"""Catalog, split, and feature-assembly checks for the M1 contract."""

from __future__ import annotations

import numpy as np
import pytest

from kingsight.catalog.coverage import in_coverage, polygon
from kingsight.catalog.store import CatalogStore
from kingsight.data.dataset import (
    FEATURE_COLUMNS,
    load_cleaned,
    load_raw,
    load_splits,
    write_splits,
)
from kingsight.data.scaler import FeatureScaler, load_scaler
from kingsight.features.assemble import assemble_features

_UI = (
    "sqft_living",
    "bedrooms",
    "bathrooms",
    "grade",
    "condition",
    "yr_built",
    "waterfront",
)


@pytest.fixture(scope="module")
def built(tmp_path_factory):
    root = tmp_path_factory.mktemp("catalog")
    raw = load_raw()
    cleaned = load_cleaned()
    splits_path = root / "splits.json"
    splits = write_splits(splits_path)
    scaler = FeatureScaler.fit(raw)
    scaler_path = root / "scaler.json"
    scaler.save(scaler_path)
    store = CatalogStore.build_from_frames(
        raw,
        cleaned,
        splits,
        root / "properties.sqlite",
    )
    return {
        "raw": raw,
        "cleaned": cleaned,
        "splits": load_splits(splits_path),
        "scaler": load_scaler(scaler_path),
        "store": store,
    }


def _ui_attributes(row) -> dict:
    return {
        "sqft_living": float(row["sqft_living"]),
        "bedrooms": float(row["bedrooms"]),
        "bathrooms": float(row["bathrooms"]),
        "grade": float(row["grade"]),
        "condition": float(row["condition"]),
        "yr_built": float(row["yr_built"]),
        "waterfront": bool(int(row["waterfront"])),
    }


def _raw_feature_row(raw, index: int) -> dict:
    row = raw.iloc[index]
    payload = {column: row[column] for column in FEATURE_COLUMNS}
    payload["id"] = str(int(row["id"]))
    return payload


def test_split_is_eighty_ten_ten(built):
    splits = built["splits"]
    train, val, test = splits["train"], splits["val"], splits["test"]
    assert splits["seed"] == 42
    assert (len(train), len(val), len(test)) == (17290, 2161, 2162)
    assert len(train) / 21613 == pytest.approx(0.80, abs=0.01)
    assert len(val) / 21613 == pytest.approx(0.10, abs=0.01)
    assert len(test) / 21613 == pytest.approx(0.10, abs=0.01)
    covered = set(train) | set(val) | set(test)
    assert covered == set(range(21613))
    assert len(covered) == len(train) + len(val) + len(test)


def test_scaler_matches_cleaned_row(built):
    raw = built["raw"]
    cleaned = built["cleaned"]
    scaler = built["scaler"]
    assert scaler.feature_order == FEATURE_COLUMNS
    transformed = scaler.transform_frame(raw.loc[:, FEATURE_COLUMNS])
    expected = cleaned.loc[:, FEATURE_COLUMNS].to_numpy(dtype=np.float64)
    np.testing.assert_allclose(transformed[0], expected[0], atol=1e-4, rtol=0)
    np.testing.assert_allclose(transformed, expected, atol=1e-4, rtol=0)


def test_list_properties_excludes_train_ids(built):
    raw = built["raw"]
    splits = built["splits"]
    store = built["store"]
    page = store.list_properties(limit=len(splits["test"]))
    assert page["total"] == len(splits["test"])
    assert page["next_cursor"] is None
    assert len(page["items"]) == len(splits["test"])
    assert {item["role"] for item in page["items"]} == {"held_out_example"}

    listed_ids = {item["id"] for item in page["items"]}
    train_ids = {str(int(raw.iloc[index]["id"])) for index in splits["train"]}
    test_ids = {str(int(raw.iloc[index]["id"])) for index in splits["test"]}
    train_only = train_ids - test_ids
    assert train_only
    assert listed_ids.isdisjoint(train_only)

    first = store.list_properties(limit=24)
    assert first["next_cursor"] == "24"
    second = store.list_properties(limit=24, cursor=first["next_cursor"])
    assert first["items"][0]["id"] != second["items"][0]["id"] or (
        first["items"][0]["latitude"] != second["items"][0]["latitude"]
    )
    assert first["total"] == second["total"] == len(splits["test"])


