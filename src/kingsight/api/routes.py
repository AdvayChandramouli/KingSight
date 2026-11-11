"""HTTP routes. Paths match `HttpKingSightClient` with no prefix and no trailing slash."""

from __future__ import annotations

import logging
import math

from fastapi import APIRouter, Query, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator

from kingsight.api.errors import APIError
from kingsight.api.metadata import build_metadata
from kingsight.api.records import normalize_detail, normalize_page
from kingsight.api.runtime import Unavailable
from kingsight.api.service import explain, neighbors, predict

logger = logging.getLogger("kingsight.api")
router = APIRouter()

CATALOG_UNAVAILABLE = "The property catalog is not available."


class AttributesIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    sqft_living: float
    bedrooms: int
    bathrooms: float
    grade: int
    condition: int
    yr_built: int
    waterfront: bool

    @field_validator("sqft_living", "bathrooms")
    @classmethod
    def finite_measure(cls, value: float) -> float:
        if not math.isfinite(value):
            raise ValueError("must be a finite number")
        return value


class PredictIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    client_request_id: str = Field(min_length=1)
    source: str
    property_id: str | None = None
    latitude: float
    longitude: float
    valuation_year: int
    attributes: AttributesIn
    model_ids: list[str] = Field(min_length=1)

    @field_validator("source")
    @classmethod
    def known_source(cls, value: str) -> str:
        if value not in {"existing", "edited", "hypothetical"}:
            raise ValueError("source must be existing, edited, or hypothetical")
        return value

    @field_validator("latitude", "longitude")
    @classmethod
    def finite_coord(cls, value: float) -> float:
        if not math.isfinite(value):
            raise ValueError("must be a finite number")
        return value

    @field_validator("model_ids")
    @classmethod
    def model_ids_present(cls, value: list[str]) -> list[str]:
        if any(not isinstance(item, str) or not item.strip() for item in value):
            raise ValueError("Each model id must be a non-empty string.")
        return value


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "data_mode": "real"}


@router.get("/metadata")
def metadata(request: Request) -> dict:
    return build_metadata(request.app.state.settings)


@router.get("/properties")
def list_properties(
    request: Request,
    q: str | None = None,
    zip: str | None = None,
    bbox: str | None = None,
    waterfront: str | None = None,
    min_sqft: float | None = None,
    max_sqft: float | None = None,
    cursor: str | None = None,
    limit: int = Query(default=24, ge=1, le=100),
) -> dict:
    runtime = request.app.state.runtime
    parsed_bbox = _bbox(bbox)
    parsed_waterfront = _waterfront(waterfront)
    if min_sqft is not None and max_sqft is not None and min_sqft > max_sqft:
        raise APIError(422, "invalid_input", "min_sqft cannot be greater than max_sqft.", retryable=False)
    try:
        page = runtime.list_properties(
            q=_blank(q),
            zip=_blank(zip),
            bbox=parsed_bbox,
            waterfront=parsed_waterfront,
            min_sqft=min_sqft,
            max_sqft=max_sqft,
            cursor=_blank(cursor),
            limit=limit,
        )
    except Unavailable as exc:
        raise APIError(503, "service_unavailable", CATALOG_UNAVAILABLE, retryable=True) from exc
    except APIError:
        raise
    except ValueError as exc:
        message = str(exc)
        if "cursor" in message:
            message = "That page of results is not available."
        else:
            message = "Some of the details sent were not accepted. Check the values and try again."
        raise APIError(422, "invalid_input", message, retryable=False) from exc
    except Exception as exc:
        logger.exception("property list failed")
        raise APIError(503, "service_unavailable", CATALOG_UNAVAILABLE, retryable=True) from exc
    if isinstance(page, list):
        page = {"items": page, "next_cursor": None, "total": len(page)}
    try:
        return normalize_page(page)
    except (KeyError, TypeError, ValueError) as exc:
        logger.exception("property list payload could not be normalized")
        raise APIError(503, "service_unavailable", CATALOG_UNAVAILABLE, retryable=True) from exc


@router.get("/properties/{property_id}")
def get_property(property_id: str, request: Request) -> dict:
    runtime = request.app.state.runtime
    try:
        found = runtime.get_property(property_id)
    except Unavailable as exc:
        raise APIError(503, "service_unavailable", CATALOG_UNAVAILABLE, retryable=True) from exc
    except Exception as exc:
        logger.exception("property lookup failed")
        raise APIError(503, "service_unavailable", CATALOG_UNAVAILABLE, retryable=True) from exc
    if not found:
        raise APIError(404, "not_found", "The requested record could not be found.", retryable=False)
    try:
        return normalize_detail(found)
    except (KeyError, TypeError, ValueError) as exc:
        logger.exception("property detail could not be normalized")
        raise APIError(503, "service_unavailable", CATALOG_UNAVAILABLE, retryable=True) from exc


@router.post("/predict")
def post_predict(body: PredictIn, request: Request) -> dict:
    return predict(request.app.state.runtime, request.app.state.store, body.model_dump())


@router.get("/predictions/{prediction_id}/explanation")
def get_explanation(prediction_id: str, request: Request, model_id: str = Query(min_length=1)) -> dict:
    return explain(request.app.state.runtime, request.app.state.store, prediction_id, model_id)


@router.get("/predictions/{prediction_id}/neighbors")
def get_neighbors(prediction_id: str, request: Request) -> dict:
    return neighbors(request.app.state.runtime, request.app.state.store, prediction_id)


def _blank(value: str | None) -> str | None:
    if value is None:
        return None
    text = value.strip()
    return text or None


def _bbox(value: str | None) -> tuple[float, float, float, float] | None:
    if value is None or not value.strip():
        return None
    parts = [part.strip() for part in value.split(",")]
    if len(parts) != 4:
        raise APIError(422, "invalid_input", "bbox must be west,south,east,north.", retryable=False)
    try:
        west, south, east, north = (float(part) for part in parts)
    except ValueError as exc:
        raise APIError(422, "invalid_input", "bbox must be west,south,east,north.", retryable=False) from exc
    if not all(math.isfinite(number) for number in (west, south, east, north)):
        raise APIError(422, "invalid_input", "bbox must be west,south,east,north.", retryable=False)
    if west > east or south > north:
        raise APIError(422, "invalid_input", "bbox must run west to east and south to north.", retryable=False)
    return (west, south, east, north)


def _waterfront(value: str | None) -> bool | None:
    if value is None or not value.strip():
        return None
    lowered = value.strip().lower()
    if lowered in {"true", "1", "yes"}:
        return True
    if lowered in {"false", "0", "no"}:
        return False
    raise APIError(422, "invalid_input", "waterfront must be true or false.", retryable=False)
