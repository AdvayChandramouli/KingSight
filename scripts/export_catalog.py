"""Write the locked split, scaler statistics, and SQLite property catalog.

Run from the repository root:

    PYTHONPATH=src uv run python scripts/export_catalog.py
"""

from __future__ import annotations

import numpy as np

from kingsight.catalog.store import CatalogStore
from kingsight.data.dataset import (
    FEATURE_COLUMNS,
    assert_frames_aligned,
    load_cleaned,
    load_raw,
    write_splits,
)
from kingsight.data.scaler import FeatureScaler


def main() -> None:
    raw = load_raw()
    cleaned = load_cleaned()
    assert_frames_aligned(raw, cleaned)

    splits = write_splits()
    scaler = FeatureScaler.fit(raw)
    transformed = scaler.transform_frame(raw.loc[:, FEATURE_COLUMNS])
    expected = cleaned.loc[:, FEATURE_COLUMNS].to_numpy(dtype=np.float64)
    if transformed.shape != expected.shape:
        raise SystemExit(f"scaler shape {transformed.shape} != cleaned shape {expected.shape}")
    max_abs = float(np.max(np.abs(transformed - expected)))
    if max_abs > 1e-4:
        raise SystemExit(f"scaler does not match kc_cleaned_data.csv (max abs error {max_abs})")
    scaler.save()
    CatalogStore.build_from_frames(raw, cleaned, splits)

    print(f"rows: {len(raw)}")
    print(f"train: {len(splits['train'])}")
    print(f"val: {len(splits['val'])}")
    print(f"test: {len(splits['test'])}")
    print(f"scaler max abs error vs cleaned: {max_abs}")
    print("wrote artifacts/splits.json")
    print("wrote artifacts/preprocessing/scaler.json")
    print("wrote artifacts/catalog/properties.sqlite")


if __name__ == "__main__":
    main()
