"""Local SHAP explanations for the tabular XGBoost regressor.

Contributions are in ``log_usd`` (natural log of USD). They add back to the
model output: ``reference_output + sum(contributions) ≈ predict_log_price``.
"""

from __future__ import annotations

import numpy as np
import shap

from kingsight.models.tabular import MODEL_ID, TabularRegressor

HUMAN_LABELS: dict[str, str] = {
    "zipcode": "ZIP code",
    "bedrooms": "Bedrooms",
    "bathrooms": "Bathrooms",
    "sqft_living": "Living area",
    "sqft_lot": "Lot size",
    "floors": "Floors",
    "sqft_above": "Above-ground area",
    "sqft_basement": "Basement area",
    "waterfront": "Waterfront",
    "view": "View",
    "condition": "Condition",
    "grade": "Grade",
    "yr_built": "Year built",
    "yr_renovated": "Year renovated",
    "lat": "Latitude",
    "long": "Longitude",
    "sqft_living15": "Neighbor living area",
    "sqft_lot15": "Neighbor lot size",
}


def explain_tabular(model: TabularRegressor, features: np.ndarray) -> dict:
    """Explain one z-scored feature vector with SHAP TreeExplainer."""
    row = _row(model, features)
    explainer = shap.TreeExplainer(model._model)
    shap_values = np.asarray(explainer.shap_values(row), dtype=np.float64)
    if shap_values.ndim == 2:
        shap_values = shap_values[0]
    contributions = shap_values.reshape(-1)
    if contributions.shape[0] != len(model.feature_order):
        raise RuntimeError(
            f"SHAP returned {contributions.shape[0]} values for {len(model.feature_order)} features."
        )
    reference = float(np.asarray(explainer.expected_value, dtype=np.float64).reshape(-1)[0])
    explained = []
    for key, value, contribution in zip(model.feature_order, row.reshape(-1), contributions, strict=True):
        explained.append(
            {
                "key": key,
                "label": HUMAN_LABELS.get(key, key),
                "value": float(value),
                "contribution": float(contribution),
            }
        )
    explained.sort(key=lambda item: abs(item["contribution"]), reverse=True)
    return {
        "model_id": MODEL_ID,
        "model_version": model.version,
        "scope": "local",
        "method": "shap",
        "output_space": "log_usd",
        "reference_output": reference,
        "features": explained,
    }


def _row(model: TabularRegressor, features: np.ndarray) -> np.ndarray:
    row = np.asarray(features, dtype=np.float64)
    if row.ndim == 2 and row.shape[0] == 1:
        row = row.reshape(-1)
    if row.ndim != 1 or row.shape[0] != len(model.feature_order):
        raise ValueError(
            f"features must have shape ({len(model.feature_order)},) or (1, {len(model.feature_order)}), "
            f"got {tuple(np.asarray(features).shape)}"
        )
    return row.reshape(1, -1)
