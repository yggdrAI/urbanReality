import { useRef, useCallback } from "react";

const FLOOD_ANIMATION = {
    depthIncrement: 0.02,
    maxDepth: 3.5,
    resetDepth: 0,
    baseDepthMultiplier: 0.4
};

export function useFlood(getTerrainMetrics) {
    const floodAnimRef = useRef(null);
    const floodDepthRef = useRef(0);

    const simulateFlood = useCallback((map, center, rainfall) => {
        if (!map || !center) return [];

        const features = [];
        const baseRain = Math.min(rainfall / 20, 1);
        const zoom = map.getZoom();

        // Adaptive settings
        const step = zoom > 14 ? 0.002 : 0.004;
        const radius = zoom > 15 ? 0.006 : 0.012; // Adaptive bounding box

        for (let dx = -radius; dx <= radius; dx += step) {
            for (let dy = -radius; dy <= radius; dy += step) {
                try {
                    const lng = center[0] + dx;
                    const lat = center[1] + dy;

                    const { elevation, drainage } = getTerrainMetrics(map, { lng, lat });
                    const drainageClamped = Math.max(0.1, drainage);

                    const depth = Math.max(0, baseRain * 4 - elevation * 0.02) * drainageClamped;
                    if (depth <= 0) continue;

                    features.push({
                        type: "Feature",
                        properties: { depth: Math.min(depth, FLOOD_ANIMATION.maxDepth) },
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
                } catch (e) { }
            }
        }
        return features;
    }, [getTerrainMetrics]);

    const startFloodSimulation = useCallback((map, center, rainfall) => {
        if (!map || !center || rainfall <= 0) return;

        const source = map.getSource("flood-zones");
        if (!source) return;

        floodDepthRef.current = FLOOD_ANIMATION.resetDepth;

        const animate = () => {
            floodDepthRef.current = Math.min(
                FLOOD_ANIMATION.maxDepth,
                floodDepthRef.current + FLOOD_ANIMATION.depthIncrement
            );

            const features = simulateFlood(map, center, rainfall * floodDepthRef.current);

            try {
                if (map.getSource("flood-zones")) {
                    map.getSource("flood-zones").setData({ type: "FeatureCollection", features });
                }
            } catch (e) { }

            if (floodDepthRef.current < FLOOD_ANIMATION.maxDepth) {
                floodAnimRef.current = requestAnimationFrame(animate);
            } else {
                floodAnimRef.current = null;
            }
        };

        if (floodAnimRef.current) cancelAnimationFrame(floodAnimRef.current);
        floodAnimRef.current = requestAnimationFrame(animate);
    }, [simulateFlood]);

    const stopFloodSimulation = useCallback((map) => {
        if (floodAnimRef.current) {
            cancelAnimationFrame(floodAnimRef.current);
            floodAnimRef.current = null;
        }
        try {
            const source = map.getSource("flood-zones");
            if (source) source.setData({ type: "FeatureCollection", features: [] });
        } catch (e) { }
    }, []);

    return {
        startFloodSimulation,
        stopFloodSimulation,
        floodDepth: floodDepthRef.current
    };
}
