import image_8774b0bd1df166ad114767342f591fd7cb12d3c3 from 'figma:assets/8774b0bd1df166ad114767342f591fd7cb12d3c3.png'
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ChevronLeft, MapPin, Clock, Footprints, Navigation } from "lucide-react";
import { Button } from "./ui/button";
import { ChatBox } from "./ChatBox";
import type { RouteResponse } from "../lib/api";

interface RouteStep {
  name: string;
  description: string;
  distance: string;
  type: "start" | "waypoint" | "destination";
}

interface RouteStepRaw {
  html_instructions?: string;
  distance?: {
    text?: string;
    value?: number;
  };
}

interface RouteLegRaw {
  distance?: {
    text?: string;
    value?: number;
  };
  steps?: RouteStepRaw[];
}

const FALLBACK_ROUTE_STEPS: RouteStep[] = [
  { name: "Current Location", description: "Starting point", distance: "0 mi", type: "start" },
  { name: "First turn", description: "Head toward your destination", distance: "0.2 mi", type: "waypoint" },
  { name: "Continue", description: "Stay on the current road", distance: "0.3 mi", type: "waypoint" },
  { name: "Final approach", description: "Approaching destination", distance: "0.2 mi", type: "waypoint" },
];

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

export function CalibratedMapScreen() {
  const [destination, setDestination] = useState("");
  const [duration, setDuration] = useState(0);
  const [mode, setMode] = useState<"destination" | "duration">("destination");
  const [goal, setGoal] = useState("");
  const [goalDetail, setGoalDetail] = useState("");
  const [origin, setOrigin] = useState("");
  const [isCalibrating, setIsCalibrating] = useState(true);
  const [selectedRoute, setSelectedRoute] = useState<RouteResponse | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const sessionMode = sessionStorage.getItem("mode");
    const selectedGoal = sessionStorage.getItem("goal");

    if (!sessionMode || !selectedGoal) {
      navigate("/start");
      return;
    }

    setMode(sessionMode as "destination" | "duration");
    setGoal(selectedGoal);

    if (sessionMode === "destination") {
      const dest = sessionStorage.getItem("destination");
      if (dest) setDestination(dest);
    } else {
      const dur = sessionStorage.getItem("duration");
      if (dur) setDuration(parseInt(dur, 10));
    }

    const detail = sessionStorage.getItem("goalDetail");
    if (detail) setGoalDetail(detail);

    const savedOrigin = sessionStorage.getItem("origin");
    if (savedOrigin) setOrigin(savedOrigin);

    const rawSelectedRoute = sessionStorage.getItem("selectedRoute");
    if (rawSelectedRoute) {
      try {
        setSelectedRoute(JSON.parse(rawSelectedRoute) as RouteResponse);
      } catch {
        sessionStorage.removeItem("selectedRoute");
      }
    }

    setTimeout(() => {
      setIsCalibrating(false);
    }, 2000);
  }, [navigate]);

  const routeLeg = useMemo(() => {
    const routeData = selectedRoute?.route_data as { legs?: RouteLegRaw[] } | undefined;
    return routeData?.legs?.[0];
  }, [selectedRoute]);

  const routeSteps = useMemo<RouteStep[]>(() => {
    const rawSteps = routeLeg?.steps;
    if (!rawSteps?.length) {
      return FALLBACK_ROUTE_STEPS;
    }

    const mapped = rawSteps.map((step, index) => ({
      name: index === 0 ? "Start" : `Step ${index + 1}`,
      description: step.html_instructions ? stripHtml(step.html_instructions) : "Continue",
      distance: step.distance?.text || "",
      type: (index === 0 ? "start" : "waypoint") as RouteStep["type"],
    }));

    return mapped;
  }, [routeLeg]);

  const totalDistance = useMemo(() => {
    if (routeLeg?.distance?.text) {
      return routeLeg.distance.text;
    }

    const miles = routeSteps.reduce((acc, step) => {
      const value = parseFloat(step.distance);
      return acc + (Number.isNaN(value) ? 0 : value);
    }, 0);

    return `${miles.toFixed(1)} mi`;
  }, [routeLeg, routeSteps]);

  const waypointCount = routeSteps.filter((s) => s.type === "waypoint").length;
  const staticMapUrl = selectedRoute?.route_data?.static_map_url;

  const handleBack = () => navigate(-1);
  const handleStartWalk = () => navigate("/navigate");

  if (isCalibrating) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6 max-w-[430px] mx-auto">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6 animate-pulse">
            <Navigation className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl mb-3">Calibrating Route</h2>
          <p className="text-muted-foreground">Finding the best path for your journey...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-[430px] mx-auto">
      <div className="px-6 pt-12 pb-6">
        <button
          onClick={handleBack}
          className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center mb-6 hover:bg-accent transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl mb-3">Your Route</h1>
        <p className="text-muted-foreground">
          {goalDetail ? `${goalDetail} - ` : ""}
          {goal.charAt(0).toUpperCase() + goal.slice(1)} walk
        </p>
        {origin && <p className="mt-1 text-sm text-muted-foreground">Starting from {origin}</p>}
        {selectedRoute && <p className="mt-2 text-sm text-muted-foreground">{selectedRoute.summary}</p>}
      </div>

      <div className="flex-1 px-6 pb-6 flex flex-col overflow-y-auto">
        <div className="bg-card border border-border rounded-2xl p-4 mb-6 relative overflow-hidden min-h-[320px]">
          <img
            src={staticMapUrl || image_8774b0bd1df166ad114767342f591fd7cb12d3c3}
            alt={staticMapUrl ? "Generated map from Google Static Maps" : "Map overlay"}
            className="absolute inset-0 w-full h-full object-cover"
          />

          <div className="absolute bottom-4 left-4 right-4 bg-background/95 backdrop-blur-sm rounded-xl p-4 border border-border">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Footprints className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground">Total Distance</span>
              </div>
              <span className="font-medium">{totalDistance}</span>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 mb-6">
          <h3 className="mb-4">Route Details</h3>
          <div className="relative space-y-4 max-h-[280px] overflow-y-auto pr-2">
            {routeSteps.map((step, index) => (
              <div key={`${step.name}-${index}`} className="flex items-start gap-4 relative">
                <div className="flex-shrink-0 relative z-10">
                  {step.type === "start" ? (
                    <div className="w-5 h-5 rounded-full bg-accent border-3 border-primary"></div>
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-primary mt-0.5"></div>
                  )}
                </div>

                <div className="flex-1 min-w-0 pb-2">
                  <p className={`${step.type === "start" ? "font-medium" : ""} mb-1`}>{step.name}</p>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>

                <div className="text-sm text-muted-foreground flex-shrink-0">{step.distance}</div>
              </div>
            ))}

            {mode === "destination" && destination && (
              <div className="flex items-start gap-4 relative">
                <div className="flex-shrink-0 relative z-10">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-primary-foreground" />
                  </div>
                </div>
                <div className="flex-1 min-w-0 pb-2">
                  <p className="font-medium mb-1">{destination}</p>
                  <p className="text-sm text-muted-foreground">Final destination</p>
                </div>
              </div>
            )}

            <div className="absolute left-[10px] top-2 bottom-6 w-0.5 bg-gradient-to-b from-accent via-primary to-primary rounded-full -z-0"></div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 mb-6">
          <h3 className="mb-4">Trip Summary</h3>
          <div className="space-y-4">
            {mode === "destination" && destination && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground">Destination</p>
                  <p className="truncate">{destination}</p>
                </div>
              </div>
            )}

            {mode === "duration" && duration > 0 && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p>{duration} minutes</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Footprints className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Waypoints</p>
                <p>{waypointCount} stops along the route</p>
              </div>
            </div>
          </div>
        </div>

        {selectedRoute && (
          <div className="bg-card border border-border rounded-2xl p-6 mb-6">
            <h3 className="mb-2">Why this route</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{selectedRoute.explanation}</p>
          </div>
        )}

        <div className="space-y-3">
          <Button
            onClick={handleStartWalk}
            className="w-full h-14 rounded-xl bg-gradient-to-r from-[#E4002B] to-[#FF6D6D] hover:opacity-90 active:bg-[#E4002B] active:bg-none text-white"
          >
            <Navigation className="mr-2 w-5 h-5" />
            Start Walking
          </Button>
          <p className="text-center text-sm text-muted-foreground">Follow the route to discover more along the way</p>
        </div>
      </div>

      <ChatBox />
    </div>
  );
}
