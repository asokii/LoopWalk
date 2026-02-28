# LoopWalk Maps API Design Guide

This document proposes a production-ready backend API design for a maps product that starts with Google Places and stays easy to integrate with additional providers over time (crowd, safety, traffic, reviews, etc.).

## 1) Core design principles

- **Provider-agnostic core**: expose a stable internal domain model (`Place`, `AreaSignal`, `RouteRisk`) and keep each external API behind adapters.
- **Composability**: split endpoints by concern (search, details, crowd, safety, routing) so clients can request only what they need.
- **Explainability**: return `score`, `confidence`, and `factors[]` for every derived metric (crowdedness/safety).
- **Graceful degradation**: if one provider fails, return partial results with source-specific warnings.
- **Cost-aware orchestration**: use field masks, caching, and staged enrichment to limit paid API calls.

## 2) Recommended backend architecture

```text
Client Apps (web/mobile)
   -> API Gateway / BFF
      -> Maps Domain Service
          |- Place Search Service
          |- Place Details Service
          |- Scoring Service (crowd/safety)
          |- Ranking Service
          |- Provider Adapters
              |- Google Places Adapter
              |- Yelp/Foursquare Adapter (optional)
              |- Mobility/Crime Providers (optional)
          |- Cache (Redis)
          |- Persistence (Postgres)
```

### Why this structure works

- Places can be swapped (or dual-sourced) without breaking app contracts.
- New integrations are isolated to adapters and score pipelines.
- Scoring can evolve from heuristic to ML with no client changes.

## 3) Domain model (internal API contract)

Use internal canonical entities and map external payloads into them.

### `Place`

- `id` (internal UUID)
- `external_ids` (`google_place_id`, `yelp_id`, etc.)
- `name`, `types[]`, `location {lat,lng}`
- `address`, `open_now`, `rating`, `rating_count`, `price_level`
- `source_attribution[]`

### `CrowdSignal`

- `place_id`
- `score` (0-100)
- `level` (`low|medium|high`)
- `confidence` (0-1)
- `factors[]` (e.g. `time_of_day=0.7`, `live_reports=0.2`)
- `updated_at`, `ttl_seconds`

### `SafetySignal`

- `geo_cell` or `place_id`
- `score` (0-100, where higher means safer)
- `confidence`
- `factors[]` (`recent_incidents`, `lighting_proxy`, `time_of_day`)
- `updated_at`, `ttl_seconds`

## 4) API surface (v1)

### 4.1 Nearby places

`GET /v1/places/nearby`

Query params:
- `lat`, `lng` (required)
- `radius_m` (default 1200)
- `types` (e.g. `cafe,coffee_shop`)
- `open_now` (optional)
- `limit` (default 20)
- `sort` (`distance|rating|best_match`)

Returns:
- list of canonical `Place` summaries
- optional `crowd_signal`/`safety_signal` when requested via `include=`

### 4.2 Place details

`GET /v1/places/{place_id}`

Returns:
- canonical place details
- provider raw IDs
- current derived signals
- lightweight provider metadata (`source_status`)

### 4.3 Batch signals for map viewport

`POST /v1/signals/viewport`

Body:
- bounds or geohash tiles
- requested signals (`crowd`, `safety`)

Returns:
- compact tile/cell scores for map overlays

### 4.4 User report endpoint (for real-time crowd accuracy)

`POST /v1/places/{place_id}/reports/crowd`

Body:
- `level` (`low|medium|high`)
- optional `wait_minutes`, `notes`

Returns:
- accepted report + updated aggregate snapshot

## 5) Integration strategy with Google Places first

### Step A: Search via Places Nearby/Text Search

- Use field masks to fetch only what nearby cards require.
- Normalize types into your internal taxonomy.
- Persist external IDs for later enrichment.

### Step B: Enrich details on demand

- Call details only for selected places or top N results.
- Cache details aggressively (e.g. 1-24h depending on fields).

### Step C: Derive scores in scoring service

- Start with deterministic formulas.
- Blend with external providers when present.
- Always return confidence and stale age.

## 6) Scoring framework (crowd + safety)

## 6.1 Crowd score formula (v1 heuristic)

Example normalized blend:

- `popularity = log(1 + rating_count)`
- `temporal = hourly_popularity_prior(place_type, weekday, hour)`
- `distance_bias = f(distance)`
- `live_reports = weighted_recent_reports(last_60m)`

`crowd_score = 100 * clamp(0, 1, 0.35*popularity + 0.35*temporal + 0.10*distance_bias + 0.20*live_reports)`

Then map to levels:
- `0-33 low`
- `34-66 medium`
- `67-100 high`

### 6.2 Safety score formula (v1 heuristic)

- `incident_rate` (recent incidents per area)
- `time_risk` (late-night modifier)
- `environment` (lighting/road factors if available)
- `crowd_protective` (optional context-dependent)

`safe_score = 100 * clamp(0, 1, 0.45*(1-incident_rate) + 0.25*(1-time_risk) + 0.20*environment + 0.10*crowd_protective)`

## 7) Provider adapter interface

Define one adapter contract per provider:

