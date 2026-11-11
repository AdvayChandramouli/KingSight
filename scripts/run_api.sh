#!/usr/bin/env bash
# Start the KingSight API on port 8000. Extra args are passed to uvicorn.
set -euo pipefail
cd "$(dirname "$0")/.."
export PYTHONPATH="src${PYTHONPATH:+:$PYTHONPATH}"
exec uv run uvicorn kingsight.api.main:app --port 8000 "$@"
