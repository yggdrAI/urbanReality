export default function TimeSlider({ year, setYear }) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 30,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 20,
        background: "rgba(2,6,23,0.9)",
        padding: "14px 20px",
        borderRadius: 14,
        color: "white",
        width: 360,
        boxShadow: "0 15px 40px rgba(0,0,0,0.6)",
        backdropFilter: "blur(8px)"
      }}
    >
      <div style={{ marginBottom: 8 }}>
        <b>🕒 Simulation Year:</b> {year}
      </div>

      <input
        type="range"
        min="2025"
        max="2040"
        step="1"
        value={year}
        onChange={e => setYear(Number(e.target.value))}
        style={{ width: "100%" }}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          opacity: 0.7
        }}
      >
        <span>2025</span>
        <span>2030</span>
        <span>2035</span>
        <span>2040</span>
      </div>
    </div>
  );
}
