import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { createRoot } from "react-dom/client";


import MapMenu from "./MapMenu";
import LayerToggle from "./LayerToggle";
import EconomicPanel from "./EconomicPanel";
import CitySuggestions from "./CitySuggestions";
import TimeSlider from "./TimeSlider";
import SearchBar from "./SearchBar";
import { getUrbanAnalysis } from "../utils/gemini";
import { fetchIndiaMacroData } from "../utils/worldBank";
import { calculateImpactModel } from "../utils/impactModel";
import { fetchRealtimeAQI } from "../utils/aqi";
import LocationPopup from "./LocationPopup";
import InsightPanel from "./InsightPanel";
import MetricBar from "./MetricBar";
import { getTerrainInsight } from "../utils/gemini";

// Constants
const BASE_YEAR = 2025;
const INITIAL_YEAR = BASE_YEAR;
const MIN_YEAR = BASE_YEAR;
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
// OpenWeather Air Pollution API key (set VITE_OPENWEATHER_API_KEY in .env)
// Get free API key from: https://openweathermap.org/api/air-pollution
const OPENWEATHER_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY || "";
const MAPTILER_KEY = "UQBNCVHquLf1PybiywBt";
const SATELLITE_STYLE = `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`;
const TERRAIN_STYLE = `https://api.maptiler.com/maps/basic-v2/style.json?key=${MAPTILER_KEY}`;
const STREET_STYLE = `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`;

// --- Terrain Utils ---
const TERRAIN_SAMPLE_DELTA = 0.0005;

function getElevation(map, lngLat) {
    if (!map || !lngLat) return 0;
    try {
        // Guard: if terrain isn't ready yet, avoid calling queryTerrainElevation
        if (!map.getTerrain || !map.getTerrain()) return 0;
        return map.queryTerrainElevation(lngLat, { exaggerated: false }) ?? 0;
    } catch (e) {
        return 0;
    }
}

function getSlope(map, lngLat) {
    if (!map || !lngLat) return 0;
    try {
        const e1 = getElevation(map, lngLat);
        const e2 = getElevation(map, {
            lng: lngLat.lng + TERRAIN_SAMPLE_DELTA,
            lat: lngLat.lat
        });
        return Math.abs(e2 - e1) / TERRAIN_SAMPLE_DELTA;
    } catch (e) {
        return 0;
    }
}

function getDrainageScore(map, lngLat) {
    const slope = getSlope(map, lngLat);
    return Math.max(0, 1 - slope * 4);
}

function calculateHeatIndex(map, lngLat, builtDensity = 0.6) {
    const elevation = getElevation(map, lngLat);
    const slope = getSlope(map, lngLat);
    return Math.max(0, 1 + builtDensity * 2 - elevation * 0.002 - slope * 0.4);
}

function trafficSpeedMultiplier(map, lngLat) {
    const slope = getSlope(map, lngLat);
    return Math.max(0.4, 1 - slope * 0.6);
}

function populationRisk(map, lngLat, population) {
    const floodRisk = getDrainageScore(map, lngLat);
    const heat = calculateHeatIndex(map, lngLat);
    return population * (floodRisk * 0.6 + heat * 0.4);
}

function simulateFlood(map, center, rainfall) {
    if (!map || !center) return [];
    
    const features = [];
    const step = 0.002;

    for (let dx = -0.01; dx <= 0.01; dx += step) {
        for (let dy = -0.01; dy <= 0.01; dy += step) {
            try {
                const lng = center[0] + dx;
                const lat = center[1] + dy;

                const elevation = getElevation(map, { lng, lat });
                const drainage = getDrainageScore(map, { lng, lat });
                const depth = Math.max(0, (rainfall - elevation * 0.02) * drainage);

                if (depth <= 0) continue;

                features.push({
                    type: "Feature",
                    properties: { depth: Math.min(depth, 5) },
                    geometry: {
                        type: "Polygon",
                        coordinates: [[
                            [lng, lat],
                            [lng + step, lat],
                            [lng + step, lat + step],
                            [lng, lat + step],
                            [lng, lat]
                        ]]
                    }
                });
            } catch (e) {
                // Skip invalid coordinates
            }
        }
    }

    return features;
}

// --- Elevation Cache ---
const elevationCache = new Map();

function getCachedElevation(map, lngLat) {
    if (!map || !lngLat) return 0;
    const key = `${lngLat.lng.toFixed(5)},${lngLat.lat.toFixed(5)}`;
    if (!elevationCache.has(key)) {
        elevationCache.set(key, getElevation(map, lngLat));
    }
    return elevationCache.get(key);
}

// --- Water Flow Direction ---
function getFlowDirection(map, lngLat) {
    if (!map || !lngLat) return { dx: 0, dy: 0 };
    const d = 0.0006;
    
    try {
        const eCenter = getCachedElevation(map, lngLat);
        const eEast = getCachedElevation(map, { lng: lngLat.lng + d, lat: lngLat.lat });
        const eNorth = getCachedElevation(map, { lng: lngLat.lng, lat: lngLat.lat + d });
        
        return {
            dx: eCenter - eEast,
            dy: eCenter - eNorth
        };
    } catch (e) {
        return { dx: 0, dy: 0 };
    }
}

// --- Risk Score Calculation ---
function calculateRisk(map, lngLat, population = 1) {
    if (!map || !lngLat) return 0;
    try {
        const flood = getDrainageScore(map, lngLat);
        const heat = calculateHeatIndex(map, lngLat);
        return (flood * 0.6 + heat * 0.4) * population;
    } catch (e) {
        return 0;
    }
}

// --- Emergency Response Time ---
function emergencyResponseTime(map, lngLat) {
    if (!map || !lngLat) return 5;
    try {
        const slope = getSlope(map, lngLat);
        const floodPenalty = getDrainageScore(map, lngLat);
        return Math.round(5 + slope * 12 + floodPenalty * 8);
    } catch (e) {
        return 5;
    }
}

// --- Update Functions for Terrain Features ---
function updateWaterFlow(map) {
    if (!map) return;
    try {
        const center = map.getCenter();
        const features = [];
        const arrowLength = 0.001; // Length of flow arrow

        for (let i = -0.01; i <= 0.01; i += 0.004) {
            for (let j = -0.01; j <= 0.01; j += 0.004) {
                const lngLat = {
                    lng: center.lng + i,
                    lat: center.lat + j
                };

                const { dx, dy } = getFlowDirection(map, lngLat);
                const magnitude = Math.sqrt(dx * dx + dy * dy);
                
                // Only show arrows where there's significant flow
                if (magnitude > 0.1) {
                    // Normalize direction
                    const normDx = dx / magnitude;
                    const normDy = dy / magnitude;
                    
                    // Create line from start to end point
                    const startLng = lngLat.lng;
                    const startLat = lngLat.lat;
                    const endLng = startLng + normDx * arrowLength;
                    const endLat = startLat + normDy * arrowLength;
                    
                    features.push({
                        type: "Feature",
                        properties: { magnitude },
                        geometry: {
                            type: "LineString",
                            coordinates: [[startLng, startLat], [endLng, endLat]]
                        }
                    });
                }
            }
        }

        const source = map.getSource("water-flow");
        if (source) {
            source.setData({
                type: "FeatureCollection",
                features
            });
        }
    } catch (e) {
        console.warn("Water flow update failed:", e);
    }
}

function updateRiskHeatmap(map) {
    if (!map) return;
    try {
        const center = map.getCenter();
        const features = [];

        for (let x = -0.015; x <= 0.015; x += 0.004) {
            for (let y = -0.015; y <= 0.015; y += 0.004) {
                const lngLat = { lng: center.lng + x, lat: center.lat + y };
                const risk = calculateRisk(map, lngLat);

                if (risk > 0) {
                    features.push({
                        type: "Feature",
                        properties: { risk },
                        geometry: {
                            type: "Point",
                            coordinates: [lngLat.lng, lngLat.lat]
                        }
                    });
                }
            }
        }

        const source = map.getSource("risk-heat");
        if (source) {
            source.setData({
                type: "FeatureCollection",
                features
            });
        }
    } catch (e) {
        console.warn("Risk heatmap update failed:", e);
    }
}

function updateEmergencyZones(map) {
    if (!map) return;
    try {
        const center = map.getCenter();
        const features = [];

        for (let i = -0.01; i <= 0.01; i += 0.005) {
            for (let j = -0.01; j <= 0.01; j += 0.005) {
                const lngLat = { lng: center.lng + i, lat: center.lat + j };

                features.push({
                    type: "Feature",
                    properties: {
                        time: emergencyResponseTime(map, lngLat)
                    },
                    geometry: {
                        type: "Point",
                        coordinates: [lngLat.lng, lngLat.lat]
                    }
                });
            }
        }

        const source = map.getSource("emergency-zones");
        if (source) {
            source.setData({
                type: "FeatureCollection",
                features
            });
        }
    } catch (e) {
        console.warn("Emergency zones update failed:", e);
    }
}

// --- Throttling Utility ---
function createThrottledUpdate(delay = 300) {
    let lastUpdate = 0;
    return (fn) => {
        const now = Date.now();
        if (now - lastUpdate > delay) {
            lastUpdate = now;
            fn();
        }
    };
}

