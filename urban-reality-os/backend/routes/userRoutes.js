import express from "express";
import User from "../models/User.js";
import auth from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/profile", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.json(user);
  } catch (err) {
    console.error('profile error', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post("/location", auth, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    await User.findByIdAndUpdate(req.user.id, {
      location: { lat, lng }
    });
    res.json({ message: "Location saved" });
  } catch (err) {
    console.error('location save error', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Save a named location to user's savedLocations
router.post('/save-location', auth, async (req, res) => {
  try {
    const { name, lat, lng } = req.body;
    if (!name || !lat || !lng) return res.status(400).json({ msg: 'Missing fields' });
    await User.findByIdAndUpdate(req.user.id, { $push: { savedLocations: { name, lat, lng } } });
    res.json({ ok: true });
  } catch (err) {
    console.error('save-location error', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Alerts endpoint: compute AQI and flood risk for user's primary location
router.get('/alerts', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const loc = user.location || (user.savedLocations && user.savedLocations.length ? user.savedLocations[0] : null);
    if (!loc) return res.status(400).json({ msg: 'No location available' });

    const OPENWEATHER_KEY = process.env.OPENWEATHER_API_KEY;
    let aqi = null;
    try {
      if (OPENWEATHER_KEY) {
        const r = await fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${loc.lat}&lon=${loc.lng}&appid=${OPENWEATHER_KEY}`);
        if (r.ok) {
          const j = await r.json();
          const pm25 = j.list?.[0]?.components?.pm2_5 ?? null;
          if (pm25 !== null) {
            // rough conversion to US AQI
            let usAQI = 0;
            if (pm25 <= 12) usAQI = Math.round((pm25 / 12) * 50);
            else if (pm25 <= 35.4) usAQI = Math.round(50 + ((pm25 - 12) / 23.4) * 50);
            else if (pm25 <= 55.4) usAQI = Math.round(100 + ((pm25 - 35.4) / 20) * 50);
            else usAQI = 200;
            aqi = usAQI;
          }
        }
      }
    } catch (e) {
      console.warn('alerts AQI fetch failed', e);
    }

    // Flood risk via Open-Meteo precipitation probability
    let floodRisk = 0;
    try {
      const r2 = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lng}&hourly=precipitation_probability&forecast_days=1`);
      if (r2.ok) {
        const j2 = await r2.json();
        const prob = j2.hourly?.precipitation_probability?.[0] ?? 0;
        floodRisk = Math.min(1, prob / 100);
      }
    } catch (e) {
      console.warn('alerts flood fetch failed', e);
    }

    const alerts = [];
    if (aqi !== null && aqi > 150) alerts.push('⚠️ Poor Air Quality');
    if (floodRisk > 0.6) alerts.push('🌊 Flood Risk');

    res.json({ alerts, aqi, floodRisk });
  } catch (err) {
    console.error('alerts error', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

export default router;
