import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import MapMenu from "./MapMenu";
import LayerToggle from "./LayerToggle";
import EconomicPanel from "./EconomicPanel";
import CitySuggestions from "./CitySuggestions";
import TimeSlider from "./TimeSlider";
import SearchBar from "./SearchBar";
import { getUrbanAnalysis } from "../utils/gemini";
import { fetchIndiaMacroData } from "../utils/worldBank";
import { calculatePopulationDynamics } from "../utils/demographics";

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
// OpenWeather Air Pollution API key (set VITE_OPENWEATHER_API_KEY in .env)
// Get free API key from: https://openweathermap.org/api/air-pollution
const OPENWEATHER_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY || "";

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

export default function MapView() {
    const mapContainer = useRef(null);
    const mapRef = useRef(null);
    const popupRef = useRef(null);
    const yearRef = useRef(INITIAL_YEAR);
    const floodAnimRef = useRef(null);
    const floodDepthRef = useRef(0);
    const flyThroughTimeoutsRef = useRef([]);
    const rainfallRef = useRef(0); // Store current rainfall for flood animation

    const [year, setYear] = useState(INITIAL_YEAR);
    const [impactData, setImpactData] = useState(null);
    const [urbanAnalysis, setUrbanAnalysis] = useState(null);
    const [analysisLoading, setAnalysisLoading] = useState(false);
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
                                const response = await fetch(
                                    `https://api.openweathermap.org/data/2.5/air_pollution?lat=${city.lat}&lon=${city.lng}&appid=${OPENWEATHER_KEY}`
                                );

                                if (!response.ok) {
                                    throw new Error(`API responded with status ${response.status}`);
                                }

                                const data = await response.json();

                                if (data && data.list && data.list.length > 0) {
                                    const aqi = data.list[0].main.aqi; // AQI value (1-5)
                                    const components = data.list[0].components;
                                    const pm25 = components.pm2_5 || 0;
                                    const pm10 = components.pm10 || 0;

                                    // Convert PM2.5 to US AQI scale (0-500)
                                    let usAQI = 0;
                                    if (pm25 > 0) {
                                        if (pm25 <= 12) usAQI = Math.round((pm25 / 12) * 50);
                                        else if (pm25 <= 35.4) usAQI = Math.round(50 + ((pm25 - 12) / 23.4) * 50);
                                        else if (pm25 <= 55.4) usAQI = Math.round(100 + ((pm25 - 35.4) / 20) * 50);
                                        else if (pm25 <= 150.4) usAQI = Math.round(150 + ((pm25 - 55.4) / 95) * 100);
                                        else if (pm25 <= 250.4) usAQI = Math.round(250 + ((pm25 - 150.4) / 100) * 100);
                                        else usAQI = Math.round(350 + ((pm25 - 250.4) / 149.6) * 150);
                                        usAQI = Math.min(500, Math.max(0, usAQI));
                                    } else {
                                        const aqiMap = { 1: 50, 2: 100, 3: 150, 4: 200, 5: 300 };
                                        usAQI = aqiMap[aqi] || 100;
                                    }

                                    return {
                                        type: "Feature",
                                        properties: {
                                            aqi: usAQI,
                                            city: city.name,
                                            level: aqi,
                                            pm25: Math.round(pm25 * 10) / 10,
                                            pm10: Math.round(pm10 * 10) / 10
                                        },
                                        geometry: {
                                            type: "Point",
                                            coordinates: [city.lng, city.lat]
                                        }
                                    };
                                }
                                return null;
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

                try {
                    const aqiData = await fetchAllCitiesAQI();

                    if (isMounted && aqiData && aqiData.features.length > 0) {
                        map.addSource("aqi", { type: "geojson", data: aqiData });
                        setAqiGeo(aqiData);
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
                    } else if (isMounted && !OPENWEATHER_KEY) {
                        console.warn("OpenWeather API key not set. AQI layer will not be available.");
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
                if (isMounted && map.getSource && map.getSource("openmaptiles")) {
                    try {
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
                    } catch (e) {
                        console.warn('Could not add 3d-buildings layer:', e);
                    }
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

        /* ===== FETCH REAL-TIME AQI ===== */
        const fetchAQI = async (lat, lng) => {
            if (!OPENWEATHER_KEY) {
                return null;
            }

            try {
                setLoadingAQI(true);
                const response = await fetch(
                    `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lng}&appid=${OPENWEATHER_KEY}`
                );

                if (!response.ok) {
                    throw new Error(`API responded with status ${response.status}`);
                }

                const data = await response.json();

                if (data && data.list && data.list.length > 0) {
                    const aqi = data.list[0].main.aqi; // AQI value (1-5)
                    const components = data.list[0].components; // Pollutant concentrations

                    // Convert AQI scale (1-5) to US AQI scale (0-500) for better understanding
                    const pm25 = components.pm2_5 || 0;
                    const pm10 = components.pm10 || 0;

                    // Rough conversion: using PM2.5 as primary indicator
                    let usAQI = 0;
                    if (pm25 > 0) {
                        if (pm25 <= 12) usAQI = Math.round((pm25 / 12) * 50);
                        else if (pm25 <= 35.4) usAQI = Math.round(50 + ((pm25 - 12) / 23.4) * 50);
                        else if (pm25 <= 55.4) usAQI = Math.round(100 + ((pm25 - 35.4) / 20) * 50);
                        else if (pm25 <= 150.4) usAQI = Math.round(150 + ((pm25 - 55.4) / 95) * 100);
                        else if (pm25 <= 250.4) usAQI = Math.round(250 + ((pm25 - 150.4) / 100) * 100);
                        else usAQI = Math.round(350 + ((pm25 - 250.4) / 149.6) * 150);
                        usAQI = Math.min(500, Math.max(0, usAQI));
                    } else {
                        const aqiMap = { 1: 50, 2: 100, 3: 150, 4: 200, 5: 300 };
                        usAQI = aqiMap[aqi] || 100;
                    }

                    return {
                        aqi: usAQI,
                        level: aqi,
                        levelText: ['Good', 'Fair', 'Moderate', 'Poor', 'Very Poor'][aqi - 1] || 'Unknown',
                        components: {
                            pm25: Math.round(pm25 * 10) / 10,
                            pm10: Math.round(pm10 * 10) / 10,
                            no2: Math.round((components.no2 || 0) * 10) / 10,
                            o3: Math.round((components.o3 || 0) * 10) / 10,
                            co: Math.round((components.co || 0) * 10) / 10
                        },
                        timestamp: new Date(data.list[0].dt * 1000).toLocaleTimeString()
                    };
                }
                return null;
            } catch (err) {
                console.warn("Could not fetch real-time AQI:", err);
                return null;
            } finally {
                setLoadingAQI(false);
            }
        };

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

            // Get place name from coordinates
            const placeName = await getPlaceName(lat, lng);

            // Show loading popup immediately at clicked location
            if (popupRef.current && mapRef.current) {
                popupRef.current
                    .setLngLat([lng, lat])
                    .setHTML(`
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; padding: 20px; text-align: center;">
              <div style="display: inline-block; width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.06); border-top-color: #60a5fa; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 12px;"></div>
              <div style="font-size: 13px; color: #94a3b8; font-weight: 500;">Loading AQI data...</div>
            </div>
            <style>
              @keyframes spin { to { transform: rotate(360deg); } }
            </style>
          `)
                    .addTo(mapRef.current);
            }

            // Fetch real-time AQI first (with timeout)
            let realTimeAQI = null;
            if (OPENWEATHER_KEY) {
                try {
                    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000));
                    realTimeAQI = await Promise.race([fetchAQI(lat, lng), timeout]);
                } catch (e) {
                    console.warn("AQI fetch timed out or failed", e);
                }
            }

            // Calculate time factor for future projections
            const yearsElapsed = y - MIN_YEAR;
            const timeFactor = yearsElapsed / (MAX_YEAR - MIN_YEAR);

            // 🌧 Fetch real-time rainfall (Open-Meteo) (with timeout)
            let rainfall = 0;
            let rainProbability = 0;

            try {
                const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000));
                const rainData = await Promise.race([fetchRainfall(lat, lng), timeout]);
                if (rainData) {
                    rainfall = rainData.rain; // mm
                    rainProbability = rainData.probability; // %
                    rainfallRef.current = rainfall; // Store for flood animation
                }
            } catch (e) {
                console.warn("Rainfall fetch timed out", e);
            }

            // Build rain HTML (integrated inside AQI card) - MUST be defined before aqiHtml
            const rainHtml = `
        <div style="
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid rgba(255,255,255,0.04);
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          font-size: 12px;
          color: #cbd5f5;
        ">
          <div style="
            background: rgba(255,255,255,0.03);
            border-radius: 8px;
            padding: 8px 10px;
            display:flex;
            align-items:center;
            gap:8px;
          ">
            🌧 <span>Rainfall</span>
            <b style="margin-left:auto;color:#60a5fa">${rainfall.toFixed(1)} mm</b>
          </div>

          <div style="
            background: rgba(255,255,255,0.03);
            border-radius: 8px;
            padding: 8px 10px;
            display:flex;
            align-items:center;
            gap:8px;
          ">
            ☔ <span>Probability</span>
            <b style="margin-left:auto;color:#38bdf8">${rainProbability}%</b>
          </div>
        </div>
      `;

            // Build World Bank data HTML - MUST be defined before aqiHtml
            let worldBankHtml = "";

            if (macroData && macroData.population && macroData.urbanPct && macroData.gdpPerCapita) {
                const povertyVal = macroData.poverty?.value ?? macroData.povertyDDAY?.value ?? null;

                worldBankHtml = `
          <div style="
            margin-top: 12px;
            padding-top: 10px;
            border-top: 1px solid rgba(255,255,255,0.04);
            font-size: 11px;
            color: #94a3b8;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          ">
            <div>Population: <b style="color:#cbd5f5">${(macroData.population.value / 1e6).toFixed(1)}M</b></div>
            <div>Urban: <b style="color:#cbd5f5">${macroData.urbanPct.value.toFixed(1)}%</b></div>
            <div>GDP/capita: <b style="color:#cbd5f5">$${Math.round(macroData.gdpPerCapita.value)}</b></div>
            <div>Poverty: <b style="color:#cbd5f5">${povertyVal !== null ? povertyVal.toFixed(1) + "%" : "—"}</b></div>
          </div>
        `;
            }

            // 1. Fetch Real Traffic Data for this point
            let currentTrafficFactor = IMPACT_MODEL.baseTraffic;

            try {
                if (TOMTOM_KEY) {
                    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000));
                    const response = await Promise.race([
                        fetch(`https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?key=${TOMTOM_KEY}&point=${lat},${lng}`),
                        timeout
                    ]);

                    if (response.ok) {
                        const data = await response.json();

                        if (data.flowSegmentData) {
                            const { currentSpeed, freeFlowSpeed } = data.flowSegmentData;
                            if (freeFlowSpeed > 0) {
                                const congestion = 1 - (currentSpeed / freeFlowSpeed);
                                currentTrafficFactor = Math.max(0, Math.min(1, congestion));
                            }
                        }
                    }
                }
            } catch (err) {
                console.warn("Could not fetch real-time traffic, falling back to model", err);
            }

            // 2. Mix Real Data with Future Projections
            const projectedTraffic = currentTrafficFactor + (0.5 * timeFactor);

            // Use real-time AQI if available, otherwise use model
            const AQI = realTimeAQI ? realTimeAQI.aqi : (IMPACT_MODEL.baseAQI + (IMPACT_MODEL.maxAQI - IMPACT_MODEL.baseAQI) * timeFactor);

            // Flood risk influenced by rainfall + future projection
            const rainFactor = Math.min(rainfall / 20, 1); // 20mm+ = severe
            const rainProbFactor = rainProbability / 100;

            const FloodRisk = Math.min(
                1,
                IMPACT_MODEL.baseFloodRisk +
                (IMPACT_MODEL.maxFloodRisk - IMPACT_MODEL.baseFloodRisk) * timeFactor +
                rainFactor * 0.4 +
                rainProbFactor * 0.2
            );
            const Pop = IMPACT_MODEL.basePopulation + IMPACT_MODEL.populationGrowth * timeFactor;

            const people = Math.round(
                800 + 110 * AQI + 12000 * FloodRisk + 9000 * projectedTraffic + 0.03 * Pop
            );

            // Economic loss will be calculated by Gemini AI based on location-specific factors
            // No static calculation - Gemini will analyze location and calculate appropriate loss
            setImpactData({
                zone: `${placeName} (${y})`,
                people,
                loss: null, // Will be calculated by Gemini AI
                risk: FloodRisk > 0.6 ? "Severe 🔴" : FloodRisk > 0.4 ? "Moderate 🟠" : "Low 🟡"
            });

            // Reset location population when clicking new location
            setLocationPopulation(null);

            // Calculate Demographics (will be updated once Gemini provides loss value)
            let demoStats = null;
            try {
                demoStats = calculatePopulationDynamics(y, { loss: null });
                setDemographics(demoStats);
            } catch (err) {
                console.warn('Demographics calc failed:', err);
            }

            // Kick off Gemini AI analysis (non-blocking)
            (async () => {
                try {
                    setAnalysisLoading(true);
                    setUrbanAnalysis(null);
                    // Simple projection for national GDP for the requested year (fallback growth ~6%/yr)
                    const nationalGDPYear = macroData?.gdp?.value ? macroData.gdp.value * (1 + 0.06 * (y - 2023)) : 3.4e12;

                    const aiData = {
                        // Core Simulation Data
                        year: y,
                        zone: placeName,
                        coordinates: { lat, lng },

                        // Impact Metrics (economic loss will be calculated by Gemini)
                        people_affected: people,
                        risk_level: FloodRisk > 0.6 ? "Severe" : FloodRisk > 0.4 ? "Moderate" : "Low",

                        // Environmental Real-time Data
                        rainfall_mm: rainfall.toFixed(1),
                        rain_probability_pct: rainProbability,
                        aqi_realtime: realTimeAQI ? realTimeAQI.aqi : Math.round(AQI),
                        flood_risk_index: FloodRisk.toFixed(2),

                        // Traffic Data
                        traffic_congestion_index: projectedTraffic.toFixed(2),

                        // Demographics & Social Data (Calculated Model)
                        demographics: {
                            population: demoStats ? (demoStats.totalPopulation / 1e6).toFixed(2) + " Million" : (cityDemo / 1e6).toFixed(2) + " Million",
                            growth_rate: demoStats ? demoStats.growthRate + "%" : "Unknown",
                            tfr: demoStats ? demoStats.tfr : "Unknown",
                            migration_status: demoStats?.migrationImpact ?? (demoStats?.migrationShare ? `${demoStats.migrationShare}%` : "Unknown")
                        },

                        // Macro-Economics (World Bank Live + Projections)
                        macro: {
                            national_gdp_usd: macroData?.gdp?.value ? (macroData.gdp.value / 1e12).toFixed(2) + " Trillion" : "Unknown",
                            urban_poverty_rate: macroData?.poverty?.value ? macroData.poverty.value + "%" : "Unknown",
                            gdp_per_capita: macroData?.gdpPerCapita?.value ? Math.round(macroData.gdpPerCapita.value) : "Unknown"
                        }
                    };

                    const metrics = {
                        aqi: aiData.aqi_realtime,
                        traffic: parseFloat(aiData.traffic_congestion_index),
                        floodDepth: floodDepthRef.current || 0,
                        weather: `Rainfall: ${aiData.rainfall_mm}mm`
                    };
                    const analysis = await getUrbanAnalysis(aiData, y, metrics);
                    setUrbanAnalysis(analysis || "No analysis available.");

                    // Extract population, economic loss and people affected from Gemini's analysis
                    // Format: "Real-Time Loss: ₹[Amount] Cr. Population: [X] people."
                    const populationMatch = analysis?.match(/Population:\s*([\d,]+)\s+people/i);
                    // Robust regex for currency: Matches ₹ 1,200 Cr, ₹1200 Cr, etc.
                    const lossMatch = analysis?.match(/[₹Rs.]\s*([\d,]+(?:\.\d+)?)\s*Cr/i);
                    const peopleMatch = analysis?.match(/affects\s+([\d,]+)\s+people/i);

                    // Extract and set population
                    if (populationMatch) {
                        const pop = parseInt(populationMatch[1].replace(/,/g, ''), 10);
                        setLocationPopulation(pop);
                    }

                    if (lossMatch) {
                        // Remove commas and parse
                        const rawLoss = lossMatch[1].replace(/,/g, '');
                        const calculatedLoss = Math.round(parseFloat(rawLoss));
                        const affectedPeople = peopleMatch ? parseInt(peopleMatch[1].replace(/,/g, '')) : people;

                        setImpactData(prev => ({
                            ...prev,
                            loss: calculatedLoss,
                            people: affectedPeople
                        }));
                        // Recalculate demographics with the new loss value
                        try {
                            const updatedDemoStats = calculatePopulationDynamics(y, { loss: calculatedLoss });
                            setDemographics(updatedDemoStats);
                        } catch (err) {
                            console.warn('Demographics recalculation failed:', err);
                        }
                    } else {
                        // If AI fails to return strict format, try to infer or keep old values
                        console.warn("Could not parse Economic Loss from AI analysis:", analysis);
                    }

                    // Update popup with analysis
                    if (popupRef.current && mapRef.current) {
                        const popupElement = popupRef.current.getElement();
                        const analysisContainer = popupElement?.querySelector('#analysis-container');
                        if (analysisContainer) {
                            analysisContainer.innerHTML = `
                <div style="font-size: 13px; font-weight: 700; color: #60a5fa; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">🤖 AI Location Analysis</div>
                <div style="font-size: 14px; color: #e2e8f0; line-height: 1.7; white-space: pre-wrap; word-wrap: break-word; overflow-wrap: break-word; max-height: 300px; overflow-y: auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-weight: 400; max-width: 100%; box-sizing: border-box;">${analysis || "No analysis available."}</div>
              `;
                        }
                    }
                } catch (err) {
                    console.error("Gemini analysis failed:", err);
                    setUrbanAnalysis("Analysis failed. See console for details.");

                    // Update popup with error
                    if (popupRef.current && mapRef.current) {
                        const popupElement = popupRef.current.getElement();
                        const analysisContainer = popupElement?.querySelector('#analysis-container');
                        if (analysisContainer) {
                            analysisContainer.innerHTML = `
                <div style="font-size: 11px; color: #f87171; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-weight: 500;">Analysis temporarily unavailable</div>
              `;
                        }
                    }
                } finally {
                    setAnalysisLoading(false);
                }
            })();

            // Fallback: Find nearest AQI point from static data if no real-time data
            let nearestAQI = null;
            if (!realTimeAQI && aqiGeo && aqiGeo.features && aqiGeo.features.length) {
                const toRad = (deg) => (deg * Math.PI) / 180;
                const haversine = (lat1, lon1, lat2, lon2) => {
                    const R = 6371e3; // meters
                    const phi1 = toRad(lat1);
                    const phi2 = toRad(lat2);
                    const dPhi = toRad(lat2 - lat1);
                    const dLambda = toRad(lon2 - lon1);
                    const a = Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
                        Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                    return R * c;
                };

                let best = { dist: Infinity, feat: null };
                for (const f of aqiGeo.features) {
                    const [fx, fy] = f.geometry.coordinates; // [lng, lat]
                    const d = haversine(lat, lng, fy, fx);
                    if (d < best.dist) {
                        best = { dist: d, feat: f };
                    }
                }
                if (best.feat) {
                    nearestAQI = {
                        value: best.feat.properties && (best.feat.properties.aqi ?? best.feat.properties.AQI ?? best.feat.properties.value),
                        distance_m: Math.round(best.dist)
                    };
                }
            }

            // Build AQI display HTML with modern, minimal design
            let aqiHtml = '';
            if (realTimeAQI) {
                let aqiColor = '#22c55e'; // Green (0-50)
                let aqiStatus = 'Good';
                if (realTimeAQI.aqi > 50 && realTimeAQI.aqi <= 100) {
                    aqiColor = '#eab308';
                    aqiStatus = 'Moderate';
                } else if (realTimeAQI.aqi > 100 && realTimeAQI.aqi <= 150) {
                    aqiColor = '#f97316';
                    aqiStatus = 'Unhealthy for Sensitive';
                } else if (realTimeAQI.aqi > 150 && realTimeAQI.aqi <= 200) {
                    aqiColor = '#dc2626';
                    aqiStatus = 'Unhealthy';
                } else if (realTimeAQI.aqi > 200 && realTimeAQI.aqi <= 300) {
                    aqiColor = '#9333ea';
                    aqiStatus = 'Very Unhealthy';
                } else if (realTimeAQI.aqi > 300) {
                    aqiColor = '#6b21a8';
                    aqiStatus = 'Hazardous';
                }

                // Dark-themed AQI card - compact size
                aqiHtml = `
          <div style="background: rgba(15, 23, 42, 0.95); box-shadow: 0 8px 24px rgba(0,0,0,0.6); border-radius: 10px; padding: 12px; margin: 10px; border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(12px); color: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: calc(100% - 20px); box-sizing: border-box; word-wrap: break-word;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:8px;flex-wrap:wrap;">
              <div style="flex:1;min-width:0;">
                <div style="font-size:9px;color:#94a3b8;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;margin-bottom:6px;white-space:nowrap;">Air Quality Index</div>
                <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;">
                  <span style="font-size:24px;font-weight:800;color:${aqiColor};line-height:1;font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;white-space:nowrap;">${realTimeAQI.aqi}</span>
                  <span style="font-size:11px;color:#cbd5e1;font-weight:600;white-space:nowrap;">${aqiStatus}</span>
                </div>
              </div>
              <div style="width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,0.1);flex-shrink:0;">
                <div style="width:18px;height:18px;border-radius:50%;background:${aqiColor};box-shadow:0 0 12px ${aqiColor}80;"></div>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.1);">
              <div style="min-width:0;">
                <div style="font-size:9px;color:#64748b;text-transform:uppercase;margin-bottom:4px;font-weight:600;letter-spacing:0.4px;white-space:nowrap;">PM2.5</div>
                <div style="font-size:11px;font-weight:700;color:#e2e8f0;word-break:break-word;">${realTimeAQI.components.pm25} <span style="font-size:9px;color:#94a3b8;font-weight:500">μg/m³</span></div>
              </div>
              <div style="min-width:0;">
                <div style="font-size:9px;color:#64748b;text-transform:uppercase;margin-bottom:4px;font-weight:600;letter-spacing:0.4px;white-space:nowrap;">PM10</div>
                <div style="font-size:11px;font-weight:700;color:#e2e8f0;word-break:break-word;">${realTimeAQI.components.pm10} <span style="font-size:9px;color:#94a3b8;font-weight:500">μg/m³</span></div>
              </div>
              <div style="min-width:0;">
                <div style="font-size:9px;color:#64748b;text-transform:uppercase;margin-bottom:4px;font-weight:600;letter-spacing:0.4px;white-space:nowrap;">NO₂</div>
                <div style="font-size:11px;font-weight:700;color:#e2e8f0;word-break:break-word;">${realTimeAQI.components.no2} <span style="font-size:9px;color:#94a3b8;font-weight:500">μg/m³</span></div>
              </div>
              <div style="min-width:0;">
                <div style="font-size:9px;color:#64748b;text-transform:uppercase;margin-bottom:4px;font-weight:600;letter-spacing:0.4px;white-space:nowrap;">O₃</div>
                <div style="font-size:11px;font-weight:700;color:#e2e8f0;word-break:break-word;">${realTimeAQI.components.o3} <span style="font-size:9px;color:#94a3b8;font-weight:500">μg/m³</span></div>
              </div>
            </div>

            <div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08);font-size:9px;color:#94a3b8;display:flex;align-items:center;gap:4px;font-weight:500;flex-wrap:wrap;">
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1" opacity="0.3"/><path d="M6 3v3l2 2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/></svg>
              <span style="word-break:break-word;font-size:9px;">Updated ${realTimeAQI.timestamp}</span>
            </div>

            ${rainHtml}
            ${worldBankHtml}
          </div>
        `;
            } else if (nearestAQI) {
                let aqiColor = '#22c55e';
                if (nearestAQI.value > 50 && nearestAQI.value <= 100) aqiColor = '#eab308';
                else if (nearestAQI.value > 100 && nearestAQI.value <= 150) aqiColor = '#f97316';
                else if (nearestAQI.value > 150 && nearestAQI.value <= 200) aqiColor = '#dc2626';
                else if (nearestAQI.value > 200 && nearestAQI.value <= 300) aqiColor = '#9333ea';
                else if (nearestAQI.value > 300) aqiColor = '#6b21a8';

                aqiHtml = `
          <div style="background: rgba(15, 23, 42, 0.95); box-shadow: 0 8px 24px rgba(0,0,0,0.6); border-radius:10px; padding:12px; margin:10px; border:1px solid rgba(255,255,255,0.1); backdrop-filter: blur(12px); color:#e2e8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div style="flex:1">
                <div style="font-size:9px;color:#94a3b8;text-transform:uppercase;margin-bottom:6px;font-weight:700;letter-spacing:0.6px;">Air Quality Index</div>
                <div style="display:flex;align-items:baseline;gap:8px;"> <span style="font-size:24px;font-weight:800;color:${aqiColor};font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">${nearestAQI.value}</span><span style="font-size:11px;color:#cbd5e1;font-weight:600">Nearest (${nearestAQI.distance_m}m)</span></div>
              </div>
              <div style="width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,0.1)">
                <div style="width:18px;height:18px;border-radius:50%;background:${aqiColor};box-shadow:0 0 12px ${aqiColor}80;"></div>
              </div>
            </div>

            ${rainHtml}
            ${worldBankHtml}
          </div>
        `;
            } else {
                aqiHtml = `
          <div style="background: rgba(15, 23, 42, 0.95); box-shadow: 0 8px 24px rgba(0,0,0,0.6); border-radius: 10px; padding: 14px; margin: 10px; border: 1px solid rgba(255,255,255,0.1); text-align: center; backdrop-filter: blur(12px);">
            <div style="color: #94a3b8; font-size: 11px; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-weight: 500;">
              ${OPENWEATHER_KEY ? 'AQI data not available for this location' : 'Set VITE_OPENWEATHER_API_KEY for real-time AQI'}
            </div>

            ${rainHtml}
          </div>
        `;
            }

            if (popupRef.current && mapRef.current) {
                const map = mapRef.current;
                const point = map.project([lng, lat]);
                const w = map.getContainer().clientWidth;
                const h = map.getContainer().clientHeight;
                // Position popup at clicked location - small offset above the point
                let popupOffset = [0, -10];
                // Only adjust if popup would go off-screen
                // If near right edge, shift left
                if (point.x > w - 180) popupOffset = [-160, -10];
                // If near left edge, shift right
                else if (point.x < 180) popupOffset = [160, -10];
                // If near top, position below
                if (point.y < 100) popupOffset = [popupOffset[0], 10];
                // If near bottom, position above (default)
                else if (point.y > h - 100) popupOffset = [popupOffset[0], -10];

                const closePopup = `
          <div
            style="
              position:absolute;
              top:10px;
              right:12px;
              cursor:pointer;
              font-size:16px;
              color:#94a3b8;
              font-weight:600;
              width:24px;
              height:24px;
              display:flex;
              align-items:center;
              justify-content:center;
              border-radius:4px;
              transition:all 0.2s;
              z-index:1300;
            "
            onmouseover="this.style.background='rgba(255,255,255,0.1)';this.style.color='#f1f5f9'"
            onmouseout="this.style.background='transparent';this.style.color='#94a3b8'"
            onclick="this.closest('.maplibregl-popup').remove()"
          >
            ✕
          </div>
        `;

                popupRef.current
                    .setLngLat([lng, lat])
                    .setHTML(`
            <div style="position:relative; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; padding: 0; margin: 0; max-width: 100%; box-sizing: border-box; word-wrap: break-word; overflow-wrap: break-word;">
              ${closePopup}
              <div style="padding: 12px 14px 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.08);">
                <div style="font-size: 14px; font-weight: 700; color: #f1f5f9; margin-bottom: 6px; letter-spacing: -0.3px;">Location</div>
                <div style="font-size: 11px; color: #94a3b8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin-bottom: 10px; word-break: break-word;">${placeName}</div>
                <div style="margin-top: 10px;">
                  <button onclick="(function(){const n=prompt('Save name','Pinned Location'); if(n!==null) window.saveLocation(n, ${lat}, ${lng});})()" style="padding:6px 12px;border-radius:6px;border:none;background:rgba(245, 158, 11, 0.9);color:#fff;cursor:pointer;font-weight:600;font-size:11px;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;transition:all 0.2s;width:100%;box-sizing:border-box;" onmouseover="this.style.background='rgba(245, 158, 11, 1)';this.style.transform='scale(1.02)'" onmouseout="this.style.background='rgba(245, 158, 11, 0.9)';this.style.transform='scale(1)'">⭐ Save</button>
                </div>
              </div>
              ${aqiHtml}
              ${!aqiHtml ? worldBankHtml : ""}
              <div id="analysis-container" style="background: rgba(15, 23, 42, 0.95); box-shadow: 0 8px 24px rgba(0,0,0,0.6); border-radius: 10px; padding: 12px; margin: 10px; border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(12px); max-width: calc(100% - 20px); box-sizing: border-box;">
                <div style="text-align: center; color: #94a3b8;">
                  <div style="display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(96, 165, 250, 0.3); border-top-color: #60a5fa; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 8px;"></div>
                  <div style="font-size: 11px; color: #cbd5e1; font-weight: 500; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">Generating AI Analysis...</div>
                </div>
              </div>
            </div>
            <style>
              @keyframes spin { to { transform: rotate(360deg); } }
              .custom-popup {
                pointer-events: auto !important;
              }
              .custom-popup .maplibregl-popup-content {
                background: rgba(15, 23, 42, 0.98) !important;
                border: 1px solid rgba(255,255,255,0.15) !important;
                border-radius: 12px !important;
                box-shadow: 0 12px 40px rgba(0,0,0,0.8) !important;
                backdrop-filter: blur(16px) !important;
                padding: 0 !important;
                max-width: 260px !important;
                width: 260px !important;
                min-width: 260px !important;
                box-sizing: border-box !important;
                overflow: hidden !important;
              }
              .custom-popup .maplibregl-popup-tip {
                border-top-color: rgba(15, 23, 42, 0.98) !important;
                border-left-color: rgba(15, 23, 42, 0.98) !important;
                border-right-color: rgba(15, 23, 42, 0.98) !important;
                border-bottom-color: rgba(15, 23, 42, 0.98) !important;
              }
            </style>
          `)
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
                            const response = await fetch(
                                `https://api.openweathermap.org/data/2.5/air_pollution?lat=${city.lat}&lon=${city.lng}&appid=${OPENWEATHER_KEY}`
                            );

                            if (!response.ok) return null;

                            const data = await response.json();

                            if (data && data.list && data.list.length > 0) {
                                const aqi = data.list[0].main.aqi;
                                const components = data.list[0].components;
                                const pm25 = components.pm2_5 || 0;

                                let usAQI = 0;
                                if (pm25 > 0) {
                                    if (pm25 <= 12) usAQI = Math.round((pm25 / 12) * 50);
                                    else if (pm25 <= 35.4) usAQI = Math.round(50 + ((pm25 - 12) / 23.4) * 50);
                                    else if (pm25 <= 55.4) usAQI = Math.round(100 + ((pm25 - 35.4) / 20) * 50);
                                    else if (pm25 <= 150.4) usAQI = Math.round(150 + ((pm25 - 55.4) / 95) * 100);
                                    else if (pm25 <= 250.4) usAQI = Math.round(250 + ((pm25 - 150.4) / 100) * 100);
                                    else usAQI = Math.round(350 + ((pm25 - 250.4) / 149.6) * 150);
                                    usAQI = Math.min(500, Math.max(0, usAQI));
                                } else {
                                    const aqiMap = { 1: 50, 2: 100, 3: 150, 4: 200, 5: 300 };
                                    usAQI = aqiMap[aqi] || 100;
                                }

                                return {
                                    type: "Feature",
                                    properties: {
                                        aqi: usAQI,
                                        city: city.name,
                                        level: aqi,
                                        pm25: Math.round(pm25 * 10) / 10,
                                        pm10: Math.round((components.pm10 || 0) * 10) / 10
                                    },
                                    geometry: {
                                        type: "Point",
                                        coordinates: [city.lng, city.lat]
                                    }
                                };
                            }
                            return null;
                        } catch (err) {
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

        // Calculate max depth based on year and rainfall
        const yearsElapsed = year - MIN_YEAR;
        const timeFactor = yearsElapsed / (MAX_YEAR - MIN_YEAR);
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

            // Re-add other custom layers if needed
            // Note: AQI, flood layers would need to be re-added here if needed
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
        toggle("flood-layer", layers.flood);
        toggle("traffic-layer", layers.traffic);
        toggle("flood-depth-layer", layers.floodDepth);
    }, [layers, loading]);

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

    /* ================= HANDLE LOCATION SEARCH ================= */
    const handleLocationSelect = useCallback((lng, lat, placeName) => {
        if (!mapRef.current) return;

        // Fly to the selected location
        flyToPoint(lng, lat, 14, 65, mapRef.current.getBearing());

        // Optional: Create a marker or popup at the location
        if (popupRef.current) {
            popupRef.current
                .setLngLat([lng, lat])
                .setHTML(`
          <div style="
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto;
            padding: 12px;
            color: #202124;
          ">
            <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">
              ${placeName}
            </div>
            <div style="font-size: 12px; color: #5f6368;">
              ${lat.toFixed(4)}, ${lng.toFixed(4)}
            </div>
          </div>
        `)
                .addTo(mapRef.current);
        }
    }, [flyToPoint]);

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
            <TimeSlider year={year} setYear={setYear} />

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
                            e.target.style.background = layers.traffic ? "ratio" : "rgba(30, 41, 59, 0.9)";
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
