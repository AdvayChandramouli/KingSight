"""Error shapes, metadata, and request validation. These do not need model artifacts."""

from __future__ import annotations

import json

import pytest

from helpers import predict_body, property_record


def test_health_and_cors(client):
    response = client.get("/health", headers={"Origin": "http://localhost:5173"})
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "data_mode": "real"}
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_metadata_contract_without_artifacts(client):
    body = client.get("/metadata").json()
    assert body["data_mode"] == "real"
    assert body["primary_model_id"] == "xgboost"
    assert body["dataset"]["currency"] == "USD"
    assert body["dataset"]["area_unit"] == "sqft"
    assert body["dataset"]["period_label"] == "May 2014–May 2015"
    assert body["dataset"]["period_start"] == "2014-05"
    assert body["dataset"]["period_end"] == "2015-05"
    assert "Kaggle" in body["dataset"]["source_label"]
    assert body["dataset"]["version"] == "kc-2014-2015"
    assert [model["id"] for model in body["models"]] == ["xgboost", "gnn"]
    assert body["models"][0]["perspective_label"] == "Property-feature model"
    assert body["models"][0]["family"] == "tabular"
    assert body["models"][1]["perspective_label"] == "Neighborhood-graph model"
    assert body["models"][1]["family"] == "graph"
    assert all(model["explanation_available"] is True for model in body["models"])
    assert [field["key"] for field in body["fields"]] == [
        "sqft_living",
        "bedrooms",
        "bathrooms",
        "grade",
        "condition",
        "yr_built",
        "waterfront",
    ]
    by_key = {field["key"]: field for field in body["fields"]}
    assert by_key["sqft_living"]["min"] <= 1900 <= by_key["sqft_living"]["max"]
    assert by_key["grade"]["min"] == 1 and by_key["grade"]["max"] == 13
    assert by_key["bathrooms"]["step"] == 0.25
    assert by_key["yr_built"]["min"] <= 1975 <= by_key["yr_built"]["max"]
    assert "training_range" in by_key["sqft_living"]
    assert len(body["coverage"]["polygon"]) >= 4
    assert len(body["coverage"]["bounds"]) == 4
    assert body["graph"]["available"] is True
    assert body["graph"]["rule_label"] == "8 nearest homes within 5 km"
    assert body["metrics"] is None
    assert body["valuation_year_range"] == {"min": 2014, "max": 2015}


def test_metrics_only_when_manifest_has_numbers(client, settings):
    settings.xgboost_dir.mkdir(parents=True)
    (settings.xgboost_dir / "manifest.json").write_text(
        json.dumps(
            {
                "version": "tb-2",
                "provenance": "scripts/train_tabular.py",
                "metrics": {"r2_log": 0.91, "rmse_usd": 120000, "note": "ignore me"},
            }
        )
    )
    settings.gnn_dir.mkdir(parents=True)
    (settings.gnn_dir / "manifest.json").write_text(
        json.dumps({"metrics": {"status": "pending"}, "rule_label": "8 nearest homes within 5 km"})
    )
    body = client.get("/metadata").json()
    assert body["metrics"] is not None
    assert {item["name"] for item in body["metrics"]} == {"r2_log", "rmse_usd"}
    assert {item["model_id"] for item in body["metrics"]} == {"xgboost"}
    assert all(item["split"] == "test" for item in body["metrics"])
    assert all(item["provenance"] == "scripts/train_tabular.py" for item in body["metrics"])
    r2 = next(item for item in body["metrics"] if item["name"] == "r2_log")
    assert r2["value"] == 0.91
    assert r2["target_scale"] == "log_usd"
    assert body["models"][0]["version"] == "tb-2"
    assert body["graph"]["rule_label"] == "8 nearest homes within 5 km"


def test_catalog_missing_is_service_unavailable(client):
    listed = client.get("/properties")
    assert listed.status_code == 503
    body = listed.json()
    assert body["code"] == "service_unavailable"
    assert body["retryable"] is True
    assert "traceback" not in body["message"].lower()
    assert "request_id" in body

    missing = client.get("/properties/no-such-home")
    assert missing.status_code == 503
    assert missing.json()["code"] == "service_unavailable"


def test_unknown_property_is_not_found(client, app):
    app.state.runtime.get_property = lambda property_id: None
    response = client.get("/properties/missing")
    assert response.status_code == 404
    body = response.json()
    assert body["code"] == "not_found"
    assert body["retryable"] is False


