import React from "react";

function DebugPanel({ data }) {
    if (!data) return null;

    return (
        <div
            style={{
                position: "absolute",
                top: 80,
                right: 20,
                background: "linear-gradient(180deg, rgba(2, 6, 23, 0.95), rgba(15, 23, 42, 0.95))",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: 12,
                padding: "16px",
                minWidth: "200px",
                fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                fontSize: "13px",
                color: "#e6eef8",
                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
                zIndex: 1000,
                backdropFilter: "blur(10px)"
            }}
        >
            <div style={{ marginBottom: "12px", fontSize: "14px", fontWeight: 600, color: "#60a5fa" }}>
                🧭 Terrain Debug
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#94a3b8" }}>Elevation:</span>
                    <span style={{ fontWeight: 600, color: "#fff" }}>{data.elevation} m</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#94a3b8" }}>Slope:</span>
                    <span style={{ fontWeight: 600, color: "#fff" }}>{data.slope}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#94a3b8" }}>Heat:</span>
                    <span style={{ fontWeight: 600, color: "#fff" }}>{data.heat}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#94a3b8" }}>Flood Risk:</span>
                    <span style={{ fontWeight: 600, color: "#fff" }}>{data.drainage}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#94a3b8" }}>Response:</span>
                    <span style={{ fontWeight: 600, color: "#fff" }}>{data.response} min</span>
                </div>
            </div>
        </div>
    );
}

export default DebugPanel;
