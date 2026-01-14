import { useRef } from "react";

// --- Elevation Cache ---
const elevationCache = new Map();
const CACHE_SIZE_LIMIT = 5000;

export function useTerrain() {
    const TERRAIN_SAMPLE_DELTA = 0.0005;

    const getElevation = (map, lngLat) => {
        if (!map || !lngLat) return 0;
        try {
            if (!map.getTerrain || !map.getTerrain()) return 0;
            return map.queryTerrainElevation(lngLat, { exaggerated: false }) ?? 0;
        } catch (e) {
            return 0;
        }
    };

    const getCachedElevation = (map, lngLat) => {
        if (!map || !lngLat) return 0;
        const key = `${lngLat.lng.toFixed(5)},${lngLat.lat.toFixed(5)}`;

        if (!elevationCache.has(key)) {
            // Guard: Cleanup if cache grows too large
            if (elevationCache.size > CACHE_SIZE_LIMIT) {
                elevationCache.clear();
            }
            elevationCache.set(key, getElevation(map, lngLat));
        }
        return elevationCache.get(key);
    };

    const getTerrainMetrics = (map, lngLat) => {
        if (!map || !lngLat) return { elevation: 0, slope: 0, drainage: 0, heat: 0 };

        const elevation = getElevation(map, lngLat);

        // Calculate slope efficiently using sampled elevation
        const e2 = getElevation(map, {
            lng: lngLat.lng + TERRAIN_SAMPLE_DELTA,
            lat: lngLat.lat
        });
        const slope = Math.abs(e2 - elevation) / TERRAIN_SAMPLE_DELTA;

        const drainage = Math.max(0, 1 - slope * 4);
        const builtDensity = 0.6;
        const heat = Math.max(0, 1 + builtDensity * 2 - elevation * 0.002 - slope * 0.4);

        return { elevation, slope, drainage, heat };
    };

    const getFlowDirection = (map, lngLat) => {
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
    };

    const calculateRisk = (map, lngLat, population = 1) => {
        if (!map || !lngLat) return 0;
        const { drainage, heat } = getTerrainMetrics(map, lngLat);
        return (drainage * 0.6 + heat * 0.4) * population;
    };

    const emergencyResponseTime = (map, lngLat) => {
        if (!map || !lngLat) return 5;
        const { slope, drainage } = getTerrainMetrics(map, lngLat);
        return Math.round(5 + slope * 12 + drainage * 8);
    };

    return {
        getElevation,
        getCachedElevation,
        getTerrainMetrics,
        getFlowDirection,
        calculateRisk,
        emergencyResponseTime,
        clearCache: () => elevationCache.clear()
    };
}
