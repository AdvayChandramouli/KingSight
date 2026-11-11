"""API error body shared by every route. Matches `ApiErrorBody` in the frontend."""

from __future__ import annotations

from fastapi.responses import JSONResponse

ErrorCode = str


class APIError(Exception):
    def __init__(
        self,
        status_code: int,
        code: ErrorCode,
        message: str,
        *,
        retryable: bool,
        field_errors: dict[str, str] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.retryable = retryable
        self.field_errors = field_errors


def error_payload(
    code: str,
    message: str,
    *,
    retryable: bool,
    field_errors: dict[str, str] | None = None,
    request_id: str | None = None,
) -> dict:
    body: dict = {"code": code, "message": message, "retryable": retryable}
    if field_errors:
        body["field_errors"] = field_errors
    if request_id:
        body["request_id"] = request_id
    return body


def error_response(
    status_code: int,
    code: str,
    message: str,
    *,
    retryable: bool,
    field_errors: dict[str, str] | None = None,
    request_id: str | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content=error_payload(
            code,
            message,
            retryable=retryable,
            field_errors=field_errors,
            request_id=request_id,
        ),
    )
