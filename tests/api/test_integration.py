"""Live catalog and model checks. Skipped until sibling artifacts exist."""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from kingsight.api.main import app
from kingsight.api.settings import load_settings
from helpers import attributes


def _settings():
    return load_settings()


def _catalog_ready() -> bool:
    return _settings().catalog_path.is_file()


def _xgboost_ready() -> bool:
    settings = _settings()
    model = (settings.xgboost_dir / "model.json").is_file() or (settings.xgboost_dir / "model.ubj").is_file()
    return model and settings.scaler_path.is_file()


@pytest.mark.skipif(not _catalog_ready(), reason="catalog sqlite is not built")
def test_live_property_page_matches_schema():
    client = TestClient(app)
    response = client.get("/properties", params={"limit": 5})
    assert response.status_code == 200, response.text
    page = response.json()
    assert isinstance(page["items"], list)
    assert page["total"] is None or isinstance(page["total"], int)
    if not page["items"]:
        pytest.skip("catalog returned no held-out properties")
    item = page["items"][0]
    assert item["role"] == "held_out_example"
    detail = client.get(f"/properties/{item['id']}")
    assert detail.status_code == 200, detail.text
    body = detail.json()
    assert body["id"] == item["id"]
    assert isinstance(body["valuation_year"], int)
    assert "neighborhood_label" in body


@pytest.mark.skipif(not _xgboost_ready(), reason="xgboost artifact or scaler is not built")
def test_live_xgboost_predict_returns_usd():
    client = TestClient(app)
    response = client.post(
        "/predict",
        json={
            "client_request_id": f"live-{uuid.uuid4().hex}",
            "source": "hypothetical",
            "latitude": 47.61,
            "longitude": -122.33,
            "valuation_year": 2015,
            "attributes": attributes(),
            "model_ids": ["xgboost"],
        },
    )
    if response.status_code == 503:
        pytest.skip(response.json().get("message", "model stack not ready"))
    assert response.status_code == 200, response.text
    result = response.json()["results"][0]
    if result["status"] != "success":
        pytest.skip(result.get("message", "xgboost unavailable"))
    assert result["predicted_price_usd"] > 0
    assert any("imput" in warning.lower() for warning in response.json()["warnings"])