// Major Indian cities with coordinates
const MAJOR_INDIAN_CITIES = [
    { name: "Delhi", lat: 28.6139, lng: 77.2090 },
    { name: "Mumbai", lat: 19.0760, lng: 72.8777 },
    { name: "Kolkata", lat: 22.5726, lng: 88.3639 },
    { name: "Chennai", lat: 13.0827, lng: 80.2707 },
    { name: "Bangalore", lat: 12.9716, lng: 77.5946 },
    { name: "Hyderabad", lat: 17.3850, lng: 78.4867 },
    { name: "Pune", lat: 18.5204, lng: 73.8567 },
    { name: "Ahmedabad", lat: 23.0225, lng: 72.5714 },
    { name: "Jaipur", lat: 26.9124, lng: 75.8649 },
    { name: "Surat", lat: 21.1702, lng: 72.8311 },
    { name: "Lucknow", lat: 26.8467, lng: 80.9462 },
    { name: "Kanpur", lat: 26.4499, lng: 80.3319 },
    { name: "Nagpur", lat: 21.1458, lng: 79.0882 },
    { name: "Indore", lat: 22.7196, lng: 75.8577 },
    { name: "Thane", lat: 19.2183, lng: 72.9667 },
    { name: "Bhopal", lat: 23.2599, lng: 77.4126 },
    { name: "Visakhapatnam", lat: 17.6868, lng: 83.2185 },
    { name: "Patna", lat: 25.5941, lng: 85.1376 },
    { name: "Vadodara", lat: 22.3072, lng: 73.1812 },
    { name: "Ghaziabad", lat: 28.6692, lng: 77.4378 },
    { name: "Ludhiana", lat: 30.9010, lng: 75.8573 },
    { name: "Agra", lat: 27.1767, lng: 78.0081 },
    { name: "Nashik", lat: 19.9975, lng: 73.7898 },
    { name: "Faridabad", lat: 28.4089, lng: 77.3167 },
    { name: "Meerut", lat: 28.9845, lng: 77.7064 }
];

/* ====== Map Helpers: centralized rendering & lighting helpers ====== */
function ensureHillshade(map) {
    if (!map) return;
    try {
        const style = map.getStyle && map.getStyle();
        if (!style || !style.sources || !style.sources.terrain) return;
        if (map.getLayer && map.getLayer("terrain-hillshade")) return;

        map.addLayer({
            id: "terrain-hillshade",
            type: "hillshade",
            source: "terrain",
            paint: {
                "hillshade-exaggeration": 0.6,
                "hillshade-shadow-color": "#3d3d3d",
                "hillshade-highlight-color": "#ffffff",
                "hillshade-accent-color": "#9c8468"
            }
        });
    } catch (e) {
        console.warn("ensureHillshade failed:", e);
    }
}

function add3DBuildings(map) {
    if (!map) return;
    try {
        if (map.getLayer && map.getLayer("3d-buildings")) return;

        const style = map.getStyle && map.getStyle();
        if (!style || !style.sources || !style.sources.openmaptiles) return;

        map.addLayer({
            id: "3d-buildings",
            source: "openmaptiles",
            "source-layer": "building",
            type: "fill-extrusion",
            minzoom: 14,
            paint: {
                "fill-extrusion-color": "#d1d1d1",
                "fill-extrusion-height": ["get", "render_height"],
                "fill-extrusion-base": ["get", "render_min_height"],
                "fill-extrusion-opacity": 0.85
            }
        });
    } catch (e) {
        console.warn("add3DBuildings failed:", e);
    }
}

function updateSunLighting(map, hour = 14) {
    if (!map) return;
    try {
        const azimuth = (hour / 24) * 360;
        const altitude = Math.max(15, 80 - Math.abs(12 - hour) * 5);
        map.setLight({
            anchor: "map",
            position: [azimuth, altitude, 80],
            intensity: 0.8,
            color: "#ffffff"
        });
    } catch (e) {
        console.warn("updateSunLighting failed:", e);
    }
}

function enableGlobalLighting(map) {
    if (!map) return;
    try {
        map.setLight({
            anchor: "map",
            position: [1.5, 90, 80],
            intensity: 0.7,
            color: "#ffffff"
        });
    } catch (e) { /* ignore */ }
}

function enableFog(map) {
    if (!map) return;
    try {
        map.setFog({
            range: [0.6, 10],
            color: "#dbe7f3",
            "horizon-blend": 0.2,
            "star-intensity": 0
        });
    } catch (e) { /* ignore */ }
}

function rehydrateCustomLayers(map) {
    if (!map) return;
    try {
        // Terrain + hillshade + buildings + lighting should be reapplied after style/load
        if (map.getSource && map.getSource("terrain")) map.setTerrain && map.setTerrain({ source: "terrain", exaggeration: 1.4 });
        ensureHillshade(map);
        add3DBuildings(map);
        // Apply lighting after the style/terrain becomes idle
        map.once("idle", () => {
            enableGlobalLighting(map);
            enableFog(map);
            updateSunLighting(map, 16);
        });
    } catch (e) {
        console.warn("rehydrateCustomLayers failed:", e);
    }
}

function startFlyThrough(map, flyPath = defaultFlyPath) {
    if (!map) return;
    try {
        setCinematicMode(true);
        flyPath.forEach((step, i) => {
            setTimeout(() => {
                map.easeTo({ ...step, duration: 2500, easing: (t) => t * (2 - t) });
                if (i === flyPath.length - 1) setTimeout(() => setCinematicMode(false), 2600);
            }, i * 2600);
        });
    } catch (e) { console.warn('startFlyThrough failed:', e); }
}

function streetLevelView(map, lngLat) {
    if (!map || !lngLat) return;
    try {
        setCinematicMode(true);
        map.easeTo({ center: [lngLat.lng, lngLat.lat], zoom: 17, pitch: 80, bearing: Math.random() * 360, duration: 1800 });
        setTimeout(() => setCinematicMode(false), 2000);
    } catch (e) { console.warn('streetLevelView failed:', e); }
}

function setCinematicMode(active) {
    try { document.body.classList.toggle('cinematic', !!active); } catch (e) {}
}

