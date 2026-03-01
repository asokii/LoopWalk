# Connecting the LoopWalk backend to the frontend (current version)

This guide explains how to wire the existing React/Vite frontend to the FastAPI backend that already exposes `/route`, `/route/by-duration`, and `/health`.

## 1) Start both services

From repo root:

```bash
uvicorn backend.main:app --reload
```

From `frontend/`:

```bash
npm install
npm run dev
```

Backend defaults to `http://127.0.0.1:8000` and frontend to `http://127.0.0.1:5173`.

## 2) Add a frontend API base URL

Create `frontend/.env.local`:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Then read it in frontend code with:

```ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";
```

## 3) Add a typed API client

Create `frontend/src/app/lib/api.ts`:

```ts
export type RouteRequest = {
  origin: string;
  destination: string;
  user_query: string;
  enrichment_queries: string[];
};

export type DurationRouteRequest = {
  origin: string;
  minutes: number;
  user_query: string;
  enrichment_queries: string[];
};

export type RouteResponse = {
  route_id: number;
  summary: string;
  explanation: string;
  route_data: Record<string, unknown>;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${path} failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<T>;
}

export const loopwalkApi = {
  health: async () => {
    const res = await fetch(`${API_BASE_URL}/health`);
    if (!res.ok) throw new Error("Health check failed");
    return res.json() as Promise<{ status: string }>;
  },

  route: (payload: RouteRequest) =>
    postJson<RouteResponse>("/route", payload),

  routeByDuration: (payload: DurationRouteRequest) =>
    postJson<RouteResponse>("/route/by-duration", payload),
};
```

## 4) Build payloads from existing UI state

Current screens already persist selection data in `sessionStorage`:
- `mode` (`destination` or `duration`)
- `destination` or `duration`

When user confirms goals in `GoalSelectionScreen`, add one backend call:

- If `mode === "destination"`, call `/route`
- If `mode === "duration"`, call `/route/by-duration`

Suggested payload mapping:

```ts
const origin = "Chicago Loop, IL"; // replace with geolocated address later
const mode = sessionStorage.getItem("mode");
const destination = sessionStorage.getItem("destination") ?? "";
const minutes = Number(sessionStorage.getItem("duration") ?? "30");
const userQuery = selectedGoalText; // e.g. "I want a calm walk with cafe stops"
const enrichmentQueries = inferEnrichmentQueries(selectedGoalText);
```

Simple enrichment inference (good enough for now):

```ts
function inferEnrichmentQueries(goal: string): string[] {
  const q = goal.toLowerCase();
  const queries = ["cafe"];
  if (q.includes("park") || q.includes("calm") || q.includes("nature")) queries.push("park");
  if (q.includes("food") || q.includes("restaurant")) queries.push("restaurant");
  if (q.includes("historic") || q.includes("architecture")) queries.push("landmark");
  return Array.from(new Set(queries));
}
```

## 5) Store backend result for map/navigation screens

After API returns, persist response:

```ts
sessionStorage.setItem("selectedRoute", JSON.stringify(routeResponse));
```

Then in `CalibratedMapScreen` and `ActiveNavigationScreen`, read and parse it:

```ts
const route = JSON.parse(sessionStorage.getItem("selectedRoute") ?? "null");
```

Use fallback mock data when route is missing, so the UI still works offline.

## 6) Add loading + error states on the submit action

Use a simple `isLoading` + `error` pattern in `GoalSelectionScreen`:
- Disable submit button while loading
- Show a user-friendly error banner if API fails
- Only navigate to `/walk` after successful response

## 7) Optional: add Vite dev proxy (same-origin local calls)

Alternative to absolute URLs: add a local proxy in `frontend/vite.config.ts` and call `/api/*` from the browser.

```ts
server: {
  proxy: {
    "/api": {
      target: "http://127.0.0.1:8000",
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, ""),
    },
  },
},
```

Then calls become `fetch("/api/route", ...)`.

## 8) Quick verification checklist

1. Open `http://127.0.0.1:8000/docs` and test endpoint manually.
2. In frontend, confirm selected goal triggers one POST request in Network tab.
3. Confirm response includes `route_id`, `summary`, `explanation`, and `route_data`.
4. Confirm `/walk` screen reads `selectedRoute` from `sessionStorage`.
5. Confirm refresh-safe behavior (fallback or re-request).

---

If you want, the next step is to implement this guide directly in `GoalSelectionScreen`, `CalibratedMapScreen`, and `ActiveNavigationScreen` with a production-ready typed adapter.
