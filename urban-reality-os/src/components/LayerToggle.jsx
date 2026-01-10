export default function LayerToggle({ layers, setLayers }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 20,
        left: 20,
        background: "#020617",
        padding: 12,
        borderRadius: 8,
        color: "white",
        fontSize: 14,
        zIndex: 10
      }}
    >
      <strong>Layers</strong>

      {Object.keys(layers).map((key) => (
        <div key={key} style={{ marginTop: 8 }}>
          <label>
            <input
              type="checkbox"
              checked={layers[key]}
              onChange={() =>
                setLayers((prev) => ({
                  ...prev,
                  [key]: !prev[key]
                }))
              }
            />{" "}
            {key.toUpperCase()}
          </label>
        </div>
      ))}
    </div>
  );
}
