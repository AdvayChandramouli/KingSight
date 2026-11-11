"""Held-out checks for the served XGBoost artifact and its SHAP explanations."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from kingsight.explain.tabular import explain_tabular
from kingsight.models.tabular import FEATURE_COLUMNS, TabularRegressor

# King County sale prices in the cleaned file span $75,000 to $7,700,000.
USD_LOW = 50_000.0
USD_HIGH = 10_000_000.0
RANDOM_STATE = 42


def _splits_path() -> Path:
    return ROOT / "artifacts" / "splits.json"


def _test_indices(n_rows: int) -> np.ndarray:
    path = _splits_path()
    if path.is_file():
        payload = json.loads(path.read_text())
        if isinstance(payload.get("splits"), dict):
            payload = {**payload, **payload["splits"]}
        for key in ("test", "test_indices", "test_idx"):
            if key in payload:
                return np.asarray(payload[key], dtype=np.int64)
    indices = np.arange(n_rows)
    _train, temp = train_test_split(indices, test_size=0.20, random_state=RANDOM_STATE)
    _val, test = train_test_split(temp, test_size=0.50, random_state=RANDOM_STATE)
    return np.asarray(test, dtype=np.int64)


@pytest.fixture(scope="module")
def frame() -> pd.DataFrame:
    return pd.read_csv(ROOT / "data" / "kc_cleaned_data.csv")


@pytest.fixture(scope="module")
def model() -> TabularRegressor:
    return TabularRegressor.load(ROOT / "artifacts" / "xgboost")


def test_predict_log_and_usd_on_a_test_row(model: TabularRegressor, frame: pd.DataFrame) -> None:
    row_index = int(_test_indices(len(frame))[0])
    features = frame.loc[row_index, FEATURE_COLUMNS].to_numpy(dtype=np.float64)
    assert features.shape == (18,)

    log_price = model.predict_log_price(features)
    log_price_batch = model.predict_log_price(features.reshape(1, 18))
    usd = model.predict_usd(features)

    assert isinstance(log_price, float)
    assert log_price == pytest.approx(log_price_batch)
    assert usd > 0
    assert USD_LOW <= usd <= USD_HIGH
    assert usd == pytest.approx(float(np.exp(log_price)))


def test_shap_additivity_on_three_test_rows(model: TabularRegressor, frame: pd.DataFrame) -> None:
    indices = _test_indices(len(frame))[:3]
    assert len(indices) >= 3
    for row_index in indices:
        features = frame.loc[int(row_index), FEATURE_COLUMNS].to_numpy(dtype=np.float64)
        explanation = explain_tabular(model, features)
        assert explanation["model_id"] == "xgboost"
        assert explanation["model_version"] == model.version
        assert explanation["scope"] == "local"
        assert explanation["method"] == "shap"
        assert explanation["output_space"] == "log_usd"
        assert len(explanation["features"]) == len(FEATURE_COLUMNS)
        magnitudes = [abs(item["contribution"]) for item in explanation["features"]]
        assert magnitudes == sorted(magnitudes, reverse=True)
        total = explanation["reference_output"] + sum(item["contribution"] for item in explanation["features"])
        assert total == pytest.approx(model.predict_log_price(features), abs=1e-3)


def test_manifest_test_metrics_meet_notebook_bar() -> None:
    manifest = json.loads((ROOT / "artifacts" / "xgboost" / "manifest.json").read_text())
    assert manifest["model_id"] == "xgboost"
    assert manifest["feature_order"] == FEATURE_COLUMNS
    assert manifest["target"] == "log_price"
    assert manifest["target_transform"] == "exp"
    assert manifest["split_seed"] == 42
    assert "scripts/train_tabular.py" in manifest["provenance"]
    assert "best_iteration" in manifest
    metrics = manifest["metrics"]
    for key in ("r2_log", "rmse_log", "mae_log", "rmse_usd", "mae_usd"):
        assert key in metrics
        assert isinstance(metrics[key], float)
    assert metrics["r2_log"] >= 0.90
    assert metrics["rmse_usd"] > 0
    assert metrics["mae_usd"] > 0
