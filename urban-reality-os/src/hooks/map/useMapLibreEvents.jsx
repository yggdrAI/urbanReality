import { useCallback } from "react";
import { createRoot } from "react-dom/client";

export function useMapLibreEvents({
    mapRef,
    popupRef,
    popupRootRef,
    popupSessionRef,
    setActiveLocation,
    setAnalysisLoading,
    setUrbanAnalysis,
    setInsightLoading,
    setTerrainInsight,
    terrainInsightRef,
    fetchAQI,
    fetchRainfall,
    fetchTraffic,
    getPlaceName,
    getTerrainMetrics,
    calculateImpactModel,
    getEstimatedPopulation,
    startFloodSimulation,
    getUrbanAnalysis,
    getTerrainInsight,
    OPENWEATHER_KEY,
    TOMTOM_KEY,
    BASE_YEAR,
    MAX_YEAR,
    IMPACT_MODEL,
    macroDataRef,
    lastAQIRef,
    lastRequestTimeRef,
    yearRef,
    LocationPopup
}) {

    // Combined MouseMove Pipeline for performance
    const handleMouseMove = useCallback((e) => {
        // Safety Guard
        if (!mapRef.current || !e?.lngLat) return;

        // Dispatch terrain data queries or hover visual effects here
        // handleTerrainHover(e);
        // handleAQIHover(e);
    }, [mapRef]);

    const handleMapClick = useCallback(async (e) => {
        // Safety Guard
        if (!mapRef.current || !e?.lngLat) return;

        const { lng, lat } = e.lngLat;
        const y = yearRef.current;
        const sessionId = ++popupSessionRef.current;
        const requestTime = Date.now();
        lastRequestTimeRef.current = requestTime;

        // Abort controller for this specific request
        const abortController = new AbortController();

        // UI Feedback: Ease to location
        mapRef.current.easeTo({
            center: [lng, lat],
            zoom: Math.max(mapRef.current.getZoom(), 14),
            pitch: 65,
            bearing: -30,
            duration: 1800,
            easing: (t) => t * (2 - t)
        });

        // Show Initial Loading Popup
        if (popupRef.current && mapRef.current) {
            try { if (popupRootRef.current) { popupRootRef.current.unmount(); popupRootRef.current = null; } } catch (e) { }

            const container = document.createElement('div');
            container.className = 'custom-popup';
            popupRef.current.setLngLat([lng, lat]).setDOMContent(container).addTo(mapRef.current);

            const root = createRoot(container);
            popupRootRef.current = root;
            root.render(
                <LocationPopup
                    placeName="Analyzing Location..."
                    lat={lat} lng={lng} year={y} baseYear={BASE_YEAR}
                    realTimeAQI={lastAQIRef.current} analysisLoading={true}
                />
            );
        }

        try {
            setActiveLocation({ lat, lng, isInitialLoading: true, sessionId });
            setAnalysisLoading(true);
            setUrbanAnalysis(null);
            setInsightLoading(true);

            // Parallel Global Data Fetch
            const [placeName, realTimeAQI, rainData, trafficJson] = await Promise.all([
                getPlaceName(lat, lng, abortController.signal),
                fetchAQI(lat, lng, OPENWEATHER_KEY),
                fetchRainfall(lat, lng, abortController.signal),
                fetchTraffic(lat, lng, TOMTOM_KEY, abortController.signal)
            ]);

            if (popupSessionRef.current !== sessionId) return;

            // Local Context Calculations
            const localPopulation = getEstimatedPopulation(placeName, lat, lng);
            const rainfall = rainData.rain;
            lastAQIRef.current = realTimeAQI;

            // Start terrain-aware flood
            startFloodSimulation(mapRef.current, [lng, lat], rainfall);

            const yearsElapsed = y - BASE_YEAR;
            const timeFactor = yearsElapsed / (MAX_YEAR - BASE_YEAR);

            // Traffic Refinement
            let currentTrafficFactor = IMPACT_MODEL.baseTraffic;
            if (trafficJson?.flowSegmentData?.freeFlowSpeed > 0) {
                currentTrafficFactor = Math.max(0, Math.min(1, 1 - (trafficJson.flowSegmentData.currentSpeed / trafficJson.flowSegmentData.freeFlowSpeed)));
            }
            const projectedTraffic = currentTrafficFactor + (0.5 * timeFactor);

            const floodRisk = Math.min(1, IMPACT_MODEL.baseFloodRisk + (timeFactor * 0.4) + (rainfall / 20) * 0.4 + (rainData.probability / 100) * 0.2);
            const finalAQI = realTimeAQI?.aqi ?? IMPACT_MODEL.baseAQI;

            const impact = calculateImpactModel({
                year: y,
                baseYear: BASE_YEAR,
                populationBase: localPopulation,
                aqi: finalAQI,
                rainfallMm: rainfall,
                trafficCongestion: projectedTraffic,
                floodRisk: floodRisk,
                worldBank: macroDataRef.current
            });

            // Update Global State
            setActiveLocation({
                lat, lng, placeName,
                baseAQI: finalAQI,
                baseRainfall: rainfall,
                baseTraffic: currentTrafficFactor,
                baseFloodRisk: floodRisk,
                basePopulation: localPopulation,
                worldBank: macroDataRef.current,
                sessionId
            });

            // Intermediate Render (Popup with Data)
            if (popupRootRef.current && popupRef.current.isOpen()) {
                popupRootRef.current.render(
                    <LocationPopup
                        placeName={placeName} lat={lat} lng={lng} year={y} baseYear={BASE_YEAR}
                        realTimeAQI={realTimeAQI} finalAQI={finalAQI} rainfall={rainfall}
                        rainProbability={rainData.probability} macroData={macroDataRef.current}
                        impact={impact} analysisLoading={true}
                        openWeatherKey={OPENWEATHER_KEY}
                    />
                );
            }

            // --- AI ANALYSIS (Background) ---
            (async () => {
                try {
                    // Fetch Terrain Metrics efficiently
                    const metrics = getTerrainMetrics(mapRef.current, { lng, lat });

                    // Terrain Insight
                    let insight;
                    if (terrainInsightRef.current.coords &&
                        Math.abs(terrainInsightRef.current.coords.lat - lat) < 1e-5) {
                        insight = terrainInsightRef.current.insight;
                    } else {
                        insight = await getTerrainInsight({
                            elevation: metrics.elevation,
                            slope: metrics.slope,
                            floodRisk: metrics.drainage,
                            heat: metrics.heat,
                            population: impact.population,
                            aqi: finalAQI
                        }, abortController.signal);
                        terrainInsightRef.current = { coords: { lat, lng }, insight };
                    }
                    if (popupSessionRef.current === sessionId) {
                        setTerrainInsight(insight);
                        setInsightLoading(false);
                    }

                    // Urban Analysis
                    const analysis = await getUrbanAnalysis({
                        zone: placeName, year: y, aqi: finalAQI,
                        rainfallMm: rainfall, traffic: projectedTraffic,
                        floodRisk: floodRisk, peopleAffected: impact.peopleAffected,
                        economicLossCr: impact.economicLossCr
                    }, abortController.signal);

                    if (popupSessionRef.current === sessionId) {
                        setUrbanAnalysis(analysis);
                        setAnalysisLoading(false);

                        // Final Render
                        if (popupRootRef.current) {
                            popupRootRef.current.render(
                                <LocationPopup
                                    placeName={placeName} lat={lat} lng={lng} year={y} baseYear={BASE_YEAR}
                                    realTimeAQI={realTimeAQI} finalAQI={finalAQI} rainfall={rainfall}
                                    rainProbability={rainData.probability} macroData={macroDataRef.current}
                                    impact={impact} analysis={analysis} analysisLoading={false}
                                    terrainInsight={insight} openWeatherKey={OPENWEATHER_KEY}
                                />
                            );
                        }
                    }
                } catch (e) {
                    if (e.name !== 'AbortError') console.warn("AI Analysis background task failed:", e);
                }
            })();

        } catch (e) {
            if (e.name !== 'AbortError') console.error("Map click handler failed:", e);
            setAnalysisLoading(false);
            setInsightLoading(false);
        }

        return () => abortController.abort();
    }, [
        mapRef, popupRef, LocationPopup, yearRef, popupSessionRef,
        getPlaceName, fetchAQI, fetchRainfall, fetchTraffic,
        getEstimatedPopulation, getTerrainMetrics, startFloodSimulation,
        calculateImpactModel, getTerrainInsight, getUrbanAnalysis,
        OPENWEATHER_KEY, TOMTOM_KEY, BASE_YEAR, MAX_YEAR, IMPACT_MODEL
    ]);

    return {
        handleMouseMove,
        handleMapClick
    };
}
