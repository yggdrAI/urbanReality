const LAYER_LABELS = {
  aqi: "AQI",
  flood: "Flood Zones",
  traffic: "Traffic",
  floodDepth: "Flood Depth"
};

export default function LayerToggle({ layers, setLayers }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 20,
        left: 20,
        background: "rgba(2, 6, 23, 0.9)",
        padding: 12,
        borderRadius: 8,
        color: "white",
        fontSize: 14,
        zIndex: 10,
        backdropFilter: "blur(8px)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        minWidth: 160
      }}
    >
      <strong style={{ display: "block", marginBottom: 8 }}>Layers</strong>

      {Object.keys(layers).map((key) => (
        <div key={key} style={{ marginTop: 6 }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              cursor: "pointer",
              userSelect: "none"
            }}
          >
            <input
              type="checkbox"
              checked={layers[key]}
              onChange={() =>
                setLayers((prev) => ({
                  ...prev,
                  [key]: !prev[key]
                }))
              }
              style={{ marginRight: 8, cursor: "pointer" }}
            />
            <span>{LAYER_LABELS[key] || key.toUpperCase()}</span>
          </label>
        </div>
      ))}
    </div>
  );
}