def test_get_property_returns_raw_living_area(built):
    raw = built["raw"]
    splits = built["splits"]
    store = built["store"]
    test_index = splits["test"][0]
    row = raw.iloc[test_index]
    property_id = str(int(row["id"]))
    detail = store.get_property(property_id)
    assert detail is not None
    assert detail["attributes"]["sqft_living"] == int(row["sqft_living"])
    assert abs(detail["attributes"]["sqft_living"]) > 50
    assert isinstance(detail["attributes"]["waterfront"], bool)
    assert detail["latitude"] == pytest.approx(float(row["lat"]))
    assert detail["sale_date"] == f"{str(row['date'])[:4]}-{str(row['date'])[4:6]}-{str(row['date'])[6:8]}"
    assert detail["neighborhood_label"] is None
    assert detail["valuation_year"] == int(str(row["date"])[:4])
    assert detail["actual_price_usd"] == int(row["price"])

    train_index = next(
        index
        for index in splits["train"]
        if str(int(raw.iloc[index]["id"])) not in {
            str(int(raw.iloc[other]["id"])) for other in splits["test"]
        }
    )
    train_id = str(int(raw.iloc[train_index]["id"]))
    reference = store.get_property(train_id)
    assert reference is not None
    assert reference["role"] == "reference_only"
    assert reference["attributes"]["sqft_living"] == int(raw.iloc[train_index]["sqft_living"])
    listed = store.list_properties(q=train_id, limit=50)
    assert all(item["id"] != train_id for item in listed["items"])

    features = store.get_raw_features(train_id)
    assert features is not None
    assert features["sqft_living"] == pytest.approx(float(raw.iloc[train_index]["sqft_living"]))
    assert features["id"] == train_id
    assert "lat" in features and "long" in features and "zipcode" in features


def test_hypothetical_assemble_emits_warnings(built):
    scaler = built["scaler"]
    raw = built["raw"]
    vector, warnings = assemble_features(
        source="hypothetical",
        property_id=None,
        latitude=float(raw.iloc[0]["lat"]),
        longitude=float(raw.iloc[0]["long"]),
        attributes=_ui_attributes(raw.iloc[0]),
        raw_row=None,
        scaler=scaler,
    )
    assert vector.shape == (18,)
    text = " ".join(warnings)
    for field in (
        "zipcode",
        "floors",
        "view",
        "sqft_basement",
        "yr_renovated",
        "sqft_above",
        "sqft_living15",
        "sqft_lot",
        "sqft_lot15",
    ):
        assert field in text
    assert len(warnings) >= 9


def test_edited_overlay_changes_only_requested_fields(built):
    raw = built["raw"]
    cleaned = built["cleaned"]
    scaler = built["scaler"]
    index = 0
    raw_row = _raw_feature_row(raw, index)
    attributes = _ui_attributes(raw.iloc[index])
    property_id = raw_row["id"]

    existing, _existing_warnings = assemble_features(
        source="existing",
        property_id=property_id,
        latitude=0.0,
        longitude=0.0,
        attributes=attributes,
        raw_row=raw_row,
        scaler=scaler,
    )
    expected = cleaned.iloc[index][FEATURE_COLUMNS].to_numpy(dtype=np.float64)
    np.testing.assert_allclose(existing, expected, atol=1e-4, rtol=0)

    edited_attributes = dict(attributes)
    edited_attributes["bedrooms"] = attributes["bedrooms"] + 1
    edited, _edited_warnings = assemble_features(
        source="edited",
        property_id=property_id,
        latitude=1.0,
        longitude=2.0,
        attributes=edited_attributes,
        raw_row=raw_row,
        scaler=scaler,
    )
    changed = [
        FEATURE_COLUMNS[position]
        for position in np.where(np.abs(existing - edited) > 1e-8)[0]
    ]
    assert changed == ["bedrooms"]
    bedrooms_index = FEATURE_COLUMNS.index("bedrooms")
    mean = scaler.mean[bedrooms_index]
    std = scaler.std[bedrooms_index]
    assert edited[bedrooms_index] == pytest.approx((edited_attributes["bedrooms"] - mean) / std)

    living_attributes = dict(attributes)
    living_attributes["sqft_living"] = attributes["sqft_living"] + 100
    living, living_warnings = assemble_features(
        source="edited",
        property_id=property_id,
        latitude=47.0,
        longitude=-122.0,
        attributes=living_attributes,
        raw_row=raw_row,
        scaler=scaler,
    )
    living_changed = {
        FEATURE_COLUMNS[position]
        for position in np.where(np.abs(existing - living) > 1e-8)[0]
    }
    assert living_changed == {"sqft_living", "sqft_above"}
    assert any("sqft_above" in warning for warning in living_warnings)


def test_coverage_contains_sales_and_rejects_far_points(built):
    raw = built["raw"]
    assert in_coverage(float(raw["lat"].min()), float(raw["long"].min()))
    assert in_coverage(float(raw["lat"].max()), float(raw["long"].max()))
    assert not in_coverage(0.0, 0.0)
    ring = polygon()
    assert ring[0] == ring[-1]
    assert len(ring) == 5
