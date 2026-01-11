import React from "react";

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
    /* ================= SAFE DATA ================= */

    const population =
        demographics?.population ??
        impact?.population ??
        macroData?.population?.value ??
        null;

    const growthRate = demographics?.growthRate ?? null;
    const tfr = demographics?.tfr ?? null;
    const migrants = demographics?.migrantsPct ?? null;

    const pm25 = realTimeAQI?.components?.pm25 ?? "N/A";
    const pm10 = realTimeAQI?.components?.pm10 ?? "N/A";

    const aqiValue = finalAQI ?? realTimeAQI?.aqi ?? "N/A";

    /* ================= UI ================= */

    return (
        <div
            style={{
                width: 300,
                padding: 16,
                background: "rgba(2,6,23,0.96)",
                color: "#e5e7eb",
                borderRadius: 14,
                fontFamily: "Inter, system-ui, sans-serif",
                boxShadow: "0 20px 40px rgba(0,0,0,0.45)"
            }}
        >
            {/* HEADER */}
            <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{placeName}</div>
                <div style={{ fontSize: 12, opacity: 0.6 }}>
                    {lat.toFixed(4)}, {lng.toFixed(4)}
                </div>
            </div>

            {/* AQI */}
            <Section title="Air Quality">
                <Row label="AQI" value={aqiValue} />
                <Row label="PM2.5" value={`${pm25} µg/m³`} />
                <Row label="PM10" value={`${pm10} µg/m³`} />
            </Section>

            {/* WEATHER */}
            <Section title="Weather">
                <Row label="Rainfall" value={`${rainfall ?? 0} mm`} />
                <Row
                    label="Rain Probability"
                    value={
                        rainProbability !== null
                            ? `${rainProbability}%`
                            : "N/A"
                    }
                />
            </Section>

            {/* POPULATION */}
            <Section title="Population">
                <Row
                    label="Population"
                    value={
                        population
                            ? population.toLocaleString()
                            : "N/A"
                    }
                />
                <Row
                    label="Growth Rate"
                    value={growthRate ? `${growthRate}%` : "N/A"}
                />
                <Row
                    label="TFR"
                    value={tfr ?? "N/A"}
                />
                <Row
                    label="Migrants"
                    value={migrants ? `${migrants}%` : "N/A"}
                />
            </Section>

            {/* AI ANALYSIS */}
            <Section title="AI Location Analysis">
                {analysisLoading && (
                    <div style={{ fontSize: 13, opacity: 0.7 }}>
                        Generating AI analysis…
                    </div>
                )}

                {!analysisLoading && analysis && (
                    <div
                        style={{
                            fontSize: 13,
                            lineHeight: 1.5,
                            color: "#e2e8f0"
                        }}
                    >
                        {analysis}
                    </div>
                )}

                {!analysisLoading && !analysis && (
                    <div style={{ fontSize: 13, opacity: 0.5 }}>
                        No analysis available
                    </div>
                )}
            </Section>

            {/* SAVE */}
            {onSave && (
                <button
                    onClick={() => onSave(placeName)}
                    style={{
                        marginTop: 12,
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "none",
                        background: "#f59e0b",
                        color: "#020617",
                        fontWeight: 600,
                        cursor: "pointer"
                    }}
                >
                    ⭐ Save Location
                </button>
            )}
        </div>
    );
}

/* ================= SMALL UI HELPERS ================= */

function Section({ title, children }) {
    return (
        <div style={{ marginBottom: 14 }}>
            <div
                style={{
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 6,
                    color: "#93c5fd"
                }}
            >
                {title}
            </div>
            {children}
        </div>
    );
}

function Row({ label, value }) {
    return (
        <div
            style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                marginBottom: 4
            }}
        >
            <span style={{ opacity: 0.7 }}>{label}</span>
            <span style={{ fontWeight: 500 }}>{value}</span>
        </div>
    );
}
