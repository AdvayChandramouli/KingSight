"""Build one 18-dimensional vector in cleaned-file z-score space.

``existing`` and ``edited`` start from the unscaled property row (the dict
returned by ``CatalogStore.get_raw_features``). UI attributes overwrite that
row. Latitude and longitude stay on the record for both of those sources, so
an edited request cannot move the home.

When living area changes, ``sqft_above`` is recomputed as
``max(0, sqft_living - sqft_basement)``. Basement stays on the recorded value.

``hypothetical`` uses the seven UI attributes plus the request coordinates.
Hidden fields are imputed and each one is named in ``warnings``:

- ``floors=1``, ``view=0``, ``sqft_basement=0``, ``yr_renovated=0``
- ``sqft_above=sqft_living``, ``sqft_living15=sqft_living``
- ``sqft_lot`` is the global median raw lot size
- ``zipcode`` is the zipcode of the nearest catalog home by haversine
  (all sales rows, stable first-minimum on row order)
- ``sqft_lot15`` is the median raw ``sqft_lot`` of that ZIP, or the global
  median when the ZIP cannot be resolved
"""

from __future__ import annotations

from functools import lru_cache

import numpy as np
import pandas as pd

from kingsight.data.dataset import FEATURE_COLUMNS, load_raw, property_id_from_value
from kingsight.data.scaler import FeatureScaler

_UI_FIELDS = (
    "sqft_living",
    "bedrooms",
    "bathrooms",
    "grade",
    "condition",
    "yr_built",
    "waterfront",
)

_SOURCES = frozenset({"existing", "edited", "hypothetical"})


class _ImputationIndex:
    def __init__(self) -> None:
        raw = load_raw()
        self.latitudes = raw["lat"].to_numpy(dtype=np.float64)
        self.longitudes = raw["long"].to_numpy(dtype=np.float64)
        self.zipcodes = tuple(_zip_key(value) for value in raw["zipcode"].tolist())
        self.global_lot_median = float(raw["sqft_lot"].median())
        zip_labels = pd.Series(self.zipcodes, index=raw.index)
        grouped = raw.groupby(zip_labels, sort=False)["sqft_lot"].median()
        self.lot_median_by_zip = {str(zipcode): float(median) for zipcode, median in grouped.items()}


@lru_cache(maxsize=1)
def _imputation_index() -> _ImputationIndex:
    return _ImputationIndex()


def _zip_key(value: object) -> str:
    if isinstance(value, str):
        return value.strip().removesuffix(".0").zfill(5)
    return str(int(float(value))).zfill(5)


def _nearest_zipcode(latitude: float, longitude: float) -> str:
    index = _imputation_index()
    lat1 = np.radians(float(latitude))
    lon1 = np.radians(float(longitude))
    lat2 = np.radians(index.latitudes)
    lon2 = np.radians(index.longitudes)
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    haversine_a = np.sin(dlat / 2.0) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2.0) ** 2
    nearest = int(np.argmin(haversine_a))
    return index.zipcodes[nearest]


def _normalize_raw_row(raw_row: dict) -> dict:
    row = dict(raw_row)
    if "lat" not in row and "latitude" in row:
        row["lat"] = row["latitude"]
    if "long" not in row and "longitude" in row:
        row["long"] = row["longitude"]
    return row


def _require_raw_row(source: str, raw_row: dict | None) -> dict:
    if raw_row is None:
        raise ValueError(f"{source} features require raw_row from the property record")
    row = _normalize_raw_row(raw_row)
    missing = [column for column in FEATURE_COLUMNS if column not in row or row[column] is None]
    if missing:
        raise ValueError(f"raw_row is missing unscaled columns: {missing}")
    return row


def _overlay_attributes(values: dict[str, float], attributes: dict, warnings: list[str]) -> None:
    old_living = float(values["sqft_living"])
    living_was_sent = "sqft_living" in attributes and attributes["sqft_living"] is not None
    for key in _UI_FIELDS:
        if key not in attributes or attributes[key] is None:
            continue
        if key == "waterfront":
            values[key] = 1.0 if bool(attributes[key]) else 0.0
        else:
            values[key] = float(attributes[key])
    if living_was_sent and float(values["sqft_living"]) != old_living:
        basement = float(values["sqft_basement"])
        values["sqft_above"] = max(0.0, float(values["sqft_living"]) - basement)
        warnings.append(
            "Recomputed sqft_above as sqft_living minus the recorded sqft_basement, "
            "floored at 0, because living area changed."
        )


