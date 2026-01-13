// ===================================================
// Browser-safe Gemini helper
// Proxies requests to backend (/api/urban-analysis)
// ===================================================

const API_BASE =
  (import.meta.env.VITE_GEMINI_BACKEND_URL || "http://localhost:3001")
    .replace(/\/$/, "");

// ---------- HELPERS ----------
function clamp(val, min, max) {
  return Math.min(Math.max(Number(val) || 0, min), max);
}

// ===================================================
// Urban Analysis (Gemini explain-only)
// ===================================================
export async function getUrbanAnalysis(raw) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    // ---------- NORMALIZE ----------
    const data = {
      zone: raw?.zone || "Urban Area",
      year: Number(raw?.year) || new Date().getFullYear(),
      baseYear: Number(raw?.baseYear) || 2024,

      aqi: Number(raw?.aqi ?? raw?.aqi_realtime ?? 0),
      rainfallMm: Number(raw?.rainfallMm ?? raw?.rainfall ?? 0),
      traffic: Number(raw?.traffic ?? raw?.trafficCongestion ?? 0),
      floodRisk: Number(raw?.floodRisk ?? 0),

      peopleAffected: Number(raw?.peopleAffected) || 0,
      economicLossCr: Number(raw?.economicLossCr) || 0,

      baseYearLossCr:
        raw?.baseYearLossCr !== undefined ? Number(raw.baseYearLossCr) : null,
      baseYearAQI:
        raw?.baseYearAQI !== undefined ? Number(raw.baseYearAQI) : null
    };

    // ---------- SANITIZE ----------
    data.aqi = clamp(data.aqi, 0, 999);
    data.traffic = clamp(data.traffic, 0, 1);
    data.floodRisk = clamp(data.floodRisk, 0, 1);
    data.rainfallMm = clamp(data.rainfallMm, 0, 5000);
    data.peopleAffected = Math.round(data.peopleAffected);
    data.economicLossCr = Number(data.economicLossCr.toFixed(2));

    // ---------- COMPARISON ----------
    let comparisonText = "No historical baseline available.";
    if (
      data.baseYearLossCr !== null &&
      data.year !== data.baseYear
    ) {
      const lossDiff = data.economicLossCr - data.baseYearLossCr;
      const aqiDiff =
        typeof data.baseYearAQI === "number"
          ? data.aqi - data.baseYearAQI
          : null;

      const lossText =
        Math.abs(lossDiff) < 0.1
          ? "stable"
          : `${lossDiff > 0 ? "INCREASED" : "DECREASED"} by ₹${Math.abs(lossDiff).toFixed(1)} Cr`;

      const aqiText =
        aqiDiff === null
          ? "unchanged"
          : Math.abs(aqiDiff) < 1
          ? "stable"
          : `${aqiDiff > 0 ? "worse" : "better"} by ${Math.abs(aqiDiff)} points`;

      comparisonText = `Compared to ${data.baseYear}: Economic loss has ${lossText}, and AQI is ${aqiText}.`;
    }

    // ---------- PROMPT ----------
    const prompt = `
Role: Urban Risk & Economics Analyst.

Context:
Location: ${data.zone}
Year: ${data.year}

METRICS:
- AQI: ${data.aqi}
- Rainfall: ${data.rainfallMm} mm
- Flood Risk Index: ${data.floodRisk.toFixed(2)} (0–1)
- Traffic Index: ${data.traffic.toFixed(2)} (0–1)
- Estimated Economic Loss: ₹${data.economicLossCr} Crores
- Population Affected: ${data.peopleAffected.toLocaleString()}

COMPARISON:
${comparisonText}

TASK:
Provide a concise 5-point strategic summary (max 160 words):

1. Root Cause of economic loss.
2. Most impacted sector.
3. Trend compared to baseline.
4. Social implication for residents.
5. One realistic mitigation strategy for Indian cities.

Tone: Professional, data-backed, no filler.
`;

    // ---------- API CALL ----------
    const resp = await fetch(`${API_BASE}/api/urban-analysis`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
      signal: controller.signal
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "Unknown error");
      throw new Error(`Backend ${resp.status}: ${text}`);
    }

    const json = await resp.json();
    return (
      json.analysis ||
      json.text ||
      json.output ||
      json.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Analysis unavailable."
    );
  } catch (err) {
    if (err.name === "AbortError")
      return "Analysis timed out. Server may be sleeping.";
    console.warn("getUrbanAnalysis failed:", err.message);
    return "Analysis unavailable. Ensure backend is running.";
  } finally {
    clearTimeout(timeoutId);
  }
}

// ===================================================
// Terrain Insight (short explanation)
// ===================================================
export async function getTerrainInsight(context) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const {
      elevation = 0,
      slope = 0,
      floodRisk = 0,
      heat = 0,
      population = 0,
      aqi = 0
    } = context;

    const prompt = `
Explain terrain-based urban risk in simple terms.

Metrics:
- Elevation: ${elevation} m
- Slope: ${slope.toFixed(2)}
- Flood Risk: ${floodRisk.toFixed(2)}
- Heat Index: ${heat.toFixed(2)}
- AQI: ${aqi}
- Population: ${population ? population.toLocaleString() : "Unknown"}

Explain:
1. Why this area is vulnerable.
2. One infrastructure improvement recommendation.
`;

    const resp = await fetch(`${API_BASE}/api/urban-analysis`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
      signal: controller.signal
    });

    if (!resp.ok) throw new Error("Backend error");

    const json = await resp.json();
    return (
      json.analysis ||
      json.text ||
      json.output ||
      json.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Terrain insight unavailable."
    );
  } catch (err) {
    console.warn("getTerrainInsight failed:", err.message);
    return "Insight temporarily unavailable.";
  } finally {
    clearTimeout(timeoutId);
  }
}

// ===================================================
// Future expansion stubs
// ===================================================
export const getPredictiveRiskAnalysis = async () => null;
export const getRealtimeDecisionSupport = async () => null;
export const getComparativeAnalysis = async () => null;
export const getDeepImpactAnalysis = async () => null;
export const createUrbanExpertChat = () => null;
export const getStreamingAnalysis = async () => null;