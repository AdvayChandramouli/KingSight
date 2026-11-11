"""SQLite catalog of King County sales.

``list_properties`` returns only ``held_out_example`` rows (the test split).
Train and validation rows are stored as ``reference_only`` so neighbor lookup
and ``get_raw_features`` can still see them.

The dataset repeats some ``id`` values. ``get_property`` and ``get_raw_features``
return the earliest row (lowest cleaned-frame index) for that id.

Display attributes come from the raw, unscaled columns. ``feat_json`` stores the
pre-scale model inputs, including integer-truncated ``floors``.
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

import pandas as pd

from kingsight.data.dataset import (
    FEATURE_COLUMNS,
    assert_frames_aligned,
    default_catalog_path,
    model_input_frame,
    property_id_from_value,
)

_HELD_OUT = "held_out_example"
_REFERENCE = "reference_only"


def _as_number(value: object) -> int | float:
    number = float(value)  # type: ignore[arg-type]
    if number.is_integer():
        return int(number)
    return number


def _sale_date_iso(value: object) -> str | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    text = str(value).strip()
    if len(text) >= 8 and text[:8].isdigit():
        return f"{text[:4]}-{text[4:6]}-{text[6:8]}"
    parsed = pd.to_datetime(text, errors="coerce")
    if pd.isna(parsed):
        return None
    return parsed.strftime("%Y-%m-%d")


def _valuation_year(sale_date: str | None) -> int | None:
    if sale_date is None or len(sale_date) < 4:
        return None
    return int(sale_date[:4])


def _like_pattern(text: str) -> str:
    escaped = text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


class CatalogStore:
    def __init__(self, path: str | Path | None = None) -> None:
        self.path = Path(path) if path is not None else default_catalog_path()

    @classmethod
    def build_from_frames(
        cls,
        raw: pd.DataFrame,
        cleaned: pd.DataFrame,
        splits: dict,
        path: str | Path | None = None,
    ) -> CatalogStore:
        store = cls(path)
        store._persist(raw, cleaned, splits)
        return store

    def _persist(self, raw: pd.DataFrame, cleaned: pd.DataFrame, splits: dict) -> None:
        assert_frames_aligned(raw, cleaned)
        test_index = {int(index) for index in splits["test"]}
        val_index = {int(index) for index in splits["val"]}
        train_index = {int(index) for index in splits["train"]}
        covered = test_index | val_index | train_index
        if covered != set(range(len(raw))):
            raise ValueError("splits must cover every aligned row exactly once")
        if len(covered) != len(test_index) + len(val_index) + len(train_index):
            raise ValueError("train, val, and test indices overlap")

        features = model_input_frame(raw)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if self.path.exists():
            self.path.unlink()

        connection = sqlite3.connect(self.path)
        try:
            connection.execute(
                """
                CREATE TABLE properties (
                    row_index INTEGER PRIMARY KEY,
                    id TEXT NOT NULL,
                    role TEXT NOT NULL CHECK (role IN ('held_out_example', 'reference_only')),
                    latitude REAL NOT NULL,
                    longitude REAL NOT NULL,
                    zipcode TEXT NOT NULL,
                    sale_date TEXT,
                    actual_price_usd REAL,
                    valuation_year INTEGER,
                    sqft_living REAL NOT NULL,
                    bedrooms REAL NOT NULL,
                    bathrooms REAL NOT NULL,
                    grade REAL NOT NULL,
                    condition REAL NOT NULL,
                    yr_built REAL NOT NULL,
                    waterfront INTEGER NOT NULL,
                    feat_json TEXT NOT NULL
                )
                """
            )
            connection.execute(
                "CREATE INDEX idx_properties_role_row ON properties(role, row_index)"
            )
            connection.execute("CREATE INDEX idx_properties_id ON properties(id)")
            rows = []
            feature_records = features.itertuples(index=False, name=None)
            for row_index, feature_values in enumerate(feature_records):
                source = raw.iloc[row_index]
                sale_date = _sale_date_iso(source["date"])
                feature_payload = {
                    column: float(value)
                    for column, value in zip(FEATURE_COLUMNS, feature_values, strict=True)
                }
                rows.append(
                    (
                        row_index,
                        property_id_from_value(source["id"]),
                        _HELD_OUT if row_index in test_index else _REFERENCE,
                        float(source["lat"]),
                        float(source["long"]),
                        str(int(source["zipcode"])).zfill(5),
                        sale_date,
                        float(source["price"]),
                        _valuation_year(sale_date),
                        float(source["sqft_living"]),
                        float(source["bedrooms"]),
                        float(source["bathrooms"]),
                        float(source["grade"]),
                        float(source["condition"]),
                        float(source["yr_built"]),
                        int(source["waterfront"]),
                        json.dumps(feature_payload, separators=(",", ":")),
                    )
                )
            connection.executemany(
                """
                INSERT INTO properties (
                    row_index, id, role, latitude, longitude, zipcode, sale_date,
                    actual_price_usd, valuation_year, sqft_living, bedrooms, bathrooms,
                    grade, condition, yr_built, waterfront, feat_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                rows,
            )
            connection.commit()
        finally:
            connection.close()

    def _connect(self) -> sqlite3.Connection:
        if not self.path.is_file():
            raise FileNotFoundError(
                f"Catalog database not found at {self.path}. Run scripts/export_catalog.py."
            )
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        return connection

    def list_properties(
        self,
        *,
        q: str | None = None,
        zip: str | None = None,
        bbox: tuple[float, float, float, float] | None = None,
        waterfront: bool | None = None,
        min_sqft: float | None = None,
        max_sqft: float | None = None,
        cursor: str | None = None,
        limit: int = 24,
    ) -> dict:
        if limit < 1:
            raise ValueError("limit must be >= 1")
        offset = _parse_cursor(cursor)
        where, params = _filter_clause(
            q=q,
            zipcode=zip,
            bbox=bbox,
            waterfront=waterfront,
            min_sqft=min_sqft,
            max_sqft=max_sqft,
        )
        connection = self._connect()
        try:
            total = int(
                connection.execute(f"SELECT COUNT(*) FROM properties WHERE {where}", params).fetchone()[0]
            )
            query_params = [*params, int(limit), offset]
            selected = connection.execute(
                f"""
                SELECT * FROM properties
                WHERE {where}
                ORDER BY row_index
                LIMIT ? OFFSET ?
                """,
                query_params,
            ).fetchall()
        finally:
            connection.close()
        next_offset = offset + len(selected)
        next_cursor = str(next_offset) if next_offset < total else None
        return {
            "items": [_record(row) for row in selected],
            "next_cursor": next_cursor,
            "total": total,
        }

    def get_property(self, property_id: str) -> dict | None:
        connection = self._connect()
        try:
            row = connection.execute(
                """
                SELECT * FROM properties
                WHERE id = ?
                ORDER BY row_index
                LIMIT 1
                """,
                (str(property_id),),
            ).fetchone()
        finally:
            connection.close()
        if row is None:
            return None
        detail = _record(row)
        detail["valuation_year"] = int(row["valuation_year"]) if row["valuation_year"] is not None else None
        detail["neighborhood_label"] = None
        return detail

    def get_raw_features(self, property_id: str) -> dict | None:
        """Unscaled model columns, including reference rows, plus id, lat, long, zipcode."""
        connection = self._connect()
        try:
            row = connection.execute(
                """
                SELECT id, feat_json FROM properties
                WHERE id = ?
                ORDER BY row_index
                LIMIT 1
                """,
                (str(property_id),),
            ).fetchone()
        finally:
            connection.close()
        if row is None:
            return None
        features = {key: float(value) for key, value in json.loads(row["feat_json"]).items()}
        features["id"] = row["id"]
        features["lat"] = float(features["lat"])
        features["long"] = float(features["long"])
        features["zipcode"] = float(features["zipcode"])
        return features


