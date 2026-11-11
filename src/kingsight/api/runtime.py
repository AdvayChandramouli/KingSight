"""Lazy calls into catalog, feature, and model packages.

Imports happen inside methods so this process can start before those artifacts exist.
"""

from __future__ import annotations

import inspect
import logging
import threading
from typing import Any

from kingsight.api.metadata import AGREED_RULE, coverage_region
from kingsight.api.settings import Settings

logger = logging.getLogger("kingsight.api")


class Unavailable(Exception):
    """A model or dataset artifact cannot be loaded."""


class ModelFailed(Exception):
    """A loaded model failed on this input."""


def _callable_params(fn: Any) -> dict[str, inspect.Parameter]:
    try:
        return dict(inspect.signature(fn).parameters)
    except (TypeError, ValueError):
        return {}


def invoke(fn: Any, *args: Any, **kwargs: Any) -> Any:
    params = _callable_params(fn)
    if any(param.kind == inspect.Parameter.VAR_KEYWORD for param in params.values()):
        return fn(*args, **kwargs)
    filtered = {key: value for key, value in kwargs.items() if key in params}
    if "latitude" in kwargs and "latitude" not in params and "lat" in params:
        filtered["lat"] = kwargs["latitude"]
    if "longitude" in kwargs and "longitude" not in params:
        if "long" in params:
            filtered["long"] = kwargs["longitude"]
        elif "lon" in params:
            filtered["lon"] = kwargs["longitude"]
    if "property_id" in kwargs and "property_id" not in params and "id" in params:
        filtered["id"] = kwargs["property_id"]
    return fn(*args, **filtered)


def as_numpy(features: list[float]):
    import numpy as np

    return np.asarray(features, dtype=float)


def _load_class(cls: type, directory):
    params = _callable_params(cls.load)
    if "artifact_dir" in params:
        return cls.load(artifact_dir=directory)
    if "path" in params:
        return cls.load(path=directory)
    return cls.load(directory)


def open_catalog(path):
    from kingsight.catalog.store import CatalogStore

    if not path.is_file():
        raise FileNotFoundError(path)
    factories = []
    if callable(getattr(CatalogStore, "open", None)):
        factories.append(lambda: CatalogStore.open(path))
    if callable(getattr(CatalogStore, "load", None)):
        factories.append(lambda: CatalogStore.load(path))
    factories.extend(
        [
            lambda: CatalogStore(path),
            lambda: CatalogStore(path=path),
            lambda: CatalogStore(db_path=path),
            lambda: CatalogStore(catalog_path=path),
        ]
    )
    last_type_error: TypeError | None = None
    for factory in factories:
        try:
            return factory()
        except TypeError as exc:
            last_type_error = exc
            continue
    if last_type_error is not None:
        raise last_type_error
    raise TypeError("CatalogStore has no usable constructor")


