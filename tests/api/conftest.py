"""Shared fixtures for the API suite. Inserts `src` so pytest works with PYTHONPATH unset."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "src"
API_TESTS = Path(__file__).resolve().parent
for path in (SRC, API_TESTS):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

import pytest
from fastapi.testclient import TestClient

from kingsight.api.main import create_app
from kingsight.api.settings import Settings


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    artifacts = tmp_path / "artifacts"
    return Settings(
        repo_root=tmp_path,
        artifact_dir=artifacts,
        catalog_path=artifacts / "catalog" / "properties.sqlite",
        scaler_path=artifacts / "preprocessing" / "scaler.json",
        xgboost_dir=artifacts / "xgboost",
        gnn_dir=artifacts / "gnn",
        data_csv=tmp_path / "kc_house_data.csv",
        cors_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        log_level="WARNING",
    )


@pytest.fixture
def app(settings: Settings):
    return create_app(settings)


@pytest.fixture
def client(app):
    return TestClient(app)

