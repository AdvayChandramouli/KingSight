"""Predict, explanation, and neighbor orchestration."""

from __future__ import annotations

import hashlib
import json
import logging
import math
import uuid
from datetime import datetime, timezone

from kingsight.api.errors import APIError
from kingsight.api.fields import training_warnings, validate_prediction_fields
from kingsight.api.geo import haversine_meters
from kingsight.api.metadata import AGREED_RULE, dataset_version
from kingsight.api.records import normalize_record, record_from_raw
from kingsight.api.runtime import ModelFailed, Runtime, Unavailable
from kingsight.api.store import PredictionStore, StoredPrediction

logger = logging.getLogger("kingsight.api")

MODEL_FAILURE = "The model could not produce a result."
HYPOTHETICAL_IMPUTE = (
    "Fields the form does not collect were imputed "
    "(lot size, floors, view, basement size, renovation year, nearby home sizes, and ZIP code)."
)
MESSAGES = {
    "xgboost": {
        "unavailable": "The property-feature model is not available right now.",
        "error": "The property-feature model could not produce an estimate for this request.",
    },
    "gnn": {
        "unavailable": "The neighborhood-graph model is not available right now.",
        "error": "The neighborhood-graph model could not produce an estimate for this request.",
    },
}


def predict(runtime: Runtime, store: PredictionStore, payload: dict) -> dict:
    client_request_id = str(payload["client_request_id"])
    if not client_request_id.strip():
        raise APIError(422, "invalid_input", "A client request id is required.", retryable=False)

    cached = store.get_by_client(client_request_id)
    if cached is not None:
        return cached.response

    message, field_errors = validate_prediction_fields(payload)
    if message:
        raise APIError(422, "invalid_input", message, retryable=False, field_errors=field_errors or None)

    if not runtime.in_coverage(float(payload["latitude"]), float(payload["longitude"])):
        raise APIError(400, "out_of_coverage", _coverage_message(runtime), retryable=False)

    source = payload["source"]
    property_id = _blank_to_none(payload.get("property_id"))
    raw_row = None
    if source in {"existing", "edited"}:
        if property_id is None:
            raise APIError(422, "invalid_input", "A property is required for this estimate.", retryable=False)
        try:
            raw_row = runtime.raw_features(property_id)
        except Unavailable as exc:
            raise APIError(503, "service_unavailable", "The property catalog is not available.", retryable=True) from exc
        if raw_row is None:
            raise APIError(404, "not_found", "The property for this estimate could not be found.", retryable=False)

    latitude, longitude = _resolve_location(payload, raw_row, source)
    graph_property_id = None if source == "hypothetical" else property_id
    try:
        assembled, assemble_warnings = runtime.assemble(
            source=source,
            property_id=property_id,
            latitude=float(payload["latitude"]),
            longitude=float(payload["longitude"]),
            attributes=payload["attributes"],
            raw_row=raw_row,
        )
        features = _feature_vector(assembled)
    except (Unavailable, ModelFailed) as exc:
        logger.info("prediction features unavailable: %s", exc)
        raise APIError(503, "model_failure", MODEL_FAILURE, retryable=True) from exc

    warnings = _warnings(runtime, source, payload["attributes"], assemble_warnings)
    model_ids = _dedupe(payload["model_ids"])
    results = [
        _run_model(runtime, model_id, features, latitude, longitude, graph_property_id) for model_id in model_ids
    ]
    if not results or all(result["status"] != "success" for result in results):
        raise APIError(503, "model_failure", MODEL_FAILURE, retryable=True)

    response = {
        "prediction_id": f"pred_{uuid.uuid4().hex}",
        "client_request_id": client_request_id,
        "input_fingerprint": _fingerprint(payload),
        "data_mode": "real",
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "dataset_version": dataset_version(runtime.settings),
        "results": results,
        "warnings": warnings,
    }
    stored = store.save(
        StoredPrediction(
            prediction_id=response["prediction_id"],
            client_request_id=client_request_id,
            response=response,
            features=features,
            latitude=latitude,
            longitude=longitude,
            property_id=graph_property_id,
            source=source,
            statuses={result["model_id"]: result["status"] for result in results},
        )
    )
    return stored.response


