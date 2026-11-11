"""Request bodies shared by the API tests."""

from __future__ import annotations


def attributes(**overrides) -> dict:
    values = {
        "sqft_living": 1900,
        "bedrooms": 3,
        "bathrooms": 2,
        "grade": 7,
        "condition": 3,
        "yr_built": 1975,
        "waterfront": False,
    }
    values.update(overrides)
    return values


def predict_body(**overrides) -> dict:
    body = {
        "client_request_id": "req-1",
        "source": "hypothetical",
        "latitude": 47.61,
        "longitude": -122.33,
        "valuation_year": 2015,
        "attributes": attributes(),
        "model_ids": ["xgboost"],
    }
    body.update(overrides)
    return body


def property_record(property_id: str = "100", **overrides) -> dict:
    record = {
        "id": property_id,
        "latitude": 47.62,
        "longitude": -122.30,
        "zipcode": "98115",
        "sale_date": "20141013T000000",
        "actual_price_usd": 450000,
        "role": "reference_only",
        "attributes": attributes(),
        "valuation_year": 2014,
        "neighborhood_label": None,
    }
    record.update(overrides)
    return record
