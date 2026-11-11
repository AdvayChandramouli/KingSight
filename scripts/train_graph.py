"""Train the KingSight message-passing regressor and write artifacts/gnn/."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from sklearn.model_selection import train_test_split
from torch import nn

from kingsight.models.graph import (
    FEATURE_ORDER,
    HIDDEN_SIZE,
    TwoLayerGCN,
    build_training_edges,
    default_artifact_dir,
    regression_metrics,
    repo_root,
    save_gnn_artifacts,
    standardize_zipcode,
)

MAX_EPOCHS = 80
PATIENCE = 12
LEARNING_RATE = 1e-2
SEED = 42


def load_frame(root: Path) -> pd.DataFrame:
    cleaned = pd.read_csv(root / "data" / "kc_cleaned_data.csv")
    raw = pd.read_csv(root / "data" / "kc_house_data.csv", usecols=["id", "lat", "long"])
    if not np.array_equal(cleaned["id"].to_numpy(), raw["id"].to_numpy()):
        raise SystemExit("kc_cleaned_data.csv and kc_house_data.csv ids are not row-aligned")
    frame = cleaned.copy()
    frame["raw_lat"] = raw["lat"].to_numpy()
    frame["raw_long"] = raw["long"].to_numpy()
    return frame


def load_or_make_splits(n_rows: int, path: Path) -> tuple[np.ndarray, np.ndarray, np.ndarray, str]:
    if path.is_file():
        payload = json.loads(path.read_text())
        if isinstance(payload.get("indices"), dict):
            payload = {**payload, **payload["indices"]}
        def take(*keys: str) -> np.ndarray:
            for key in keys:
                if key in payload:
                    return np.asarray(payload[key], dtype=np.int64)
            raise KeyError(f"{path} is missing one of {keys}")

        train = take("train", "train_idx", "train_indices")
        val = take("val", "validation", "val_idx", "val_indices", "valid_idx")
        test = take("test", "test_idx", "test_indices")
        for name, index in ("train", train), ("val", val), ("test", test):
            if index.size and (int(index.min()) < 0 or int(index.max()) >= n_rows):
                raise SystemExit(f"{name} indices in {path} fall outside 0..{n_rows - 1}")
        return train, val, test, f"artifacts/splits.json ({path})"

    index = np.arange(n_rows)
    train, holdout = train_test_split(index, test_size=0.20, random_state=SEED)
    val, test = train_test_split(holdout, test_size=0.50, random_state=SEED)
    note = (
        "sklearn.model_selection.train_test_split random_state=42, "
        "test_size=0.20, then 50/50 val/test on the holdout"
    )
    return (
        np.asarray(train, dtype=np.int64),
        np.asarray(val, dtype=np.int64),
        np.asarray(test, dtype=np.int64),
        note,
    )


def git_head(root: Path) -> str | None:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"],
            cwd=root,
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        return None


def train() -> None:
    torch.manual_seed(SEED)
    np.random.seed(SEED)
    root = repo_root()
    frame = load_frame(root)
    features = frame.loc[:, list(FEATURE_ORDER)].to_numpy(dtype=np.float64)
    log_price = frame["log_price"].to_numpy(dtype=np.float64)
    latitudes = frame["raw_lat"].to_numpy(dtype=np.float64)
    longitudes = frame["raw_long"].to_numpy(dtype=np.float64)
    ids = np.array([str(int(value)) for value in frame["id"].to_numpy()])

    train_idx, val_idx, test_idx, split_note = load_or_make_splits(len(frame), root / "artifacts" / "splits.json")
    zip_mean = float(features[train_idx, 0].mean())
    zip_std = float(features[train_idx, 0].std())
    model_features = standardize_zipcode(features, zip_mean, zip_std)
    edge_index, edge_weight = build_training_edges(latitudes, longitudes, model_features)
    print(
        f"nodes={len(frame)} directed_edges={edge_index.shape[1]} "
        f"train={len(train_idx)} val={len(val_idx)} test={len(test_idx)}"
    )

    net = TwoLayerGCN(features.shape[1], HIDDEN_SIZE)
    train_mean = float(log_price[train_idx].mean())
    with torch.no_grad():
        # Adam steps are ~lr on a saturated gradient, so start at the train mean
        # instead of asking the head bias to walk from 0 up to ~13.
        net.head.bias.fill_(train_mean)
        nn.init.normal_(net.head.weight, std=0.01)
    optimizer = torch.optim.Adam(net.parameters(), lr=LEARNING_RATE)
    loss_fn = nn.MSELoss()
    feature_t = torch.from_numpy(np.ascontiguousarray(model_features))
    index_t = torch.from_numpy(np.ascontiguousarray(edge_index))
    weight_t = torch.from_numpy(np.ascontiguousarray(edge_weight))
    target_t = torch.from_numpy(log_price.astype(np.float32))
    train_t = torch.from_numpy(train_idx.astype(np.int64))
    val_t = torch.from_numpy(val_idx.astype(np.int64))

    best_state: dict[str, torch.Tensor] | None = None
    best_val = float("inf")
    best_epoch = 0
    waits = 0
    ran = 0
    for epoch in range(1, MAX_EPOCHS + 1):
        net.train()
        optimizer.zero_grad(set_to_none=True)
        prediction = net(feature_t, index_t, weight_t)
        loss = loss_fn(prediction[train_t], target_t[train_t])
        loss.backward()
        optimizer.step()
        ran = epoch

        net.eval()
        with torch.no_grad():
            prediction = net(feature_t, index_t, weight_t)
            val_err = prediction[val_t] - target_t[val_t]
            val_rmse = float(torch.sqrt(torch.mean(val_err**2)))
        improved = val_rmse < best_val - 1e-5
        if improved:
            best_val = val_rmse
            best_epoch = epoch
            waits = 0
            best_state = {key: value.detach().cpu().clone() for key, value in net.state_dict().items()}
        else:
            waits += 1
        if epoch == 1 or epoch % 5 == 0 or improved or waits >= PATIENCE:
            print(f"epoch {epoch:02d} train_mse={float(loss.detach()):.5f} val_rmse={val_rmse:.5f}")
        if waits >= PATIENCE:
            break

    if best_state is None:
        raise SystemExit("training did not produce a checkpoint")
    net.load_state_dict(best_state)
    net.eval()
    with torch.no_grad():
        prediction = net(feature_t, index_t, weight_t).detach().cpu().numpy()
    metrics = regression_metrics(log_price[test_idx], prediction[test_idx])
    print("test", {key: round(value, 6) for key, value in metrics.items()})

    sample = test_idx[:64]
    isolated = np.empty(sample.shape[0], dtype=np.float64)
    with torch.no_grad():
        for position, node in enumerate(sample):
            hidden = net(feature_t, index_t, weight_t, isolate=int(node))
            isolated[position] = float(hidden[int(node)])
    delta = np.abs(prediction[sample] - isolated)
    print(
        f"message_delta_p50={np.median(delta):.5f} "
        f"message_delta_frac_gt_1e-3={float(np.mean(delta > 1e-3)):.3f}"
    )

    provenance = {
        "script": "scripts/train_graph.py",
        "git_head": git_head(root),
        "split": split_note,
        "n_rows": len(frame),
        "n_train": len(train_idx),
        "n_val": len(val_idx),
        "n_test": len(test_idx),
        "n_directed_edges": int(edge_index.shape[1]),
        "seed": SEED,
        "max_epochs": MAX_EPOCHS,
        "epochs_ran": ran,
        "best_epoch": best_epoch,
        "best_val_rmse_log": best_val,
        "learning_rate": LEARNING_RATE,
        "patience": PATIENCE,
        "optimizer": "adam",
        "loss": "mse on train indices only; static graph over all homes",
        "coordinates": "raw lat/long from data/kc_house_data.csv joined by row-aligned id",
        "features": "data/kc_cleaned_data.csv in FEATURE_ORDER; zipcode standardized on the train split",
        "comparison_note": "Test metrics describe this GNN only. They are not a claim to beat XGBoost.",
        "train_log_price_mean": float(log_price[train_idx].mean()),
    }
    out = default_artifact_dir()
    save_gnn_artifacts(
        out,
        net,
        ids=ids,
        latitudes=latitudes,
        longitudes=longitudes,
        features=features,
        log_price=log_price,
        edge_index=edge_index,
        edge_weight=edge_weight,
        train_idx=train_idx,
        val_idx=val_idx,
        test_idx=test_idx,
        zip_mean=zip_mean,
        zip_std=zip_std,
        metrics=metrics,
        provenance=provenance,
    )
    print(f"wrote {out}")


if __name__ == "__main__":
    train()
