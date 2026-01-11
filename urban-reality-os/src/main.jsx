import React from "react";
import ReactDOM from "react-dom/client";
import MapView from "./components/MapView";
import { AuthProvider } from "./context/AuthContext";
import { GoogleOAuthProvider } from "@react-oauth/google";

const GOOGLE_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const root = ReactDOM.createRoot(document.getElementById("root"));

// Always render the app - Google OAuth is optional
const AppWrapper = ({ children }) => {
  if (GOOGLE_ID) {
    return (
      <GoogleOAuthProvider clientId={GOOGLE_ID}>
        {children}
      </GoogleOAuthProvider>
    );
  }
  return children;
};

root.render(
  <React.StrictMode>
    <AppWrapper>
      <AuthProvider>
        <MapView />
      </AuthProvider>
    </AppWrapper>
  </React.StrictMode>
);
