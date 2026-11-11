"""Train the notebook XGBoost baseline and write artifacts/xgboost/.

Features in data/kc_cleaned_data.csv are already z-scored. Do not scale again.
Target is log_price (natural log of USD). Dollar metrics use exp, not expm1.

If artifacts/splits.json exists, those indices are the train/val/test split.
Otherwise the notebook split is recomputed (seed 42, 80/10/10).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from xgboost import XGBRegressor

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from kingsight.models.tabular import FEATURE_COLUMNS

DATA_PATH = ROOT / "data" / "kc_cleaned_data.csv"
SPLITS_PATH = ROOT / "artifacts" / "splits.json"
ARTIFACT_DIR = ROOT / "artifacts" / "xgboost"
RANDOM_STATE = 42
TARGET = "log_price"
MODEL_VERSION = "1.0.0"

HYPERPARAMETERS = {
    "n_estimators": 500,
    "learning_rate": 0.05,
    "max_depth": 6,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "early_stopping_rounds": 50,
    "random_state": RANDOM_STATE,
    "n_jobs": -1,
}


def main() -> None:
    frame = pd.read_csv(DATA_PATH)
    missing = [name for name in [*FEATURE_COLUMNS, TARGET, "price"] if name not in frame.columns]
    if missing:
        raise SystemExit(f"{DATA_PATH} is missing columns: {missing}")

    features = frame.loc[:, FEATURE_COLUMNS]
    target = frame[TARGET].to_numpy(dtype=np.float64)
    train_idx, val_idx, test_idx = resolve_indices(len(frame))

    model = XGBRegressor(**HYPERPARAMETERS)
    model.fit(
        features.iloc[train_idx],
        target[train_idx],
        eval_set=[(features.iloc[val_idx], target[val_idx])],
        verbose=False,
    )

    log_pred = model.predict(features.iloc[test_idx])
    log_true = target[test_idx]
    usd_pred = np.exp(log_pred)
    usd_true = np.exp(log_true)
    metrics = {
        "split": "test",
        "r2_log": float(r2_score(log_true, log_pred)),
        "rmse_log": float(np.sqrt(mean_squared_error(log_true, log_pred))),
        "mae_log": float(mean_absolute_error(log_true, log_pred)),
        "rmse_usd": float(np.sqrt(mean_squared_error(usd_true, usd_pred))),
        "mae_usd": float(mean_absolute_error(usd_true, usd_pred)),
    }

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    model_path = ARTIFACT_DIR / "model.json"
    model.save_model(model_path)
    manifest = {
        "model_id": "xgboost",
        "model_version": MODEL_VERSION,
        "feature_order": list(FEATURE_COLUMNS),
        "hyperparameters": HYPERPARAMETERS,
        "best_iteration": int(model.best_iteration),
        "target": TARGET,
        "target_transform": "exp",
        "metrics": metrics,
        "split_seed": RANDOM_STATE,
        "provenance": "scripts/train_tabular.py",
    }
    (ARTIFACT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(
        f"test R2={metrics['r2_log']:.6f} "
        f"RMSE_log={metrics['rmse_log']:.6f} MAE_log={metrics['mae_log']:.6f} "
        f"RMSE_usd={metrics['rmse_usd']:.2f} MAE_usd={metrics['mae_usd']:.2f} "
        f"best_iteration={manifest['best_iteration']}"
    )
    print(f"wrote {model_path}")


def resolve_indices(n_rows: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    if SPLITS_PATH.is_file():
        train_idx, val_idx, test_idx = read_splits(SPLITS_PATH)
        print(f"using indices from {SPLITS_PATH}")
    else:
        train_idx, val_idx, test_idx = notebook_split(n_rows)
        print("artifacts/splits.json missing; recomputed notebook 80/10/10 split")
    _check_indices(train_idx, val_idx, test_idx, n_rows=n_rows)
    return train_idx, val_idx, test_idx


def notebook_split(n_rows: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    indices = np.arange(n_rows)
    train_idx, temp_idx = train_test_split(indices, test_size=0.20, random_state=RANDOM_STATE)
    val_idx, test_idx = train_test_split(temp_idx, test_size=0.50, random_state=RANDOM_STATE)
    return (
        np.asarray(train_idx, dtype=np.int64),
        np.asarray(val_idx, dtype=np.int64),
        np.asarray(test_idx, dtype=np.int64),
    )


def read_splits(path: Path) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    payload = json.loads(path.read_text())
    if isinstance(payload.get("splits"), dict):
        payload = {**payload, **payload["splits"]}
    key_sets = (
        ("train", "val", "test"),
        ("train", "validation", "test"),
        ("train_indices", "val_indices", "test_indices"),
        ("train_indices", "validation_indices", "test_indices"),
        ("train_idx", "val_idx", "test_idx"),
        ("train_idx", "validation_idx", "test_idx"),
    )
    for train_key, val_key, test_key in key_sets:
        if train_key in payload and val_key in payload and test_key in payload:
            return (
                np.asarray(payload[train_key], dtype=np.int64),
                np.asarray(payload[val_key], dtype=np.int64),
                np.asarray(payload[test_key], dtype=np.int64),
            )
    raise SystemExit(
        f"Unrecognized {path} schema. Top-level keys: {sorted(payload) if isinstance(payload, dict) else type(payload)}"
    )


def _check_indices(*groups: np.ndarray, n_rows: int) -> None:
    train_idx, val_idx, test_idx = groups
    for name, idx in (("train", train_idx), ("val", val_idx), ("test", test_idx)):
        if idx.size == 0:
            raise SystemExit(f"{name} split is empty")
        if int(idx.min()) < 0 or int(idx.max()) >= n_rows:
            raise SystemExit(f"{name} indices fall outside 0..{n_rows - 1}")
    stacked = np.concatenate([train_idx, val_idx, test_idx])
    if np.unique(stacked).size != stacked.size:
        raise SystemExit("train/val/test indices overlap")


if __name__ == "__main__":
    main()
