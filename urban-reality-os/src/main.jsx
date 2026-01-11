import React from "react";
import ReactDOM from "react-dom/client";
import MapView from "./components/MapView";
import { AuthProvider } from "./context/AuthContext";
import { GoogleOAuthProvider } from "@react-oauth/google";

const GOOGLE_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const root = ReactDOM.createRoot(document.getElementById("root"));

if (!GOOGLE_ID) {
  root.render(
    <div style={{ padding: 20, fontFamily: "sans-serif", color: "red" }}>
      ❌ Missing <b>VITE_GOOGLE_CLIENT_ID</b> <br />
      Check your <code>.env</code> file and restart Vite.
    </div>
  );
} else {
  root.render(
    <React.StrictMode>
      <GoogleOAuthProvider clientId={GOOGLE_ID}>
        <AuthProvider>
          <MapView />
        </AuthProvider>
      </GoogleOAuthProvider>
    </React.StrictMode>
  );
}
