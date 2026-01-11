import { useState } from "react";

export default function MapMenu({ layers, setLayers, mapStyle, setMapStyle }) {
  const [open, setOpen] = useState(false);
  const [expandedLayers, setExpandedLayers] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem("urban_user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  return (
    <div>
      {/* Hamburger */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 1002,
          width: 44,
          height: 44,
          borderRadius: 8,
          border: "none",
          background: "rgba(255,255,255,0.95)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          cursor: "pointer"
        }}
      >
        ☰
      </button>

      {/* Side panel */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 68,
            zIndex: 1002,
            width: 340,
            background: "#fff",
            borderRadius: 12,
            boxShadow: "0 12px 40px rgba(2,6,23,0.2)"
          }}
        >
          <div style={{ padding: 12 }}>
            <strong>Account</strong>

            {user ? (
              <div>
                <div>{user.name}</div>
                <div>{user.email}</div>
                <button
                  onClick={() => {
                    localStorage.removeItem("urban_user");
                    setUser(null);
                  }}
                >
                  Sign out
                </button>
              </div>
            ) : (
              <button onClick={() => setAccountOpen(true)}>Sign in</button>
            )}
          </div>
        </div>
      )}

      {/* Account popup */}
      {accountOpen && (
        <div
          style={{
            position: "absolute",
            top: 64,
            left: 68,
            zIndex: 1003,
            background: "#fff",
            padding: 12,
            borderRadius: 8
          }}
        >
          <SignInForm
            onSuccess={(u) => {
              setUser(u);
              localStorage.setItem("urban_user", JSON.stringify(u));
              setAccountOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

/* ================= SIGN IN FORM ================= */

function SignInForm({ onSuccess }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  return (
    <div>
      <h3>Sign in</h3>

      <input
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <button
        onClick={() => {
          if (name && email) onSuccess({ name, email });
        }}
      >
        Sign in
      </button>
    </div>
  );
}
