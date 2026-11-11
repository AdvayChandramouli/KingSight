"""Message-passing regressor for King County log sale price.

Graph rule (training and inference share these constants):

- Undirected kNN with k = 8. An undirected edge is kept when either home
  lists the other (one-way kNN, then symmetrized). Mutual kNN is not required.
- Haversine distance with earth radius 6,371,000 m. Edges longer than 5 km
  are dropped.
- Edge weight is cosine similarity of the model-space feature vectors.
  Similarities below 0 are dropped.
- API edge type is ``combined``: a neighbor must pass the 5 km geographic
  gate and is weighted by feature cosine similarity.
- Request neighbors are the query's own one-way kNN under that rule, not the
  reverse neighbors added only by symmetrization.
- Messages are incoming-degree normalized: each message is scaled by
  ``w_ij / sum_k w_ik``.
- ``zipcode`` in the public 18-vector is the raw ZIP integer stored in
  ``kc_cleaned_data.csv``. The model standardizes it with the training-split
  mean and standard deviation. The other 17 columns are already z-scored and
  are used as stored. Coordinates passed to inference are raw degrees; the
  z-scored ``lat``/``long`` columns are features, not degrees.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import torch
from sklearn.neighbors import BallTree
from torch import nn

# This CPU PyTorch build can segfault inside parallel index_add_ on the
# message aggregation, and it can misbehave with XGBoost in the same process.
# One thread keeps training and inference stable. Keep this; do not drop the GNN.
torch.set_num_threads(1)
try:
    torch.set_num_interop_threads(1)
except RuntimeError:
    pass

MODEL_ID = "gnn"
MODEL_VERSION = "gnn-1"
GRAPH_VERSION = "undirected-knn-k8-5km-cos0-v1"
RULE_LABEL = "8 nearest homes within 5 km"
DESCRIPTION = (
    "Homes are linked by an undirected 8-nearest-neighbor graph limited to a "
    "5 km haversine radius, with cosine-similarity weights and any similarity "
    "below 0 dropped; API neighbors are the query's one-way matches under that "
    "rule and use edge type combined."
)

K_NEIGHBORS = 8
RADIUS_M = 5000.0
SIMILARITY_FLOOR = 0.0
EDGE_TYPE = "combined"
EARTH_RADIUS_M = 6_371_000.0
HIDDEN_SIZE = 64
N_MESSAGE_LAYERS = 2
IG_STEPS = 32

FEATURE_ORDER: tuple[str, ...] = (
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
)
FEATURE_LABELS: dict[str, str] = {
    "zipcode": "ZIP code",
    "bedrooms": "Bedrooms",
    "bathrooms": "Bathrooms",
    "sqft_living": "Living area",
    "sqft_lot": "Lot size",
    "floors": "Floors",
    "sqft_above": "Above-ground living area",
    "sqft_basement": "Basement size",
    "waterfront": "Waterfront",
    "view": "View",
    "condition": "Condition",
    "grade": "Grade",
    "yr_built": "Year built",
    "yr_renovated": "Year renovated",
    "lat": "Latitude",
    "long": "Longitude",
    "sqft_living15": "Nearby living area",
    "sqft_lot15": "Nearby lot size",
}
ZIP_INDEX = 0
N_FEATURES = len(FEATURE_ORDER)

# Catalog hits must match the stored vector and sit on the stored coordinate.
# Float32 round-trip of these columns is far tighter than 1e-5; a real edit leaves
# the transductive embedding and is scored as a new query node.
CATALOG_FEATURE_ATOL = 1e-5
CATALOG_COORD_TOLERANCE_M = 1.0

GRAPH_RULE: dict[str, Any] = {
    "structure": "undirected_knn",
    "k": K_NEIGHBORS,
    "radius_m": RADIUS_M,
    "distance": "haversine",
    "earth_radius_m": EARTH_RADIUS_M,
    "symmetrization": (
        "One-way kNN is symmetrized: an undirected edge is kept when either "
        "endpoint lists the other. Mutual kNN is not required."
    ),
    "edge_weight": "cosine similarity of model-space features",
    "similarity_floor": SIMILARITY_FLOOR,
    "similarity_floor_note": "Edges with cosine similarity below 0 are dropped.",
    "api_edge_type": EDGE_TYPE,
    "api_edge_type_note": (
        "A returned neighbor is inside 5 km and weighted by feature cosine "
        "similarity, so edge_type is combined."
    ),
    "degree_normalization": "w_ij / sum_k w_ik (incoming weighted degree)",
    "request_neighbors": (
        "One-way k nearest existing homes from the query that pass the radius "
        "and the similarity floor, excluding the query property id."
    ),
    "training": (
        "The static graph includes every home. Loss is mean squared error on "
        "train indices only; validation indices are used for early stopping; "
        "test indices are reported separately."
    ),
    "zipcode": (
        "zipcode in the 18-vector is the raw ZIP integer from kc_cleaned_data.csv. "
        "It is standardized with the training-split mean and standard deviation "
        "before cosine weights and message passing. The other 17 inputs are used "
        "as stored."
    ),
}


def repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def default_artifact_dir() -> Path:
    return repo_root() / "artifacts" / "gnn"


def regression_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, float]:
    """Log-space fit plus USD error after exp(log_price)."""
    y_true = np.asarray(y_true, dtype=np.float64)
    y_pred = np.asarray(y_pred, dtype=np.float64)
    err = y_pred - y_true
    sst = float(np.sum((y_true - y_true.mean()) ** 2))
    r2 = float("nan") if sst == 0 else float(1.0 - np.sum(err**2) / sst)
    usd_err = np.exp(y_pred) - np.exp(y_true)
    return {
        "r2_log": r2,
        "rmse_log": float(np.sqrt(np.mean(err**2))),
        "mae_log": float(np.mean(np.abs(err))),
        "rmse_usd": float(np.sqrt(np.mean(usd_err**2))),
        "mae_usd": float(np.mean(np.abs(usd_err))),
    }


def standardize_zipcode(features: np.ndarray, zip_mean: float, zip_std: float) -> np.ndarray:
    """Return a float32 copy with column 0 replaced by the training z-score."""
    model_x = np.array(features, dtype=np.float32, copy=True)
    scale = zip_std if zip_std > 0 else 1.0
    model_x[..., ZIP_INDEX] = (model_x[..., ZIP_INDEX] - np.float32(zip_mean)) / np.float32(scale)
    return model_x


def _pair_cosine(left: np.ndarray, right: np.ndarray) -> np.ndarray:
    """Row-wise cosine. Undefined norms become -inf so the floor drops them."""
    left_norm = np.linalg.norm(left, axis=-1)
    right_norm = np.linalg.norm(right, axis=-1)
    dots = np.einsum("...f,...f->...", left, right)
    denom = left_norm * right_norm
    sims = np.full(dots.shape, -np.inf, dtype=np.float64)
    ok = denom > 1e-8
    sims[ok] = dots[ok] / denom[ok]
    return sims


def build_training_edges(
    latitude: np.ndarray,
    longitude: np.ndarray,
    model_features: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    """Symmetrized one-way kNN edges.

    Returns ``edge_index`` of shape ``(2, E)`` (source, destination) and
    ``edge_weight`` of shape ``(E,)``. Each undirected pair is stored in both
    directions with the same cosine weight.
    """
    latitude = np.asarray(latitude, dtype=np.float64)
    longitude = np.asarray(longitude, dtype=np.float64)
    model_features = np.asarray(model_features, dtype=np.float32)
    n_nodes = latitude.shape[0]
    if n_nodes == 0:
        return np.zeros((2, 0), dtype=np.int64), np.zeros((0,), dtype=np.float32)

    k_query = min(K_NEIGHBORS + 1, n_nodes)
    coords = np.radians(np.column_stack([latitude, longitude]))
    _dist_rad, index = BallTree(coords, metric="haversine").query(coords, k=k_query)
    dist_m = _dist_rad * EARTH_RADIUS_M
    if k_query == 1:
        return np.zeros((2, 0), dtype=np.int64), np.zeros((0,), dtype=np.float32)

    neighbors = index[:, 1:]
    distances = dist_m[:, 1:]
    gathered = model_features[neighbors]
    own = np.repeat(model_features[:, None, :], neighbors.shape[1], axis=1)
    similarity = _pair_cosine(own, gathered)
    keep = (distances <= RADIUS_M) & (similarity >= SIMILARITY_FLOOR)
    source = np.repeat(np.arange(n_nodes, dtype=np.int64), neighbors.shape[1])[keep.ravel()]
    dest = neighbors.ravel()[keep.ravel()].astype(np.int64, copy=False)
    weight = similarity.ravel()[keep.ravel()].astype(np.float32, copy=False)
    distinct = source != dest
    source, dest, weight = source[distinct], dest[distinct], weight[distinct]
    if source.size == 0:
        return np.zeros((2, 0), dtype=np.int64), np.zeros((0,), dtype=np.float32)

    left = np.minimum(source, dest)
    right = np.maximum(source, dest)
    order = np.lexsort((right, left))
    left, right, weight = left[order], right[order], weight[order]
    pair_key = left * np.int64(n_nodes) + right
    _unique, first = np.unique(pair_key, return_index=True)
    left, right, weight = left[first], right[first], weight[first]
    edge_index = np.vstack(
        [
            np.concatenate([left, right]),
            np.concatenate([right, left]),
        ]
    ).astype(np.int64, copy=False)
    edge_weight = np.concatenate([weight, weight]).astype(np.float32, copy=False)
    return edge_index, edge_weight


class DegreeNormMP(nn.Module):
    """Self transform plus incoming messages scaled by ``w_ij / deg_i``."""

    def __init__(self, in_dim: int, out_dim: int) -> None:
        super().__init__()
        self.self_lin = nn.Linear(in_dim, out_dim)
        self.msg_lin = nn.Linear(in_dim, out_dim, bias=False)

    def forward(
        self,
        features: torch.Tensor,
        edge_index: torch.Tensor,
        edge_weight: torch.Tensor,
        isolate: int | None = None,
    ) -> torch.Tensor:
        out_dim = self.self_lin.out_features
        aggregated = features.new_zeros((features.shape[0], out_dim))
        if edge_index.numel() > 0:
            source, dest = edge_index[0], edge_index[1]
            degree = features.new_zeros(features.shape[0])
            degree.index_add_(0, dest, edge_weight)
            scale = edge_weight / degree[dest].clamp_min(1e-8)
            messages = self.msg_lin(features)[source] * scale.unsqueeze(-1)
            aggregated = aggregated.index_add(0, dest, messages)
        if isolate is not None:
            mask = aggregated.new_ones((aggregated.shape[0], 1))
            mask[isolate] = 0
            aggregated = aggregated * mask
        return self.self_lin(features) + aggregated


class TwoLayerGCN(nn.Module):
    """Two degree-normalized message-passing layers and a linear head."""

    def __init__(self, in_dim: int = N_FEATURES, hidden: int = HIDDEN_SIZE) -> None:
        super().__init__()
        self.in_dim = in_dim
        self.hidden = hidden
        self.layer1 = DegreeNormMP(in_dim, hidden)
        self.layer2 = DegreeNormMP(hidden, hidden)
        self.head = nn.Linear(hidden, 1)

    def forward(
        self,
        features: torch.Tensor,
        edge_index: torch.Tensor,
        edge_weight: torch.Tensor,
        isolate: int | None = None,
    ) -> torch.Tensor:
        hidden = torch.relu(self.layer1(features, edge_index, edge_weight, isolate))
        hidden = torch.relu(self.layer2(hidden, edge_index, edge_weight, isolate))
        return self.head(hidden).squeeze(-1)


def _as_feature_vector(features: np.ndarray) -> np.ndarray:
    vector = np.asarray(features, dtype=np.float64).reshape(-1)
    if vector.shape != (N_FEATURES,):
        raise ValueError(f"features must have shape ({N_FEATURES},), got {tuple(np.asarray(features).shape)}")
    return vector


def _haversine_m(lat1: float, lon1: float, lat2: np.ndarray | float, lon2: np.ndarray | float) -> np.ndarray:
    lat1_r, lon1_r = np.radians(lat1), np.radians(lon1)
    lat2_r, lon2_r = np.radians(lat2), np.radians(lon2)
    dlat = lat2_r - lat1_r
    dlon = lon2_r - lon1_r
    a = np.sin(dlat / 2.0) ** 2 + np.cos(lat1_r) * np.cos(lat2_r) * np.sin(dlon / 2.0) ** 2
    return EARTH_RADIUS_M * 2.0 * np.arcsin(np.minimum(1.0, np.sqrt(a)))


class GraphRegressor:
    """Transductive GNN with an inductive query node for edited homes."""

    model_id = MODEL_ID
    version: str = MODEL_VERSION
    graph_version: str = GRAPH_VERSION
    rule_label: str = RULE_LABEL
    description: str = DESCRIPTION

    def __init__(self, artifact_dir: Path) -> None:
        manifest_path = artifact_dir / "manifest.json"
        nodes_path = artifact_dir / "nodes.npz"
        weights_path = artifact_dir / "model.pt"
        for path in (manifest_path, nodes_path, weights_path):
            if not path.is_file():
                raise FileNotFoundError(
                    f"Missing {path}. Train the graph model with scripts/train_graph.py."
                )
        manifest = json.loads(manifest_path.read_text())
        blob = np.load(nodes_path)
        checkpoint = torch.load(weights_path, map_location="cpu", weights_only=True)

        self.artifact_dir = artifact_dir
        self.manifest = manifest
        self.version = str(manifest["version"])
        self.graph_version = str(manifest["graph_version"])
        self.rule_label = str(manifest["rule_label"])
        self.description = str(manifest["description"])
        self.zip_mean = float(manifest["zipcode_mean"])
        self.zip_std = float(manifest["zipcode_std"])

        self.ids = np.array([str(value) for value in blob["ids"]])
        self.latitudes = blob["lat"].astype(np.float64, copy=False)
        self.longitudes = blob["lon"].astype(np.float64, copy=False)
        self.features = blob["features"].astype(np.float32, copy=False)
        self.log_price = blob["log_price"].astype(np.float64, copy=False)
        self.edge_index = blob["edge_index"].astype(np.int64, copy=False)
        self.edge_weight = blob["edge_weight"].astype(np.float32, copy=False)
        self.train_idx = blob["train_idx"].astype(np.int64, copy=False)
        self.val_idx = blob["val_idx"].astype(np.int64, copy=False)
        self.test_idx = blob["test_idx"].astype(np.int64, copy=False)
        self.model_features = standardize_zipcode(self.features, self.zip_mean, self.zip_std)

        hidden = int(checkpoint.get("hidden", manifest.get("hidden_size", HIDDEN_SIZE)))
        in_dim = int(checkpoint.get("in_dim", N_FEATURES))
        self.net = TwoLayerGCN(in_dim, hidden)
        self.net.load_state_dict(checkpoint["state_dict"])
        self.net.eval()

        coords = np.radians(np.column_stack([self.latitudes, self.longitudes]))
        self._tree = BallTree(coords, metric="haversine")
        id_to_indices: dict[str, list[int]] = {}
        for index, node_id in enumerate(self.ids.tolist()):
            id_to_indices.setdefault(node_id, []).append(index)
        self._id_to_indices = id_to_indices
        self._cached_log_price = self._forward_numpy(self.model_features, self.edge_index, self.edge_weight)

    @classmethod
    def load(cls, artifact_dir: Path | None = None) -> GraphRegressor:
        return cls(Path(artifact_dir) if artifact_dir is not None else default_artifact_dir())

    def predict_log_price(
        self,
        features: np.ndarray,
        latitude: float,
        longitude: float,
        property_id: str | None = None,
    ) -> float:
        """Predict natural log of USD price.

        A catalog id whose stored feature vector and raw coordinate match the
        request uses that node's trained embedding. Any other id, feature edit,
        or coordinate edit adds a query node and runs message passing.
        """
        pack = self._pack(features, latitude, longitude, property_id)
        if pack["catalog"]:
            return float(self._cached_log_price[pack["target"]])
        prediction = self._forward_numpy(pack["x"], pack["edge_index"], pack["edge_weight"])
        return float(prediction[pack["target"]])

    def predict_usd(
        self,
        features: np.ndarray,
        latitude: float,
        longitude: float,
        property_id: str | None = None,
    ) -> float:
        return float(np.exp(self.predict_log_price(features, latitude, longitude, property_id)))

    def neighbors(
        self,
        features: np.ndarray,
        latitude: float,
        longitude: float,
        property_id: str | None = None,
        limit: int = 12,
    ) -> list[dict[str, Any]]:
        """One-way kNN neighbors for this request, capped by ``limit``."""
        vector = _as_feature_vector(features)
        node_id = None if property_id is None else str(property_id)
        query = standardize_zipcode(vector, self.zip_mean, self.zip_std)
        found = self._query_neighbors(query, float(latitude), float(longitude), node_id, K_NEIGHBORS)
        rows: list[dict[str, Any]] = []
        for index, meters, _weight in found[: max(0, int(limit))]:
            rows.append(
                {
                    "id": self.ids[index],
                    "distance_meters": float(meters),
                    "edge_type": EDGE_TYPE,
                }
            )
        return rows

    def _match_catalog(
        self,
        property_id: str | None,
        features: np.ndarray,
        latitude: float,
        longitude: float,
    ) -> int | None:
        if property_id is None:
            return None
        for index in self._id_to_indices.get(property_id, []):
            stored = self.features[index].astype(np.float64, copy=False)
            if float(np.max(np.abs(stored - features))) > CATALOG_FEATURE_ATOL:
                continue
            distance = float(_haversine_m(latitude, longitude, self.latitudes[index], self.longitudes[index]))
            if distance <= CATALOG_COORD_TOLERANCE_M:
                return index
        return None

    def _query_neighbors(
        self,
        model_features: np.ndarray,
        latitude: float,
        longitude: float,
        exclude_id: str | None,
        max_neighbors: int,
    ) -> list[tuple[int, float, float]]:
        n_nodes = len(self.ids)
        if n_nodes == 0 or max_neighbors <= 0:
            return []
        k_search = min(n_nodes, max(max_neighbors + 16, 32))
        point = np.radians([[latitude, longitude]])
        dist_rad, index = self._tree.query(point, k=k_search)
        query_norm = float(np.linalg.norm(model_features))
        found: list[tuple[int, float, float]] = []
        for radians, node in zip(dist_rad[0], index[0], strict=True):
            meters = float(radians * EARTH_RADIUS_M)
            if meters > RADIUS_M:
                break
            node = int(node)
            if exclude_id is not None and self.ids[node] == exclude_id:
                continue
            neighbor = self.model_features[node]
            neighbor_norm = float(np.linalg.norm(neighbor))
            if query_norm <= 1e-8 or neighbor_norm <= 1e-8:
                continue
            similarity = float(np.dot(model_features, neighbor) / (query_norm * neighbor_norm))
            if similarity < SIMILARITY_FLOOR:
                continue
            found.append((node, meters, similarity))
            if len(found) >= max_neighbors:
                break
        found.sort(key=lambda item: (item[1], self.ids[item[0]]))
        return found

    def _pack(
        self,
        features: np.ndarray,
        latitude: float,
        longitude: float,
        property_id: str | None,
    ) -> dict[str, Any]:
        vector = _as_feature_vector(features)
        node_id = None if property_id is None else str(property_id)
        matched = self._match_catalog(node_id, vector, float(latitude), float(longitude))
        if matched is not None:
            incoming = int(np.count_nonzero(self.edge_index[1] == matched)) if self.edge_index.size else 0
            return {
                "x": self.model_features,
                "edge_index": self.edge_index,
                "edge_weight": self.edge_weight,
                "target": matched,
                "catalog": True,
                "neighbor_count": incoming,
            }

        query = standardize_zipcode(vector, self.zip_mean, self.zip_std)
        found = self._query_neighbors(query, float(latitude), float(longitude), node_id, K_NEIGHBORS)
        stacked = np.vstack([self.model_features, query.reshape(1, -1)])
        target = self.model_features.shape[0]
        if not found:
            return {
                "x": stacked,
                "edge_index": self.edge_index,
                "edge_weight": self.edge_weight,
                "target": target,
                "catalog": False,
                "neighbor_count": 0,
            }
        nodes = np.array([index for index, _meters, _weight in found], dtype=np.int64)
        weights = np.array([weight for _index, _meters, weight in found], dtype=np.float32)
        query_ids = np.full(nodes.shape[0], target, dtype=np.int64)
        extra_index = np.vstack(
            [
                np.concatenate([nodes, query_ids]),
                np.concatenate([query_ids, nodes]),
            ]
        )
        extra_weight = np.concatenate([weights, weights])
        return {
            "x": stacked,
            "edge_index": np.concatenate([self.edge_index, extra_index], axis=1),
            "edge_weight": np.concatenate([self.edge_weight, extra_weight]),
            "target": target,
            "catalog": False,
            "neighbor_count": len(found),
        }

    def _forward_numpy(
        self,
        features: np.ndarray,
        edge_index: np.ndarray,
        edge_weight: np.ndarray,
        isolate: int | None = None,
    ) -> np.ndarray:
        self.net.eval()
        feature_t = torch.from_numpy(np.ascontiguousarray(features, dtype=np.float32))
        index_t = torch.from_numpy(np.ascontiguousarray(edge_index, dtype=np.int64))
        weight_t = torch.from_numpy(np.ascontiguousarray(edge_weight, dtype=np.float32))
        with torch.no_grad():
            prediction = self.net(feature_t, index_t, weight_t, isolate)
        return prediction.detach().cpu().numpy().astype(np.float64, copy=False)

    def attribution(self, features: np.ndarray, latitude: float, longitude: float, property_id: str | None) -> dict[str, Any]:
        """Additive log-price parts for :func:`kingsight.explain.graph.explain_graph`."""
        pack = self._pack(features, latitude, longitude, property_id)
        vector = _as_feature_vector(features)
        reference, gradients, connected, prediction = self._integrated_gradients(pack)
        contributions = [
            {
                "key": name,
                "label": FEATURE_LABELS[name],
                "value": float(vector[index]),
                "contribution": float(gradients[index]),
            }
            for index, name in enumerate(FEATURE_ORDER)
        ]
        contributions.sort(key=lambda item: abs(item["contribution"]), reverse=True)
        contributions.insert(
            0,
            {
                "key": "connected_homes",
                "label": "Connected homes",
                "value": int(pack["neighbor_count"]),
                "contribution": float(connected),
            },
        )
        return {
            "model_id": self.model_id,
            "model_version": self.version,
            "scope": "local",
            "method": (
                f"{IG_STEPS}-step trapezoidal integrated gradients of the neighbor-isolated "
                "self-path from the zero vector, plus the log-price delta from restoring "
                "degree-normalized neighbor messages; the integration residual is folded "
                "into connected_homes"
            ),
            "output_space": "log_usd",
            "reference_output": float(reference),
            "prediction_log_price": float(prediction),
            "features": contributions,
        }

    def _integrated_gradients(self, pack: dict[str, Any]) -> tuple[float, np.ndarray, float, float]:
        target = int(pack["target"])
        features = torch.from_numpy(np.ascontiguousarray(pack["x"], dtype=np.float32))
        edge_index = torch.from_numpy(np.ascontiguousarray(pack["edge_index"], dtype=np.int64))
        edge_weight = torch.from_numpy(np.ascontiguousarray(pack["edge_weight"], dtype=np.float32))
        target_row = features[target].detach().clone()
        steps = IG_STEPS
        grads: list[torch.Tensor] = []
        self.net.eval()
        for step in range(steps):
            alpha = step / (steps - 1)
            varied = features.detach().clone()
            varied[target] = alpha * target_row
            varied.requires_grad_(True)
            isolated = self.net(varied, edge_index, edge_weight, isolate=target)[target]
            grad = torch.autograd.grad(isolated, varied)[0][target]
            grads.append(grad.detach())
        stacked = torch.stack(grads, dim=0)
        intervals = steps - 1
        trapezoid = 0.5 * stacked[0] + stacked[1:-1].sum(dim=0) + 0.5 * stacked[-1]
        integrated = (target_row * (trapezoid / intervals)).detach().cpu().numpy().astype(np.float64)

        with torch.no_grad():
            full = float(self.net(features, edge_index, edge_weight, isolate=None)[target])
            isolated_value = float(self.net(features, edge_index, edge_weight, isolate=target)[target])
            baseline_features = features.clone()
            baseline_features[target] = 0
            reference = float(self.net(baseline_features, edge_index, edge_weight, isolate=target)[target])
        connected = full - isolated_value
        residual = full - (reference + float(integrated.sum()) + connected)
        connected += residual
        return reference, integrated, connected, full


def save_gnn_artifacts(
    artifact_dir: Path,
    net: TwoLayerGCN,
    *,
    ids: np.ndarray,
    latitudes: np.ndarray,
    longitudes: np.ndarray,
    features: np.ndarray,
    log_price: np.ndarray,
    edge_index: np.ndarray,
    edge_weight: np.ndarray,
    train_idx: np.ndarray,
    val_idx: np.ndarray,
    test_idx: np.ndarray,
    zip_mean: float,
    zip_std: float,
    metrics: dict[str, float],
    provenance: dict[str, Any],
) -> None:
    """Write ``manifest.json``, ``model.pt``, and ``nodes.npz``."""
    artifact_dir.mkdir(parents=True, exist_ok=True)
    manifest = {
        "model_id": MODEL_ID,
        "version": MODEL_VERSION,
        "graph_version": GRAPH_VERSION,
        "rule_label": RULE_LABEL,
        "description": DESCRIPTION,
        "k": K_NEIGHBORS,
        "radius_m": RADIUS_M,
        "similarity_floor": SIMILARITY_FLOOR,
        "edge_type": EDGE_TYPE,
        "earth_radius_m": EARTH_RADIUS_M,
        "hidden_size": net.hidden,
        "n_message_layers": N_MESSAGE_LAYERS,
        "degree_normalization": GRAPH_RULE["degree_normalization"],
        "feature_order": list(FEATURE_ORDER),
        "target": "log_price",
        "target_note": "Natural log of USD sale price. USD = exp(log_price).",
        "zipcode_mean": zip_mean,
        "zipcode_std": zip_std,
        "graph_rule": GRAPH_RULE,
        "metrics": metrics,
        "provenance": provenance,
    }
    (artifact_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    torch.save(
        {"state_dict": net.state_dict(), "in_dim": net.in_dim, "hidden": net.hidden},
        artifact_dir / "model.pt",
    )
    np.savez_compressed(
        artifact_dir / "nodes.npz",
        ids=np.asarray(ids).astype("U20"),
        lat=np.asarray(latitudes, dtype=np.float64),
        lon=np.asarray(longitudes, dtype=np.float64),
        features=np.asarray(features, dtype=np.float32),
        log_price=np.asarray(log_price, dtype=np.float64),
        edge_index=np.asarray(edge_index, dtype=np.int64),
        edge_weight=np.asarray(edge_weight, dtype=np.float32),
        train_idx=np.asarray(train_idx, dtype=np.int64),
        val_idx=np.asarray(val_idx, dtype=np.int64),
        test_idx=np.asarray(test_idx, dtype=np.int64),
    )
