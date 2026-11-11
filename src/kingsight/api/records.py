"""Coerce catalog rows into PropertyRecord / PropertyDetail JSON."""

from __future__ import annotations

import math

from kingsight.api.fields import ATTRIBUTE_KEYS, DEFAULT_VALUATION_YEAR

ROLES = {"held_out_example", "reference_only"}


def _number(value: object) -> float:
    if isinstance(value, bool) or value is None:
        raise ValueError("not a number")
    if hasattr(value, "item") and not isinstance(value, (str, bytes, dict, list)):
        value = value.item()
    number = float(value)  # type: ignore[arg-type]
    if not math.isfinite(number):
        raise ValueError("non-finite")
    return number


def _optional_number(value: object) -> float | None:
    if value is None or value == "":
        return None
    try:
        number = _number(value)
    except (TypeError, ValueError):
        return None
    if number < 0:
        return None
    return number


def _bool(value: object) -> bool:
    if isinstance(value, bool):
        return value
    if hasattr(value, "item") and not isinstance(value, (str, bytes)):
        value = value.item()
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "y"}
    raise ValueError("not a boolean")


def _int(value: object) -> int:
    number = _number(value)
    if not float(number).is_integer():
        raise ValueError("not an integer")
    return int(number)


def normalize_zip(value: object) -> str | None:
    if value is None or value == "":
        return None
    if hasattr(value, "item") and not isinstance(value, (str, bytes)):
        value = value.item()
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    if isinstance(value, int) and not isinstance(value, bool):
        return str(value)
    text = str(value).strip()
    if text.endswith(".0") and text[:-2].isdigit():
        return text[:-2]
    return text or None


def normalize_sale_date(value: object) -> str | None:
    if value is None or value == "":
        return None
    text = str(value).strip()
    digits = "".join(ch for ch in text if ch.isdigit())
    if len(digits) >= 8:
        return f"{digits[0:4]}-{digits[4:6]}-{digits[6:8]}"
    return text or None


def _identifier(value: object, fallback: str | None = None) -> str:
    if value is None or value == "":
        if fallback:
            return fallback
        raise ValueError("missing id")
    if hasattr(value, "item") and not isinstance(value, (str, bytes)):
        value = value.item()
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    if isinstance(value, int) and not isinstance(value, bool):
        return str(value)
    text = str(value).strip()
    if not text:
        raise ValueError("missing id")
    return text


def _attributes(source: dict) -> dict:
    nested = source.get("attributes")
    raw = nested if isinstance(nested, dict) else source
    return {
        "sqft_living": _number(raw["sqft_living"]),
        "bedrooms": _int(raw["bedrooms"]),
        "bathrooms": _number(raw["bathrooms"]),
        "grade": _int(raw["grade"]),
        "condition": _int(raw["condition"]),
        "yr_built": _int(raw["yr_built"]),
        "waterfront": _bool(raw["waterfront"]),
    }


def _lat_lon(source: dict) -> tuple[float, float]:
    lat = source.get("latitude", source.get("lat"))
    lon = source.get("longitude", source.get("long", source.get("lng")))
    return _number(lat), _number(lon)


def normalize_record(source: dict, *, default_role: str) -> dict:
    if not isinstance(source, dict):
        raise ValueError("record is not an object")
    latitude, longitude = _lat_lon(source)
    role = source.get("role") or default_role
    if role not in ROLES:
        role = default_role
    record = {
        "id": _identifier(source.get("id")),
        "latitude": latitude,
        "longitude": longitude,
        "zipcode": normalize_zip(source.get("zipcode")),
        "sale_date": normalize_sale_date(source.get("sale_date", source.get("date"))),
        "actual_price_usd": _optional_number(source.get("actual_price_usd", source.get("price"))),
        "attributes": _attributes(source),
        "role": role,
    }
    missing = [key for key in ATTRIBUTE_KEYS if key not in record["attributes"]]
    if missing:
        raise ValueError(f"missing attributes: {missing}")
    return record


def normalize_detail(source: dict) -> dict:
    record = normalize_record(source, default_role="held_out_example")
    year = source.get("valuation_year")
    if isinstance(year, int) and not isinstance(year, bool):
        valuation_year = year
    else:
        sale = record["sale_date"]
        if isinstance(sale, str) and sale[:4].isdigit():
            valuation_year = int(sale[:4])
        else:
            valuation_year = DEFAULT_VALUATION_YEAR
    label = source.get("neighborhood_label")
    neighborhood = label if isinstance(label, str) and label.strip() else None
    return {**record, "valuation_year": valuation_year, "neighborhood_label": neighborhood}


def normalize_page(payload: dict) -> dict:
    items = payload.get("items") if isinstance(payload, dict) else None
    if not isinstance(items, list):
        raise ValueError("property page is missing items")
    normalized = [normalize_record(item, default_role="held_out_example") for item in items]
    total = payload.get("total") if isinstance(payload, dict) else None
    if isinstance(total, bool) or not isinstance(total, int):
        total = None
    cursor = payload.get("next_cursor") if isinstance(payload, dict) else None
    if cursor is not None:
        cursor = str(cursor)
        if cursor == "":
            cursor = None
    return {"items": normalized, "next_cursor": cursor, "total": total}


def record_from_raw(raw: dict, property_id: str) -> dict | None:
    if not isinstance(raw, dict):
        return None
    body = dict(raw)
    body.setdefault("id", property_id)
    body.setdefault("role", "reference_only")
    try:
        return normalize_record(body, default_role="reference_only")
    except (KeyError, TypeError, ValueError):
        return None