def test_property_query_is_forwarded(client, app):
    seen = {}

    def list_properties(**kwargs):
        seen.update(kwargs)
        return {"items": [property_record("7129300520", role="held_out_example")], "next_cursor": "24", "total": 40}

    app.state.runtime.list_properties = list_properties
    response = client.get(
        "/properties",
        params={
            "q": "712",
            "zip": "98115",
            "bbox": "-122.5,47.2,-122.1,47.8",
            "waterfront": "false",
            "min_sqft": "500",
            "max_sqft": "3000",
            "cursor": "0",
            "limit": "24",
        },
    )
    assert response.status_code == 200
    page = response.json()
    assert page["total"] == 40
    assert page["next_cursor"] == "24"
    assert page["items"][0]["id"] == "7129300520"
    assert page["items"][0]["sale_date"] == "2014-10-13"
    assert page["items"][0]["zipcode"] == "98115"
    assert "valuation_year" not in page["items"][0]
    assert seen["bbox"] == (-122.5, 47.2, -122.1, 47.8)
    assert seen["waterfront"] is False
    assert seen["q"] == "712"
    assert seen["zip"] == "98115"
    assert seen["min_sqft"] == 500
    assert seen["max_sqft"] == 3000
    assert seen["limit"] == 24


def test_invalid_bbox_and_waterfront(client):
    bbox = client.get("/properties", params={"bbox": "1,2,3"})
    assert bbox.status_code == 422
    assert bbox.json()["code"] == "invalid_input"
    assert bbox.json()["retryable"] is False
    waterfront = client.get("/properties", params={"waterfront": "maybe"})
    assert waterfront.status_code == 422
    assert waterfront.json()["code"] == "invalid_input"


def test_malformed_json_and_pydantic_errors(client):
    malformed = client.post("/predict", content="{", headers={"Content-Type": "application/json"})
    assert malformed.status_code == 400
    assert malformed.json()["code"] == "malformed_payload"
    assert malformed.json()["retryable"] is False
    assert "traceback" not in malformed.text.lower()

    missing = client.post("/predict", json={"source": "hypothetical"})
    assert missing.status_code == 422
    body = missing.json()
    assert body["code"] == "invalid_input"
    assert body["retryable"] is False
    assert set(body) <= {"code", "message", "field_errors", "retryable", "request_id"}


def test_field_errors_and_coverage(client):
    grade = client.post("/predict", json=predict_body(attributes={**predict_body()["attributes"], "grade": 14}))
    assert grade.status_code == 422
    assert grade.json()["code"] == "invalid_input"
    assert "13" in grade.json()["field_errors"]["grade"]

    year = client.post("/predict", json=predict_body(valuation_year=2016))
    assert year.status_code == 422
    assert year.json()["code"] == "invalid_input"
    assert "field_errors" not in year.json()
    assert "2014" in year.json()["message"]

    outside = client.post("/predict", json=predict_body(latitude=0, longitude=0))
    assert outside.status_code == 400
    body = outside.json()
    assert body["code"] == "out_of_coverage"
    assert body["retryable"] is False
    assert "traceback" not in json.dumps(body).lower()


def test_metadata_coverage_follows_catalog_helper(client):
    try:
        from kingsight.catalog.coverage import LABEL, bounds

        expected = [float(value) for value in bounds()]
    except Exception:
        pytest.skip("coverage helper cannot read the raw sales file")
    body = client.get("/metadata").json()
    assert body["coverage"]["label"] == LABEL
    assert body["coverage"]["bounds"] == expected
    assert body["coverage"]["polygon"][0] == body["coverage"]["polygon"][-1]


def test_invalid_catalog_cursor(client, app):
    def list_properties(**kwargs):
        raise ValueError("cursor must be an integer offset string")

    app.state.runtime.list_properties = list_properties
    response = client.get("/properties", params={"cursor": "nope"})
    assert response.status_code == 422
    assert response.json()["code"] == "invalid_input"
    assert response.json()["message"] == "That page of results is not available."


def test_unknown_route_uses_error_body(client):
    response = client.get("/missing")
    assert response.status_code == 404
    assert response.json()["code"] == "not_found"
    assert response.json()["retryable"] is False