export default function MapView() {
    const mapContainer = useRef(null);
    const mapRef = useRef(null);
    const popupRef = useRef(null);
    const popupRootRef = useRef(null);
    const popupSessionRef = useRef(0);
    const lastRequestTimeRef = useRef(0);
    const yearRef = useRef(INITIAL_YEAR);
    const floodAnimRef = useRef(null);
    const floodDepthRef = useRef(0);
    const flyThroughTimeoutsRef = useRef([]);
    const rainfallRef = useRef(0); // Store current rainfall for flood animation
    const macroDataRef = useRef(null);
    const lastAQIRef = useRef(null); // Persist AQI across renders
    const lastUpdateRef = useRef(0); // For throttling terrain updates
    const throttledUpdateRef = useRef(null); // Throttled update function

    const [year, setYear] = useState(INITIAL_YEAR);
    const [debugData, setDebugData] = useState(null);
    const [impactData, setImpactData] = useState(null);
    const [urbanAnalysis, setUrbanAnalysis] = useState(null);
    const [analysisLoading, setAnalysisLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(true);
    const [floodMode, setFloodMode] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [terrainInsight, setTerrainInsight] = useState(null);
    const [insightLoading, setInsightLoading] = useState(false);

    const [layers, setLayers] = useState({
        aqi: true,
        flood: true,
        traffic: true,
        floodDepth: false,
        terrain: true,
        hillshade: true
    });

    const [cameraState, setCameraState] = useState({
        bearing: MAP_CONFIG.bearing,
        pitch: MAP_CONFIG.pitch
    });

    const [mapStyle, setMapStyle] = useState("default"); // "default", "satellite", "terrain"
    const [showLayersMenu, setShowLayersMenu] = useState(false);
    const [aqiGeo, setAqiGeo] = useState(null);
    const [loadingAQI, setLoadingAQI] = useState(false);
    const [macroData, setMacroData] = useState(null);
    const [demographics, setDemographics] = useState(null);
    const [cityDemo, setCityDemo] = useState(null);
    const [locationPopulation, setLocationPopulation] = useState(null);
    const [activeLocation, setActiveLocation] = useState(null);

    // Sync macroData to ref for usage in callbacks
    useEffect(() => { macroDataRef.current = macroData; }, [macroData]);

    // Load saved locations markers only when map is ready
    useEffect(() => {
        if (!mapRef.current || loading) return;

        try {
            const savedLocations = JSON.parse(localStorage.getItem('savedLocations') || '[]');
            savedLocations.forEach(loc => {
                new maplibregl.Marker({ color: '#f97316' })
                    .setLngLat([loc.lng, loc.lat])
                    .addTo(mapRef.current);
            });
        } catch (e) {
            console.warn('Could not load saved locations', e);
        }
    }, [loading]);

    // Recalculate projections when the selected location or year changes
    useEffect(() => {
        if (!activeLocation) return;

        const {
            lat: aLat,
            lng: aLng,
            placeName: aPlace,
            baseAQI,
            baseRainfall,
            baseTraffic,
            baseFloodRisk,
            worldBank
        } = activeLocation;

        const yearsElapsed = year - BASE_YEAR;
        const timeFactor = yearsElapsed / (MAX_YEAR - BASE_YEAR);

        // Project AQI
        const projectedAQI = Math.round(
            baseAQI + timeFactor * (IMPACT_MODEL.maxAQI - IMPACT_MODEL.baseAQI)
        );

        // Project Traffic
        const projectedTraffic = Math.min(
            1,
            baseTraffic + timeFactor * 0.5
        );

        // Project Flood Risk
        const projectedFloodRisk = Math.min(
            1,
            baseFloodRisk + timeFactor * 0.4
        );

        // Deterministic impact model
        const impact = calculateImpactModel({
            year,
            baseYear: BASE_YEAR,
            populationBase: worldBank?.population?.value,
            aqi: projectedAQI,
            rainfallMm: baseRainfall,
            trafficCongestion: projectedTraffic,
            floodRisk: projectedFloodRisk,
            worldBank
        });

        setImpactData({
            zone: `${aPlace} (${year})`,
            people: impact.peopleAffected,
            loss: impact.economicLossCr,
            risk: impact.risk
        });

        setDemographics({
            population: impact.population,
            growthRate: 1.6,
            tfr: 1.9,
            migrantsPct: 21
        });

        // If popup root is mounted, re-render it with updated impact
        try {
            if (popupRootRef.current && popupRef.current?.isOpen() && activeLocation?.sessionId === popupSessionRef.current) {
                popupRootRef.current.render(
                    <LocationPopup
                        placeName={aPlace}
                        lat={aLat}
                        lng={aLng}
                        year={year}
                        baseYear={BASE_YEAR}
                        realTimeAQI={lastAQIRef.current}
                        finalAQI={projectedAQI}
                        rainfall={baseRainfall}
                        rainProbability={null}
                        macroData={worldBank}
                        impact={impact}
                        demographics={demographics}
                        analysis={urbanAnalysis}
                        analysisLoading={analysisLoading}
                        openWeatherKey={OPENWEATHER_KEY}
                        onSave={(name) => { if (window.saveLocation) window.saveLocation(name, aLat, aLng); }}
                    />
                );
            }
        } catch (e) { console.warn("Popup render skipped (Year Change):", e); }

    }, [year, activeLocation]);

    /* ================= MAP INIT ================= */
    useEffect(() => {
        if (!mapContainer.current || mapRef.current) return;

        let isMounted = true;

        const map = new maplibregl.Map({
            container: mapContainer.current,
            style:
                "https://api.maptiler.com/maps/streets-v2/style.json?key=UQBNCVHquLf1PybiywBt",
            center: MAP_CONFIG.center,
            zoom: MAP_CONFIG.zoom,
            pitch: MAP_CONFIG.pitch,
            bearing: MAP_CONFIG.bearing,
            antialias: true
        });

        mapRef.current = map;
        popupRef.current = new maplibregl.Popup({
            className: 'custom-popup',
            closeButton: false,
            offset: 12,
            closeOnClick: false
        });

        // Setup persistent popup close listener
        const handlePopupClose = () => {
            try {
                if (popupRootRef.current) {
                    popupRootRef.current.unmount();
                    popupRootRef.current = null;
                }
            } catch (e) {
                console.warn("Popup unmount failed:", e);
            }
        };

        popupRef.current.on("close", handlePopupClose);

        map.addControl(new maplibregl.NavigationControl(), "top-right");

        // Keep elevation cache bounded: clear on camera moves
        try { map.on && map.on("movestart", () => elevationCache.clear()); } catch (e) {}

        // Expose debug helpers to window for quick testing
        try {
            window.updateSunLighting = (h = 16) => updateSunLighting(mapRef.current, h);
            window.startFlyThrough = () => startFlyThrough(mapRef.current);
            window.streetLevelView = (lngLat) => streetLevelView(mapRef.current, lngLat);
        } catch (e) {}

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

                // Lighting & Fog for photoreal satellite — apply once style/terrain becomes idle
                try {
                    map.once("idle", () => {
                        enableGlobalLighting(map);
                        enableFog(map);
                        // Set initial sun position (late afternoon as default)
                        updateSunLighting(map, 16);
                    });
                } catch (e) { console.warn('Lighting init failed:', e); }

                // LOD and 3D performance adjustments on zoom
                try {
                    map.on('zoom', () => {
                        const z = map.getZoom();
                        // Terrain LOD
                        try { map.setTerrain({ source: 'terrain', exaggeration: z > 13 ? 1.4 : 0.8 }); } catch (e) {}
                        // 3D buildings visibility
                        try { if (map.getLayer('3d-buildings')) map.setLayoutProperty('3d-buildings', 'visibility', z > 14 ? 'visible' : 'none'); } catch (e) {}
                    });
                } catch (e) { console.warn('Zoom handlers failed:', e); }

                /* ===== HILLSHADE (TERRAIN VISUALIZATION) ===== */
                try {
                    ensureHillshade(map);
                    if (map.getLayer && map.getLayer("terrain-hillshade")) {
                        map.setLayoutProperty("terrain-hillshade", "visibility", layers.hillshade ? "visible" : "none");
                    }
                } catch (e) {
                    console.warn("Hillshade ensure failed:", e);
                }

                /* ===== TERRAIN-AWARE FLOOD SOURCE ===== */
                try {
                    map.addSource("flood-terrain", {
                        type: "geojson",
                        data: {
                            type: "FeatureCollection",
                            features: []
                        }
                    });

                    map.addLayer({
                        id: "terrain-flood-layer",
                        type: "fill",
                        source: "flood-terrain",
                        paint: {
                            "fill-color": [
                                "interpolate",
                                ["linear"],
                                ["get", "depth"],
                                0, "rgba(0,0,0,0)",
                                0.3, "rgba(80,170,255,0.25)",
                                1, "rgba(40,120,220,0.5)",
                                3, "rgba(20,60,160,0.7)"
                            ],
                            "fill-opacity": 0.6
                        },
                        layout: {
                            visibility: layers.flood ? "visible" : "none"
                        }
                    });
                } catch (e) {
                    console.warn("Terrain flood layer setup failed:", e);
                }

                /* ===== WATER FLOW ARROWS ===== */
                try {
                    map.addSource("water-flow", {
                        type: "geojson",
                        data: { type: "FeatureCollection", features: [] }
                    });

                    // Use line layer to show flow direction
                    map.addLayer({
                        id: "water-flow-arrows",
                        type: "line",
                        source: "water-flow",
                        layout: {
                            "line-cap": "round",
                            "line-join": "round",
                            visibility: "none" // Hidden by default, toggle via layer controls
                        },
                        paint: {
                            "line-color": "rgba(59, 130, 246, 0.7)",
                            "line-width": 2,
                            "line-opacity": 0.6
                        }
                    });
                } catch (e) {
                    console.warn("Water flow arrows setup failed:", e);
                }

                /* ===== RISK HEATMAP ===== */
                try {
                    map.addSource("risk-heat", {
                        type: "geojson",
                        data: { type: "FeatureCollection", features: [] }
                    });

                    map.addLayer({
                        id: "risk-heatmap",
                        type: "heatmap",
                        source: "risk-heat",
                        paint: {
                            "heatmap-weight": ["get", "risk"],
                            "heatmap-intensity": 1.2,
                            "heatmap-radius": 25,
                            "heatmap-color": [
                                "interpolate",
                                ["linear"],
                                ["heatmap-density"],
                                0, "rgba(0,0,0,0)",
                                0.3, "rgba(255,255,0,0.6)",
                                0.6, "rgba(255,165,0,0.8)",
                                1, "rgba(255,0,0,1)"
                            ],
                            "heatmap-opacity": 0.6
                        },
                        layout: {
                            visibility: "none" // Hidden by default
                        }
                    });
                } catch (e) {
                    console.warn("Risk heatmap setup failed:", e);
                }

                /* ===== EMERGENCY RESPONSE ZONES ===== */
                try {
                    map.addSource("emergency-zones", {
                        type: "geojson",
                        data: { type: "FeatureCollection", features: [] }
                    });

                    map.addLayer({
                        id: "emergency-response",
                        type: "circle",
                        source: "emergency-zones",
                        paint: {
                            "circle-radius": 10,
                            "circle-color": [
                                "interpolate",
                                ["linear"],
                                ["get", "time"],
                                5, "rgba(34,197,94,0.8)",
                                10, "rgba(234,179,8,0.8)",
                                20, "rgba(239,68,68,0.8)"
                            ],
                            "circle-opacity": 0.6,
                            "circle-stroke-width": 1,
                            "circle-stroke-color": "#ffffff",
                            "circle-stroke-opacity": 0.5
                        },
                        layout: {
                            visibility: "none" // Hidden by default
                        }
                    });
                } catch (e) {
                    console.warn("Emergency response zones setup failed:", e);
                }

                /* ===== AQI (REAL-TIME FROM OPENWEATHER API) ===== */
                const fetchAllCitiesAQI = async () => {
                    if (!OPENWEATHER_KEY) {
                        console.warn("OpenWeather API key not available");
                        return null;
                    }

                    try {
                        setLoadingAQI(true);
                        const aqiPromises = MAJOR_INDIAN_CITIES.map(async (city) => {
                            try {
                                const r = await fetchRealtimeAQI(city.lat, city.lng, OPENWEATHER_KEY);
                                if (!r) return null;
                                return {
                                    type: "Feature",
                                    properties: {
                                        aqi: r.aqi,
                                        city: city.name,
                                        level: r.category || null,
                                        pm25: r.pm25 ?? null,
                                        pm10: r.pm10 ?? null
                                    },
                                    geometry: { type: "Point", coordinates: [city.lng, city.lat] }
                                };
                            } catch (err) {
                                console.warn(`Failed to fetch AQI for ${city.name}:`, err);
                                return null;
                            }
                        });

                        const results = await Promise.all(aqiPromises);
                        const features = results.filter(f => f !== null);

                        return {
                            type: "FeatureCollection",
                            features: features
                        };
                    } catch (err) {
                        console.error("Error fetching AQI data:", err);
                        return null;
                    } finally {
                        setLoadingAQI(false);
                    }
                };

                /* ===== AQI LAYER INIT ===== */
                const aqiData = await fetchAllCitiesAQI();
                if (aqiData && isMounted) {
                    map.addSource("aqi", { type: "geojson", data: aqiData });
                    map.addLayer({
                        id: "aqi-layer",
                        type: "circle",
                        source: "aqi",
                        paint: {
                            "circle-radius": 12,
                            "circle-opacity": 0.9,
                            "circle-stroke-width": 2,
                            "circle-stroke-color": "#ffffff",
                            "circle-stroke-opacity": 0.8,
                            "circle-color": [
                                "interpolate",
                                ["linear"],
                                ["get", "aqi"],
                                0, "#22c55e",
                                50, "#22c55e",
                                100, "#eab308",
                                150, "#f97316",
                                200, "#dc2626",
                                300, "#9333ea",
                                400, "#6b21a8"
                            ]
                        }
                    });
                    setAqiGeo(aqiData);
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

                /* ===== CITY DEMOGRAPHICS (local static) ===== */
                try {
                    const demoResp = await fetch('/data/demographics.json');
                    if (demoResp && demoResp.ok) {
                        const demo = await demoResp.json();
                        if (isMounted) setCityDemo(demo);
                    }
                } catch (err) {
                    console.warn('Could not load city demographics:', err);
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
                        // Traffic layer is controlled via the Google Maps-style layers menu
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

                        // Ensure traffic layer does not sit above UI-focused layers (place it below AQI/flood)
                        try {
                            if (map.getLayer('aqi-layer')) {
                                map.moveLayer('traffic-layer', 'aqi-layer');
                            } else if (map.getLayer('flood-layer')) {
                                map.moveLayer('traffic-layer', 'flood-layer');
                            } else if (map.getStyle() && map.getStyle().layers && map.getStyle().layers.length) {
                                // move to bottom-most drawable layer to avoid UI overlap
                                const bottomLayerId = map.getStyle().layers[0].id;
                                map.moveLayer('traffic-layer', bottomLayerId);
                            }
                        } catch (moveErr) {
                            console.warn('Could not reposition traffic layer:', moveErr);
                        }
                    }
                } catch (err) {
                    console.error("Error loading traffic data:", err);
                    if (isMounted) setError("Failed to load traffic data from TomTom API");
                }

                /* ===== 3D BUILDINGS ===== */
                if (isMounted) {
                    try { add3DBuildings(map); } catch (e) { console.warn('Could not add 3d-buildings layer:', e); }
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

        // Fetch World Bank data once on mount
        (async () => {
            try {
                const data = await fetchIndiaMacroData();
                if (isMounted) setMacroData(data);
            } catch (e) {
                console.warn("World Bank data failed:", e);
            }
        })();

        /* NOTE: Replaced inline AQI fetch with centralized fetchRealtimeAQI in ../utils/aqi.js */

        /* ===== OPEN-METEO (RAIN + FLOOD SIGNAL) ===== */
        const fetchRainfall = async (lat, lng) => {
            try {
                const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=rain,precipitation_probability&forecast_days=1`;
                const res = await fetch(url);
                if (!res.ok) throw new Error("Open-Meteo error");

                const data = await res.json();

                const rainNow = data.hourly?.rain?.[0] ?? 0; // mm
                const rainProb = data.hourly?.precipitation_probability?.[0] ?? 0; // %

                return {
                    rain: rainNow,
                    probability: rainProb
                };
            } catch (err) {
                console.warn("Open-Meteo fetch failed:", err);
                return null;
            }
        };

        /* ===== REVERSE GEOCODING ===== */
        const getPlaceName = async (lat, lng) => {
            try {
                // Use OpenStreetMap Nominatim (free, no API key required)
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
                    {
                        headers: {
                            'User-Agent': 'UrbanRealityOS/1.0'
                        }
                    }
                );
                if (!response.ok) throw new Error('Geocoding failed');
                const data = await response.json();
                if (data.address) {
                    // Try to get a meaningful place name
                    const address = data.address;
                    return address.village || address.town || address.city || address.county || address.state || address.country || 'Unknown Location';
                }
                return 'Unknown Location';
            } catch (err) {
                console.warn('Reverse geocoding failed:', err);
                return 'Unknown Location';
            }
        };

        /* ===== AI IMPACT MODEL ===== */
        const handleMapClick = async (e) => {
            if (!mapRef.current) return;

            const { lng, lat } = e.lngLat;
            const y = yearRef.current;
            const macroData = macroDataRef.current;

            // Smooth camera transition to clicked location
            mapRef.current.easeTo({
                center: [lng, lat],
                zoom: Math.max(mapRef.current.getZoom(), 14),
                pitch: 65,
                bearing: -30,
                duration: 1800,
                easing: (t) => t * (2 - t) // Ease-out curve
            });

            // Start a new popup session
            const sessionId = ++popupSessionRef.current;

            // Track request time to prevent race conditions
            const requestTime = Date.now();
            lastRequestTimeRef.current = requestTime;

            // Show loading popup immediately at clicked location (React only)
            if (popupRef.current && mapRef.current) {
                // Clean up any previous root
                try { if (popupRootRef.current) { popupRootRef.current.unmount(); popupRootRef.current = null; } } catch (e) { console.warn("Root cleanup warning:", e); }

                const container = document.createElement('div');
                container.className = 'custom-popup';

                // Attach popup to map using DOM container
                popupRef.current.setLngLat([lng, lat]).setDOMContent(container).addTo(mapRef.current);

                // Create React root and render Loading State
                const root = createRoot(container);
                popupRootRef.current = root;

                root.render(
                    <LocationPopup
                        placeName="Analyzing Location..."
                        lat={lat}
                        lng={lng}
                        year={y}
                        baseYear={BASE_YEAR}
                        realTimeAQI={lastAQIRef.current}
                        finalAQI={null}
                        rainfall={0}
                        rainProbability={null}
                        macroData={macroDataRef.current}
                        impact={null}
                        demographics={demographics}
                        analysis={urbanAnalysis}
                        analysisLoading={true}
                        openWeatherKey={OPENWEATHER_KEY}
                        onSave={null}
                    />
                );

                // Unmount the root when popup closes - REMOVED (Handled by global listener)
            }

            try {
                // Set initial loading state with session ID
                setActiveLocation({ lat, lng, isInitialLoading: true, sessionId: sessionId });
                setAnalysisLoading(true);
                setUrbanAnalysis(null);

                // Parallel Data Fetching
                const [placeName, realTimeAQI, rainData, trafficJson] = await Promise.all([
                    // Place Name
                    getPlaceName(lat, lng).catch(err => {
                        console.warn("Geocoding failed:", err);
                        return "Unknown Location";
                    }),

                    // AQI Data (centralized helper)
                    (async () => {
                        try {
                            return await fetchRealtimeAQI(lat, lng, OPENWEATHER_KEY);
                        } catch (e) {
                            console.warn("AQI fetch failed:", e);
                            return null;
                        }
                    })(),

                    // Rainfall Data (race against timeout)
                    (async () => {
                        try {
                            return await Promise.race([
                                fetchRainfall(lat, lng),
                                new Promise((_, r) => setTimeout(() => r(new Error('Rain Timeout')), 4000))
                            ]);
                        } catch (e) {
                            console.warn("Rain fetch failed:", e);
                            return { rain: 0, probability: 0 };
                        }
                    })(),

                    // Traffic Data (race against timeout)
                    (async () => {
                        if (!TOMTOM_KEY) return null;
                        try {
                            const res = await Promise.race([
                                fetch(`https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?key=${TOMTOM_KEY}&point=${lat},${lng}`),
                                new Promise((_, r) => setTimeout(() => r(new Error('Traffic Timeout')), 4000))
                            ]);
                            if (res.ok) return await res.json();
                            return null;
                        } catch (e) { return null; }
                    })()
                ]);

                // 3. Process Data & Calculate Metrics

                // Rainfall
                const rainfall = rainData ? rainData.rain : 0;
                const rainProbability = rainData ? rainData.probability : 0;
                rainfallRef.current = rainfall; // Store for flood animation
                lastAQIRef.current = realTimeAQI; // Persist AQI for re-renders

                // Time Factor (use BASE_YEAR)
                const yearsElapsed = y - BASE_YEAR;
                const timeFactor = yearsElapsed / (MAX_YEAR - BASE_YEAR);

                // Traffic Calculation
                let currentTrafficFactor = IMPACT_MODEL.baseTraffic;
                if (trafficJson && trafficJson.flowSegmentData) {
                    const { currentSpeed, freeFlowSpeed } = trafficJson.flowSegmentData;
                    if (freeFlowSpeed > 0) {
                        const congestion = 1 - (currentSpeed / freeFlowSpeed);
                        currentTrafficFactor = Math.max(0, Math.min(1, congestion));
                    }
                }
                const projectedTraffic = currentTrafficFactor + (0.5 * timeFactor);

                // Risk & People Calculation
                const rainFactor = Math.min(rainfall / 20, 1);
                const rainProbFactor = rainProbability / 100;

                const FloodRisk = Math.min(
                    1,
                    IMPACT_MODEL.baseFloodRisk +
                    (IMPACT_MODEL.maxFloodRisk - IMPACT_MODEL.baseFloodRisk) * timeFactor +
                    rainFactor * 0.4 +
                    rainProbFactor * 0.2
                );

                // Determine nearest AQI from cached geo features if realtime missing
                let nearestVal = null;
                if (!realTimeAQI && aqiGeo && aqiGeo.features && aqiGeo.features.length) {
                    let bestDist = Infinity;
                    for (const f of aqiGeo.features) {
                        const [fx, fy] = f.geometry.coordinates;
                        const d = (lat - fy) * (lat - fy) + (lng - fx) * (lng - fx);
                        if (d < bestDist && Number.isFinite(f.properties?.aqi)) {
                            bestDist = d;
                            nearestVal = f.properties.aqi;
                        }
                    }
                }

                const finalAQI = realTimeAQI?.aqi ?? nearestVal ?? IMPACT_MODEL.baseAQI;

                // Use single-source deterministic impact model
                const impact = calculateImpactModel({
                    year: y,
                    baseYear: BASE_YEAR,
                    populationBase: macroData?.population?.value,
                    aqi: finalAQI,
                    rainfallMm: rainfall,
                    trafficCongestion: projectedTraffic,
                    floodRisk: FloodRisk,
                    worldBank: macroData
                });

                setImpactData({
                    zone: `${placeName} (${y})`,
                    people: impact.peopleAffected,
                    loss: impact.economicLossCr,
                    risk: impact.risk
                });

                setLocationPopulation(null); // Reset population detail logic

                // Calculate Demographics (Initial) using deterministic impact
                try {
                    setDemographics({
                        population: impact.population,
                        growthRate: 1.6,
                        tfr: 1.9,
                        migrantsPct: 21
                    });

                    // Save base/reference snapshot for this clicked location
                    try {
                        setActiveLocation({
                            lat,
                            lng,
                            placeName,
                            baseAQI: finalAQI,
                            baseRainfall: rainfall,
                            baseTraffic: currentTrafficFactor,
                            baseFloodRisk: FloodRisk,
                            worldBank: macroData,
                            sessionId: sessionId
                        });
                    } catch (e) { console.warn("Active location update warning:", e); }
                } catch (err) {
                    console.warn('Demographics calc failed:', err);
                }

                // HMTL String generation removed (dead code)

                // 6. Update popup with fetched data
                if (popupRef.current && mapRef.current) {
                    // Re-render existing React root
                    if (popupRootRef.current && popupRef.current.isOpen() && sessionId === popupSessionRef.current) {
                        try {
                            popupRootRef.current.render(
                                <LocationPopup
                                    placeName={placeName}
                                    lat={lat}
                                    lng={lng}
                                    year={y}
                                    baseYear={BASE_YEAR}
                                    realTimeAQI={realTimeAQI}
                                    finalAQI={finalAQI}
                                    rainfall={rainfall}
                                    rainProbability={rainProbability}
                                    macroData={macroData}
                                    impact={impact}
                                    demographics={demographics}
                                    analysis={urbanAnalysis}
                                    analysisLoading={analysisLoading}
                                    openWeatherKey={OPENWEATHER_KEY}
                                    onSave={(name) => { if (window.saveLocation) window.saveLocation(name, lat, lng); }}
                                />
                            );
                        } catch (e) { console.warn("Popup data render error:", e); }
                    }
                }

                // 7. Trigger AI Analysis (Background)
                (async () => {
                    try {
                        if (popupSessionRef.current !== sessionId) return;

                        setAnalysisLoading(true);
                        setUrbanAnalysis(null);
                        // show loading state in popup if already mounted
                        /* AI Analysis Loading State - State already set above, popup will re-render via state */

                        // Get terrain data for AI analysis
                        let elevation = null;
                        let slope = 0;
                        let heatIndex = 0;
                        let drainageScore = 0;
                        
                        try {
                            if (mapRef.current) {
                                const lngLat = { lng, lat };
                                elevation = getElevation(mapRef.current, lngLat);
                                slope = getSlope(mapRef.current, lngLat);
                                heatIndex = calculateHeatIndex(mapRef.current, lngLat, projectedTraffic);
                                drainageScore = getDrainageScore(mapRef.current, lngLat);
                            }
                        } catch (e) {
                            console.warn("Terrain query failed:", e);
                        }

                        // Build sanitized payload for AI (explain-only) with full terrain context
                        const terrainContext = {
                            elevation: elevation ? Math.round(elevation) : null,
                            slope: Math.round(slope * 100) / 100,
                            heatIndex: Math.round(heatIndex * 100) / 100,
                            drainageScore: Math.round(drainageScore * 100) / 100
                        };

                        // Generate terrain insight on click
                        try {
                            setInsightLoading(true);
                            const insight = await getTerrainInsight({
                                elevation: elevation ?? 0,
                                slope: slope,
                                floodRisk: drainageScore,
                                heat: heatIndex,
                                population: impact.population,
                                aqi: finalAQI
                            });
                            if (popupSessionRef.current === sessionId) {
                                setTerrainInsight(insight);
                            }
                        } catch (e) {
                            console.warn("Terrain insight failed:", e);
                        } finally {
                            if (popupSessionRef.current === sessionId) {
                                setInsightLoading(false);
                            }
                        }

                        const aiPayload = {
                            zone: placeName,
                            year: y,
                            baseYear: BASE_YEAR,
                            aqi: realTimeAQI?.aqi,
                            rainfallMm: rainfall,
                            traffic: projectedTraffic,
                            floodRisk: FloodRisk,
                            peopleAffected: impact.peopleAffected,
                            economicLossCr: impact.economicLossCr,
                            terrain: terrainContext
                        };

                        // Fetch analysis with sanitized payload
                        const analysis = await getUrbanAnalysis(aiPayload);

                        // Guard completion update
                        if (popupSessionRef.current !== sessionId) return;

                        // Race condition check: only update if this is still the latest request
                        if (lastRequestTimeRef.current === requestTime) {
                            setUrbanAnalysis(analysis || "No analysis available.");
                            setAnalysisLoading(false);

                            // NOTE: Gemini provides explanatory analysis only. Do not overwrite deterministic loss here.
                            // Re-render popup React root (if present) with new analysis from state
                            try {
                                if (
                                    popupRootRef.current &&
                                    popupRef.current?.isOpen() &&
                                    popupSessionRef.current === sessionId &&
                                    document.body.contains(popupRef.current.getElement())
                                ) {
                                    popupRootRef.current.render(
                                        <LocationPopup
                                            placeName={placeName}
                                            lat={lat}
                                            lng={lng}
                                            year={y}
                                            baseYear={BASE_YEAR}
                                            realTimeAQI={realTimeAQI}
                                            finalAQI={finalAQI}
                                            rainfall={rainfall}
                                            rainProbability={rainProbability}
                                            macroData={macroData}
                                            impact={impact}
                                            demographics={demographics}
                                            analysis={analysis || 'No analysis available.'}
                                            analysisLoading={false}
                                            openWeatherKey={OPENWEATHER_KEY}
                                            onSave={(name) => { if (window.saveLocation) window.saveLocation(name, lat, lng); }}
                                        />
                                    );
                                }
                            } catch (e) { console.warn("AI result render error:", e); }
                        }
                    } catch (err) {
                        if (lastRequestTimeRef.current === requestTime && popupSessionRef.current === sessionId) {
                            console.error("AI Analysis Failed", err);
                            setUrbanAnalysis(null);
                            setAnalysisLoading(false);
                            try {
                                if (popupRootRef.current && popupRef.current?.isOpen() && popupSessionRef.current === sessionId) {
                                    popupRootRef.current.render(
                                        <LocationPopup
                                            placeName={placeName}
                                            lat={lat}
                                            lng={lng}
                                            year={y}
                                            baseYear={BASE_YEAR}
                                            realTimeAQI={realTimeAQI}
                                            finalAQI={finalAQI}
                                            rainfall={rainfall}
                                            rainProbability={rainProbability}
                                            macroData={macroData}
                                            impact={impact}
                                            demographics={demographics}
                                            analysis={null}
                                            analysisLoading={false}
                                            openWeatherKey={OPENWEATHER_KEY}
                                            onSave={(name) => { if (window.saveLocation) window.saveLocation(name, lat, lng); }}
                                        />
                                    );
                                }
                            } catch (e) { console.warn("AI error render skipped:", e); }
                        }
                    } finally {
                        if (lastRequestTimeRef.current === requestTime && popupSessionRef.current === sessionId) {
                            setAnalysisLoading(false);
                        }
                    }
                })();

            } catch (fatalError) {
                console.error("Fatal error in handleMapClick:", fatalError);
                try {
                    if (
                        popupRootRef.current &&
                        popupRef.current?.isOpen() &&
                        popupSessionRef.current === sessionId
                    ) {
                        popupRootRef.current.render(
                            <LocationPopup
                                placeName="Error"
                                lat={lat}
                                lng={lng}
                                year={y}
                                baseYear={BASE_YEAR}
                                realTimeAQI={null}
                                finalAQI={null}
                                rainfall={0}
                                rainProbability={null}
                                macroData={macroData}
                                impact={null}
                                demographics={null}
                                analysis="Failed to load details"
                                analysisLoading={false}
                                openWeatherKey={OPENWEATHER_KEY}
                                onSave={null}
                            />
                        );
                    }
                } catch (e) {
                    console.warn("Error fallback render skipped:", e);
                }
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

    // Expose saveLocation for popup buttons (local storage only, no backend)
    useEffect(() => {
        window.saveLocation = async (name, lat, lng) => {
            try {
                // Save to local storage only
                const savedLocations = JSON.parse(localStorage.getItem('savedLocations') || '[]');
                savedLocations.push({ name: name || 'Pinned Location', lat, lng, timestamp: Date.now() });
                localStorage.setItem('savedLocations', JSON.stringify(savedLocations));

                alert('Location saved locally');
                // Add marker immediately
                if (mapRef.current) {
                    const m = new maplibregl.Marker({ color: '#f59e0b' }).setLngLat([lng, lat]).addTo(mapRef.current);
                }
                return true;
            } catch (err) {
                console.error('saveLocation error', err);
                alert('Could not save location');
                return false;
            }
        };

        return () => { delete window.saveLocation; };
    }, []);

    // Load saved locations from local storage
    useEffect(() => {
        if (!mapRef.current) return;
        try {
            const savedLocations = JSON.parse(localStorage.getItem('savedLocations') || '[]');
            savedLocations.forEach(loc => {
                try {
                    new maplibregl.Marker({ color: '#f97316' }).setLngLat([loc.lng, loc.lat]).addTo(mapRef.current);
                } catch (e) { }
            });
        } catch (e) {
            console.warn('Could not load saved locations', e);
        }
    }, []);

    /* ================= YEAR SYNC ================= */
    useEffect(() => {
        yearRef.current = year;
    }, [year]);

    /* ================= REFRESH AQI DATA PERIODICALLY ================= */
    useEffect(() => {
        if (!mapRef.current || !OPENWEATHER_KEY || !layers.aqi) return;

        const refreshAQIData = async () => {
            const fetchAllCitiesAQI = async () => {
                try {
                    const aqiPromises = MAJOR_INDIAN_CITIES.map(async (city) => {
                        try {
                            const r = await fetchRealtimeAQI(city.lat, city.lng, OPENWEATHER_KEY);
                            if (!r) return null;
                            return {
                                type: "Feature",
                                properties: {
                                    aqi: r.aqi,
                                    city: city.name,
                                    level: r.category || null,
                                    pm25: r.pm25 ?? null,
                                    pm10: r.pm10 ?? null
                                },
                                geometry: { type: "Point", coordinates: [city.lng, city.lat] }
                            };
                        } catch (err) {
                            return null;
                        }
                    });

                    const results = await Promise.all(aqiPromises);
                    const features = results.filter(f => f !== null);

                    return { type: "FeatureCollection", features };
                } catch (err) {
                    console.error("Error refreshing AQI data:", err);
                    return null;
                }
            };

            const aqiData = await fetchAllCitiesAQI();
            if (aqiData && aqiData.features.length > 0 && mapRef.current) {
                const aqiSource = mapRef.current.getSource("aqi");
                if (aqiSource) {
                    aqiSource.setData(aqiData);
                    setAqiGeo(aqiData);
                }
            }
        };

        // Refresh immediately and then every 5 minutes (300000 ms)
        refreshAQIData();
        const interval = setInterval(refreshAQIData, 300000);

        return () => clearInterval(interval);
    }, [layers.aqi]);

    /* ================= AQI LAYER HOVER SYNC ================= */
    useEffect(() => {
        if (!mapRef.current || !layers.aqi || loading) return;

        const map = mapRef.current;
        if (!map.getLayer("aqi-layer")) return;

        // Throttle function for hover updates
        let lastCall = 0;
        const throttle = (func, delay) => {
            return (e) => {
                const now = Date.now();
                if (now - lastCall >= delay) {
                    lastCall = now;
                    func(e);
                }
            };
        };
        
        const handleHover = (e) => {
            if (!map.getLayer("aqi-layer") || !e.features || e.features.length === 0) return;
            
            const feature = e.features[0];
            const props = feature.properties;
            const coords = e.lngLat;

            // Update popup with hover data (if popup is open)
            if (popupRef.current && popupRef.current.isOpen() && popupRootRef.current) {
                try {
                    const hoverAQI = {
                        aqi: props.aqi,
                        pm25: props.pm25 ?? null,
                        pm10: props.pm10 ?? null
                    };

                    popupRootRef.current.render(
                        <LocationPopup
                            placeName={props.city || "Hover Location"}
                            lat={coords.lat}
                            lng={coords.lng}
                            year={yearRef.current}
                            baseYear={BASE_YEAR}
                            realTimeAQI={hoverAQI}
                            finalAQI={props.aqi}
                            rainfall={0}
                            rainProbability={null}
                            macroData={macroDataRef.current}
                            impact={null}
                            demographics={null}
                            analysis={null}
                            analysisLoading={false}
                            openWeatherKey={OPENWEATHER_KEY}
                            onSave={null}
                        />
                    );
                } catch (err) {
                    console.warn("Hover update failed:", err);
                }
            }

            // Change cursor on hover
            map.getCanvas().style.cursor = "pointer";
        };

        const throttledHover = throttle(handleHover, 100);

        const handleMouseLeave = () => {
            map.getCanvas().style.cursor = "";
        };

        map.on("mousemove", "aqi-layer", throttledHover);
        map.on("mouseleave", "aqi-layer", handleMouseLeave);

        return () => {
            map.off("mousemove", "aqi-layer", throttledHover);
            map.off("mouseleave", "aqi-layer", handleMouseLeave);
        };
    }, [layers.aqi, loading]);

    /* ================= TERRAIN HOVER HUD ================= */
    useEffect(() => {
        if (!mapRef.current || loading) return;

        const map = mapRef.current;
        let hoverTimeout;

        const handleTerrainHover = (e) => {
            clearTimeout(hoverTimeout);
            hoverTimeout = setTimeout(() => {
                try {
                    const elevation = getElevation(map, e.lngLat);
                    const slope = getSlope(map, e.lngLat);
                    const heat = calculateHeatIndex(map, e.lngLat);
                    const drainage = getDrainageScore(map, e.lngLat);
                    const response = emergencyResponseTime(map, e.lngLat);

                    if (elevation !== null) {
                        map.getCanvas().style.cursor = "crosshair";
                        
                        const debugInfo = {
                            elevation: Math.round(elevation),
                            slope: parseFloat(slope.toFixed(2)),
                            heat: parseFloat(heat.toFixed(2)),
                            drainage: parseFloat(drainage.toFixed(2)),
                            response: response
                        };

                        setDebugData(debugInfo);
                        
                        // Dispatch custom event for HUD/popup integration
                        window.dispatchEvent(new CustomEvent("terrain-hover", {
                            detail: debugInfo
                        }));
                    }
                } catch (err) {
                    // Terrain query may fail in some areas
                }
            }, 50);
        };

        const handleTerrainLeave = () => {
            clearTimeout(hoverTimeout);
            map.getCanvas().style.cursor = "";
            setDebugData(null);
        };

        map.on("mousemove", handleTerrainHover);
        map.on("mouseleave", handleTerrainLeave);

        return () => {
            clearTimeout(hoverTimeout);
            map.off("mousemove", handleTerrainHover);
            map.off("mouseleave", handleTerrainLeave);
        };
    }, [loading]);

    /* ================= TERRAIN FEATURES UPDATE (WATER FLOW, RISK, EMERGENCY) ================= */
    useEffect(() => {
        if (!mapRef.current || loading) return;

        const map = mapRef.current;
        
        // Initialize throttled update function
        if (!throttledUpdateRef.current) {
            throttledUpdateRef.current = createThrottledUpdate(400);
        }

        const updateTerrainFeatures = () => {
            throttledUpdateRef.current(() => {
                try {
                    // Update water flow arrows if layer is visible
                    if (map.getLayer("water-flow-arrows") && 
                        map.getLayoutProperty("water-flow-arrows", "visibility") === "visible") {
                        updateWaterFlow(map);
                    }
                    
                    // Update risk heatmap if layer is visible
                    if (map.getLayer("risk-heatmap") && 
                        map.getLayoutProperty("risk-heatmap", "visibility") === "visible") {
                        updateRiskHeatmap(map);
                    }
                    
                    // Update emergency zones if layer is visible
                    if (map.getLayer("emergency-response") && 
                        map.getLayoutProperty("emergency-response", "visibility") === "visible") {
                        updateEmergencyZones(map);
                    }
                } catch (e) {
                    console.warn("Terrain features update failed:", e);
                }
            });
        };

        // Update on map move/zoom
        map.on("moveend", updateTerrainFeatures);
        map.on("zoomend", updateTerrainFeatures);

        // Initial update
        setTimeout(updateTerrainFeatures, 500);

        return () => {
            map.off("moveend", updateTerrainFeatures);
            map.off("zoomend", updateTerrainFeatures);
        };
    }, [loading]);

    /* ================= FLOOD DEPTH ANIMATION (TERRAIN-AWARE) ================= */
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

        // Calculate max depth based on year and rainfall
        const yearsElapsed = year - BASE_YEAR;
        const timeFactor = yearsElapsed / (MAX_YEAR - BASE_YEAR);
        const rainAmplifier = Math.min(rainfallRef.current / 15, 1); // mm-based
        const maxDepth = 3 * (
            timeFactor +
            FLOOD_ANIMATION_CONFIG.baseDepthMultiplier +
            rainAmplifier * 0.6
        );

        // Reset depth when toggling on or year changes significantly
        if (floodDepthRef.current >= maxDepth) {
            floodDepthRef.current = FLOOD_ANIMATION_CONFIG.resetDepth;
        }

        const animate = () => {
            if (!mapRef.current || !floodSource) return;

            const currentDepth = floodDepthRef.current + FLOOD_ANIMATION_CONFIG.depthIncrement;
            floodDepthRef.current = Math.min(currentDepth, maxDepth);

            // Use terrain-aware flood if terrain-flood source exists
            const terrainFloodSource = map.getSource("flood-terrain");
            if (terrainFloodSource && activeLocation) {
                const center = [activeLocation.lng, activeLocation.lat];
                const floodFeatures = simulateFlood(
                    map,
                    center,
                    rainfallRef.current * floodDepthRef.current
                );
                
                terrainFloodSource.setData({
                    type: "FeatureCollection",
                    features: floodFeatures
                });

                		// Update water flow arrows after flood update (throttled)
                		if (map.getLayer("water-flow-arrows") && 
                		    map.getLayoutProperty("water-flow-arrows", "visibility") === "visible") {
                		    if (throttledUpdateRef.current) {
                		        throttledUpdateRef.current(() => updateWaterFlow(map));
                		    } else {
                		        updateWaterFlow(map);
                		    }
                		}
            }

            // Keep original flood-depth source for backward compatibility
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
    }, [floodMode, year, layers.floodDepth, activeLocation]);

    /* ================= MAP STYLE SWITCHING ================= */
    const styleRef = useRef(null);
    const isInitialLoad = useRef(true);

    useEffect(() => {
        if (!mapRef.current || loading) return;
        const map = mapRef.current;

        // On initial load, just set the ref and skip style change
        if (isInitialLoad.current) {
            styleRef.current = mapStyle;
            isInitialLoad.current = false;
            return;
        }

        // Don't switch if already on this style
        if (styleRef.current === mapStyle) return;

        const styleUrls = {
            default: "https://api.maptiler.com/maps/streets-v2/style.json?key=UQBNCVHquLf1PybiywBt",
            satellite: "https://api.maptiler.com/maps/hybrid/style.json?key=UQBNCVHquLf1PybiywBt",
            terrain: "https://api.maptiler.com/maps/topo-v2/style.json?key=UQBNCVHquLf1PybiywBt"
        };

        const targetStyle = styleUrls[mapStyle];
        if (!targetStyle) return;

        styleRef.current = mapStyle;
        map.setStyle(targetStyle);

        // Re-add layers after style change
        map.once("style.load", () => {
            // Re-add terrain if needed
            if (mapStyle === "terrain" || mapStyle === "satellite") {
                try {
                    map.addSource("terrain", {
                        type: "raster-dem",
                        url: "https://api.maptiler.com/tiles/terrain-rgb/tiles.json?key=UQBNCVHquLf1PybiywBt",
                        tileSize: 256
                    });
                    map.setTerrain({ source: "terrain", exaggeration: 1.4 });
                } catch (err) {
                    console.error("Error adding terrain:", err);
                }
            }

            // Re-add traffic layer if enabled
            if (layers.traffic && TOMTOM_KEY) {
                setTimeout(() => {
                    try {
                        if (!map.getSource("traffic")) {
                            map.addSource("traffic", {
                                type: "raster",
                                tiles: [
                                    `https://api.tomtom.com/traffic/map/4/tile/flow/relative/{z}/{x}/{y}.png?key=${TOMTOM_KEY}`
                                ],
                                tileSize: 256
                            });
                            map.addLayer({
                                id: "traffic-layer",
                                type: "raster",
                                source: "traffic",
                                paint: {
                                    "raster-opacity": 1.0,
                                    "raster-fade-duration": 300
                                },
                                layout: {
                                    visibility: layers.traffic ? "visible" : "none"
                                }
                            });
                        } else {
                            map.setLayoutProperty("traffic-layer", "visibility", layers.traffic ? "visible" : "none");
                        }
                    } catch (err) {
                        console.error("Error re-adding traffic layer:", err);
                    }
                }, 300);
            }

            // Re-add AQI layer if we have cached geo data
            if (aqiGeo) {
                setTimeout(() => {
                    try {
                        if (!map.getSource("aqi")) {
                            map.addSource("aqi", { type: "geojson", data: aqiGeo });
                            map.addLayer({
                                id: "aqi-layer",
                                type: "circle",
                                source: "aqi",
                                paint: {
                                    "circle-radius": 12,
                                    "circle-opacity": 0.9,
                                    "circle-stroke-width": 2,
                                    "circle-stroke-color": "#ffffff",
                                    "circle-stroke-opacity": 0.8,
                                    "circle-color": [
                                        "interpolate",
                                        ["linear"],
                                        ["get", "aqi"],
                                        0, "#22c55e",
                                        50, "#22c55e",
                                        100, "#eab308",
                                        150, "#f97316",
                                        200, "#dc2626",
                                        300, "#9333ea",
                                        400, "#6b21a8"
                                    ]
                                },
                                layout: {
                                    visibility: layers.aqi ? "visible" : "none"
                                }
                            });
                        } else {
                            map.setLayoutProperty("aqi-layer", "visibility", layers.aqi ? "visible" : "none");
                        }
                    } catch (err) {
                        console.error("Error re-adding AQI layer:", err);
                    }
                }, 300);
            }

            // Clear elevation cache and rehydrate custom layers (terrain, hillshade, buildings, lighting)
            try { elevationCache.clear(); } catch (e) {}
            try {
                // Keep a cinematic camera for satellite for UX
                if (mapStyle === "satellite") {
                    map.easeTo({ pitch: 70, bearing: -25, zoom: Math.max(map.getZoom(), 14), duration: 1500 });
                }

                rehydrateCustomLayers(map);
            } catch (e) {
                console.warn("Post-style rehydrate failed:", e);
            }

            // Re-add other custom layers if needed
        });
    }, [mapStyle, loading, layers.traffic, layers.aqi, aqiGeo]);

    /* ================= LAYER TOGGLES ================= */
    useEffect(() => {
        if (!mapRef.current || loading) return;
        const map = mapRef.current;

        const toggle = (id, visible) => {
            if (map.getLayer(id)) {
                map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
            }
        };

        toggle("aqi-layer", layers.aqi);
        // If terrain-aware flood (depth) is enabled, hide the flat flood layer to avoid double-visuals
        toggle("flood-layer", layers.flood && !layers.floodDepth);
        toggle("traffic-layer", layers.traffic);
        toggle("flood-depth-layer", layers.floodDepth);
        toggle("terrain-hillshade", layers.hillshade);
        toggle("terrain-flood-layer", layers.flood);
        
        // Add flood animation class when flood mode is active
        if (mapRef.current) {
            const floodLayerEl = document.querySelector('.maplibregl-map');
            if (floodLayerEl) {
                if (floodMode && layers.floodDepth) {
                    floodLayerEl.classList.add('flood-layer');
                } else {
                    floodLayerEl.classList.remove('flood-layer');
                }
            }
        }
    }, [layers, loading, floodMode]);

    /* ================= CINEMATIC CAMERA ================= */
    const flyToPoint = useCallback((lng, lat, zoom = 14, pitch = 65, bearing = 0) => {
        if (!mapRef.current) return;
        // Use easeTo for smoother, cinematic transitions
        mapRef.current.easeTo({
            center: [lng, lat],
            zoom,
            pitch,
            bearing,
            duration: 1800,
            easing: (t) => t * (2 - t) // Ease-out curve
        });
    }, []);

    /* ================= HANDLE LOCATION SEARCH ================= */
    const handleLocationSelect = useCallback((lng, lat, placeName) => {
        if (!mapRef.current || !popupRef.current) return;

        const sessionId = ++popupSessionRef.current;

        // Smooth camera transition to selected location
        if (mapRef.current) {
            mapRef.current.easeTo({
                center: [lng, lat],
                zoom: 14,
                pitch: 65,
                bearing: mapRef.current.getBearing(),
                duration: 1800,
                easing: (t) => t * (2 - t)
            });
        }

        try {
            // Clean up any previous root
            if (popupRootRef.current) {
                popupRootRef.current.unmount();
                popupRootRef.current = null;
            }

            const container = document.createElement("div");
            container.className = 'custom-popup';

            popupRef.current.setLngLat([lng, lat]).setDOMContent(container).addTo(mapRef.current);

            const root = createRoot(container);
            popupRootRef.current = root;

            root.render(
                <LocationPopup
                    placeName={placeName}
                    lat={lat}
                    lng={lng}
                    year={yearRef.current}
                    baseYear={BASE_YEAR}
                    realTimeAQI={null}
                    finalAQI={null}
                    rainfall={0}
                    rainProbability={null}
                    macroData={macroDataRef.current}
                    impact={null}
                    demographics={null}
                    analysis={null}
                    analysisLoading={false}
                    openWeatherKey={OPENWEATHER_KEY}
                    onSave={(name) => { if (window.saveLocation) window.saveLocation(name, lat, lng); }}
                />
            );

            // Set activeLocation so year slider updates work
            setActiveLocation({
                lat,
                lng,
                placeName,
                baseAQI: IMPACT_MODEL.baseAQI,
                baseRainfall: 0,
                baseTraffic: IMPACT_MODEL.baseTraffic,
                baseFloodRisk: IMPACT_MODEL.baseFloodRisk,
                worldBank: macroDataRef.current,
                sessionId
            });
        } catch (e) {
            console.warn("Search popup render skipped:", e);
        }
    }, []);

    /* ================= MOUSE CAMERA CONTROLS ================= */
    // Intercept right-click drag for custom rotation/tilt control
    useEffect(() => {
        if (!mapRef.current || !mapContainer.current || loading) return;

        const map = mapRef.current;
        const container = mapContainer.current;
        let isRightClickDragging = false;
        let startPos = { x: 0, y: 0, bearing: 0, pitch: 0 };

        const handleRightMouseDown = (e) => {
            if (e.button === 2) { // Right mouse button
                e.preventDefault();
                e.stopPropagation();
                isRightClickDragging = true;
                startPos = {
                    x: e.clientX,
                    y: e.clientY,
                    bearing: map.getBearing(),
                    pitch: map.getPitch()
                };
                container.style.cursor = 'grabbing';

                // Disable MapLibre's default right-click rotation if available
                if (map.dragRotate && typeof map.dragRotate.disable === 'function') {
                    map.dragRotate.disable();
                }
            }
        };

        const handleMouseMove = (e) => {
            if (isRightClickDragging && mapRef.current) {
                e.preventDefault();
                const deltaX = e.clientX - startPos.x;
                const deltaY = e.clientY - startPos.y;

                // Left/Right movement = Rotation (Bearing)
                const bearingSensitivity = 0.5;
                const newBearing = startPos.bearing + (deltaX * bearingSensitivity);

                // Up/Down movement = Tilt (Pitch)
                const pitchSensitivity = 0.3;
                const newPitch = Math.max(0, Math.min(85, startPos.pitch - (deltaY * pitchSensitivity)));

                mapRef.current.easeTo({
                    bearing: newBearing,
                    pitch: newPitch,
                    duration: 0
                });

                setCameraState({
                    bearing: newBearing,
                    pitch: newPitch
                });
            }
        };

        const handleMouseUp = (e) => {
            if (isRightClickDragging && e.button === 2) {
                e.preventDefault();
                e.stopPropagation();
                isRightClickDragging = false;
                container.style.cursor = '';
                // Re-enable MapLibre's default controls if available
                if (mapRef.current && mapRef.current.dragRotate && typeof mapRef.current.dragRotate.enable === 'function') {
                    mapRef.current.dragRotate.enable();
                }
            }
        };

        container.addEventListener('mousedown', handleRightMouseDown);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        container.addEventListener('contextmenu', (e) => e.preventDefault()); // Prevent context menu

        return () => {
            container.removeEventListener('mousedown', handleRightMouseDown);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            if (mapRef.current && mapRef.current.dragRotate && typeof mapRef.current.dragRotate.enable === 'function') {
                mapRef.current.dragRotate.enable();
            }
        };
    }, [loading]);


    const resetCamera = useCallback(() => {
        if (!mapRef.current) return;
        mapRef.current.flyTo({
            center: MAP_CONFIG.center,
            zoom: MAP_CONFIG.zoom,
            pitch: MAP_CONFIG.pitch,
            bearing: MAP_CONFIG.bearing,
            speed: 0.8,
            curve: 1.5
        });
        setCameraState({
            bearing: MAP_CONFIG.bearing,
            pitch: MAP_CONFIG.pitch
        });
    }, []);

    // Update camera state when map moves (for display purposes)
    useEffect(() => {
        if (!mapRef.current) return;
        const map = mapRef.current;

        const updateCameraState = () => {
            setCameraState({
                bearing: Math.round(map.getBearing()),
                pitch: Math.round(map.getPitch())
            });
        };

        map.on("rotate", updateCameraState);
        map.on("pitch", updateCameraState);

        return () => {
            map.off("rotate", updateCameraState);
            map.off("pitch", updateCameraState);
        };
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

    // Close layers menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (showLayersMenu && !e.target.closest('[data-layers-menu]')) {
                setShowLayersMenu(false);
            }
        };
        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    }, [showLayersMenu]);

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
                        top: 120,
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

            <MapMenu layers={layers} setLayers={setLayers} mapStyle={mapStyle} setMapStyle={setMapStyle} mapRef={mapRef} />

            <SearchBar mapRef={mapRef} onLocationSelect={handleLocationSelect} />
            <TimeSlider
                year={year}
                setYear={setYear}
                baseYear={BASE_YEAR}
                minYear={BASE_YEAR}
                maxYear={MAX_YEAR}
            />

            {/* Google Maps-style Layers Menu - Bottom Left */}
            <div
                data-layers-menu
                style={{
                    position: "absolute",
                    bottom: 20,
                    left: 20,
                    zIndex: 20,
                    display: "flex",
                    gap: 4,
                    background: "rgba(255, 255, 255, 0.95)",
                    padding: "4px",
                    borderRadius: 8,
                    boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                    backdropFilter: "blur(8px)"
                }}
            >
                {/* Satellite Button with Preview */}
                <button
                    onClick={() => {
                        setMapStyle(mapStyle === "satellite" ? "default" : "satellite");
                        setShowLayersMenu(false);
                    }}
                    style={{
                        width: 64,
                        height: 64,
                        borderRadius: 8,
                        border: "none",
                        background: mapStyle === "satellite" ? "rgba(59, 130, 246, 0.9)" : "rgba(30, 41, 59, 0.9)",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",
                        overflow: "hidden",
                        padding: 0,
                        transition: "all 0.2s",
                        border: "1px solid rgba(255,255,255,0.1)"
                    }}
                    onMouseEnter={(e) => {
                        if (mapStyle !== "satellite") {
                            e.target.style.background = "rgba(30, 41, 59, 1)";
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (mapStyle !== "satellite") {
                            e.target.style.background = "rgba(30, 41, 59, 0.9)";
                        }
                    }}
                >
                    {/* Satellite Preview Thumbnail */}
                    <div
                        style={{
                            width: "100%",
                            height: "48px",
                            background: "linear-gradient(135deg, #8b7355 0%, #6b5842 25%, #4a3d2e 50%, #8b7355 75%, #a69075 100%)",
                            position: "relative",
                            overflow: "hidden"
                        }}
                    >
                        {/* Simulated satellite imagery pattern */}
                        <div style={{
                            position: "absolute",
                            width: "100%",
                            height: "100%",
                            background: `
                repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px),
                repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px),
                radial-gradient(circle at 30% 40%, rgba(100,150,100,0.3) 0%, transparent 40%),
                radial-gradient(circle at 70% 60%, rgba(80,120,80,0.3) 0%, transparent 40%)
              `
                        }} />
                        {/* Roads */}
                        <div style={{
                            position: "absolute",
                            top: "50%",
                            left: "20%",
                            width: "60%",
                            height: "2px",
                            background: "#d4a574",
                            transform: "rotate(15deg)"
                        }} />
                        <div style={{
                            position: "absolute",
                            top: "30%",
                            left: "10%",
                            width: "80%",
                            height: "2px",
                            background: "#d4a574",
                            transform: "rotate(-10deg)"
                        }} />
                    </div>
                    <span style={{
                        fontSize: 11,
                        color: "#e2e8f0",
                        marginTop: 2,
                        fontWeight: 600,
                        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
                    }}>
                        Satellite
                    </span>
                </button>

                {/* Terrain Button */}
                <button
                    onClick={() => {
                        setMapStyle(mapStyle === "terrain" ? "default" : "terrain");
                        setShowLayersMenu(false);
                    }}
                    style={{
                        width: 64,
                        height: 64,
                        borderRadius: 8,
                        border: "none",
                        background: mapStyle === "terrain" ? "rgba(59, 130, 246, 0.9)" : "rgba(30, 41, 59, 0.9)",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 0,
                        transition: "all 0.2s",
                        border: "1px solid rgba(255,255,255,0.1)"
                    }}
                    onMouseEnter={(e) => {
                        if (mapStyle !== "terrain") {
                            e.target.style.background = "rgba(30, 41, 59, 1)";
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (mapStyle !== "terrain") {
                            e.target.style.background = "rgba(30, 41, 59, 0.9)";
                        }
                    }}
                >
                    <div style={{
                        width: "48px",
                        height: "48px",
                        background: "linear-gradient(135deg, #d4e8d4 0%, #c0d8c0 20%, #8bb08b 40%, #6b8f6b 60%, #4a6f4a 80%, #2a4f2a 100%)",
                        borderRadius: 4,
                        position: "relative",
                        overflow: "hidden"
                    }}>
                        {/* Contour lines */}
                        <svg width="48" height="48" style={{ position: "absolute", top: 0, left: 0 }}>
                            <path d="M 8 30 Q 16 20, 24 25 T 40 28" stroke="#5a7a5a" strokeWidth="1" fill="none" opacity="0.6" />
                            <path d="M 6 35 Q 14 28, 22 32 T 38 34" stroke="#5a7a5a" strokeWidth="1" fill="none" opacity="0.6" />
                            <path d="M 10 40 Q 18 35, 26 38 T 42 42" stroke="#5a7a5a" strokeWidth="1" fill="none" opacity="0.6" />
                        </svg>
                    </div>
                    <span style={{
                        fontSize: 11,
                        color: "#e2e8f0",
                        marginTop: 2,
                        fontWeight: 600,
                        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
                    }}>
                        Terrain
                    </span>
                </button>

                {/* Traffic Button */}
                <div style={{ position: "relative" }}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setLayers(prev => ({ ...prev, traffic: !prev.traffic }));
                            setShowLayersMenu(!showLayersMenu);
                        }}
                        style={{
                            width: 64,
                            height: 64,
                            borderRadius: 8,
                            border: layers.traffic ? "2px solid #60a5fa" : "1px solid rgba(255,255,255,0.1)",
                            background: layers.traffic ? "rgba(59, 130, 246, 0.9)" : "rgba(30, 41, 59, 0.9)",
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: 0,
                            transition: "all 0.2s"
                        }}
                        onMouseEnter={(e) => {
                            e.target.style.background = layers.traffic ? "rgba(59, 130, 246, 1)" : "rgba(30, 41, 59, 1)";
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.background = layers.traffic ? "rgba(59, 130, 246, 0.9)" : "rgba(30, 41, 59, 0.9)";
                        }}
                    >
                        <div style={{
                            width: "48px",
                            height: "48px",
                            background: "rgba(15, 23, 42, 0.8)",
                            borderRadius: 4,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            position: "relative"
                        }}>
                            {/* Traffic intersection icon */}
                            <svg width="36" height="36" viewBox="0 0 36 36" style={{ position: "absolute" }}>
                                {/* Road lines */}
                                <line x1="18" y1="0" x2="18" y2="36" stroke="#bbb" strokeWidth="3" />
                                <line x1="0" y1="18" x2="36" y2="18" stroke="#bbb" strokeWidth="3" />
                                {/* Traffic colors */}
                                <line x1="18" y1="0" x2="18" y2="14" stroke="#22c55e" strokeWidth="4" />
                                <line x1="18" y1="22" x2="18" y2="36" stroke="#eab308" strokeWidth="4" />
                                <line x1="0" y1="18" x2="14" y2="18" stroke="#dc2626" strokeWidth="4" />
                                <line x1="22" y1="18" x2="36" y2="18" stroke="#22c55e" strokeWidth="4" />
                            </svg>
                        </div>
                        <span style={{
                            fontSize: 11,
                            color: "#e2e8f0",
                            marginTop: 2,
                            fontWeight: 600,
                            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
                        }}>
                            Traffic
                        </span>
                    </button>

                    {/* Traffic Color Legend Popup */}
                    {showLayersMenu && (
                        <div
                            data-layers-menu
                            style={{
                                position: "absolute",
                                bottom: "100%",
                                left: 0,
                                marginBottom: 8,
                                background: "rgba(15, 23, 42, 0.98)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                backdropFilter: "blur(12px)",
                                padding: "12px 16px",
                                borderRadius: 8,
                                boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                                minWidth: 180,
                                zIndex: 1000
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "#e2e8f0", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" }}>
                                Live traffic
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <div style={{
                                        width: 32,
                                        height: 4,
                                        background: "#22c55e",
                                        borderRadius: 2
                                    }} />
                                    <span style={{ fontSize: 12, color: "#5f6368" }}>Fast</span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <div style={{
                                        width: 32,
                                        height: 4,
                                        background: "#eab308",
                                        borderRadius: 2
                                    }} />
                                    <span style={{ fontSize: 12, color: "#5f6368" }}>Slow</span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <div style={{
                                        width: 32,
                                        height: 4,
                                        background: "#dc2626",
                                        borderRadius: 2
                                    }} />
                                    <span style={{ fontSize: 12, color: "#5f6368" }}>Congested</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Camera Controls Info - Mouse Instructions */}
            <div
                style={{
                    position: "absolute",
                    bottom: 20,
                    right: 20,
                    zIndex: 10,
                    background: "rgba(2, 6, 23, 0.85)",
                    padding: "12px 16px",
                    borderRadius: 8,
                    backdropFilter: "blur(8px)",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                    color: "#fff",
                    fontSize: 12,
                    lineHeight: 1.5,
                    maxWidth: 200
                }}
            >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>🖱️ Mouse Controls</div>
                <div style={{ opacity: 0.9 }}>
                    <div>Right-click + Drag</div>
                    <div style={{ marginTop: 4, fontSize: 11, opacity: 0.8 }}>
                        Left/Right = Rotate<br />
                        Up/Down = Tilt
                    </div>
                </div>
            </div>

            {/* Control Buttons */}
            <div
                style={{
                    position: "absolute",
                    top: 20,
                    left: 620, // Moved right to avoid overlapping with search bar (200 + 400 width + 20 gap)
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

            <EconomicPanel data={impactData} demographics={demographics} analysis={urbanAnalysis} analysisLoading={analysisLoading} />
            <CitySuggestions map={mapRef.current} visible={showSuggestions} />
            <InsightPanel 
                insight={terrainInsight} 
                loading={insightLoading}
                onExplain={async () => {
                    if (!mapRef.current || !activeLocation) return;
                    setInsightLoading(true);
                    try {
                        const { lng, lat } = activeLocation;
                        const lngLat = { lng, lat };
                        const elevation = getElevation(mapRef.current, lngLat);
                        const slope = getSlope(mapRef.current, lngLat);
                        const heat = calculateHeatIndex(mapRef.current, lngLat);
                        const drainage = getDrainageScore(mapRef.current, lngLat);
                        const aqi = lastAQIRef.current?.aqi || 0;
                        const population = demographics?.population || 0;

                        const insight = await getTerrainInsight({
                            elevation: elevation ?? 0,
                            slope: slope,
                            floodRisk: drainage,
                            heat: heat,
                            population: population,
                            aqi: aqi
                        });
                        setTerrainInsight(insight);
                    } catch (e) {
                        console.warn("Terrain insight failed:", e);
                        setTerrainInsight("Unable to generate insight. Please try again.");
                    } finally {
                        setInsightLoading(false);
                    }
                }}
            />

            <div
                ref={mapContainer}
                style={{
                    width: "100%",
                    height: "100%",
                    position: "fixed",
                    top: 0,
                    left: 0
                }}
            />
        </>
    );
}

