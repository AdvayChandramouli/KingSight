"""Raw and cleaned King County frames, plus the models.ipynb split.

`load_raw()` and `load_cleaned()` share row order. Preprocessing dropped no
rows; cleaned row ``i`` is raw row ``i`` after integer casts and z-scoring.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

FEATURE_COLUMNS: list[str] = [
    "zipcode",
    "bedrooms",
    "bathrooms",
    "sqft_living",
    "sqft_lot",
    "floors",
    "sqft_above",
    "sqft_basement",
    "waterfront",
    "view",
    "condition",
    "grade",
    "yr_built",
    "yr_renovated",
    "lat",
    "long",
    "sqft_living15",
    "sqft_lot15",
]

# Columns the preprocessing notebook cast with ``astype(int)`` before scaling.
# ``floors`` values such as 1.5 become 1. That cast is part of the cleaned matrix.
INTEGER_CAST_COLUMNS: list[str] = [
    "bedrooms",
    "floors",
    "waterfront",
    "view",
    "condition",
    "grade",
    "yr_built",
    "yr_renovated",
]

RANDOM_STATE = 42

_DROP_COLUMNS = ["id", "date", "price", "log_price"]


def project_root() -> Path:
    """Directory that contains ``data/kc_house_data.csv``."""
    here = Path(__file__).resolve()
    candidates = [Path.cwd(), *here.parents]
    for candidate in candidates:
        if (candidate / "data" / "kc_house_data.csv").is_file():
            return candidate
    raise FileNotFoundError(
        "Could not find data/kc_house_data.csv from the working directory or the package path."
    )


def default_splits_path() -> Path:
    return project_root() / "artifacts" / "splits.json"


def default_scaler_path() -> Path:
    return project_root() / "artifacts" / "preprocessing" / "scaler.json"


def default_catalog_path() -> Path:
    return project_root() / "artifacts" / "catalog" / "properties.sqlite"


def raw_data_path() -> Path:
    return project_root() / "data" / "kc_house_data.csv"


def cleaned_data_path() -> Path:
    return project_root() / "data" / "kc_cleaned_data.csv"


def property_id_from_value(value: object) -> str:
    """String form of a dataset id, e.g. ``\"7129300520\"``."""
    if value is None or (isinstance(value, float) and np.isnan(value)):
        raise ValueError("property id is missing")
    if isinstance(value, str):
        return value.strip().removesuffix(".0")
    return str(int(value))


def load_raw() -> pd.DataFrame:
    """Original King County sales, in file order."""
    return pd.read_csv(raw_data_path())


def load_cleaned() -> pd.DataFrame:
    """Z-scored training matrix. Row ``i`` aligns with ``load_raw().iloc[i]``."""
    return pd.read_csv(cleaned_data_path())


def assert_frames_aligned(raw: pd.DataFrame, cleaned: pd.DataFrame) -> None:
    if len(raw) != len(cleaned):
        raise ValueError(
            f"raw has {len(raw)} rows and cleaned has {len(cleaned)} rows; they must align"
        )
    raw_ids = [property_id_from_value(value) for value in raw["id"].tolist()]
    cleaned_ids = [property_id_from_value(value) for value in cleaned["id"].tolist()]
    if raw_ids != cleaned_ids:
        raise ValueError("raw and cleaned property ids are not in the same row order")


def model_input_frame(raw: pd.DataFrame) -> pd.DataFrame:
    """Unscaled 18-column matrix in ``FEATURE_COLUMNS`` order.

    Integer casts match ``notebooks/preprocessing.ipynb`` (half-floors truncate).
    Zipcode stays on its original numeric scale; it was not passed to StandardScaler.
    """
    missing = [column for column in FEATURE_COLUMNS if column not in raw.columns]
    if missing:
        raise ValueError(f"raw frame is missing columns: {missing}")
    frame = raw.loc[:, FEATURE_COLUMNS].copy()
    for column in INTEGER_CAST_COLUMNS:
        frame[column] = frame[column].astype(int)
    zipcode = frame["zipcode"]
    if pd.api.types.is_numeric_dtype(zipcode):
        frame["zipcode"] = zipcode.astype(float)
    else:
        text = zipcode.astype(str).str.strip().str.replace(r"\.0$", "", regex=True)
        frame["zipcode"] = text.str.zfill(5).astype(float)
    return frame.astype(np.float64)


def write_splits(path: Path | None = None) -> dict:
    """Persist the models.ipynb 80/10/10 indices.

    Indices are positions in the cleaned frame, in the order
    ``train_test_split`` returns (shuffled, not sorted). ``df.iloc[splits["train"]]``
    rebuilds that training matrix.
    """
    cleaned = load_cleaned()
    features = cleaned.drop(columns=_DROP_COLUMNS)
    target = cleaned["log_price"]
    train_x, temp_x, _train_y, temp_y = train_test_split(
        features,
        target,
        test_size=0.20,
        random_state=RANDOM_STATE,
    )
    val_x, test_x, _val_y, _test_y = train_test_split(
        temp_x,
        temp_y,
        test_size=0.50,
        random_state=RANDOM_STATE,
    )
    payload = {
        "seed": RANDOM_STATE,
        "train": [int(index) for index in train_x.index],
        "val": [int(index) for index in val_x.index],
        "test": [int(index) for index in test_x.index],
    }
    destination = Path(path) if path is not None else default_splits_path()
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    return payload


def load_splits(path: Path | None = None) -> dict:
    source = Path(path) if path is not None else default_splits_path()
    payload = json.loads(source.read_text(encoding="utf-8"))
    if payload.get("seed") != RANDOM_STATE:
        raise ValueError(f"splits seed is {payload.get('seed')}, expected {RANDOM_STATE}")
    for name in ("train", "val", "test"):
        if name not in payload:
            raise ValueError(f"splits file is missing '{name}'")
        payload[name] = [int(index) for index in payload[name]]
    return payload