def _scaled_vector(values: dict[str, float], scaler: FeatureScaler) -> np.ndarray:
    frame = pd.DataFrame([{column: values[column] for column in FEATURE_COLUMNS}])
    vector = scaler.transform_frame(frame)[0]
    if vector.shape != (len(FEATURE_COLUMNS),):
        raise RuntimeError(f"expected a vector of length {len(FEATURE_COLUMNS)}, got {vector.shape}")
    return vector


def _ids_match(property_id: str, raw_id: object) -> bool:
    try:
        return property_id_from_value(property_id) == property_id_from_value(raw_id)
    except (TypeError, ValueError):
        return str(property_id) == str(raw_id)


def assemble_features(
    *,
    source: str,
    property_id: str | None,
    latitude: float,
    longitude: float,
    attributes: dict,
    raw_row: dict | None,
    scaler: FeatureScaler,
) -> tuple[np.ndarray, list[str]]:
    if source not in _SOURCES:
        raise ValueError(f"source must be one of {sorted(_SOURCES)}")
    warnings: list[str] = []

    if source in {"existing", "edited"}:
        row = _require_raw_row(source, raw_row)
        if (
            property_id is not None
            and row.get("id") is not None
            and not _ids_match(property_id, row["id"])
        ):
            warnings.append(
                f"property_id {property_id} does not match raw_row id {row['id']}; "
                "features were assembled from raw_row."
            )
        values = {column: float(row[column]) for column in FEATURE_COLUMNS}
        _overlay_attributes(values, attributes, warnings)
        values["lat"] = float(row["lat"])
        values["long"] = float(row["long"])
        return _scaled_vector(values, scaler), warnings

    missing = [key for key in _UI_FIELDS if key not in attributes or attributes[key] is None]
    if missing:
        raise ValueError(f"hypothetical attributes missing {missing}")

    index = _imputation_index()
    zipcode = _nearest_zipcode(latitude, longitude)
    lot_median = index.lot_median_by_zip.get(zipcode)
    if lot_median is None:
        lot_median = index.global_lot_median
        lot_warning = (
            f"Imputed sqft_lot15 as the global median sqft_lot ({lot_median:g}) "
            f"because ZIP {zipcode} has no catalog homes."
        )
    else:
        lot_warning = (
            f"Imputed sqft_lot15 as the median sqft_lot of ZIP {zipcode} ({lot_median:g})."
        )
    living = float(attributes["sqft_living"])
    values = {
        "zipcode": float(zipcode),
        "bedrooms": float(attributes["bedrooms"]),
        "bathrooms": float(attributes["bathrooms"]),
        "sqft_living": living,
        "sqft_lot": index.global_lot_median,
        "floors": 1.0,
        "sqft_above": living,
        "sqft_basement": 0.0,
        "waterfront": 1.0 if bool(attributes["waterfront"]) else 0.0,
        "view": 0.0,
        "condition": float(attributes["condition"]),
        "grade": float(attributes["grade"]),
        "yr_built": float(attributes["yr_built"]),
        "yr_renovated": 0.0,
        "lat": float(latitude),
        "long": float(longitude),
        "sqft_living15": living,
        "sqft_lot15": float(lot_median),
    }
    warnings.extend(
        [
            (
                f"Imputed zipcode as {zipcode} from the nearest catalog home by haversine distance."
            ),
            "Imputed floors as 1.",
            "Imputed view as 0.",
            "Imputed sqft_basement as 0.",
            "Imputed yr_renovated as 0.",
            "Imputed sqft_above as sqft_living.",
            "Imputed sqft_living15 as sqft_living.",
            f"Imputed sqft_lot as the global median lot size ({index.global_lot_median:g}).",
            lot_warning,
        ]
    )
    return _scaled_vector(values, scaler), warnings