def _parse_cursor(cursor: str | None) -> int:
    if cursor is None or cursor == "":
        return 0
    try:
        offset = int(str(cursor))
    except ValueError as exc:
        raise ValueError("cursor must be an integer offset string") from exc
    if offset < 0:
        raise ValueError("cursor must be >= 0")
    return offset


def _filter_clause(
    *,
    q: str | None,
    zipcode: str | None,
    bbox: tuple[float, float, float, float] | None,
    waterfront: bool | None,
    min_sqft: float | None,
    max_sqft: float | None,
) -> tuple[str, list[object]]:
    clauses = ["role = ?"]
    params: list[object] = [_HELD_OUT]
    if q is not None and str(q).strip() != "":
        pattern = _like_pattern(str(q).strip())
        clauses.append("(id LIKE ? ESCAPE '\\' OR zipcode LIKE ? ESCAPE '\\')")
        params.extend([pattern, pattern])
    if zipcode is not None and str(zipcode).strip() != "":
        clauses.append("zipcode = ?")
        params.append(str(zipcode).strip().zfill(5))
    if bbox is not None:
        if len(bbox) != 4:
            raise ValueError("bbox must be (west, south, east, north)")
        west, south, east, north = (float(value) for value in bbox)
        clauses.append("longitude >= ? AND latitude >= ? AND longitude <= ? AND latitude <= ?")
        params.extend([west, south, east, north])
    if waterfront is not None:
        clauses.append("waterfront = ?")
        params.append(1 if waterfront else 0)
    if min_sqft is not None:
        clauses.append("sqft_living >= ?")
        params.append(float(min_sqft))
    if max_sqft is not None:
        clauses.append("sqft_living <= ?")
        params.append(float(max_sqft))
    return " AND ".join(clauses), params


def _record(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "latitude": float(row["latitude"]),
        "longitude": float(row["longitude"]),
        "zipcode": row["zipcode"],
        "sale_date": row["sale_date"],
        "actual_price_usd": _as_number(row["actual_price_usd"])
        if row["actual_price_usd"] is not None
        else None,
        "attributes": {
            "sqft_living": _as_number(row["sqft_living"]),
            "bedrooms": _as_number(row["bedrooms"]),
            "bathrooms": _as_number(row["bathrooms"]),
            "grade": _as_number(row["grade"]),
            "condition": _as_number(row["condition"]),
            "yr_built": _as_number(row["yr_built"]),
            "waterfront": bool(row["waterfront"]),
        },
        "role": row["role"],
    }