def explain(runtime: Runtime, store: PredictionStore, prediction_id: str, model_id: str) -> dict:
    stored = store.get(prediction_id)
    if stored is None:
        raise APIError(404, "not_found", "This estimate is no longer available. Request a new estimate to continue.", retryable=False)
    known = stored.statuses.get(model_id)
    if known is None:
        raise APIError(404, "not_found", "No estimate from this model exists for this request, so there is nothing to explain.", retryable=False)
    if known != "success":
        raise APIError(
            503,
            "model_failure",
            "This model did not produce an estimate for this request, so no explanation is available.",
            retryable=False,
        )
    version = _result_version(stored, model_id)
    try:
        payload = runtime.explain(model_id, stored.features, stored.latitude, stored.longitude, stored.property_id)
        return _normalize_explanation(stored.prediction_id, model_id, version, payload)
    except Unavailable as exc:
        raise APIError(
            503,
            "model_failure",
            "The explanation could not be loaded right now. Please try again.",
            retryable=True,
        ) from exc
    except (ModelFailed, KeyError, TypeError, ValueError) as exc:
        logger.info("explanation failed: %s", exc)
        raise APIError(503, "model_failure", "The explanation could not be loaded right now. Please try again.", retryable=True) from exc


def neighbors(runtime: Runtime, store: PredictionStore, prediction_id: str) -> dict:
    stored = store.get(prediction_id)
    if stored is None:
        raise APIError(404, "not_found", "This estimate is no longer available. Request a new estimate to continue.", retryable=False)
    try:
        graph_version, rule_label, rows = runtime.query_neighbors(
            stored.features,
            stored.latitude,
            stored.longitude,
            stored.property_id,
        )
    except Unavailable as exc:
        raise APIError(
            503,
            "model_failure",
            "Connected homes could not be loaded right now. Please try again.",
            retryable=True,
        ) from exc
    except ModelFailed as exc:
        raise APIError(
            503,
            "model_failure",
            "Connected homes could not be loaded right now. Please try again.",
            retryable=True,
        ) from exc

    exclude = {stored.property_id} if stored.property_id else set()
    mapped = []
    for row in rows:
        neighbor_id = _neighbor_id(row)
        if neighbor_id is None or neighbor_id in exclude:
            continue
        record = _neighbor_record(runtime, neighbor_id)
        if record is None:
            continue
        if record["id"] in exclude:
            continue
        distance = haversine_meters(stored.latitude, stored.longitude, record["latitude"], record["longitude"])
        if not math.isfinite(distance) or distance < 0:
            distance = _row_distance(row)
        mapped.append(
            {
                "property": record,
                "distance_meters": distance,
                "edge_type": _edge_type(row),
            }
        )
    return {
        "prediction_id": stored.prediction_id,
        "graph_version": graph_version or "0.1.0",
        "rule_label": rule_label or AGREED_RULE,
        "neighbors": mapped,
    }


def _neighbor_record(runtime: Runtime, property_id: str) -> dict | None:
    try:
        found = runtime.lookup_neighbor(property_id)
    except Unavailable as exc:
        raise APIError(503, "service_unavailable", "The property catalog is not available.", retryable=True) from exc
    except Exception as exc:
        logger.info("neighbor lookup failed for %s: %s", property_id, exc)
        return None
    if not isinstance(found, dict):
        return None
    if "attributes" in found or "sqft_living" in found:
        try:
            return normalize_record(found, default_role="reference_only")
        except (KeyError, TypeError, ValueError):
            return record_from_raw(found, property_id)
    return record_from_raw(found, property_id)


