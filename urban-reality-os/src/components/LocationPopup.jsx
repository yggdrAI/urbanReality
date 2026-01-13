import React from "react";
import "./LocationPopup.css";

export default function LocationPopup({
    placeName,
    lat,
    lng,
    year,
    baseYear,

    realTimeAQI,
    finalAQI,

    rainfall,
    rainProbability,

    macroData,
    impact,
    demographics,

    analysis,
    analysisLoading,

    onSave
}) {
    /* ================= DATA PROCESSING ================= */

    const population =
        demographics?.population ??
        impact?.population ??
        macroData?.population?.value ??
        null;

    const growthRate = demographics?.growthRate ?? null;
    const migrants = demographics?.migrantsPct ?? null;

    const pm25 = realTimeAQI?.components?.pm25;
    const pm10 = realTimeAQI?.components?.pm10;
    const aqiValue = finalAQI ?? realTimeAQI?.aqi ?? "N/A";

    const getAQIClass = (aqi) => {
        if (!aqi || aqi === "N/A") return "";
        const val = parseInt(aqi);
        if (val <= 50) return "aqi-good";
        if (val <= 100) return "aqi-moderate";
        if (val <= 200) return "aqi-poor";
        return "aqi-severe";
    };

    const formatPopulation = (num) => {
        if (!num) return "N/A";
        if (num >= 10000000) return `${(num / 10000000).toFixed(2)} Cr`;
        if (num >= 100000) return `${(num / 100000).toFixed(2)} L`;
        return num.toLocaleString();
    };

    /* ================= UI ================= */

    return (
        <div className="location-popup-panel" id="location-popup">
            <header className="location-popup-header">
                <h2 id="location-name">📍 {placeName || "Selected Location"}</h2>
                <span className="location-popup-coords" id="location-coords">
                    {lat?.toFixed(4)}, {lng?.toFixed(4)}
                </span>
            </header>

            {/* AIR QUALITY CARD */}
            <section className="location-popup-card" id="aqi-card">
                <h3>Air Quality</h3>
                <div className={`location-popup-metric ${getAQIClass(aqiValue)}`} id="aqi-value-container">
                    <span>AQI</span>
                    <strong id="aqi-value">{aqiValue}</strong>
                </div>
                <div className="location-popup-metric muted">
                    <span>PM2.5</span>
                    <strong id="pm25-value">{pm25 ? `${pm25.toFixed(1)}` : "—"}</strong>
                </div>
                <div className="location-popup-metric muted">
                    <span>PM10</span>
                    <strong id="pm10-value">{pm10 ? `${pm10.toFixed(1)}` : "—"}</strong>
                </div>
            </section>

            {/* WEATHER CARD */}
            <section className="location-popup-card" id="weather-card">
                <h3>Weather</h3>
                <div className="location-popup-metric">
                    <span>🌧 Rainfall</span>
                    <strong id="rainfall-value">{rainfall !== null ? `${rainfall} mm` : "0 mm"}</strong>
                </div>
                <div className="location-popup-metric">
                    <span>☁ Rain Prob.</span>
                    <strong id="rain-probability-value">{rainProbability !== null ? `${rainProbability}%` : "0%"}</strong>
                </div>
            </section>

            {/* POPULATION CARD */}
            <section className="location-popup-card" id="population-card">
                <h3>Population</h3>
                <div className="location-popup-metric big">
                    <span id="population-value">👥 {formatPopulation(population)}</span>
                </div>
                <div className="location-popup-metric muted">
                    <span>Growth Rate</span>
                    <strong id="growth-rate-value">{growthRate ? `${growthRate}%` : "—"}</strong>
                </div>
                <div className="location-popup-metric muted">
                    <span>Migrants</span>
                    <strong id="migrants-value">{migrants ? `${migrants}%` : "—"}</strong>
                </div>
            </section>

            {/* AI ANALYSIS SECTION */}
            <div className="location-popup-analysis-container" id="analysis-container">
                {analysisLoading ? (
                    <div className="location-popup-analysis" id="analysis-loading">
                        ⏳ Generating AI analysis...
                    </div>
                ) : analysis ? (
                    <div className="location-popup-analysis" id="analysis-text">
                        {analysis}
                    </div>
                ) : (
                    <div className="location-popup-error" id="analysis-error">
                        ⚠️ AI Location Analysis unavailable
                    </div>
                )}
            </div>

            {/* SAVE BUTTON */}
            {onSave && (
                <button
                    id="save-location-btn"
                    className="location-popup-save-btn"
                    onClick={() => onSave(placeName)}
                >
                    ⭐ Save Location
                </button>
            )}
        </div>
    );
}
