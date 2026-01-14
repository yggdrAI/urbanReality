import { useCallback } from "react";
import { fetchRealtimeAQI } from "../../utils/aqi";

export function useDataFetching() {

    const fetchRainfall = useCallback(async (lat, lng, signal) => {
        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=rain,precipitation_probability&forecast_days=1`;
            const res = await fetch(url, { signal });
            if (!res.ok) throw new Error("Open-Meteo error");

            const data = await res.json();
            const rainNow = data.hourly?.rain?.[0] ?? 0;
            const rainProb = data.hourly?.precipitation_probability?.[0] ?? 0;

            return { rain: rainNow, probability: rainProb };
        } catch (err) {
            if (err.name === 'AbortError') throw err;
            console.warn("Open-Meteo fetch failed:", err);
            return { rain: 0, probability: 0 };
        }
    }, []);

    const getPlaceName = useCallback(async (lat, lng, signal) => {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
                {
                    headers: { 'User-Agent': 'UrbanRealityOS/1.0' },
                    signal
                }
            );
            if (!response.ok) throw new Error('Geocoding failed');
            const data = await response.json();
            if (data.address) {
                const address = data.address;
                return address.village || address.town || address.city || address.county || address.state || address.country || 'Unknown Location';
            }
            return 'Unknown Location';
        } catch (err) {
            if (err.name === 'AbortError') throw err;
            console.warn('Reverse geocoding failed:', err);
            return 'Unknown Location';
        }
    }, []);

    const fetchAQI = useCallback(async (lat, lng, key) => {
        try {
            return await fetchRealtimeAQI(lat, lng, key);
        } catch (e) {
            console.warn("AQI fetch failed:", e);
            return null;
        }
    }, []);

    const fetchTraffic = useCallback(async (lat, lng, key, signal) => {
        if (!key) return null;
        try {
            const res = await fetch(
                `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?key=${key}&point=${lat},${lng}`,
                { signal }
            );
            if (res.ok) return await res.json();
            return null;
        } catch (e) {
            if (e.name === 'AbortError') throw e;
            return null;
        }
    }, []);

    return {
        fetchRainfall,
        getPlaceName,
        fetchAQI,
        fetchTraffic
    };
}
