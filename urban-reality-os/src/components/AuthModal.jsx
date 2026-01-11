import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../context/AuthContext";

export default function AuthModal() {
  const { login, setUser } = useAuth();
  const API = "http://localhost:5000";
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  const submit = async () => {
    const url = isLogin ? `${API}/api/auth/login` : `${API}/api/auth/signup`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("Auth failed:", data);
        alert(data.msg || data.message || "Auth failed");
        return;
      }
      if (data.token) login(data.token);
      if (data.user) setUser(data.user);
    } catch (err) {
      console.error("Auth error:", err);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const res = await fetch(`${API}/api/auth/google`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: credentialResponse.credential }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("Google auth failed:", data);
        alert(data.message || data.msg || "Google login failed");
        return;
      }

      // Save token via login and set user
      if (data.token) login(data.token);
      if (data.user) setUser(data.user);
    } catch (err) {
      console.error("Google auth error:", err);
    }
  };

  return (
    <div style={overlay}>
      <div style={card}>
        <h2>{isLogin ? "Login" : "Create Account"}</h2>

        {!isLogin && (
          <input
            placeholder="Name"
            onChange={e => setForm({ ...form, name: e.target.value })}
          />
        )}

        <input
          placeholder="Email"
          onChange={e => setForm({ ...form, email: e.target.value })}
        />

        <input
          type="password"
          placeholder="Password"
          onChange={e => setForm({ ...form, password: e.target.value })}
        />

        <button onClick={submit}>
          {isLogin ? "Login" : "Sign up"}
        </button>

        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={() => console.log("Google Login Failed")}
        />

        <p
          style={{ cursor: "pointer", marginTop: 10 }}
          onClick={() => setIsLogin(!isLogin)}
        >
          {isLogin ? "Create account" : "Already have an account?"}
        </p>
      </div>
    </div>
  );
}

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999
};

const card = {
  background: "#fff",
  padding: 24,
  borderRadius: 10,
  width: 320,
  display: "flex",
  flexDirection: "column",
  gap: 10
};
