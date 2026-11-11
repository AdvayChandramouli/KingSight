"""Prediction idempotency and partial model failure, using a fake runtime."""

from __future__ import annotations

from kingsight.api.runtime import Unavailable
from helpers import predict_body, property_record

FEATURES = [0.0] * 18
IMPUTED = "Imputed lot size, floors, view, basement size, renovation year, and ZIP code from defaults."


def _install_models(app, *, graph="ok"):
    calls = {"assemble": 0}

    def assemble(**kwargs):
        calls["assemble"] += 1
        warnings = [IMPUTED] if kwargs["source"] == "hypothetical" else []
        return FEATURES, warnings

    def predict_tabular(features):
        assert len(features) == 18
        return "tb-1", 425_000.0

    def predict_graph(features, latitude, longitude, property_id):
        if graph == "unavailable":
            raise Unavailable("gnn")
        if graph == "error":
            raise RuntimeError("secret stack trace from the graph model")
        return "gnn-1", 510_000.0

    app.state.runtime.assemble = assemble
    app.state.runtime.predict_tabular = predict_tabular
    app.state.runtime.predict_graph = predict_graph
    return calls


def test_idempotent_hypothetical_includes_imputation_warning(client, app):
    calls = _install_models(app)
    first = client.post("/predict", json=predict_body())
    second = client.post("/predict", json=predict_body())
    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json() == second.json()
    assert calls["assemble"] == 1
    body = first.json()
    assert body["data_mode"] == "real"
    assert body["dataset_version"] == "kc-2014-2015"
    assert body["client_request_id"] == "req-1"
    assert len(body["input_fingerprint"]) == 64
    assert body["generated_at"].endswith("Z")
    assert body["results"] == [
        {"model_id": "xgboost", "version": "tb-1", "status": "success", "predicted_price_usd": 425_000.0}
    ]
    assert any("imput" in warning.lower() for warning in body["warnings"])
    assert "Traceback" not in first.text


def test_same_client_id_does_not_recompute_when_models_change(client, app):
    calls = _install_models(app, graph="ok")
    original = predict_body(model_ids=["xgboost", "gnn"])
    first = client.post("/predict", json=original)
    replay = client.post("/predict", json={**original, "model_ids": ["xgboost"]})
    assert first.status_code == 200
    assert replay.json()["prediction_id"] == first.json()["prediction_id"]
    assert [item["model_id"] for item in replay.json()["results"]] == ["xgboost", "gnn"]
    assert calls["assemble"] == 1
    prices = [item["predicted_price_usd"] for item in first.json()["results"]]
    assert prices == [425_000.0, 510_000.0]


def test_partial_failure_is_http_200(client, app):
    _install_models(app, graph="error")
    response = client.post("/predict", json=predict_body(model_ids=["xgboost", "gnn"]))
    assert response.status_code == 200
    body = response.json()
    by_id = {item["model_id"]: item for item in body["results"]}
    assert by_id["xgboost"]["status"] == "success"
    assert by_id["gnn"]["status"] == "error"
    assert by_id["gnn"]["predicted_price_usd"] is None
    assert "secret" not in by_id["gnn"]["message"]
    assert "traceback" not in by_id["gnn"]["message"].lower()


def test_all_models_unavailable_is_model_failure(client, app):
    def assemble(**kwargs):
        return FEATURES, [IMPUTED]

    def predict_tabular(features):
        raise Unavailable("missing booster")

    app.state.runtime.assemble = assemble
    app.state.runtime.predict_tabular = predict_tabular
    response = client.post("/predict", json=predict_body(model_ids=["xgboost", "xgboost"]))
    assert response.status_code == 503
    body = response.json()
    assert body["code"] == "model_failure"
    assert body["retryable"] is True
    assert "results" not in body
    assert "missing booster" not in response.text
    assert "traceback" not in response.text.lower()


def test_existing_unknown_property(client, app):
    app.state.runtime.raw_features = lambda property_id: None
    response = client.post(
        "/predict",
        json=predict_body(source="existing", property_id="nope", client_request_id="missing-home"),
    )
    assert response.status_code == 404
    assert response.json()["code"] == "not_found"
    assert response.json()["retryable"] is False


