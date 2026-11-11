"""FastAPI entrypoint: `kingsight.api.main:app`."""

from __future__ import annotations

import logging
import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from kingsight.api.errors import APIError, error_response
from kingsight.api.routes import router
from kingsight.api.runtime import Runtime
from kingsight.api.settings import Settings, load_settings
from kingsight.api.store import PredictionStore

logger = logging.getLogger("kingsight.api")

FIELD_NAMES = {
    "sqft_living",
    "bedrooms",
    "bathrooms",
    "grade",
    "condition",
    "yr_built",
    "waterfront",
    "latitude",
    "longitude",
}


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()
    level = getattr(logging, settings.log_level.upper(), logging.INFO)
    logger.setLevel(level)

    app = FastAPI(title="KingSight", version="0.1.0", redirect_slashes=False)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS", "HEAD"],
        allow_headers=["*"],
    )
    app.state.settings = settings
    app.state.runtime = Runtime(settings)
    app.state.store = PredictionStore()

    @app.middleware("http")
    async def assign_request_id(request: Request, call_next):
        request.state.request_id = uuid.uuid4().hex
        return await call_next(request)

    app.add_exception_handler(APIError, _on_api_error)
    app.add_exception_handler(RequestValidationError, _on_validation)
    app.add_exception_handler(StarletteHTTPException, _on_http)
    app.add_exception_handler(Exception, _on_unexpected)
    app.include_router(router)
    return app


def _request_id(request: Request) -> str | None:
    return getattr(request.state, "request_id", None)


async def _on_api_error(request: Request, exc: APIError):
    return error_response(
        exc.status_code,
        exc.code,
        exc.message,
        retryable=exc.retryable,
        field_errors=exc.field_errors,
        request_id=_request_id(request),
    )


async def _on_validation(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    if any(str(err.get("type", "")).startswith("json_") for err in errors):
        return error_response(
            400,
            "malformed_payload",
            "The request body was not valid JSON.",
            retryable=False,
            request_id=_request_id(request),
        )
    field_errors: dict[str, str] = {}
    for err in errors:
        field = next((str(part) for part in reversed(err.get("loc") or ()) if str(part) in FIELD_NAMES), None)
        if field is None or field in field_errors:
            continue
        message = str(err.get("msg") or "Invalid value.")
        prefix = "Value error, "
        if message.startswith(prefix):
            message = message[len(prefix) :]
        field_errors[field] = message
    return error_response(
        422,
        "invalid_input",
        "Some of the details sent were not accepted. Check the values and try again.",
        retryable=False,
        field_errors=field_errors or None,
        request_id=_request_id(request),
    )


async def _on_http(request: Request, exc: StarletteHTTPException):
    if exc.status_code == 404:
        return error_response(
            404,
            "not_found",
            "The requested record could not be found.",
            retryable=False,
            request_id=_request_id(request),
        )
    return error_response(
        exc.status_code,
        "unknown",
        "Something went wrong. Please try again.",
        retryable=True,
        request_id=_request_id(request),
    )


async def _on_unexpected(request: Request, exc: Exception):
    logger.exception("unhandled error", exc_info=exc)
    return error_response(
        500,
        "unknown",
        "Something went wrong. Please try again.",
        retryable=True,
        request_id=_request_id(request),
    )


app = create_app()
