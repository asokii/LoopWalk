from loopwalk_ai.runner import run_agent, run_agent_by_duration
from backend.services.maps_service import (
    build_static_map_url,
    get_many_routes,
    get_routes_by_duration,
)


def _fallback_from_maps(origin: str, destination: str | None = None, minutes: int | None = None):
    """
    Fallback route selection when AI scoring fails.
    Returns the first available Google Directions candidate route.
    """
    routes = (
        get_many_routes(origin, destination)
        if destination
        else get_routes_by_duration(origin, minutes or 20)
    )

    if not routes:
        raise Exception("No routes available from Google Maps for the provided input.")

    first_route = routes[0]
    first_route["static_map_url"] = build_static_map_url(first_route)

    leg = first_route.get("legs", [{}])[0]
    distance = leg.get("distance", {}).get("text", "unknown distance")
    duration = leg.get("duration", {}).get("text", "unknown duration")

    return {
        "route_id": 0,
        "summary": first_route.get("summary", f"Fallback route ({distance}, {duration})"),
        "route": first_route,
        "explanation": (
            "AI scoring was unavailable, so LoopWalk returned a valid Google Maps walking route "
            "to keep navigation working."
        ),
    }


def get_best_route(
    origin: str,
    destination: str,
    user_query: str,
    enrichment_queries: list[str],
):
    """
    Backend wrapper around agent pipeline.
    Falls back to plain Google route selection if AI pipeline fails.
    """
    try:
        agent_state, enriched_routes = run_agent(
            origin,
            destination,
            user_query,
            enrichment_queries,
        )

        chosen_id = agent_state["chosen_route_id"]
        chosen_route = enriched_routes[chosen_id]
        chosen_route["static_map_url"] = build_static_map_url(chosen_route)

        return {
            "route_id": chosen_id,
            "summary": chosen_route.get("summary", f"Route {chosen_id}"),
            "route": chosen_route,
            "explanation": agent_state.get(
                "explanation", "Route selected by AI scoring pipeline."
            ),
        }
    except Exception as e:
        print(f"AI pipeline failed for get_best_route, using fallback: {e}")
        fallback = _fallback_from_maps(origin=origin, destination=destination)
        fallback["explanation"] += f" (fallback reason: {e})"
        return fallback


def get_best_route_by_duration(
    origin: str,
    minutes: int,
    user_query: str,
    enrichment_queries: list[str],
):
    try:
        agent_state, enriched_routes = run_agent_by_duration(
            origin,
            minutes,
            user_query,
            enrichment_queries,
        )

        chosen_id = agent_state["chosen_route_id"]
        chosen_route = enriched_routes[chosen_id]
        chosen_route["static_map_url"] = build_static_map_url(chosen_route)

        return {
            "route_id": chosen_id,
            "summary": chosen_route.get("summary", f"Route {chosen_id}"),
            "route": chosen_route,
            "explanation": agent_state.get(
                "explanation", "Route selected by AI scoring pipeline."
            ),
        }
    except Exception as e:
        print(f"AI pipeline failed for get_best_route_by_duration, using fallback: {e}")
        fallback = _fallback_from_maps(origin=origin, minutes=minutes)
        fallback["explanation"] += f" (fallback reason: {e})"
        return fallback
