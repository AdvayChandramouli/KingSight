"""Environment-backed paths for artifacts, the catalog, and CORS."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

DEFAULT_CORS = "http://localhost:5173,http://127.0.0.1:5173"


def repo_root() -> Path:
    here = Path(__file__).resolve()
    for parent in here.parents:
        if (parent / "pyproject.toml").is_file() and (parent / "app").is_dir():
            return parent
    return Path.cwd()


def _path_from_env(name: str, default: Path) -> Path:
    raw = os.environ.get(name)
    if raw is None or not raw.strip():
        return default
    return Path(raw).expanduser()


@dataclass(frozen=True)
class Settings:
    repo_root: Path
    artifact_dir: Path
    catalog_path: Path
    scaler_path: Path
    xgboost_dir: Path
    gnn_dir: Path
    data_csv: Path
    cors_origins: list[str]
    log_level: str


def load_settings() -> Settings:
    root = repo_root()
    artifact_dir = _path_from_env("KINGSIGHT_ARTIFACT_DIR", root / "artifacts")
    catalog_path = _path_from_env("KINGSIGHT_CATALOG_PATH", artifact_dir / "catalog" / "properties.sqlite")
    cors_raw = os.environ.get("KINGSIGHT_CORS_ORIGINS", DEFAULT_CORS)
    origins = [item.strip() for item in cors_raw.split(",") if item.strip()]
    if not origins:
        origins = [item.strip() for item in DEFAULT_CORS.split(",")]
    return Settings(
        repo_root=root,
        artifact_dir=artifact_dir,
        catalog_path=catalog_path,
        scaler_path=artifact_dir / "preprocessing" / "scaler.json",
        xgboost_dir=artifact_dir / "xgboost",
        gnn_dir=artifact_dir / "gnn",
        data_csv=root / "data" / "kc_house_data.csv",
        cors_origins=origins,
        log_level=os.environ.get("KINGSIGHT_LOG_LEVEL", "INFO"),
    )