def test_edited_uses_record_coordinates(client, app):
    seen = {}

    def raw_features(property_id):
        return {"id": property_id, "lat": 47.55, "long": -122.2}

    def assemble(**kwargs):
        return FEATURES, []

    def predict_graph(features, latitude, longitude, property_id):
        seen["latitude"] = latitude
        seen["longitude"] = longitude
        seen["property_id"] = property_id
        return "gnn-1", 300_000.0

    app.state.runtime.raw_features = raw_features
    app.state.runtime.assemble = assemble
    app.state.runtime.predict_graph = predict_graph
    response = client.post(
        "/predict",
        json=predict_body(
            source="edited",
            property_id="home-9",
            latitude=47.7,
            longitude=-122.4,
            model_ids=["gnn"],
            client_request_id="edited-1",
        ),
    )
    assert response.status_code == 200
    assert seen == {"latitude": 47.55, "longitude": -122.2, "property_id": "home-9"}


def test_explanation_and_neighbors(client, app):
    _install_models(app, graph="ok")
    app.state.runtime.raw_features = lambda property_id: {"id": property_id, "lat": 47.61, "long": -122.33}
    created = client.post(
        "/predict",
        json=predict_body(source="existing", property_id="home-1", model_ids=["xgboost", "gnn"], client_request_id="exp-1"),
    )
    assert created.status_code == 200
    prediction_id = created.json()["prediction_id"]

    def explain(model_id, features, latitude, longitude, property_id):
        assert model_id == "xgboost"
        assert property_id == "home-1"
        return {
            "model_version": "tb-1",
            "method": "shap",
            "output_space": "log_usd",
            "reference_output": 12.8,
            "features": [
                {"key": "grade", "label": "Grade", "value": 0.25, "contribution": 0.4},
                {"key": "sqft_living", "label": "Living area", "value": "1900", "contribution": -0.1},
            ],
        }

    def query_neighbors(features, latitude, longitude, property_id):
        assert property_id == "home-1"
        return (
            "graph-3",
            "8 nearest homes within 5 km",
            [
                {"id": "home-1", "distance_meters": 0, "edge_type": "combined"},
                {"id": "neighbor-1", "distance_meters": 50, "edge_type": "knn"},
                {"id": "missing", "distance_meters": 80, "edge_type": "weird"},
            ],
        )

    def lookup_neighbor(property_id):
        if property_id == "neighbor-1":
            return property_record("neighbor-1", role="reference_only")
        return None

    app.state.runtime.explain = explain
    app.state.runtime.query_neighbors = query_neighbors
    app.state.runtime.lookup_neighbor = lookup_neighbor

    explanation = client.get(f"/predictions/{prediction_id}/explanation", params={"model_id": "xgboost"})
    assert explanation.status_code == 200
    explained = explanation.json()
    assert explained["prediction_id"] == prediction_id
    assert explained["scope"] == "local"
    assert explained["output_space"] == "log_usd"
    assert explained["model_version"] == "tb-1"
    assert explained["features"][0]["contribution"] == 0.4

    neighbor = client.get(f"/predictions/{prediction_id}/neighbors")
    assert neighbor.status_code == 200
    context = neighbor.json()
    assert context["graph_version"] == "graph-3"
    assert context["rule_label"] == "8 nearest homes within 5 km"
    assert [item["property"]["id"] for item in context["neighbors"]] == ["neighbor-1"]
    assert context["neighbors"][0]["property"]["role"] == "reference_only"
    assert context["neighbors"][0]["edge_type"] == "combined"
    assert context["neighbors"][0]["distance_meters"] >= 0

    missing = client.get("/predictions/does-not-exist/explanation", params={"model_id": "xgboost"})
    assert missing.status_code == 404
    assert missing.json()["code"] == "not_found"

    gone = client.get("/predictions/does-not-exist/neighbors")
    assert gone.status_code == 404
    assert gone.json()["code"] == "not_found"
