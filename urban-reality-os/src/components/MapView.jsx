import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import LayerToggle from "./LayerToggle";
import EconomicPanel from "./EconomicPanel";
import CitySuggestions from "./CitySuggestions";
import TimeSlider from "./TimeSlider";

// Constants
const INITIAL_YEAR = 2025;
const MIN_YEAR = 2025;
const MAX_YEAR = 2040;
const MAP_CONFIG = {
  center: [77.209, 28.6139],
  zoom: 12,
  pitch: 60,
  bearing: -20
};
const FLOOD_ANIMATION_CONFIG = {
  depthIncrement: 0.02,
  resetDepth: 0,
  baseDepthMultiplier: 0.4
};
const IMPACT_MODEL = {
  baseAQI: 90,
  maxAQI: 200,
  baseFloodRisk: 0.25,
  maxFloodRisk: 0.85,
  baseTraffic: 0.35,
  maxTraffic: 0.85,
  basePopulation: 28000,
  populationGrowth: 6000
};
// Use environment variable - set VITE_TOMTOM_API_KEY in your .env file
const TOMTOM_KEY = import.meta.env.VITE_TOMTOM_API_KEY;

export default function MapView() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const yearRef = useRef(INITIAL_YEAR);
  const floodAnimRef = useRef(null);
  const floodDepthRef = useRef(0);
  const flyThroughTimeoutsRef = useRef([]);

  const [year, setYear] = useState(INITIAL_YEAR);
  const [impactData, setImpactData] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [floodMode, setFloodMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [layers, setLayers] = useState({
    aqi: true,
    flood: true,
    traffic: true,
    floodDepth: false
  });

  /* ================= MAP INIT ================= */
  useEffect(() => {
    if (mapRef.current) return;

    let isMounted = true;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style:
        "https://api.maptiler.com/maps/hybrid/style.json?key=UQBNCVHquLf1PybiywBt",
      center: MAP_CONFIG.center,
      zoom: MAP_CONFIG.zoom,
      pitch: MAP_CONFIG.pitch,
      bearing: MAP_CONFIG.bearing,
      antialias: true
    });

    mapRef.current = map;
    popupRef.current = new maplibregl.Popup({ 
      closeButton: false, 
      offset: 12,
      closeOnClick: true 
    });
    
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    const loadMapData = async () => {
      try {
        setLoading(true);
        setError(null);

        await new Promise((resolve) => {
          if (map.loaded()) {
            resolve();
          } else {
            map.once("load", resolve);
          }
        });

        if (!isMounted) return;

        /* ===== TERRAIN ===== */
        map.addSource("terrain", {
          type: "raster-dem",
          url:
            "https://api.maptiler.com/tiles/terrain-rgb/tiles.json?key=UQBNCVHquLf1PybiywBt",
          tileSize: 256
        });

        map.setTerrain({ source: "terrain", exaggeration: 1.4 });

        /* ===== AQI ===== */
        try {
          const aqiResponse = await fetch("/data/aqi.json");
          if (!aqiResponse.ok) throw new Error("Failed to load AQI data");
          const aqiData = await aqiResponse.json();
          
          if (isMounted) {
            map.addSource("aqi", { type: "geojson", data: aqiData });
            map.addLayer({
              id: "aqi-layer",
              type: "circle",
              source: "aqi",
              paint: {
                "circle-radius": 8,
                "circle-opacity": 0.85,
                "circle-color": [
                  "interpolate",
                  ["linear"],
                  ["get", "aqi"],
                  50, "#22c55e",
                  100, "#eab308",
                  150, "#f97316",
                  200, "#dc2626"
                ]
              }
            });
          }
        } catch (err) {
          console.error("Error loading AQI data:", err);
          if (isMounted) setError("Failed to load AQI data");
        }

        /* ===== STATIC FLOOD (DATA) ===== */
        try {
          const floodResponse = await fetch("/data/flood.json");
          if (!floodResponse.ok) throw new Error("Failed to load flood data");
          const floodData = await floodResponse.json();
          
          if (isMounted) {
            map.addSource("flood", { type: "geojson", data: floodData });
            map.addLayer({
              id: "flood-layer",
              type: "fill",
              source: "flood",
              paint: {
                "fill-color": "#2563eb",
                "fill-opacity": 0.45
              }
            });
          }
        } catch (err) {
          console.error("Error loading flood data:", err);
          if (isMounted) setError("Failed to load flood data");
        }

        /* ===== FLOOD DEPTH (ANIMATED) ===== */
        if (isMounted) {
          map.addSource("flood-depth", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] }
          });

          map.addLayer({
            id: "flood-depth-layer",
            type: "fill",
            source: "flood-depth",
            paint: {
              "fill-color": [
                "interpolate",
                ["linear"],
                ["get", "depth"],
                0, "#bfdbfe",
                1, "#60a5fa",
                2, "#2563eb",
                3, "#1e3a8a"
              ],
              "fill-opacity": [
                "interpolate",
                ["linear"],
                ["get", "depth"],
                0, 0.2,
                3, 0.75
              ]
            }
          });
        }

        /* ===== TRAFFIC (TomTom API) ===== */
        try {
          if (isMounted && TOMTOM_KEY) {
            // Add TomTom Traffic Flow Source
            map.addSource("traffic", {
              type: "raster",
              // style=relative shows speed relative to free-flow (Green/Orange/Red)
              // style=absolute shows absolute speed
              tiles: [
                `https://api.tomtom.com/traffic/map/4/tile/flow/relative/{z}/{x}/{y}.png?key=${TOMTOM_KEY}`
              ],
              tileSize: 256
            });

            // Add Raster Layer
            // We use the ID "traffic-layer" so your existing LayerToggle works automatically
            map.addLayer({
              id: "traffic-layer",
              type: "raster",
              source: "traffic",
              paint: {
                "raster-opacity": 1.0,
                "raster-fade-duration": 300
              },
              layout: {
                visibility: layers.traffic ? "visible" : "none" // Respect initial state
              }
            });
          }
        } catch (err) {
          console.error("Error loading traffic data:", err);
          if (isMounted) setError("Failed to load traffic data from TomTom API");
        }

        /* ===== 3D BUILDINGS ===== */
        if (isMounted) {
          map.addLayer({
            id: "3d-buildings",
            source: "openmaptiles",
            "source-layer": "building",
            type: "fill-extrusion",
            minzoom: 14,
            paint: {
              "fill-extrusion-color": "#cbd5e1",
              "fill-extrusion-height": ["get", "render_height"],
              "fill-extrusion-base": ["get", "render_min_height"],
              "fill-extrusion-opacity": 0.9
            }
          });
        }

        if (isMounted) setLoading(false);
      } catch (err) {
        console.error("Error initializing map:", err);
        if (isMounted) {
          setError("Failed to initialize map. Please refresh the page.");
          setLoading(false);
        }
      }
    };

    /* ===== AI IMPACT MODEL ===== */
    const handleMapClick = async (e) => {
      if (!mapRef.current) return;

      const { lng, lat } = e.lngLat;
      const y = yearRef.current;
      
      // Calculate time factor for future projections
      const yearsElapsed = y - MIN_YEAR;
      const timeFactor = yearsElapsed / (MAX_YEAR - MIN_YEAR);

      // 1. Fetch Real Traffic Data for this point
      let currentTrafficFactor = IMPACT_MODEL.baseTraffic; 
      
      try {
        if (TOMTOM_KEY) {
          const response = await fetch(
            `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?key=${TOMTOM_KEY}&point=${lat},${lng}`
          );
          
          if (response.ok) {
            const data = await response.json();
            
            // Calculate congestion ratio: (Current Speed / Free Flow Speed)
            // Lower ratio = Higher Traffic. Inverting for "Traffic Impact" (0 to 1 scale)
            if (data.flowSegmentData) {
              const { currentSpeed, freeFlowSpeed } = data.flowSegmentData;
              if (freeFlowSpeed > 0) {
                const congestion = 1 - (currentSpeed / freeFlowSpeed);
                // Clamp between 0 and 1
                currentTrafficFactor = Math.max(0, Math.min(1, congestion));
              }
            }
          }
        }
      } catch (err) {
        console.warn("Could not fetch real-time traffic, falling back to model", err);
      }

      // 2. Mix Real Data with Future Projections
      // We combine real traffic (currentTrafficFactor) with your time-based growth
      const projectedTraffic = currentTrafficFactor + (0.5 * timeFactor); // Traffic gets worse over time

      const AQI = IMPACT_MODEL.baseAQI + (IMPACT_MODEL.maxAQI - IMPACT_MODEL.baseAQI) * timeFactor;
      const FloodRisk = IMPACT_MODEL.baseFloodRisk + (IMPACT_MODEL.maxFloodRisk - IMPACT_MODEL.baseFloodRisk) * timeFactor;
      const Pop = IMPACT_MODEL.basePopulation + IMPACT_MODEL.populationGrowth * timeFactor;

      // Update calculation to use 'projectedTraffic' instead of the static 'Traffic' constant
      const people = Math.round(
        800 + 110 * AQI + 12000 * FloodRisk + 9000 * projectedTraffic + 0.03 * Pop
      );

      const loss = Math.round(
        0.0028 * people + 35 * FloodRisk + 18 * projectedTraffic
      );

      setImpactData({
        zone: `Delhi Urban Zone (${y})`,
        people,
        loss,
        risk: FloodRisk > 0.6 ? "Severe 🔴" : FloodRisk > 0.4 ? "Moderate 🟠" : "Low 🟡"
      });

      if (popupRef.current && mapRef.current) {
        popupRef.current
          .setLngLat(e.lngLat)
          .setHTML(`<b>Impact simulated for ${y}</b>`)
          .addTo(mapRef.current);
      }
    };

    map.on("click", handleMapClick);
    loadMapData();

    // Cleanup function
    return () => {
      isMounted = false;
      
      if (floodAnimRef.current) {
        cancelAnimationFrame(floodAnimRef.current);
        floodAnimRef.current = null;
      }

      flyThroughTimeoutsRef.current.forEach(clearTimeout);
      flyThroughTimeoutsRef.current = [];

      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }

      if (mapRef.current) {
        map.off("click", handleMapClick);
        map.remove();
        mapRef.current = null;
      }
    };
  }, []);

  /* ================= YEAR SYNC ================= */
  useEffect(() => {
    yearRef.current = year;
  }, [year]);

  /* ================= FLOOD DEPTH ANIMATION ================= */
  useEffect(() => {
    if (!mapRef.current) return;
    
    const map = mapRef.current;
    const floodSource = map.getSource("flood-depth");
    
    if (!floodSource) return;

    // Cancel any ongoing animation
    if (floodAnimRef.current) {
      cancelAnimationFrame(floodAnimRef.current);
      floodAnimRef.current = null;
    }

    // Reset flood depth when disabled
    if (!floodMode || !layers.floodDepth) {
      floodDepthRef.current = FLOOD_ANIMATION_CONFIG.resetDepth;
      floodSource.setData({
        type: "FeatureCollection",
        features: []
      });
      return;
    }

    // Calculate max depth based on year
    const yearsElapsed = year - MIN_YEAR;
    const timeFactor = yearsElapsed / (MAX_YEAR - MIN_YEAR);
    const maxDepth = 3 * (timeFactor + FLOOD_ANIMATION_CONFIG.baseDepthMultiplier);

    // Reset depth when toggling on or year changes significantly
    if (floodDepthRef.current >= maxDepth) {
      floodDepthRef.current = FLOOD_ANIMATION_CONFIG.resetDepth;
    }

    const animate = () => {
      if (!mapRef.current || !floodSource) return;

      const currentDepth = floodDepthRef.current + FLOOD_ANIMATION_CONFIG.depthIncrement;
      floodDepthRef.current = Math.min(currentDepth, maxDepth);

      floodSource.setData({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { depth: floodDepthRef.current },
            geometry: {
              type: "Polygon",
              coordinates: [[
                [77.16, 28.56],
                [77.32, 28.56],
                [77.32, 28.70],
                [77.16, 28.70],
                [77.16, 28.56]
              ]]
            }
          }
        ]
      });

      // Continue animation if not at max depth
      if (floodDepthRef.current < maxDepth) {
        floodAnimRef.current = requestAnimationFrame(animate);
      } else {
        floodAnimRef.current = null;
      }
    };

    // Start animation
    floodAnimRef.current = requestAnimationFrame(animate);

    // Cleanup on unmount or dependency change
    return () => {
      if (floodAnimRef.current) {
        cancelAnimationFrame(floodAnimRef.current);
        floodAnimRef.current = null;
      }
    };
  }, [floodMode, year, layers.floodDepth]);

  /* ================= LAYER TOGGLES ================= */
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const toggle = (id, visible) => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
      }
    };

    toggle("aqi-layer", layers.aqi);
    toggle("flood-layer", layers.flood);
    toggle("traffic-layer", layers.traffic);
    toggle("flood-depth-layer", layers.floodDepth);
  }, [layers]);

  /* ================= CINEMATIC CAMERA ================= */
  const flyToPoint = useCallback((lng, lat, zoom = 14, pitch = 65, bearing = 0) => {
    if (!mapRef.current) return;

    mapRef.current.flyTo({
      center: [lng, lat],
      zoom,
      pitch,
      bearing,
      speed: 0.6,
      curve: 1.8,
      essential: true
    });
  }, []);

  const startCityFlyThrough = useCallback(() => {
    if (!mapRef.current) return;

    // Clear any existing fly-through timeouts
    flyThroughTimeoutsRef.current.forEach(clearTimeout);
    flyThroughTimeoutsRef.current = [];

    const tour = [
      { lng: 77.2090, lat: 28.6139, zoom: 13, bearing: -20 },
      { lng: 77.2200, lat: 28.6300, zoom: 15, bearing: 60 },
      { lng: 77.2300, lat: 28.6500, zoom: 14, bearing: 140 },
      { lng: 77.2000, lat: 28.6200, zoom: 16, bearing: 220 },
      { lng: 77.1850, lat: 28.6000, zoom: 13, bearing: 320 }
    ];

    let i = 0;

    const flyNext = () => {
      if (i >= tour.length || !mapRef.current) {
        flyThroughTimeoutsRef.current = [];
        return;
      }
      const p = tour[i];
      flyToPoint(p.lng, p.lat, p.zoom, 65, p.bearing);
      i++;
      const timeout = setTimeout(flyNext, 4500);
      flyThroughTimeoutsRef.current.push(timeout);
    };

    flyNext();
  }, [flyToPoint]);

  const toggleFloodMode = useCallback(() => {
    setFloodMode((prev) => {
      const newFloodMode = !prev;
      if (newFloodMode && !layers.floodDepth) {
        // Enable flood depth layer when starting flood mode
        setLayers((prevLayers) => ({ ...prevLayers, floodDepth: true }));
      }
      return newFloodMode;
    });
  }, [layers.floodDepth]);

  return (
    <>
      {/* Loading Overlay */}
      {loading && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(2, 6, 23, 0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            color: "#fff",
            fontSize: 18,
            backdropFilter: "blur(8px)"
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ marginBottom: 12, fontSize: 32 }}>🗺️</div>
            <div>Loading map data...</div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            zIndex: 1000,
            background: "rgba(220, 38, 38, 0.95)",
            color: "#fff",
            padding: "12px 18px",
            borderRadius: 8,
            maxWidth: 300,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            backdropFilter: "blur(8px)"
          }}
        >
          <strong>⚠️ Error:</strong> {error}
          <button
            onClick={() => setError(null)}
            style={{
              marginLeft: 12,
              background: "rgba(255,255,255,0.2)",
              border: "none",
              color: "#fff",
              padding: "4px 8px",
              borderRadius: 4,
              cursor: "pointer"
            }}
          >
            ✕
          </button>
        </div>
      )}

      <LayerToggle layers={layers} setLayers={setLayers} />
      <TimeSlider year={year} setYear={setYear} />

      {/* Control Buttons */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 320,
          zIndex: 10,
          display: "flex",
          gap: 10
        }}
      >
        <button
          onClick={startCityFlyThrough}
          disabled={loading || !mapRef.current}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            border: "none",
            background: loading || !mapRef.current ? "#374151" : "#020617",
            color: "#fff",
            cursor: loading || !mapRef.current ? "not-allowed" : "pointer",
            fontSize: 14,
            fontWeight: 500,
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            transition: "all 0.2s",
            opacity: loading || !mapRef.current ? 0.6 : 1
          }}
          onMouseEnter={(e) => {
            if (!loading && mapRef.current) {
              e.target.style.background = "#1e293b";
              e.target.style.transform = "translateY(-1px)";
            }
          }}
          onMouseLeave={(e) => {
            if (!loading && mapRef.current) {
              e.target.style.background = "#020617";
              e.target.style.transform = "translateY(0)";
            }
          }}
        >
          🎥 Fly Through City
        </button>

        <button
          onClick={toggleFloodMode}
          disabled={loading || !mapRef.current}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            border: "none",
            background:
              floodMode && layers.floodDepth
                ? "#2563eb"
                : loading || !mapRef.current
                ? "#374151"
                : "#020617",
            color: "#fff",
            cursor: loading || !mapRef.current ? "not-allowed" : "pointer",
            fontSize: 14,
            fontWeight: 500,
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            transition: "all 0.2s",
            opacity: loading || !mapRef.current ? 0.6 : 1
          }}
          onMouseEnter={(e) => {
            if (!loading && mapRef.current) {
              e.target.style.background =
                floodMode && layers.floodDepth ? "#1d4ed8" : "#1e293b";
              e.target.style.transform = "translateY(-1px)";
            }
          }}
          onMouseLeave={(e) => {
            if (!loading && mapRef.current) {
              e.target.style.background =
                floodMode && layers.floodDepth ? "#2563eb" : "#020617";
              e.target.style.transform = "translateY(0)";
            }
          }}
        >
          🌊 {floodMode ? "Stop" : "Start"} Flood Animation
        </button>
      </div>

      <EconomicPanel data={impactData} />
      <CitySuggestions map={mapRef.current} visible={showSuggestions} />

      <div
        ref={mapContainer}
        style={{
          width: "100vw",
          height: "100vh",
          position: "relative"
        }}
      />
    </>
  );
}
