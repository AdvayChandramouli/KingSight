"""Seven form attributes: hard bounds the UI can submit, plus training-range warnings."""

from __future__ import annotations

import csv
import math
from pathlib import Path

# Hard limits stay wider than the training range so a real King County home can
# be submitted. Training range only produces a warning.
FIELD_SPECS: list[dict] = [
    {
        "key": "sqft_living",
        "label": "Living area",
        "unit": "sq ft",
        "kind": "number",
        "min": 1,
        "max": 50_000,
        "step": 1,
    },
    {
        "key": "bedrooms",
        "label": "Bedrooms",
        "kind": "integer",
        "min": 0,
        "max": 40,
        "step": 1,
    },
    {
        "key": "bathrooms",
        "label": "Bathrooms",
        "kind": "number",
        "min": 0,
        "max": 20,
        "step": 0.25,
        "help": (
            "Partial bathrooms count as fractions, such as 0.5 for a half bath "
            "or 0.75 for a bath with a shower but no tub."
        ),
    },
    {
        "key": "grade",
        "label": "Grade",
        "kind": "integer",
        "min": 1,
        "max": 13,
        "step": 1,
        "help": (
            "King County building grade rates construction quality and design from 1 to 13. "
            "Grade 7 is average; higher grades reflect better materials and craftsmanship."
        ),
    },
    {
        "key": "condition",
        "label": "Condition",
        "kind": "integer",
        "min": 1,
        "max": 5,
        "step": 1,
        "help": "Condition rates upkeep and wear relative to age, from 1 (poor) to 5 (very good). 3 is average.",
    },
    {
        "key": "yr_built",
        "label": "Year built",
        "kind": "integer",
        "min": 1800,
        "max": 2015,
        "step": 1,
    },
    {
        "key": "waterfront",
        "label": "Waterfront",
        "kind": "boolean",
    },
]

# Observed King County 2014–2015 sale bounds, used only when the raw CSV is absent.
FALLBACK_TRAINING: dict[str, tuple[float, float]] = {
    "sqft_living": (290, 13540),
    "bedrooms": (0, 33),
    "bathrooms": (0, 8),
    "grade": (1, 13),
    "condition": (1, 5),
    "yr_built": (1900, 2015),
}

VALUATION_YEAR_MIN = 2014
VALUATION_YEAR_MAX = 2015
DEFAULT_VALUATION_YEAR = 2015

ATTRIBUTE_KEYS = (
    "sqft_living",
    "bedrooms",
    "bathrooms",
    "grade",
    "condition",
    "yr_built",
    "waterfront",
)


def _as_bound(kind: str, value: float) -> int | float:
    if kind == "integer" or float(value).is_integer():
        return int(value)
    return float(value)


def training_ranges(csv_path: Path) -> dict[str, dict[str, int | float]]:
    computed = _ranges_from_csv(csv_path)
    ranges: dict[str, dict[str, int | float]] = {}
    for spec in FIELD_SPECS:
        key = spec["key"]
        if key == "waterfront":
            continue
        if computed and key in computed:
            low, high = computed[key]
        else:
            low, high = FALLBACK_TRAINING[key]
        ranges[key] = {"min": _as_bound(spec["kind"], low), "max": _as_bound(spec["kind"], high)}
    return ranges


def _ranges_from_csv(csv_path: Path) -> dict[str, tuple[float, float]] | None:
    if not csv_path.is_file():
        return None
    keys = [spec["key"] for spec in FIELD_SPECS if spec["key"] != "waterfront"]
    lows = {key: math.inf for key in keys}
    highs = {key: -math.inf for key in keys}
    try:
        with csv_path.open(newline="") as handle:
            reader = csv.DictReader(handle)
            if reader.fieldnames is None or any(key not in reader.fieldnames for key in keys):
                return None
            seen = False
            for row in reader:
                seen = True
                for key in keys:
                    value = float(row[key])
                    lows[key] = min(lows[key], value)
                    highs[key] = max(highs[key], value)
    except (OSError, ValueError, KeyError):
        return None
    if not seen:
        return None
    return {key: (lows[key], highs[key]) for key in keys}


