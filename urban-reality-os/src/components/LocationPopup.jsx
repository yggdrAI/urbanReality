import React, { useState, memo } from "react";
import "./LocationPopup.css";

// AQI Bar Component (Memoized)
const AQIBar = memo(function AQIBar({ value }) {
    if (!value || value === "N/A") return null;
    
    const numValue = typeof value === "number" ? value : parseInt(value);
    if (isNaN(numValue)) return null;
    
    const percent = Math.min((numValue / 500) * 100, 100);
    
    const getGradient = () => {
        if (numValue >= 300) return "linear-gradient(90deg, #ef4444, #fb7185)";
        if (numValue >= 200) return "linear-gradient(90deg, #f97316, #fb923c)";
        if (numValue >= 100) return "linear-gradient(90deg, #eab308, #facc15)";
        return "linear-gradient(90deg, #22c55e, #4ade80)";
    };
    
    const isSevere = numValue >= 300;
    
    return (
        <div className="aqi-bar-container">
            <div className="aqi-bar-track">
                <div
                    className={`aqi-bar-fill ${isSevere ? "severe" : ""}`}
                    style={{
                        width: `${percent}%`,
                        background: getGradient(),
                        transition: "all 0.7s ease"
                    }}
                />
            </div>
            <div className="aqi-bar-label">Severity Index</div>
        </div>
    );
});

// Data Badge Component
function DataBadge({ label, live = false }) {
    return (
        <span className={`data-badge ${live ? "data-badge-live" : ""}`}>
            {live ? "LIVE" : label}
        </span>
    );
}

// Collapsible Section Component
function Section({ title, children, defaultOpen = true, badge }) {
    const [open, setOpen] = useState(defaultOpen);
    
    return (
        <section className="location-popup-card">
            <div
                className="location-popup-card-header"
                onClick={() => setOpen(!open)}
            >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <h3>{title}</h3>
                    {badge && <DataBadge {...badge} />}
                </div>
                <span className="section-toggle">{open ? "−" : "+"}</span>
            </div>
            {open && (
                <div className="section-content">
                    {children}
                </div>
            )}
        </section>
    );
}

function LocationPopup({
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
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    /* ================= DATA PROCESSING ================= */

    const population =
        demographics?.population ??
        impact?.population ??
        macroData?.population?.value ??
        null;

    const growthRate = demographics?.growthRate ?? null;
    const migrants = demographics?.migrantsPct ?? null;

    // Fix: Use direct pm25/pm10 from realTimeAQI (not components)
    const pm25 = realTimeAQI?.pm25 ?? realTimeAQI?.components?.pm25;
    const pm10 = realTimeAQI?.pm10 ?? realTimeAQI?.components?.pm10;
    const aqiValue = finalAQI ?? realTimeAQI?.aqi ?? "N/A";

    const getAQIClass = (aqi) => {
        if (!aqi || aqi === "N/A") return "";
        const val = typeof aqi === "number" ? aqi : parseInt(aqi);
        if (isNaN(val)) return "";
        if (val <= 50) return "aqi-good";
        if (val <= 100) return "aqi-moderate";
        if (val <= 200) return "aqi-poor";
        return "aqi-severe";
    };

    const getAQILabel = (aqi) => {
        if (!aqi || aqi === "N/A") return "N/A";
        const val = typeof aqi === "number" ? aqi : parseInt(aqi);
        if (isNaN(val)) return "N/A";
        if (val >= 300) return "Severe";
        if (val >= 200) return "Very Poor";
        if (val >= 100) return "Moderate";
        return "Good";
    };

    const getAQILabelColor = (aqi) => {
        if (!aqi || aqi === "N/A") return "#94a3b8";
        const val = typeof aqi === "number" ? aqi : parseInt(aqi);
        if (isNaN(val)) return "#94a3b8";
        if (val >= 300) return "#ef4444";
        if (val >= 200) return "#f97316";
        if (val >= 100) return "#eab308";
        return "#22c55e";
    };

    const formatPopulation = (num) => {
        if (!num) return "N/A";
        if (num >= 10000000) return `${(num / 10000000).toFixed(2)} Cr`;
        if (num >= 100000) return `${(num / 100000).toFixed(2)} L`;
        return num.toLocaleString();
    };

    const isRealTimeAQI = !!realTimeAQI?.aqi;
    const hasWorldBankData = !!macroData;

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
            <Section 
                title="Air Quality" 
                badge={isRealTimeAQI ? { live: true } : null}
            >
                <div className={`location-popup-metric ${getAQIClass(aqiValue)}`} id="aqi-value-container">
                    <span>AQI</span>
                    <strong id="aqi-value">{aqiValue}</strong>
                </div>
                <AQIBar value={aqiValue} />
                <div className="aqi-severity-label">
                    <span className="aqi-severity-text">Severity</span>
                    <span 
                        className="aqi-severity-value"
                        style={{ color: getAQILabelColor(aqiValue) }}
                    >
                        {getAQILabel(aqiValue)}
                    </span>
                </div>
                {(pm25 || pm10) && (
                    <div className="metric-tiles">
                        <div className="metric-tile">
                            <span>PM2.5</span>
                            <div>
                                <strong id="pm25-value">{pm25 ? pm25.toFixed(1) : "—"}</strong>
                                {pm25 && <span className="unit">µg/m³</span>}
                            </div>
                        </div>
                        <div className="metric-tile">
                            <span>PM10</span>
                            <div>
                                <strong id="pm10-value">{pm10 ? pm10.toFixed(1) : "—"}</strong>
                                {pm10 && <span className="unit">µg/m³</span>}
                            </div>
                        </div>
                    </div>
                )}
            </Section>

            {/* WEATHER CARD */}
            <Section 
                title="Weather"
                badge={{ live: true, label: "Open-Meteo" }}
            >
                <div className="location-popup-metric weather-metric">
                    <span>🌧 Rainfall</span>
                    <strong id="rainfall-value">{rainfall !== null ? `${rainfall} mm` : "0 mm"}</strong>
                </div>
                <div className="location-popup-metric weather-metric">
                    <span>☁ Rain Prob.</span>
                    <strong id="rain-probability-value">{rainProbability !== null ? `${rainProbability}%` : "0%"}</strong>
                </div>
            </Section>

            {/* POPULATION CARD */}
            <Section 
                title="Population"
                badge={hasWorldBankData ? { label: "World Bank" } : null}
            >
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
                {(!growthRate && !migrants) && (
                    <div className="text-xs text-slate-500 mt-2" style={{ fontSize: "11px", color: "#64748b", marginTop: "8px" }}>
                        Growth & migration estimates are unavailable for the selected year
                    </div>
                )}
            </Section>

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
                        <div className="error-content">
                            🤖 AI insights are temporarily unavailable.
                            <br />
                            <span className="error-subtext">Core environmental data is still live.</span>
                        </div>
                    </div>
                )}
            </div>

            {/* SAVE BUTTON */}
            {onSave && (
                <button
                    id="save-location-btn"
                    className="location-popup-save-btn"
                    disabled={saving}
                    onClick={async () => {
                        setSaving(true);
                        setSaveSuccess(false);
                        try {
                            await onSave(placeName);
                            setSaveSuccess(true);
                            setTimeout(() => setSaveSuccess(false), 2000);
                        } catch (err) {
                            console.error("Save failed:", err);
                        } finally {
                            setSaving(false);
                        }
                    }}
                >
                    {saving ? "Saving..." : saveSuccess ? "✓ Location saved" : "⭐ Save Location"}
                </button>
            )}
        </div>
    );
}

export default memo(LocationPopup);
