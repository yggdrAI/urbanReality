import React from "react";

function InsightPanel({ insight, loading, onExplain }) {
    return (
        <div
            className="glass insight-panel"
            style={{
                position: "absolute",
                top: 80,
                right: 20,
                padding: "16px",
                minWidth: "280px",
                maxWidth: "320px",
                fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                zIndex: 1000
            }}
        >
            {loading ? (
                <div className="thinking">Analyzing terrain…</div>
            ) : insight ? (
                <>
                    <h3>Urban Insight</h3>
                    <p>{insight}</p>
                    {onExplain && (
                        <button
                            onClick={onExplain}
                            style={{
                                marginTop: "12px",
                                padding: "8px 16px",
                                borderRadius: "8px",
                                border: "none",
                                background: "rgba(96, 165, 250, 0.2)",
                                color: "#60a5fa",
                                cursor: "pointer",
                                fontSize: "12px",
                                fontWeight: 500,
                                transition: "all 0.2s",
                                width: "100%"
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.background = "rgba(96, 165, 250, 0.3)";
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.background = "rgba(96, 165, 250, 0.2)";
                            }}
                        >
                            🔍 Explain why this area is at risk
                        </button>
                    )}
                </>
            ) : (
                <div style={{ fontSize: "13px", color: "#94a3b8", textAlign: "center" }}>
                    Click on the map to get terrain insights
                </div>
            )}
        </div>
    );
}

export default InsightPanel;
