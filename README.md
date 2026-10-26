# KingSight

Graph-based property valuation for King County, Washington — exploring historical sale context (May 2014–May 2015) through property features and neighborhood-graph models.

## Repository

| Path | Description |
| --- | --- |
| [`app/`](app/README.md) | **Web frontend** — landing page + property explorer (mock-backed, production build ready) |
| [`app/SPEC.md`](app/SPEC.md) | Frontend product and implementation specification |
| [`notebooks/`](notebooks/) | EDA, preprocessing, baseline models (XGBoost, CatBoost, …), explainability |
| [`data/`](data/) | King County house sales CSVs (not committed to the frontend bundle) |
| [`handoff.md`](handoff.md) | Continuation guide for the next developer or agent session |
| [`pyproject.toml`](pyproject.toml) | Python environment (uv) for notebooks and training |

## Quick start — web app

```bash
cd app
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Mock mode needs no API keys or map credentials (schematic map fallback). Try `/explore?property=KC-1042`.

```bash
npm run check   # typecheck, lint, unit tests, production build
```

See [`app/README.md`](app/README.md) for configuration, architecture, developer scenarios, and deployment notes.

## Quick start — Python / notebooks

```bash
uv sync
# activate .venv, then open notebooks/preprocessing.ipynb or notebooks/models.ipynb
```

Training and inference services are **not** part of the frontend; see [`handoff.md`](handoff.md) for integrating a real API behind `HttpKingSightClient`.

## Status

The mock-backed UI meets the core flows in `app/SPEC.md` (discovery, estimate, compare models, contributions, neighbors, edits, hypothetical property). Real model inference and a hosted API are the main follow-ups — documented in [`handoff.md`](handoff.md) and [`app/API_INTEGRATION.md`](app/API_INTEGRATION.md).
