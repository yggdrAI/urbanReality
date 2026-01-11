import { useState } from "react";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

export default function MapMenu({ layers, setLayers, mapStyle, setMapStyle, mapRef }) {
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem("urban_user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const handleSignOut = () => {
    localStorage.removeItem("urban_user");
    localStorage.removeItem("token");
    setUser(null);
    setAccountOpen(false);
  };

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
                <div style={{ fontWeight: 700 }}>{user.name}</div>
                <div style={{ color: '#6b7280' }}>{user.email}</div>
                <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                  <button onClick={handleSignOut} style={{ flex: 1, padding: '8px 10px', borderRadius: 8 }}>Sign out</button>
                  <button onClick={() => setAccountOpen(true)} style={{ padding: '8px 10px', borderRadius: 8, background: '#0ea5e9', color: '#fff' }}>Profile</button>
                </div>
                <div style={{ marginTop: 10 }}>
                  <button onClick={() => {
                    if (!navigator.geolocation) return alert('Geolocation not available');
                    navigator.geolocation.getCurrentPosition(async (pos) => {
                      try {
                        const token = localStorage.getItem('token');
                        const resp = await fetch(BACKEND + '/api/user/location', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude })
                        });
                        if (!resp.ok) throw new Error('Save failed');
                        alert('Location saved');
                        if (mapRef && mapRef.current) {
                          mapRef.current.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 14, pitch: 65, bearing: mapRef.current.getBearing() });
                        }
                      } catch (err) {
                        console.error(err);
                        alert('Could not save location');
                      }
                    }, () => alert('Location permission denied'));
                  }} style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8 }}>Enable Location</button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ marginTop: 8, color: '#6b7280' }}>Not signed in</div>
                <div style={{ marginTop: 8 }}>
                  <button onClick={() => setAccountOpen(true)} style={{ padding: '8px 10px', borderRadius: 8 }}>Sign in / Sign up</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Account popup */}
      {accountOpen && (
        <div style={{ position: 'absolute', top: 64, left: 68, zIndex: 1003, background: '#fff', padding: 12, borderRadius: 8, minWidth: 320 }}>
          <SignInForm onSuccess={(u, token) => { setUser(u); localStorage.setItem('urban_user', JSON.stringify(u)); localStorage.setItem('token', token); setAccountOpen(false); }} />
        </div>
      )}
    </div>
  );
}

/* ================= SIGN IN FORM ================= */

function SignInForm({ onSuccess }) {
  const [mode, setMode] = useState('login'); // or 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      const path = mode === 'login' ? '/api/auth/login' : '/api/auth/signup';
      const resp = await fetch(BACKEND + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'login' ? { email, password } : { name, email, password })
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.msg || 'Auth failed');
      // API returns { token, user }
      const token = json.token;
      const user = json.user || { name, email };
      onSuccess(user, token);
    } catch (err) {
      console.error('Auth error', err);
      alert(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button onClick={() => setMode('login')} style={{ flex: 1, padding: '8px', borderRadius: 6, background: mode === 'login' ? '#eef2ff' : '#fff' }}>Login</button>
        <button onClick={() => setMode('signup')} style={{ flex: 1, padding: '8px', borderRadius: 6, background: mode === 'signup' ? '#eef2ff' : '#fff' }}>Sign up</button>
      </div>

      {mode === 'signup' && (
        <input placeholder="Full name" value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: 8, marginBottom: 8, borderRadius: 6, border: '1px solid #e5e7eb' }} />
      )}

      <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: 8, marginBottom: 8, borderRadius: 6, border: '1px solid #e5e7eb' }} />
      <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: 8, marginBottom: 8, borderRadius: 6, border: '1px solid #e5e7eb' }} />

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={submit} disabled={loading} style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: '#0ea5e9', color: '#fff' }}>{loading ? 'Working...' : (mode === 'login' ? 'Login' : 'Create account')}</button>
        <button onClick={() => { setEmail(''); setPassword(''); setName(''); }} style={{ padding: '8px 10px', borderRadius: 8 }}>Clear</button>
      </div>
    </div>
  );
}
