"""GET /metadata content. Metrics come only from numeric manifest values."""

from __future__ import annotations

import json
import math
from pathlib import Path

from kingsight.api.fields import DEFAULT_VALUATION_YEAR, VALUATION_YEAR_MAX, VALUATION_YEAR_MIN, field_constraints
from kingsight.api.geo import (
    FALLBACK_BOUNDS,
    FALLBACK_LABEL,
    FALLBACK_POLYGON,
    close_ring,
)
from kingsight.api.settings import Settings

AGREED_RULE = "8 nearest homes within 5 km"
DATASET_VERSION = "kc-2014-2015"

METRIC_SPECS = (
    ("r2_log", "r2_log", "1", "log_usd"),
    ("rmse_log", "rmse_log", "log_usd", "log_usd"),
    ("mae_log", "mae_log", "log_usd", "log_usd"),
    ("rmse_usd", "rmse_usd", "USD", "usd"),
    ("mae_usd", "mae_usd", "USD", "usd"),
)

TABULAR_DESCRIPTION = (
    "Estimates value from the home itself: its size, building grade, condition, age, rooms, "
    "waterfront status, and location coordinates."
)
GRAPH_MODEL_DESCRIPTION = (
    "Estimates value from the home together with the nearby homes it is connected to, "
    "so its surroundings shape the result."
)
GRAPH_RULE_DESCRIPTION = (
    "Each home connects to its 8 nearest homes within 5 km. "
    "Those connections give the neighborhood-graph model its surrounding context."
)


def read_json(path: Path) -> dict | None:
    if not path.is_file():
        return None
    try:
        payload = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError):
        return None
    return payload if isinstance(payload, dict) else None


def _finite(value: object) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        if isinstance(value, dict):
            return _finite(value.get("value"))
        return None
    number = float(value)
    if not math.isfinite(number):
        return None
    return number


def _provenance(value: object, fallback: str) -> str:
    if isinstance(value, str) and value.strip():
        return value.strip()
    if isinstance(value, dict):
        script = value.get("script")
        if isinstance(script, str) and script.strip():
            return script.strip()
    return fallback


def _metric_sources(manifest: dict) -> list[dict]:
    sources = [manifest]
    metrics = manifest.get("metrics")
    if isinstance(metrics, dict):
        sources.append(metrics)
        test = metrics.get("test")
        if isinstance(test, dict):
            sources.append(test)
    test_metrics = manifest.get("test_metrics")
    if isinstance(test_metrics, dict):
        sources.append(test_metrics)
    return sources


def metrics_from_manifest(manifest: dict | None, model_id: str, provenance_fallback: str) -> list[dict]:
    if not manifest:
        return []
    sources = _metric_sources(manifest)
    provenance = _provenance(manifest.get("provenance"), provenance_fallback)
    found: list[dict] = []
    for key, name, unit, scale in METRIC_SPECS:
        value = None
        for source in sources:
            if key in source:
                value = _finite(source.get(key))
                if value is not None:
                    break
        if value is None:
            continue
        found.append(
            {
                "model_id": model_id,
                "name": name,
                "value": value,
                "unit": unit,
                "split": "test",
                "target_scale": scale,
                "provenance": provenance,
            }
        )
    return found


def dataset_version(settings: Settings) -> str:
    for directory, label in ((settings.xgboost_dir, "xgboost"), (settings.gnn_dir, "gnn")):
        manifest = read_json(directory / "manifest.json")
        if not manifest:
            continue
        for key in ("dataset_version", "data_version"):
            value = manifest.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        _ = label
    return DATASET_VERSION


def _version(manifest: dict | None, *keys: str, default: str = "0.1.0") -> str:
    if not manifest:
        return default
    for key in keys:
        value = manifest.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return default


def graph_metadata(settings: Settings) -> dict:
    manifest = read_json(settings.gnn_dir / "manifest.json") or {}
    rule = manifest.get("rule_label")
    if not isinstance(rule, str) or not rule.strip():
        rule = AGREED_RULE
    description = manifest.get("description")
    if not isinstance(description, str) or not description.strip():
        description = GRAPH_RULE_DESCRIPTION
    return {
        "available": True,
        "version": _version(manifest, "graph_version", "version"),
        "rule_label": rule.strip(),
        "description": description.strip(),
    }