def _run_model(
    runtime: Runtime,
    model_id: str,
    features: list[float],
    latitude: float,
    longitude: float,
    property_id: str | None,
) -> dict:
    if model_id not in MESSAGES:
        return _result(model_id, "unknown", "unavailable", None, "This model is not available.")
    try:
        if model_id == "xgboost":
            version, price = runtime.predict_tabular(features)
        else:
            version, price = runtime.predict_graph(features, latitude, longitude, property_id)
    except Unavailable:
        return _result(model_id, "unloaded", "unavailable", None, MESSAGES[model_id]["unavailable"])
    except ModelFailed:
        return _result(model_id, "unloaded", "error", None, MESSAGES[model_id]["error"])
    except Exception:
        logger.exception("unexpected %s failure", model_id)
        return _result(model_id, "unloaded", "error", None, MESSAGES[model_id]["error"])
    try:
        number = float(price)
    except (TypeError, ValueError):
        return _result(model_id, version, "error", None, MESSAGES[model_id]["error"])
    if not math.isfinite(number) or number < 0:
        return _result(model_id, version, "error", None, MESSAGES[model_id]["error"])
    return _result(model_id, version, "success", number, None)


def _result(model_id: str, version: str, status: str, price: float | None, message: str | None) -> dict:
    body = {
        "model_id": model_id,
        "version": version or "unknown",
        "status": status,
        "predicted_price_usd": price,
    }
    if message:
        body["message"] = message
    return body


def _warnings(runtime: Runtime, source: str, attributes: dict, assemble_warnings: list[str]) -> list[str]:
    warnings = [str(item) for item in assemble_warnings if str(item).strip()]
    if source == "hypothetical" and not any("imput" in item.lower() for item in warnings):
        warnings.append(HYPOTHETICAL_IMPUTE)
    warnings.extend(training_warnings(attributes, runtime.settings.data_csv))
    return warnings


def _feature_vector(value) -> list[float]:
    if hasattr(value, "tolist"):
        value = value.tolist()
    if isinstance(value, tuple):
        value = list(value)
    if isinstance(value, list) and value and isinstance(value[0], (list, tuple)):
        value = list(value[0])
    if not isinstance(value, list):
        raise ModelFailed("features")
    numbers: list[float] = []
    for item in value:
        if isinstance(item, bool):
            raise ModelFailed("features")
        if hasattr(item, "item") and not isinstance(item, (int, float, str)):
            item = item.item()
        number = float(item)
        if not math.isfinite(number):
            raise ModelFailed("features")
        numbers.append(number)
    if len(numbers) != 18:
        raise ModelFailed("features")
    return numbers


