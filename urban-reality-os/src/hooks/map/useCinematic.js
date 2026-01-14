import { useState, useEffect, useCallback } from "react";

/**
 * Global event dispatcher for cinematic mode.
 * Decoupled from React to allow low-level map functions to trigger it.
 */
export function emitCinematic(active) {
    window.dispatchEvent(
        new CustomEvent("cinematic-mode", { detail: { active: !!active } })
    );
}

export function useCinematic() {
    const [isCinematic, setIsCinematic] = useState(false);

    useEffect(() => {
        const handleCinematic = (e) => setIsCinematic(!!e.detail.active);
        window.addEventListener("cinematic-mode", handleCinematic);

        // Sync DOM class to React state (Safe Mutation)
        document.body.classList.toggle("cinematic", isCinematic);

        return () => {
            window.removeEventListener("cinematic-mode", handleCinematic);
            document.body.classList.remove("cinematic");
        };
    }, [isCinematic]);

    const startCityFlyThrough = useCallback((map, defaultPath) => {
        if (!map) return;
        emitCinematic(true);

        defaultPath.forEach((step, i) => {
            setTimeout(() => {
                map.easeTo({
                    ...step,
                    duration: 2500,
                    easing: (t) => t * (2 - t)
                });

                if (i === defaultPath.length - 1) {
                    setTimeout(() => emitCinematic(false), 2600);
                }
            }, i * 2600);
        });
    }, []);

    const streetLevelView = useCallback((map, lngLat) => {
        if (!map || !lngLat) return;
        emitCinematic(true);
        map.easeTo({
            center: [lngLat.lng, lngLat.lat],
            zoom: 17,
            pitch: 80,
            bearing: Math.random() * 360,
            duration: 1800
        });
        setTimeout(() => emitCinematic(false), 2000);
    }, []);

    return {
        isCinematic,
        emitCinematic,
        startCityFlyThrough,
        streetLevelView
    };
}
