// ============================================
// Real-time AQI Fetcher (OpenWeather Air API)
// Converts PM2.5 → US AQI (EPA standard)
// ============================================

export async function fetchRealtimeAQI(lat, lng, API_KEY) {
  if (!API_KEY || typeof lat !== 'number' || typeof lng !== 'number') {
    console.warn("AQI Fetch skipped: Missing API Key or invalid coords");
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lng}&appid=${API_KEY}`,
      { signal: controller.signal }
    );

    if (!res.ok) throw new Error(`AQI API failed: ${res.status}`);

    const data = await res.json();
    if (!data?.list?.length) return null;

    const d = data.list[0];
    const pm25 = Number(d.components?.pm2_5 ?? 0);

    // ---------- PM2.5 → US AQI (EPA) ----------
    let aqi;
    if (pm25 <= 12) aqi = (pm25 / 12) * 50;
    else if (pm25 <= 35.4) aqi = 50 + ((pm25 - 12) / 23.4) * 50;
    else if (pm25 <= 55.4) aqi = 100 + ((pm25 - 35.4) / 20) * 50;
    else if (pm25 <= 150.4) aqi = 150 + ((pm25 - 55.4) / 95) * 100;
    else if (pm25 <= 250.4) aqi = 250 + ((pm25 - 150.4) / 100) * 100;
    else aqi = 350 + ((pm25 - 250.4) / 149.6) * 150;

    aqi = Math.round(Math.min(500, Math.max(0, aqi)));

    // ---------- AQI CATEGORY ----------
    const category =
      aqi <= 50 ? "Good" :
        aqi <= 100 ? "Moderate" :
          aqi <= 150 ? "Unhealthy (Sensitive)" :
            aqi <= 200 ? "Unhealthy" :
              aqi <= 300 ? "Very Unhealthy" :
                "Hazardous";

    return {
      aqi,
      category,
      pm25: Number(pm25.toFixed(1)),
      pm10: Number((d.components?.pm10 ?? 0).toFixed(1)),
      no2: Number((d.components?.no2 ?? 0).toFixed(1)),
      o3: Number((d.components?.o3 ?? 0).toFixed(1)),
      co: Number((d.components?.co ?? 0).toFixed(1)),
      timestamp: new Date(d.dt * 1000).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      })
    };
  } catch (err) {
    // Only warn if it's not an abort (user cancellation)
    if (err.name !== 'AbortError') {
       console.warn("AQI Fetch Error:", err.message);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
