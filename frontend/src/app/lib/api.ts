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

export type RouteData = Record<string, unknown> & {
  static_map_url?: string | null;
};

export type RouteResponse = {
  route_id: number;
  summary: string;
  explanation: string;
  route_data: RouteData;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Request failed (${response.status}): ${message || path}`);
  }

  return response.json() as Promise<T>;
}

export const loopwalkApi = {
  health: async () => {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) throw new Error("Health check failed");
    return response.json() as Promise<{ status: string }>;
  },

  route: (payload: RouteRequest) => postJson<RouteResponse>("/route", payload),
  routeByDuration: (payload: DurationRouteRequest) =>
    postJson<RouteResponse>("/route/by-duration", payload),
};
