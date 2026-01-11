export default function EconomicPanel({ data, analysis, analysisLoading, demographics }) {
  if (!data) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 120,
        left: 24,
        zIndex: 15,
        background: "rgba(2,6,23,0.85)", // Dark semi-transparent background
        color: "#fff",
        padding: 20,
        borderRadius: 16,
        width: 300,
        backdropFilter: "blur(12px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        border: "1px solid rgba(255,255,255,0.1)",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      }}
    >
      <div className="mb-4 pb-4 border-b border-white/10">
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
          <span>📊</span> Impact & Demographics
        </h3>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>
          {data.zone}
        </p>
      </div>

      {/* Grid Layout for Compactness */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "#94a3b8", letterSpacing: "0.5px" }}>Econ Loss</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#f87171" }}>₹{data.loss} Cr</div>
        </div>
        <div>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "#94a3b8", letterSpacing: "0.5px" }}>Risk Level</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{data.risk}</div>
        </div>
      </div>

      {/* New Population Section */}
      {demographics && (
        <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
            <span>👥 Population Model</span>
            <span style={{ color: "#38bdf8" }}>TFR: {demographics.tfr}</span>
          </div>
          
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: "#fff" }}>
              {(demographics.totalPopulation / 1000000).toFixed(2)}M
            </span>
            <span style={{ fontSize: 13, color: demographics.growthRate > 0 ? "#4ade80" : "#f87171", fontWeight: 500 }}>
              {demographics.growthRate > 0 ? "↗" : "↘"} {demographics.growthRate}%
            </span>
          </div>
          
          <div style={{ fontSize: 11, color: "#94a3b8", display: "flex", justifyContent: "space-between" }}>
             <span>Growth: +{(demographics.absoluteGrowth / 100000).toFixed(1)} Lakhs</span>
             <span>Migrants: {demographics.migrationShare}%</span>
          </div>
        </div>
      )}

      {/* Gemini AI Analysis */}
      <div style={{ fontSize: 13, lineHeight: 1.5, color: "#cbd5e1" }}>
        {analysisLoading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="animate-spin h-3 w-3 border-2 border-blue-500 rounded-full border-t-transparent"></div>
            Analyzing scenario...
          </div>
        ) : (
          analysis && (
            <div style={{ background: "rgba(59, 130, 246, 0.1)", borderLeft: "3px solid #3b82f6", padding: "8px 12px", borderRadius: "0 8px 8px 0" }}>
              {analysis}
            </div>
          )
        )}
      </div>
    </div>
  );
}
