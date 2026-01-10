import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import LayerToggle from "./LayerToggle";
import EconomicPanel from "./EconomicPanel";

export default function MapView() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const layersReady = useRef(false);

  const [layers, setLayers] = useState({
    aqi: true,
    flood: true,
    traffic: true
  });

  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style:
        "https://api.maptiler.com/maps/hybrid/style.json?key=UQBNCVHquLf1PybiywBt",
      center: [77.2090, 28.6139], // Delhi
      zoom: 12,
      pitch: 55,
      bearing: -15,
      antialias: true
    });

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    const popup = new maplibregl.Popup({ closeButton: false });

    map.on("load", async () => {
      /* ================= TERRAIN ================= */
      map.once("style.load", () => {
        map.addSource("terrain", {
          type: "raster-dem",
          url:
            "https://api.maptiler.com/tiles/terrain-rgb/tiles.json?key=UQBNCVHquLf1PybiywBt",
          tileSize: 256
        });

        map.setTerrain({
          source: "terrain",
          exaggeration: 1.4
        });

        map.setLight({
          anchor: "viewport",
          color: "white",
          intensity: 0.35,
          position: [1.15, 210, 30]
        });
      });

      /* ================= AQI ================= */
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

      map.on("mousemove", "aqi-layer", e => {
        map.getCanvas().style.cursor = "pointer";
        const { aqi } = e.features[0].properties;

        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<strong>AQI:</strong> ${aqi}<br/>
             <strong>Status:</strong> ${
               aqi < 50 ? "Good" :
               aqi < 100 ? "Moderate" :
               aqi < 150 ? "Unhealthy" : "Severe"
             }`
          )
          .addTo(map);
      });

      map.on("mouseleave", "aqi-layer", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });

      /* ================= FLOOD ================= */
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

      /* ================= TRAFFIC ================= */
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

      /* ================= 3D BUILDINGS ================= */
      map.addLayer({
        id: "3d-buildings",
        source: "openmaptiles",
        "source-layer": "building",
        type: "fill-extrusion",
        minzoom: 14,
        paint: {
          "fill-extrusion-color": "#cfcfcf",
          "fill-extrusion-height": [
            "interpolate",
            ["linear"],
            ["zoom"],
            14, 0,
            16, ["get", "height"]
          ],
          "fill-extrusion-base": ["get", "min_height"],
          "fill-extrusion-opacity": 0.9
        }
      });

      layersReady.current = true;
    });

    return () => map.remove();
  }, []);

  /* ================= TOGGLES ================= */
  useEffect(() => {
    if (!mapRef.current || !layersReady.current) return;
    const map = mapRef.current;

    map.setLayoutProperty(
      "aqi-layer",
      "visibility",
      layers.aqi ? "visible" : "none"
    );

    map.setLayoutProperty(
      "flood-layer",
      "visibility",
      layers.flood ? "visible" : "none"
    );

    map.setLayoutProperty(
      "traffic-layer",
      "visibility",
      layers.traffic ? "visible" : "none"
    );
  }, [layers]);

  return (
    <>
      <LayerToggle layers={layers} setLayers={setLayers} />
      <EconomicPanel layers={layers} />
      <div
        ref={mapContainer}
        style={{ width: "100vw", height: "100vh" }}
      />
    </>
  );
}