def _coverage_from_module(module) -> dict | None:
    for name in ("COVERAGE", "coverage", "REGION"):
        obj = getattr(module, name, None)
        if callable(obj):
            try:
                obj = obj()
            except TypeError:
                continue
        if isinstance(obj, dict) and "bounds" in obj and "polygon" in obj:
            return _normalize_region(obj.get("label"), obj["bounds"], obj["polygon"])
    bounds = _exported(module, ("bounds", "BOUNDS", "BBOX"))
    polygon = _exported(module, ("polygon", "POLYGON", "ring", "RING"))
    label = getattr(module, "label", None) or getattr(module, "LABEL", None)
    if bounds is None or polygon is None:
        return None
    return _normalize_region(label, bounds, polygon)


def _exported(module, names: tuple[str, ...]):
    for name in names:
        if not hasattr(module, name):
            continue
        value = getattr(module, name)
        if callable(value):
            try:
                value = value()
            except TypeError:
                continue
            except Exception:
                return None
        return value
    return None


def _normalize_region(label: object, bounds: object, polygon: object) -> dict | None:
    try:
        bound_list = [float(item) for item in list(bounds)]  # type: ignore[arg-type]
        ring = [[float(point[0]), float(point[1])] for point in list(polygon)]  # type: ignore[index]
    except (TypeError, ValueError, IndexError):
        return None
    if len(bound_list) != 4 or len(ring) < 3:
        return None
    ring = close_ring(ring)
    if len(ring) < 4:
        return None
    text = label.strip() if isinstance(label, str) and label.strip() else FALLBACK_LABEL
    return {"label": text, "bounds": bound_list, "polygon": ring}


def coverage_region() -> dict:
    """Published coverage. `checker` is the catalog predicate when that module imports."""
    fallback = {"label": FALLBACK_LABEL, "bounds": list(FALLBACK_BOUNDS), "polygon": [list(p) for p in FALLBACK_POLYGON]}
    try:
        import kingsight.catalog.coverage as coverage
    except Exception:
        return {**fallback, "checker": None}
    region = _coverage_from_module(coverage) or fallback
    checker = getattr(coverage, "in_coverage", None)
    return {**region, "checker": checker if callable(checker) else None}


def build_metadata(settings: Settings) -> dict:
    xgb_manifest = read_json(settings.xgboost_dir / "manifest.json")
    gnn_manifest = read_json(settings.gnn_dir / "manifest.json")
    metrics = [
        *metrics_from_manifest(xgb_manifest, "xgboost", "artifacts/xgboost/manifest.json"),
        *metrics_from_manifest(gnn_manifest, "gnn", "artifacts/gnn/manifest.json"),
    ]
    region = coverage_region()
    return {
        "data_mode": "real",
        "dataset": {
            "name": "House Sales in King County",
            "region_label": "King County, Washington",
            "period_label": "May 2014–May 2015",
            "period_start": "2014-05",
            "period_end": "2015-05",
            "version": dataset_version(settings),
            "source_label": "Kaggle House Sales in King County",
            "source_url": "https://www.kaggle.com/datasets/harlfoxem/housesalesprediction",
            "currency": "USD",
            "area_unit": "sqft",
        },
        "primary_model_id": "xgboost",
        "models": [
            {
                "id": "xgboost",
                "display_name": "XGBoost",
                "perspective_label": "Property-feature model",
                "family": "tabular",
                "version": _version(xgb_manifest, "version", "model_version"),
                "description": TABULAR_DESCRIPTION,
                "explanation_available": True,
            },
            {
                "id": "gnn",
                "display_name": "Graph neural network",
                "perspective_label": "Neighborhood-graph model",
                "family": "graph",
                "version": _version(gnn_manifest, "version", "model_version"),
                "description": GRAPH_MODEL_DESCRIPTION,
                "explanation_available": True,
            },
        ],
        "fields": field_constraints(settings.data_csv),
        "coverage": {
            "label": region["label"],
            "bounds": region["bounds"],
            "polygon": region["polygon"],
        },
        "default_valuation_year": DEFAULT_VALUATION_YEAR,
        "valuation_year_range": {"min": VALUATION_YEAR_MIN, "max": VALUATION_YEAR_MAX},
        "graph": graph_metadata(settings),
        "metrics": metrics or None,
    }