def field_constraints(csv_path: Path) -> list[dict]:
    ranges = training_ranges(csv_path)
    fields: list[dict] = []
    for spec in FIELD_SPECS:
        field = {
            "key": spec["key"],
            "label": spec["label"],
            "kind": spec["kind"],
        }
        if "unit" in spec:
            field["unit"] = spec["unit"]
        for bound in ("min", "max", "step"):
            if bound in spec:
                field[bound] = spec[bound]
        if spec["key"] in ranges:
            field["training_range"] = ranges[spec["key"]]
        if spec.get("help"):
            field["help"] = spec["help"]
        fields.append(field)
    return fields


def _format_number(value: float) -> str:
    if float(value).is_integer():
        return f"{int(value):,}"
    return f"{value:g}"


def validate_prediction_fields(payload: dict) -> tuple[str | None, dict[str, str]]:
    """Return (form-level message, field_errors). Empty field_errors means the attributes passed."""
    year = payload["valuation_year"]
    if isinstance(year, bool) or not isinstance(year, int) or year < VALUATION_YEAR_MIN or year > VALUATION_YEAR_MAX:
        return (
            f"Estimates are available for the {VALUATION_YEAR_MIN}–{VALUATION_YEAR_MAX} market only.",
            {},
        )

    attributes = payload.get("attributes") or {}
    errors: dict[str, str] = {}
    for spec in FIELD_SPECS:
        key = spec["key"]
        value = attributes.get(key)
        if spec["kind"] == "boolean":
            if not isinstance(value, bool):
                errors[key] = f"Choose whether the property is {spec['label'].lower()}."
            continue
        message = _check_number(spec, value, year)
        if message:
            errors[key] = message

    latitude = payload.get("latitude")
    longitude = payload.get("longitude")
    if not isinstance(latitude, (int, float)) or isinstance(latitude, bool) or not math.isfinite(float(latitude)):
        errors["latitude"] = "Enter a latitude."
    if not isinstance(longitude, (int, float)) or isinstance(longitude, bool) or not math.isfinite(float(longitude)):
        errors["longitude"] = "Enter a longitude."

    if errors:
        return ("Some property details need attention before an estimate can be made.", errors)
    return (None, {})


def _check_number(spec: dict, value: object, valuation_year: int) -> str | None:
    label = spec["label"]
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(float(value)):
        return f"Enter {label.lower()}."
    number = float(value)
    if spec["kind"] == "integer" and not float(number).is_integer():
        return f"{label} must be a whole number."
    if spec["key"] == "sqft_living" and number <= 0:
        return "Living area must be greater than 0 sq ft."
    if spec.get("min") is not None and number < spec["min"]:
        return f"{label} must be at least {spec['min']}."
    maximum = spec.get("max")
    if spec["key"] == "yr_built" and maximum is not None:
        maximum = min(maximum, valuation_year)
    if maximum is not None and number > maximum:
        return f"{label} must be {maximum} or less."
    step = spec.get("step")
    if spec["kind"] == "number" and step is not None and step > 0:
        steps = number / step
        if abs(steps - round(steps)) > 1e-9:
            if step == 0.25:
                return f"{label} must use quarter increments (e.g. 1.75)."
            return f"{label} must use steps of {step}."
    return None


def training_warnings(attributes: dict, csv_path: Path) -> list[str]:
    ranges = training_ranges(csv_path)
    warnings: list[str] = []
    for spec in FIELD_SPECS:
        key = spec["key"]
        if key not in ranges:
            continue
        value = attributes.get(key)
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(float(value)):
            continue
        low = ranges[key]["min"]
        high = ranges[key]["max"]
        if value < low or value > high:
            warnings.append(
                f"{spec['label']} ({_format_number(float(value))}) is outside the range seen in the "
                f"historical sales data ({_format_number(float(low))}–{_format_number(float(high))}). "
                "Treat this estimate with extra caution."
            )
    return warnings
