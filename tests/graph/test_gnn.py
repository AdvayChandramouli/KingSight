"""Checks for the message-passing regressor and its saved artifacts."""

from __future__ import annotations

import json
import math
import subprocess
import tempfile
from pathlib import Path

import numpy as np
import pytest
import torch

from kingsight.explain.graph import explain_graph
from kingsight.models.graph import (
    DESCRIPTION,
    EDGE_TYPE,
    FEATURE_ORDER,
    K_NEIGHBORS,
    RADIUS_M,
    RULE_LABEL,
    SIMILARITY_FLOOR,
    DegreeNormMP,
    GraphRegressor,
    build_training_edges,
    default_artifact_dir,
    regression_metrics,
)

ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture(scope="module")
def model() -> GraphRegressor:
    return GraphRegressor.load()


def test_degree_normalization_matches_weighted_incoming_mean() -> None:
    layer = DegreeNormMP(2, 2)
    with torch.no_grad():
        layer.msg_lin.weight.copy_(torch.eye(2))
        layer.self_lin.weight.zero_()
        layer.self_lin.bias.zero_()
    features = torch.tensor([[1.0, 0.0], [0.0, 1.0], [1.0, 1.0]])
    edge_index = torch.tensor([[1, 2], [0, 0]])
    edge_weight = torch.tensor([1.0, 3.0])
    output = layer(features, edge_index, edge_weight)
    assert torch.allclose(output[0], torch.tensor([0.75, 1.0]))
    isolated = layer(features, edge_index, edge_weight, isolate=0)
    assert torch.allclose(isolated[0], torch.zeros(2))


def test_toy_edges_respect_radius_and_similarity_floor() -> None:
    km = 1000.0 / 111_195.0
    latitude = 47.6 + km * np.array([0.0, 2.0, 4.0, -4.0, 6.0])
    longitude = np.full(5, -122.3)
    features = np.zeros((5, 18), dtype=np.float32)
    features[:, 1] = 1.0
    features[3, 1] = -1.0
    edge_index, edge_weight = build_training_edges(latitude, longitude, features)
    pairs = {tuple(sorted((int(src), int(dst)))) for src, dst in zip(edge_index[0], edge_index[1], strict=True)}
    assert (0, 1) in pairs
    assert (0, 2) in pairs
    assert (0, 3) not in pairs
    assert (0, 4) not in pairs
    assert np.all(edge_weight >= SIMILARITY_FLOOR)


def test_manifest_records_the_graph_rule() -> None:
    manifest = json.loads((default_artifact_dir() / "manifest.json").read_text())
    assert manifest["model_id"] == "gnn"
    assert manifest["k"] == K_NEIGHBORS
    assert manifest["radius_m"] == RADIUS_M
    assert manifest["similarity_floor"] == SIMILARITY_FLOOR
    assert manifest["rule_label"] == RULE_LABEL
    assert manifest["description"] == DESCRIPTION
    assert manifest["edge_type"] == EDGE_TYPE
    assert manifest["feature_order"] == list(FEATURE_ORDER)
    for key in ("r2_log", "rmse_log", "mae_log", "rmse_usd", "mae_usd"):
        assert key in manifest["metrics"]
    assert "provenance" in manifest
    assert (default_artifact_dir() / "model.pt").is_file()
    assert (default_artifact_dir() / "nodes.npz").is_file()