def _fingerprint(payload: dict) -> str:
    canonical = {
        "source": payload["source"],
        "property_id": _blank_to_none(payload.get("property_id")),
        "latitude": payload["latitude"],
        "longitude": payload["longitude"],
        "valuation_year": payload["valuation_year"],
        "attributes": payload["attributes"],
        "model_ids": list(payload["model_ids"]),
    }
    raw = json.dumps(canonical, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(raw.encode()).hexdigest()


def _resolve_location(payload: dict, raw_row: dict | None, source: str) -> tuple[float, float]:
    request_lat = float(payload["latitude"])
    request_lon = float(payload["longitude"])
    if source == "hypothetical" or not isinstance(raw_row, dict):
        return request_lat, request_lon
    lat = _first_float(raw_row, ("latitude", "lat"))
    lon = _first_float(raw_row, ("longitude", "long", "lng"))
    if lat is None or lon is None:
        return request_lat, request_lon
    if not (46 <= lat <= 49 and -124 <= lon <= -120):
        return request_lat, request_lon
    return lat, lon


def _first_float(raw: dict, keys: tuple[str, ...]) -> float | None:
    for key in keys:
        if key not in raw or raw[key] is None:
            continue
        try:
            value = float(raw[key])
        except (TypeError, ValueError):
            continue
        if math.isfinite(value):
            return value
    return None


def _coverage_message(runtime: Runtime) -> str:
    region = runtime.region()
    west, south, east, north = region["bounds"]
    return (
        f"This location is outside {region['label']}, so no estimate can be made. "
        f"Choose a point inside the outlined area (roughly latitude {south:.2f} to {north:.2f}, "
        f"longitude {west:.2f} to {east:.2f})."
    )


def _dedupe(model_ids: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for model_id in model_ids:
        if model_id in seen:
            continue
        seen.add(model_id)
        ordered.append(model_id)
    return ordered


def _blank_to_none(value) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _result_version(stored: StoredPrediction, model_id: str) -> str:
    for result in stored.response.get("results", []):
        if result.get("model_id") == model_id:
            return str(result.get("version") or "0.1.0")
    return "0.1.0"


def _normalize_explanation(prediction_id: str, model_id: str, model_version: str, payload: dict) -> dict:
    features = []
    for item in payload.get("features") or []:
        if not isinstance(item, dict):
            raise ModelFailed("explanation")
        value = _json_value(item.get("value"))
        contribution = float(item["contribution"])
        if isinstance(contribution, bool) or not math.isfinite(contribution):
            raise ModelFailed("explanation")
        features.append(
            {
                "key": str(item["key"]),
                "label": str(item["label"]),
                "value": value,
                "contribution": contribution,
            }
        )
    space = payload.get("output_space") or "log_usd"
    if space not in {"usd", "log_usd"}:
        space = "log_usd"
    reference = payload.get("reference_output")
    if reference is not None:
        reference = float(reference)
        if not math.isfinite(reference):
            reference = None
    body = {
        "prediction_id": prediction_id,
        "model_id": str(payload.get("model_id") or model_id),
        "model_version": str(payload.get("model_version") or payload.get("version") or model_version),
        "scope": "local",
        "method": str(payload.get("method") or "local"),
        "output_space": space,
        "reference_output": reference,
        "features": features,
    }
    global_importance = payload.get("global_importance")
    if isinstance(global_importance, list) and global_importance:
        cleaned = []
        for item in global_importance:
            if not isinstance(item, dict):
                continue
            importance = float(item["importance"])
            if not math.isfinite(importance):
                continue
            cleaned.append({"key": str(item["key"]), "label": str(item["label"]), "importance": importance})
        if cleaned:
            body["global_importance"] = cleaned
    return body


def _json_value(value):
    if hasattr(value, "item") and not isinstance(value, (str, bytes, bool, int, float)):
        value = value.item()
    if isinstance(value, bool) or value is None:
        raise ModelFailed("explanation")
    if isinstance(value, str):
        return value
    if isinstance(value, (int, float)):
        number = float(value) if isinstance(value, float) else int(value)
        if isinstance(number, float) and not math.isfinite(number):
            raise ModelFailed("explanation")
        return number
    raise ModelFailed("explanation")


def _neighbor_id(row) -> str | None:
    if isinstance(row, dict):
        value = row.get("id", row.get("property_id"))
    else:
        value = getattr(row, "id", None)
    if value is None:
        return None
    if hasattr(value, "item") and not isinstance(value, (str, bytes, int)):
        value = value.item()
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    if isinstance(value, int) and not isinstance(value, bool):
        return str(value)
    text = str(value).strip()
    return text or None


def _row_distance(row) -> float | None:
    if isinstance(row, dict):
        value = row.get("distance_meters")
    else:
        value = getattr(row, "distance_meters", None)
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(number) or number < 0:
        return None
    return number


def _edge_type(row) -> str:
    if isinstance(row, dict):
        value = row.get("edge_type", "combined")
    else:
        value = getattr(row, "edge_type", "combined")
    text = str(value or "").strip().lower()
    if text in {"geographic", "similarity", "combined"}:
        return text
    if "similar" in text and "combin" not in text:
        return "similarity"
    if "geo" in text and "combin" not in text:
        return "geographic"
    return "combined"
