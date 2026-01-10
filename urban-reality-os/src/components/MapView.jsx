import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import LayerToggle from "./LayerToggle";
import EconomicPanel from "./EconomicPanel";
import CitySuggestions from "./CitySuggestions";
import TimeSlider from "./TimeSlider";

export default function MapView() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(
    new maplibregl.Popup({ closeButton: false, offset: 12 })
  );
  const yearRef = useRef(2025);
  const floodAnimRef = useRef(null);

  const [year, setYear] = useState(2025);
  const [impactData, setImpactData] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [floodMode, setFloodMode] = useState(false);

  const [layers, setLayers] = useState({
    aqi: true,
    flood: true,
    traffic: true
  });

  /* ================= MAP INIT ================= */
  useEffect(() => {
    if (mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style:
        "https://api.maptiler.com/maps/hybrid/style.json?key=UQBNCVHquLf1PybiywBt",
      center: [77.209, 28.6139],
      zoom: 12,
      pitch: 60,
      bearing: -20,
      antialias: true
    });

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", async () => {
      /* ===== TERRAIN ===== */
      map.addSource("terrain", {
        type: "raster-dem",
        url:
          "https://api.maptiler.com/tiles/terrain-rgb/tiles.json?key=UQBNCVHquLf1PybiywBt",
        tileSize: 256
      });

      map.setTerrain({ source: "terrain", exaggeration: 1.4 });

      /* ===== AQI ===== */
      const aqiData = await fetch("/data/aqi.json").then(r => r.json());
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

      /* ===== STATIC FLOOD (DATA) ===== */
      const floodData = await fetch("/data/flood.json").then(r => r.json());
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

      /* ===== FLOOD DEPTH (ANIMATED) ===== */
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

      /* ===== TRAFFIC ===== */
      const trafficData = await fetch("/data/traffic.json").then(r => r.json());
      map.addSource("traffic", { type: "geojson", data: trafficData });

      map.addLayer({
        id: "traffic-layer",
        type: "heatmap",
        source: "traffic",
        paint: {
          "heatmap-weight": ["get", "congestion"],
          "heatmap-radius": 30,
          "heatmap-intensity": 1,
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0, "rgba(0,0,0,0)",
            0.3, "#22c55e",
            0.6, "#facc15",
            1, "#dc2626"
          ]
        }
      });

      /* ===== 3D BUILDINGS ===== */
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
    });

    /* ===== AI IMPACT MODEL ===== */
    map.on("click", e => {
      const y = yearRef.current;
      const f = (y - 2025) / 15;

      const AQI = 90 + 110 * f;
      const FloodRisk = 0.25 + 0.6 * f;
      const Traffic = 0.35 + 0.5 * f;
      const Pop = 28000 + 6000 * f;

      const people =
        800 + 110 * AQI + 12000 * FloodRisk + 9000 * Traffic + 0.03 * Pop;

      const loss =
        0.0028 * people + 35 * FloodRisk + 18 * Traffic;

      setImpactData({
        zone: `Delhi Urban Zone (${y})`,
        people: Math.round(people),
        loss: Math.round(loss),
        risk: FloodRisk > 0.6 ? "Severe 🔴" : "Moderate 🟠"
      });

      popupRef.current
        .setLngLat(e.lngLat)
        .setHTML(`<b>Impact simulated for ${y}</b>`)
        .addTo(map);
    });
  }, []);

  /* ================= YEAR SYNC ================= */
  useEffect(() => {
    yearRef.current = year;
  }, [year]);

  /* ================= FLOOD DEPTH ANIMATION ================= */
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    if (floodAnimRef.current) cancelAnimationFrame(floodAnimRef.current);

    if (!floodMode) {
      map.getSource("flood-depth")?.setData({
        type: "FeatureCollection",
        features: []
      });
      return;
    }

    let depth = 0;
    const maxDepth = 3 * ((year - 2025) / 15 + 0.4);

    const animate = () => {
      depth += 0.02;

      map.getSource("flood-depth").setData({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { depth },
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

      if (depth < maxDepth) {
        floodAnimRef.current = requestAnimationFrame(animate);
      }
    };

    animate();
  }, [floodMode, year]);

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
  }, [layers]);

  /* ================= CINEMATIC CAMERA ================= */
  const flyToPoint = (lng, lat, zoom = 14, pitch = 65, bearing = 0) => {
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
  };

  const startCityFlyThrough = () => {
    if (!mapRef.current) return;

    const tour = [
      { lng: 77.2090, lat: 28.6139, zoom: 13, bearing: -20 },
      { lng: 77.2200, lat: 28.6300, zoom: 15, bearing: 60 },
      { lng: 77.2300, lat: 28.6500, zoom: 14, bearing: 140 },
      { lng: 77.2000, lat: 28.6200, zoom: 16, bearing: 220 },
      { lng: 77.1850, lat: 28.6000, zoom: 13, bearing: 320 }
    ];

    let i = 0;
    const flyNext = () => {
      if (i >= tour.length) return;
      const p = tour[i];
      flyToPoint(p.lng, p.lat, p.zoom, 65, p.bearing);
      i++;
      setTimeout(flyNext, 4500);
    };

    flyNext();
  };

  return (
    <>
      <LayerToggle layers={layers} setLayers={setLayers} />
      <TimeSlider year={year} setYear={setYear} />

      <button
        onClick={() => setFloodMode(!floodMode)}
        style={{
          position: "absolute",
          top: 20,
          left: 480,
          zIndex: 10,
          padding: "8px 14px",
          borderRadius: 8,
          border: "none",
          background: floodMode ? "#2563eb" : "#020617",
          color: "#fff",
          cursor: "pointer"
        }}
      >
        🌊 Flood Depth
      </button>

      <button
        onClick={startCityFlyThrough}
        style={{
          position: "absolute",
          top: 20,
          left: 320,
          zIndex: 10,
          padding: "8px 14px",
          borderRadius: 8,
          border: "none",
          background: "#020617",
          color: "#fff",
          cursor: "pointer"
        }}
      >
        🎥 Fly Through City
      </button>

      <EconomicPanel data={impactData} />
      <CitySuggestions map={mapRef.current} visible={showSuggestions} />

      <div ref={mapContainer} style={{ width: "100vw", height: "100vh" }} />
    </>
  );
}