def test_saved_edges_stay_inside_the_radius(model: GraphRegressor) -> None:
    source = model.edge_index[0]
    dest = model.edge_index[1]
    assert source.size > 0
    step = max(1, source.size // 4000)
    chosen = np.arange(0, source.size, step)
    distance = _pairwise_meters(
        model.latitudes[source[chosen]],
        model.longitudes[source[chosen]],
        model.latitudes[dest[chosen]],
        model.longitudes[dest[chosen]],
    )
    assert float(distance.max()) <= RADIUS_M + 1.0
    assert np.all(model.edge_weight[chosen] >= SIMILARITY_FLOOR - 1e-5)
    # Symmetrized: every directed edge has its reverse.
    reverse = {(int(dst), int(src)) for src, dst in zip(source[chosen], dest[chosen], strict=True)}
    forward = {(int(src), int(dst)) for src, dst in zip(source, dest, strict=True)}
    assert reverse <= forward


def test_catalog_prediction_changes_when_features_or_coordinates_change(model: GraphRegressor) -> None:
    feature_shifts = []
    coordinate_shifts = []
    for index in model.test_idx[:12]:
        features = model.features[index].astype(np.float64).copy()
        latitude = float(model.latitudes[index])
        longitude = float(model.longitudes[index])
        property_id = model.ids[index]
        base = model.predict_log_price(features, latitude, longitude, property_id)
        edited = features.copy()
        edited[FEATURE_ORDER.index("sqft_living")] += 3.0
        edited[FEATURE_ORDER.index("grade")] += 2.0
        feature_shifts.append(
            abs(model.predict_log_price(edited, latitude, longitude, property_id) - base)
        )
        coordinate_shifts.append(
            abs(model.predict_log_price(features, latitude + 0.5, longitude + 0.5, property_id) - base)
        )
        assert math.isclose(
            model.predict_usd(features, latitude, longitude, property_id),
            math.exp(base),
            rel_tol=1e-6,
            abs_tol=1e-6,
        )
    assert max(feature_shifts) > 1e-3
    assert max(coordinate_shifts) > 1e-3


def test_neighbors_follow_the_combined_rule(model: GraphRegressor) -> None:
    index = int(model.test_idx[0])
    features = model.features[index]
    latitude = float(model.latitudes[index])
    longitude = float(model.longitudes[index])
    property_id = str(model.ids[index])
    rows = model.neighbors(features, latitude, longitude, property_id, limit=12)
    again = model.neighbors(features, latitude, longitude, property_id, limit=12)
    assert rows == again
    assert 1 <= len(rows) <= K_NEIGHBORS
    assert len(model.neighbors(features, latitude, longitude, property_id, limit=1)) == 1
    for row in rows:
        assert row["id"] != property_id
        assert isinstance(row["id"], str)
        assert row["edge_type"] == "combined"
        assert 0.0 <= row["distance_meters"] <= RADIUS_M


def test_explanation_is_additive_in_log_price(model: GraphRegressor) -> None:
    index = int(model.test_idx[3])
    features = model.features[index].astype(np.float64)
    latitude = float(model.latitudes[index])
    longitude = float(model.longitudes[index])
    property_id = str(model.ids[index])
    prediction = model.predict_log_price(features, latitude, longitude, property_id)
    explanation = explain_graph(model, features, latitude, longitude, property_id)
    assert explanation["output_space"] == "log_usd"
    connected = next(item for item in explanation["features"] if item["key"] == "connected_homes")
    assert connected["label"] == "Connected homes"
    assert "integrated gradients" in explanation["method"]
    total = explanation["reference_output"] + sum(item["contribution"] for item in explanation["features"])
    assert abs(total - prediction) < 2e-2

    edited = features.copy()
    edited[FEATURE_ORDER.index("sqft_living")] += 2.5
    moved = explain_graph(model, edited, latitude + 0.2, longitude, property_id)
    moved_total = moved["reference_output"] + sum(item["contribution"] for item in moved["features"])
    moved_prediction = model.predict_log_price(edited, latitude + 0.2, longitude, property_id)
    assert abs(moved_total - moved_prediction) < 2e-2


def test_held_out_metrics_and_difference_from_tabular_or_mean(model: GraphRegressor) -> None:
    manifest = json.loads((default_artifact_dir() / "manifest.json").read_text())
    prediction = np.array(
        [
            model.predict_log_price(
                model.features[index],
                float(model.latitudes[index]),
                float(model.longitudes[index]),
                str(model.ids[index]),
            )
            for index in model.test_idx
        ]
    )
    metrics = regression_metrics(model.log_price[model.test_idx], prediction)
    for key in ("r2_log", "rmse_log", "mae_log"):
        assert metrics[key] == pytest.approx(manifest["metrics"][key], abs=1e-4)
    for key in ("rmse_usd", "mae_usd"):
        assert metrics[key] == pytest.approx(manifest["metrics"][key], rel=1e-4)

    sample = model.test_idx[:30]
    gnn = prediction[:30]
    other, source = _tabular_or_mean(
        np.asarray(model.features[sample], dtype=np.float32),
        float(manifest["provenance"]["train_log_price_mean"]),
    )
    gaps = np.abs(gnn - other)
    assert np.any(gaps > 1e-3), f"GNN matched {source} on all 30 sampled test rows"


def _tabular_or_mean(features: np.ndarray, train_mean: float) -> tuple[np.ndarray, str]:
    """Score XGBoost in a process that has not imported torch.

    Loading the booster beside torch segfaults on this machine (two OpenMP
    runtimes). The project virtualenv can score the saved model on its own.
    """
    booster_path = ROOT / "artifacts" / "xgboost" / "model.json"
    python = ROOT / ".venv" / "bin" / "python"
    if booster_path.is_file() and python.is_file():
        with tempfile.TemporaryDirectory() as tmp:
            feature_path = Path(tmp) / "features.npy"
            output_path = Path(tmp) / "predictions.npy"
            np.save(feature_path, features)
            script = "\n".join(
                [
                    "import numpy as np",
                    "import xgboost as xgb",
                    f"names = {list(FEATURE_ORDER)!r}",
                    "booster = xgb.Booster()",
                    f"booster.load_model({str(booster_path)!r})",
                    f"frame = np.load({str(feature_path)!r})",
                    "pred = booster.predict(xgb.DMatrix(frame, feature_names=names))",
                    f"np.save({str(output_path)!r}, pred)",
                ]
            )
            subprocess.run([str(python), "-c", script], check=True)
            return np.load(output_path).astype(np.float64), "xgboost"
    return np.full(features.shape[0], train_mean, dtype=np.float64), "train mean"


def _pairwise_meters(
    lat1: np.ndarray,
    lon1: np.ndarray,
    lat2: np.ndarray,
    lon2: np.ndarray,
) -> np.ndarray:
    from kingsight.models.graph import EARTH_RADIUS_M

    lat1_r, lon1_r, lat2_r, lon2_r = map(np.radians, (lat1, lon1, lat2, lon2))
    dlat = lat2_r - lat1_r
    dlon = lon2_r - lon1_r
    a = np.sin(dlat / 2.0) ** 2 + np.cos(lat1_r) * np.cos(lat2_r) * np.sin(dlon / 2.0) ** 2
    return EARTH_RADIUS_M * 2.0 * np.arcsin(np.minimum(1.0, np.sqrt(a)))
