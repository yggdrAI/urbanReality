export async function fetchRealtimeAQI(lat, lng, API_KEY) {
    if (!API_KEY) return null;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(
            `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lng}&appid=${API_KEY}`,
            { signal: controller.signal }
        );
        clearTimeout(timeout);

        if (!res.ok) throw new Error("AQI API failed");

        const data = await res.json();
        const d = data.list[0];
        const pm25 = d.components.pm2_5 || 0;

        // Convert PM2.5 → US AQI (Standard EPA breakpoints)
        let aqi = 0;
        if (pm25 <= 12) aqi = (pm25 / 12) * 50;
        else if (pm25 <= 35.4) aqi = 50 + ((pm25 - 12) / 23.4) * 50;
        else if (pm25 <= 55.4) aqi = 100 + ((pm25 - 35.4) / 20) * 50;
        else if (pm25 <= 150.4) aqi = 150 + ((pm25 - 55.4) / 95) * 100;
        else if (pm25 <= 250.4) aqi = 250 + ((pm25 - 150.4) / 100) * 100;
        else aqi = 300 + ((pm25 - 250.4) / 249.6) * 200; // rough extrapolation

        return {
            aqi: Math.round(Math.min(500, aqi)),
            pm25: pm25.toFixed(1),
            pm10: (d.components.pm10 || 0).toFixed(1),
            no2: (d.components.no2 || 0).toFixed(1),
            o3: (d.components.o3 || 0).toFixed(1),
            timestamp: new Date(d.dt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
    } catch (err) {
        console.warn("AQI Fetch Error:", err);
        return null;
    }
}
