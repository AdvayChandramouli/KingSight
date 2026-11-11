"""Served XGBoost regressor for King County sale price.

Features are already z-scored. The target is ``log_price`` (natural log of USD),
so dollar predictions are ``exp(log_price)``.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from xgboost import XGBRegressor

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

MODEL_ID = "xgboost"


def default_artifact_dir() -> Path:
    """Directory that holds ``model.json`` and ``manifest.json``."""
    packaged = Path(__file__).resolve().parents[3] / "artifacts" / "xgboost"
    cwd = Path.cwd() / "artifacts" / "xgboost"
    for candidate in (cwd, packaged):
        if (candidate / "manifest.json").is_file():
            return candidate
    return packaged if packaged.is_dir() else cwd


class TabularRegressor:
    """XGBoost booster trained on z-scored King County features."""

    def __init__(
        self,
        model: XGBRegressor,
        *,
        feature_order: list[str],
        version: str,
    ) -> None:
        self._model = model
        self.feature_order = list(feature_order)
        self.version = version

    @classmethod
    def load(cls, artifact_dir: Path | None = None) -> TabularRegressor:
        directory = Path(artifact_dir) if artifact_dir is not None else default_artifact_dir()
        manifest_path = directory / "manifest.json"
        model_path = directory / "model.json"
        if not manifest_path.is_file() or not model_path.is_file():
            raise FileNotFoundError(
                f"XGBoost artifacts not found in {directory} (expected model.json and manifest.json)."
            )
        manifest = json.loads(manifest_path.read_text())
        feature_order = list(manifest["feature_order"])
        version = str(manifest.get("model_version", manifest.get("version", "unknown")))
        model = XGBRegressor()
        model.load_model(model_path)
        loaded = cls(model, feature_order=feature_order, version=version)
        best = manifest.get("best_iteration")
        if best is not None:
            loaded._model.get_booster().best_iteration = int(best)
        return loaded

    def predict_log_price(self, features: np.ndarray) -> float:
        frame = self._frame(features)
        prediction = self._model.predict(frame)
        return float(prediction[0])

    def predict_usd(self, features: np.ndarray) -> float:
        return float(np.exp(self.predict_log_price(features)))

    def _frame(self, features: np.ndarray) -> pd.DataFrame:
        row = np.asarray(features, dtype=np.float64)
        if row.ndim == 2 and row.shape[0] == 1:
            row = row.reshape(-1)
        if row.ndim != 1 or row.shape[0] != len(self.feature_order):
            raise ValueError(
                f"features must have shape ({len(self.feature_order)},) or (1, {len(self.feature_order)}), "
                f"got {tuple(np.asarray(features).shape)}"
            )
        return pd.DataFrame([row], columns=self.feature_order)
