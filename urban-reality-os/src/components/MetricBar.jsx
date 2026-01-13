import React from "react";

function MetricBar({ value, color, max = 1 }) {
    const percentage = Math.min((value / max) * 100, 100);
    
    return (
        <div className="metric-bar">
            <div
                className="metric-fill"
                style={{
                    width: `${percentage}%`,
                    background: color || "linear-gradient(90deg, #60a5fa, #3b82f6)"
                }}
            />
        </div>
    );
}

export default MetricBar;