```python
class PlacesProvider(Protocol):
    async def search_nearby(self, lat: float, lng: float, radius_m: int, types: list[str], limit: int) -> list[ExternalPlace]:
        ...

    async def get_place_details(self, external_place_id: str) -> ExternalPlaceDetails:
        ...
```

Do the same for `CrowdProvider` and `SafetyProvider`. This keeps integrations pluggable and testable.

## 8) Data storage and caching

### Tables/collections

- `places`
- `place_external_ids`
- `place_snapshots`
- `crowd_signals`
- `safety_signals`
- `crowd_reports`

### Cache keys

- `nearby:{geohash}:{radius}:{types_hash}` (TTL 1-5m)
- `details:{provider}:{external_id}` (TTL 1-24h)
- `signal:crowd:{place_id}` (TTL 2-10m)
- `signal:safety:{geo_cell}` (TTL 10-60m)

## 9) Reliability and observability checklist

- Per-provider circuit breaker and timeout budgets.
- Retries with jitter for transient 429/5xx.
- Metrics: p95 latency, cache hit rate, provider error rate, score freshness.
- Structured logs with `request_id`, `provider`, `degraded=true/false`.
- Dead-letter queue for failed async enrichments.

## 10) Security, legal, and compliance notes

- Keep API keys server-side only.
- Restrict provider keys by IP/service and endpoint.
- Respect provider terms around data retention, caching, and display attribution.
- If using user reports, store minimal PII and add abuse controls.

## 11) Suggested implementation roadmap

1. Build canonical place model + Google Places adapter.
2. Ship `nearby` and `details` endpoints with cache.
3. Add heuristic crowd score + user crowd reports.
4. Add safety score from one geography provider.
5. Add viewport batch signals and map overlays.
6. Add second provider adapters and score blending.

## 12) Minimal response example

```json
{
  "place_id": "pl_123",
  "name": "Common Grounds",
  "location": { "lat": 40.74, "lng": -73.99 },
  "rating": 4.6,
  "crowd_signal": {
    "score": 62,
    "level": "medium",
    "confidence": 0.71,
    "factors": [
      {"name":"temporal","value":0.74},
      {"name":"live_reports","value":0.55}
    ],
    "updated_at": "2026-02-28T12:34:56Z"
  },
  "safety_signal": {
    "score": 79,
    "confidence": 0.66,
    "factors": [
      {"name":"incident_rate","value":0.18},
      {"name":"time_risk","value":0.22}
    ],
    "updated_at": "2026-02-28T12:30:00Z"
  }
}
```

This structure is easy to consume by UI clients and straightforward to extend as you integrate additional providers.


## 13) Walkthrough: calculate multiple routes and pass data to APIs/LLMs

This section gives a practical end-to-end flow for your exact question: generate candidate routes, score them, and provide a clean payload to third-party APIs or an LLM.

### 13.1 Inputs you need

- Origin (`lat,lng`) and destination (`lat,lng`) or a search intent (`"quiet cafe to work"`).
- User preferences (walk time cap, avoid unsafe blocks, prefer less crowded places, wheelchair access, etc.).
- Context window (current time, weather, weekday/weekend, event flags).

### 13.2 Route generation (k-shortest candidates)

1. Use a routing provider (Google Routes, Mapbox Directions, OpenRouteService, etc.) to request **alternatives**.
2. Ask for at least `k=3..5` candidates for meaningful tradeoffs.
3. Decode each polyline to points and segment by geohash/tile so you can join area signals quickly.

Per route collect base metrics:
- `duration_s`
- `distance_m`
- `elevation_gain_m` (if available)
- `turn_count` or complexity proxy

### 13.3 Enrich each route with crowd and safety signals

For each route candidate:

- Sample points every N meters (e.g. 50-100m).
- Query your `SafetySignal` by cell and aggregate (mean/min/weighted percentile).
- Query live/estimated crowd around waypoints and destination places.
- Add transport context (traffic speed, road class, lighting proxy for night if available).

Route-level aggregates to compute:
- `crowd_exposure_score` (higher means busier)
- `safety_score` (higher means safer)
- `reliability_score` (confidence/freshness weighted)

### 13.4 Multi-objective ranking (not just fastest)

Use a weighted objective configurable per user intent.

**Important sequencing:**
1. Generate alternatives with routing APIs.
2. Enrich routes with places/crowd/safety signals.
3. Rank routes deterministically in backend services.
4. Use an LLM/agent **afterward** for explanation, personalization copy, or tie-break UX — not as the source of truth for core ranking.

Example:

`route_score = 0.35*time_score + 0.25*safety_score + 0.20*(1-crowd_exposure) + 0.10*comfort_score + 0.10*scenic_score`

Where each component is normalized 0-1.

Recommended implementation details:
- Keep `weights` in DB/config for A/B testing.
- Return both `best_route` and `alternatives[]` with clear factor breakdown.
- Include `why_selected` text from deterministic logic (not LLM-generated by default).

### 13.5 API contract to expose route candidates

`POST /v1/routes/plan`

Request body:

