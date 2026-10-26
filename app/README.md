# KingSight — web app

Property value, in context. A historical King County property valuation explorer (May 2014–May 2015 sales): a landing page and an explorer where visitors select a property, request estimates from a property-feature (tabular) model and a neighborhood-graph model, inspect signed feature contributions and graph neighbors, edit attributes, and create hypothetical properties.

The product spec is [`SPEC.md`](./SPEC.md). Progress and decisions: [`IMPLEMENTATION_STATUS.md`](./IMPLEMENTATION_STATUS.md). Backend contract notes: [`API_INTEGRATION.md`](./API_INTEGRATION.md).

## Run it

Requires Node 20+ (developed on Node 25, npm 11).

```bash
cd app
npm install
npm run dev          # http://localhost:5173 — mock mode, no backend or keys needed
```

Other commands:

```bash
npm run typecheck    # tsc -b
npm run lint         # oxlint (warnings fail)
npm run test         # Vitest unit/component tests
npm run test:e2e     # Playwright browser flows (starts its own dev server on :4317)
npm run build        # typecheck + production build into dist/
npm run preview      # serve the production build
npm run check        # typecheck + lint + test + build
```

First Playwright run may need `npx playwright install chromium`.

## Configuration

Copy `.env.example` to `.env.local`. All `VITE_*` values are client-visible; never put secrets there.

| Variable | Default | Meaning |
| --- | --- | --- |
| `VITE_DATA_MODE` | `mock` | `mock` uses deterministic illustrative fixtures; `api` uses `VITE_API_BASE_URL`. API mode never falls back to mocks. |
| `VITE_API_BASE_URL` | — | Required in API mode. |
| `VITE_MAP_STYLE_URL` | — | MapLibre style URL. Empty → offline schematic map fallback. |
| `VITE_MAP_ATTRIBUTION` | — | Attribution text required by the tile/style provider. |
| `VITE_ENABLE_SCENARIOS` | `false` | Include developer scenario controls in a production build (always on in dev, mock mode only). |
| `VITE_REQUEST_TIMEOUT_MS` | `15000` | API request timeout. |

### Map tiles and attribution

The map is configuration-driven. Without `VITE_MAP_STYLE_URL` the explorer renders a clearly labeled **schematic map** (SVG, offline, not a detailed basemap) that still supports selection, clustering, neighbor overlays, and placing a hypothetical property. To use a real vector basemap set a light style URL and its attribution, for example for local evaluation:

```bash
VITE_MAP_STYLE_URL=https://tiles.openfreemap.org/styles/positron
VITE_MAP_ATTRIBUTION="© OpenStreetMap contributors · OpenFreeMap"
```

Check the provider's terms before production use; do not assume public demo tiles allow unrestricted traffic. If WebGL or the style fails at runtime, the explorer falls back to the schematic map.

### Developer scenarios (mock mode)

Append `?scenario=` (comma-separated) or use the "Dev" button (bottom-left, dev builds only): `slow`, `empty`, `partial` (graph model fails; retry succeeds), `predict-error` (first estimate fails; retry succeeds), `explain-error`, `neighbors-unavailable`, `map-unavailable`, `out-of-coverage`. Example: `/explore?property=KC-1042&scenario=partial`.

Useful fixtures: `KC-1042` (complete example, landing preview), `KC-1010` / `KC-1024` (waterfront), `KC-1004` (small), `KC-1022` (large), `KC-1005` (old home in excellent condition), `KC-1023` (grade 13), `KC-1040` (missing ZIP/sale/price), `KC-1051` (one neighbor), `KC-1050` (no neighbors), `KC-1007` (models disagree). All fixtures are synthetic and illustrative — not real transactions.

## Architecture

```text
src/
  app/                 routing (lazy routes), providers, config, client factory, dev scenario panel
  pages/               LandingPage, ExplorerPage, NotFoundPage
  components/          SiteHeader, brand (wordmark, demo badge, model tags), ui/ primitives (Radix-based)
  features/landing/    landing sections + authored SVG Pacific Northwest artwork
  features/howItWorks/ "How it works" drawer
  features/explorer/   map engines (MapLibre / schematic / unavailable), results list, filters, neighbor card, explorer state
  features/property/   details panel, attribute form, hypothetical property, estimate workflow hook
  features/prediction/ estimate card, model comparison, sensitivity comparison, contributions, neighbors
  services/            domain types, KingSightClient, HTTP adapter, Zod schemas, TanStack Query hooks, fingerprints
  mocks/               deterministic fixtures, metadata, mock model, mock client, scenarios
  styles/              Tailwind 4 tokens and global styles
  test/                test setup and render helpers
e2e/                   Playwright browser flows
```

Key decisions:

- **One data boundary.** Components use `KingSightClient` through TanStack Query hooks; no page imports fixtures.
- **Snapshot-keyed predictions.** Every input snapshot gets a stable `client_request_id` (hash of inputs + model selection). Prediction queries are keyed by it, never auto-retried or refetched, so stale responses can't overwrite newer inputs and reopening a property restores its cached results.
- **Per-target workflow.** The details panel is keyed by property, so switching selection mid-request can never show the old response for the new selection.
- **Truthful presentation.** Historical label near every estimate, persistent "Demo data" badge in mock mode, actual sale price only for the unchanged record, log-price contributions never shown as dollars, no averaged models, no invented intervals or metrics.
- **Lazy explorer.** The landing page never loads MapLibre/WebGL.

Stack: React 19, TypeScript 6, Vite 8, React Router 8, Tailwind CSS 4, TanStack Query 5, React Hook Form 7 + Zod 4, MapLibre GL 6, Radix primitives, lucide-react, Fontsource (self-hosted Fraunces + Inter), Vitest 4 + Testing Library, Playwright, oxlint (shipped by the official Vite template).

Deployment target is Vercel (static SPA; configure a rewrite of all paths to `index.html`). Nothing is deployed by this repository.
