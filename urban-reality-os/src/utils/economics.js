import { useEffect, useState } from "react";

export default function TimeSlider({
  year,
  setYear,
  baseYear = 2025,
  minYear = 2025,
  maxYear = 2040
}) {
  const [localYear, setLocalYear] = useState(year);

  // 🔁 Sync external year → slider
  useEffect(() => {
    setLocalYear(year);
  }, [year]);

  // ⏳ Debounce expensive recalculations
  useEffect(() => {
    const t = setTimeout(() => {
      if (localYear !== year) {
        setYear(localYear);
      }
    }, 250); // debounce window

    return () => clearTimeout(t);
  }, [localYear, year, setYear]);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 30,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 20,
        background: "rgba(2,6,23,0.92)",
        padding: "14px 20px",
        borderRadius: 14,
        color: "white",
        width: 380,
        boxShadow: "0 15px 40px rgba(0,0,0,0.6)",
        backdropFilter: "blur(10px)"
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10
        }}
      >
        <div style={{ fontWeight: 600 }}>
          🕒 Simulation Year
        </div>

        <div
          style={{
            fontSize: 13,
            color: localYear === baseYear ? "#22c55e" : "#eab308",
            fontWeight: 700
          }}
        >
          {localYear}
          {localYear === baseYear && " (Baseline)"}
        </div>
      </div>

      {/* Slider */}
      <input
        type="range"
        min={minYear}
        max={maxYear}
        step={1}
        value={localYear}
        onChange={e => setLocalYear(Number(e.target.value))}
        style={{ width: "100%" }}
      />

      {/* Labels */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          opacity: 0.7,
          marginTop: 6
        }}
      >
        <span>{minYear}</span>
        <span>{Math.round((minYear + maxYear) / 2)}</span>
        <span>{maxYear}</span>
      </div>

      {/* Delta indicator */}
      <div
        style={{
          marginTop: 8,
          fontSize: 12,
          opacity: 0.85,
          textAlign: "center"
        }}
      >
        {localYear > baseYear && (
          <span style={{ color: "#f97316" }}>
            +{localYear - baseYear} years into future
          </span>
        )}
        {localYear < baseYear && (
          <span style={{ color: "#60a5fa" }}>
            {baseYear - localYear} years into past
          </span>
        )}
      </div>
    </div>
  );
}
