"""Z-score statistics that reproduce ``data/kc_cleaned_data.csv``.

The preprocessing notebook fit ``StandardScaler`` (population standard deviation)
on every numeric feature except zipcode, after casting half-floors and the other
integer columns with ``astype(int)``. Zipcode is stored with mean 0 and std 1 so
the same transform leaves it unchanged.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

from kingsight.data.dataset import (
    FEATURE_COLUMNS,
    default_scaler_path,
    model_input_frame,
)

_UNSCALED = frozenset({"zipcode"})


class FeatureScaler:
    def __init__(
        self,
        feature_order: list[str],
        mean: list[float],
        std: list[float],
    ) -> None:
        if not (len(feature_order) == len(mean) == len(std)):
            raise ValueError("feature_order, mean, and std must have the same length")
        if any(value == 0 for value in std):
            raise ValueError("std entries must be non-zero")
        self.feature_order = [str(column) for column in feature_order]
        self.mean = [float(value) for value in mean]
        self.std = [float(value) for value in std]

    @classmethod
    def fit(cls, raw: pd.DataFrame) -> FeatureScaler:
        matrix = model_input_frame(raw)
        scaled_columns = [column for column in FEATURE_COLUMNS if column not in _UNSCALED]
        standardizer = StandardScaler()
        standardizer.fit(matrix[scaled_columns])
        mean_by_column = {
            column: float(value) for column, value in zip(scaled_columns, standardizer.mean_, strict=True)
        }
        std_by_column = {
            column: float(value) for column, value in zip(scaled_columns, standardizer.scale_, strict=True)
        }
        mean: list[float] = []
        std: list[float] = []
        for column in FEATURE_COLUMNS:
            if column in _UNSCALED:
                mean.append(0.0)
                std.append(1.0)
            else:
                mean.append(mean_by_column[column])
                std.append(std_by_column[column])
        return cls(list(FEATURE_COLUMNS), mean, std)

    def save(self, path: Path | None = None) -> Path:
        destination = Path(path) if path is not None else default_scaler_path()
        destination.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "feature_order": self.feature_order,
            "mean": self.mean,
            "std": self.std,
            "standardizer": "sklearn.preprocessing.StandardScaler",
            "ddof": 0,
            "unscaled_features": ["zipcode"],
            "integer_cast_before_scale": [
                "bedrooms",
                "floors",
                "waterfront",
                "view",
                "condition",
                "grade",
                "yr_built",
                "yr_renovated",
            ],
        }
        destination.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        return destination

    @classmethod
    def load(cls, path: Path | None = None) -> FeatureScaler:
        source = Path(path) if path is not None else default_scaler_path()
        payload = json.loads(source.read_text(encoding="utf-8"))
        return cls(payload["feature_order"], payload["mean"], payload["std"])

    def transform_frame(self, raw_feature_frame: pd.DataFrame) -> np.ndarray:
        """Return z-scored rows shaped ``(n, 18)`` in cleaned-file space."""
        matrix = model_input_frame(raw_feature_frame)
        if list(matrix.columns) != self.feature_order:
            matrix = matrix.loc[:, self.feature_order]
        values = matrix.to_numpy(dtype=np.float64)
        mean = np.asarray(self.mean, dtype=np.float64)
        std = np.asarray(self.std, dtype=np.float64)
        return (values - mean) / std


def load_scaler(path: Path | None = None) -> FeatureScaler:
    return FeatureScaler.load(path)
