"""Process-lifetime prediction store keyed by prediction id and client request id."""

from __future__ import annotations

import threading
from dataclasses import dataclass, field


@dataclass
class StoredPrediction:
    prediction_id: str
    client_request_id: str
    response: dict
    features: list[float]
    latitude: float
    longitude: float
    property_id: str | None
    source: str
    statuses: dict[str, str] = field(default_factory=dict)

    @property
    def succeeded(self) -> set[str]:
        return {model_id for model_id, status in self.statuses.items() if status == "success"}


class PredictionStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._by_id: dict[str, StoredPrediction] = {}
        self._by_client: dict[str, str] = {}

    def get(self, prediction_id: str) -> StoredPrediction | None:
        with self._lock:
            return self._by_id.get(prediction_id)

    def get_by_client(self, client_request_id: str) -> StoredPrediction | None:
        with self._lock:
            prediction_id = self._by_client.get(client_request_id)
            if prediction_id is None:
                return None
            return self._by_id.get(prediction_id)

    def save(self, stored: StoredPrediction) -> StoredPrediction:
        with self._lock:
            existing_id = self._by_client.get(stored.client_request_id)
            if existing_id is not None:
                return self._by_id[existing_id]
            self._by_id[stored.prediction_id] = stored
            self._by_client[stored.client_request_id] = stored.prediction_id
            return stored
