"""Local explanation for the neighborhood graph regressor.

The decomposition is additive in log price. ``reference_output`` is the
neighbor-isolated network at a zero feature vector. Feature contributions are
integrated gradients of that isolated path. ``connected_homes`` is the change
from restoring degree-normalized neighbor messages, plus the small integration
residual so the parts sum to the prediction.
"""

from __future__ import annotations

from typing import Any

import numpy as np

from kingsight.models.graph import GraphRegressor


def explain_graph(
    model: GraphRegressor,
    features: np.ndarray,
    latitude: float,
    longitude: float,
    property_id: str | None = None,
) -> dict[str, Any]:
    """Explain one log-price prediction.

    Returns ``output_space`` ``log_usd`` and a ``connected_homes`` contribution
    labeled ``Connected homes``. ``reference_output`` plus the contributions
    equals ``predict_log_price`` up to floating-point error.
    """
    parts = model.attribution(features, latitude, longitude, property_id)
    parts.pop("prediction_log_price", None)
    return parts