class Runtime:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._lock = threading.Lock()
        self._catalog = None
        self._scaler = None
        self._tabular = None
        self._graph = None
        self._region: dict | None = None

    def region(self) -> dict:
        if self._region is None:
            self._region = coverage_region()
        return self._region

    def in_coverage(self, latitude: float, longitude: float) -> bool:
        region = self.region()
        checker = region.get("checker")
        if callable(checker):
            try:
                return bool(checker(latitude, longitude))
            except Exception:
                logger.exception("coverage helper failed")
        from kingsight.api.geo import point_in_polygon

        return point_in_polygon(longitude, latitude, region["polygon"])

    def catalog(self):
        with self._lock:
            if self._catalog is not None:
                return self._catalog
        try:
            store = open_catalog(self.settings.catalog_path)
        except (FileNotFoundError, ImportError, ModuleNotFoundError) as exc:
            raise Unavailable("catalog") from exc
        except Exception as exc:
            logger.exception("catalog open failed")
            raise Unavailable("catalog") from exc
        with self._lock:
            self._catalog = store
        return store

    def scaler(self):
        with self._lock:
            if self._scaler is not None:
                return self._scaler
        try:
            from kingsight.data.scaler import load_scaler
        except (ImportError, ModuleNotFoundError) as exc:
            raise Unavailable("scaler") from exc
        path = self.settings.scaler_path
        if not path.is_file():
            raise Unavailable("scaler")
        try:
            loaded = load_scaler(path)
        except Exception as exc:
            logger.exception("scaler load failed")
            raise Unavailable("scaler") from exc
        with self._lock:
            self._scaler = loaded
        return loaded

    def _model(self, kind: str):
        attr = "_tabular" if kind == "xgboost" else "_graph"
        with self._lock:
            cached = getattr(self, attr)
            if cached is not None:
                return cached
        try:
            if kind == "xgboost":
                from kingsight.models.tabular import TabularRegressor

                model = _load_class(TabularRegressor, self.settings.xgboost_dir)
            else:
                from kingsight.models.graph import GraphRegressor

                model = _load_class(GraphRegressor, self.settings.gnn_dir)
        except (FileNotFoundError, ImportError, ModuleNotFoundError) as exc:
            raise Unavailable(kind) from exc
        except Exception as exc:
            logger.exception("%s load failed", kind)
            raise Unavailable(kind) from exc
        with self._lock:
            setattr(self, attr, model)
        return model

    def raw_features(self, property_id: str) -> dict | None:
        catalog = self.catalog()
        return catalog.get_raw_features(property_id)

    def get_property(self, property_id: str) -> dict | None:
        catalog = self.catalog()
        return catalog.get_property(property_id)

    def list_properties(self, **kwargs):
        catalog = self.catalog()
        fn = catalog.list_properties
        params = _callable_params(fn)
        if any(param.kind == inspect.Parameter.VAR_KEYWORD for param in params.values()) or not params:
            return fn(**kwargs)
        payload = {}
        aliases = {"zip": "zipcode"}
        for key, value in kwargs.items():
            if key == "bbox" and "bbox" in params:
                annotation = params["bbox"].annotation
                if annotation is str and isinstance(value, tuple):
                    value = ",".join(str(part) for part in value)
            if key in params:
                payload[key] = value
            elif aliases.get(key) in params:
                payload[aliases[key]] = value
        return fn(**payload)

    def lookup_neighbor(self, property_id: str) -> dict | None:
        catalog = self.catalog()
        for name in ("get_property", "get_record", "get_any"):
            fn = getattr(catalog, name, None)
            if not callable(fn):
                continue
            found = fn(property_id)
            if found:
                return found
        raw = catalog.get_raw_features(property_id)
        return raw

    def assemble(self, **kwargs) -> tuple[Any, list[str]]:
        try:
            from kingsight.features.assemble import assemble_features
        except (ImportError, ModuleNotFoundError) as exc:
            raise Unavailable("features") from exc
        try:
            scaler = kwargs.get("scaler")
            if scaler is None:
                scaler = self.scaler()
            call = {key: value for key, value in kwargs.items() if key != "scaler"}
            params = _callable_params(assemble_features)
            if "scaler" not in params and "feature_scaler" in params:
                call["feature_scaler"] = scaler
            else:
                call["scaler"] = scaler
            result = invoke(assemble_features, **call)
        except Unavailable:
            raise
        except Exception as exc:
            logger.exception("feature assembly failed")
            raise Unavailable("features") from exc
        return _unpack_assemble(result)

    def predict_tabular(self, features: list[float]) -> tuple[str, float]:
        model = self._model("xgboost")
        try:
            price = invoke(model.predict_usd, as_numpy(features))
            version = str(getattr(model, "version", "0.1.0"))
            return version, float(price)
        except (ImportError, ModuleNotFoundError) as exc:
            raise Unavailable("xgboost") from exc
        except Exception as exc:
            logger.exception("xgboost predict failed")
            raise ModelFailed("xgboost") from exc

    def predict_graph(
        self,
        features: list[float],
        latitude: float,
        longitude: float,
        property_id: str | None,
    ) -> tuple[str, float]:
        model = self._model("gnn")
        try:
            price = invoke(
                model.predict_usd,
                as_numpy(features),
                latitude=latitude,
                longitude=longitude,
                property_id=property_id,
            )
            version = str(getattr(model, "version", "0.1.0"))
            return version, float(price)
        except (ImportError, ModuleNotFoundError) as exc:
            raise Unavailable("gnn") from exc
        except Exception as exc:
            logger.exception("gnn predict failed")
            raise ModelFailed("gnn") from exc

    def explain(
        self,
        model_id: str,
        features: list[float],
        latitude: float,
        longitude: float,
        property_id: str | None,
    ) -> dict:
        vector = as_numpy(features)
        try:
            if model_id == "xgboost":
                from kingsight.explain.tabular import explain_tabular

                model = self._model("xgboost")
                payload = invoke(explain_tabular, model, vector)
            elif model_id == "gnn":
                from kingsight.explain.graph import explain_graph

                model = self._model("gnn")
                payload = invoke(
                    explain_graph,
                    model,
                    vector,
                    latitude=latitude,
                    longitude=longitude,
                    property_id=property_id,
                )
            else:
                raise Unavailable(model_id)
        except Unavailable:
            raise
        except (ImportError, ModuleNotFoundError, FileNotFoundError) as exc:
            raise Unavailable(model_id) from exc
        except Exception as exc:
            logger.exception("explain failed for %s", model_id)
            raise ModelFailed(model_id) from exc
        if not isinstance(payload, dict):
            raise ModelFailed(model_id)
        return payload

    def query_neighbors(
        self,
        features: list[float],
        latitude: float,
        longitude: float,
        property_id: str | None,
    ) -> tuple[str, str, list]:
        model = self._model("gnn")
        try:
            rows = invoke(
                model.neighbors,
                as_numpy(features),
                latitude=latitude,
                longitude=longitude,
                property_id=property_id,
                limit=12,
            )
        except (ImportError, ModuleNotFoundError) as exc:
            raise Unavailable("gnn") from exc
        except Exception as exc:
            logger.exception("neighbor query failed")
            raise ModelFailed("gnn") from exc
        version = str(getattr(model, "graph_version", None) or getattr(model, "version", "0.1.0"))
        rule = getattr(model, "rule_label", None)
        if not isinstance(rule, str) or not rule.strip():
            rule = AGREED_RULE
        if rows is None:
            rows = []
        return version, rule, list(rows)


def _unpack_assemble(result: Any) -> tuple[Any, list[str]]:
    if isinstance(result, tuple) and len(result) == 2:
        features, warnings = result
        return features, [str(item) for item in list(warnings or [])]
    if isinstance(result, dict):
        features = result.get("features", result.get("vector"))
        warnings = result.get("warnings") or []
        return features, [str(item) for item in warnings]
    raise Unavailable("features")
