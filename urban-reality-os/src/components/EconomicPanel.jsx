export default function EconomicPanel({ data, analysis, analysisLoading }) {
  if (!data) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 120,
        left: 24,
        zIndex: 15,
        background: "rgba(2,6,23,0.85)",
        color: "#fff",
        padding: 18,
        borderRadius: 14,
        width: 280,
        backdropFilter: "blur(10px)",
        boxShadow: "0 0 30px rgba(0,0,0,0.6)"
      }}
    >
      <h3 style={{ marginTop: 0, fontSize: 16 }}>
        🧠 AI Impact Analysis
      </h3>

      <p><b>📍 Zone</b><br />{data.zone}</p>
      <p><b>👥 People Affected</b><br />{data.people.toLocaleString()}</p>
      <p><b>💰 Economic Loss</b><br />₹ {data.loss} Cr</p>
      <p><b>⚠️ Risk Level</b><br />{data.risk}</p>

      <p style={{ fontSize: 12, opacity: 0.7 }}>
        AI-estimated using pollution, traffic & flood exposure
      </p>

      {/* Gemini AI Analysis */}
      {analysisLoading ? (
        <p style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>Analyzing with Gemini...</p>
      ) : (
        analysis && (
          <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.4, opacity: 0.95 }}>
            <strong>Gemini Analysis:</strong>
            <p style={{ margin: '6px 0 0' }}>{analysis}</p>
          </div>
        )
      )}
    </div>
  );
}