```json
{
  "origin": {"lat": 40.741, "lng": -73.989},
  "destination": {"lat": 40.729, "lng": -73.997},
  "mode": "walk",
  "alternatives": 4,
  "preferences": {
    "prioritize": ["safety", "low_crowd"],
    "max_duration_min": 35
  },
  "include": ["route_signals", "places_along_route"]
}
```

Response body (shape):
- `routes[]` with geometry + scores + confidence
- `selected_route_id`
- `scoring_weights`
- `attribution[]`

### 13.6 Passing route data to other APIs

Use an event or webhook after route selection:

- `route.planned`
- `route.started`
- `route.completed`

Publish a compact canonical payload (avoid provider-specific raw blobs):

```json
{
  "event": "route.planned",
  "route_id": "rt_789",
  "user_id": "u_123",
  "summary": {
    "duration_s": 1320,
    "distance_m": 2100,
    "safety_score": 82,
    "crowd_exposure_score": 37,
    "confidence": 0.74
  },
  "waypoints": [
    {"lat": 40.739, "lng": -73.991, "eta_s": 420}
  ],
  "meta": {
    "computed_at": "2026-02-28T13:00:00Z",
    "sources": ["google_routes", "internal_safety_v1", "crowd_v1"]
  }
}
```

This makes it easy for:
- notification APIs (send alerts)
- analytics pipelines
- partner integrations

### 13.7 Passing route data to LLMs safely and effectively

LLMs should receive **structured summaries**, not full noisy raw provider payloads.

Best practice:
1. Build a compact `RouteContext` JSON.
2. Include only top 2-3 alternatives + factor explanations.
3. Ask LLM for user-facing explanation, not scoring decisions.
4. Keep scoring deterministic in backend for consistency/auditability.
5. If you let an agent re-rank, treat it as a **secondary preference layer** with guardrails and never override hard constraints (e.g., safety minimums).

Example `RouteContext`:

```json
{
  "user_goal": "Find the safest reasonable walk under 35 minutes",
  "routes": [
    {
      "id": "rt_a",
      "duration_min": 24,
      "safety_score": 82,
      "crowd_exposure": 37,
      "key_factors": ["well-lit streets", "low incident cells"]
    },
    {
      "id": "rt_b",
      "duration_min": 21,
      "safety_score": 68,
      "crowd_exposure": 54,
      "key_factors": ["faster", "passes high-crowd corridor"]
    }
  ],
  "selected_route": "rt_a"
}
```

Prompting pattern:
- System: "Explain route choices using provided fields only. Do not invent crime/crowd facts."
- User: "Summarize why route `rt_a` is recommended and when `rt_b` might be better."

### 13.8 Guardrails and quality checks

- Reject stale signals beyond TTL in ranking (or lower confidence).
- If safety provider fails, mark `degraded=true` and rebalance weights.
- Track offline eval metrics:
  - route acceptance rate
  - reroute rate
  - user-reported safety/crowd agreement
- Store feature snapshots for reproducibility and model iteration.

### 13.9 Implementation sequence for this route capability

1. Add `/v1/routes/plan` with routing-provider alternatives only.
2. Add safety/crowd enrichment over route geometry.
3. Add deterministic multi-objective ranker + explanation fields.
4. Add event/webhook payloads for external APIs.
5. Add LLM explanation endpoint using compact `RouteContext`.
6. Add feedback loop from user reports to improve weights.



## 14) Where to put the Maps API key

Use environment variables and keep keys server-side only.

### 14.1 Backend env vars

Add these to your backend `.env` (never commit this file):

```bash
GOOGLE_MAPS_API_KEY=your_server_side_key_here
GOOGLE_PLACES_API_KEY=your_server_side_key_here
GOOGLE_ROUTES_API_KEY=your_server_side_key_here
```

You can use one key for all enabled Google Maps Platform APIs, but many teams keep separate keys per service for easier rotation/monitoring.

### 14.2 Python config pattern

In this repo, you already load env vars via `python-dotenv` in `loopwalk-ai/config.py`, so the Maps key should be read there (or in a dedicated settings module) and injected into provider adapters.

Example:

```python
import os
from dotenv import load_dotenv

load_dotenv()

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
if not GOOGLE_MAPS_API_KEY:
    raise ValueError("GOOGLE_MAPS_API_KEY is required")
```

### 14.3 Where it is used in architecture

- `Provider Adapters -> Google Places Adapter`
- `Provider Adapters -> Google Routes Adapter`

The key should only be attached on server-to-server HTTP calls from these adapters.

### 14.4 Frontend rule

Do **not** expose server keys to browser/mobile clients.

- Client calls your backend (`/v1/places/*`, `/v1/routes/plan`).
- Backend calls Google APIs using the secret key.
- If you must use client-side map SDK keys, create a separate restricted browser key with strict domain/app restrictions.

### 14.5 Production key hygiene

- Restrict key by API scope (Places/Routes only as needed).
- Restrict by source (server IP/VPC egress where possible).
- Rotate keys periodically.
- Log quota usage and set billing alerts.
- Store secrets in a secret manager for production (not plain `.env`).
