// ===================================================
// Browser-safe Gemini helper
// Proxies requests to backend (/api/urban-analysis)
// ===================================================

const API_BASE =
  import.meta.env.VITE_GEMINI_BACKEND_URL || "http://localhost:3001";

/**
 * Urban Analysis with:
 * 1) Year-to-year comparison
 * 2) Sector-wise loss explanation
 */
export async function getUrbanAnalysis(raw) {
  try {
    // ---------- NORMALIZE INPUT ----------
    const data = {
      zone: raw?.zone || "Unknown location",
      year: raw?.year || 2025,
      baseYear: raw?.baseYear || 2025,

      aqi: raw?.aqi ?? raw?.aqi_realtime ?? 0,
      rainfallMm: raw?.rainfallMm ?? raw?.rainfall ?? 0,
      traffic: raw?.traffic ?? raw?.trafficCongestion ?? 0,
      floodRisk: raw?.floodRisk ?? 0,

      peopleAffected: raw?.peopleAffected ?? 0,
      economicLossCr: raw?.economicLossCr ?? NaN,

      // Optional baseline (for comparison)
      baseYearLossCr: raw?.baseYearLossCr ?? null,
      baseYearAQI: raw?.baseYearAQI ?? null
    };

    // ---------- FAILSAFE ----------
    if (!Number.isFinite(data.economicLossCr)) {
      return "Insufficient data for AI analysis.";
    }

    // ---------- SANITIZE ----------
    data.aqi = clamp(data.aqi, 0, 500);
    data.traffic = clamp(data.traffic, 0, 1);
    data.floodRisk = clamp(data.floodRisk, 0, 1);
    data.rainfallMm = clamp(data.rainfallMm, 0, 500);
    data.peopleAffected = Math.max(0, Math.round(data.peopleAffected));
    data.economicLossCr = Math.round(data.economicLossCr);

    // ---------- DERIVED COMPARISON ----------
    const hasComparison =
      Number.isFinite(data.baseYearLossCr) &&
      data.year !== data.baseYear;

    // ---------- PROMPT ----------
    const prompt = `
You are an urban risk, climate, and economics analyst.

City: ${data.zone}

Current Year (${data.year}) Metrics:
- Population affected: ${data.peopleAffected}
- Economic loss: ₹${data.economicLossCr} Cr
- AQI: ${data.aqi}
- Rainfall: ${data.rainfallMm} mm
- Traffic congestion index: ${data.traffic}
- Flood risk index: ${data.floodRisk}

${hasComparison ? `
Baseline Comparison:
- Base year: ${data.baseYear}
- Base year economic loss: ₹${data.baseYearLossCr} Cr
- Base year AQI: ${data.baseYearAQI}
` : ``}

Tasks:
1. Explain why risk and economic loss in ${data.year} ${
      hasComparison ? "are higher or lower compared to the base year" : "are at current levels"
    }.
2. Break down economic loss by sector:
   - Public health
   - Transport & productivity
   - Infrastructure & housing
3. Describe short-term impacts (0–2 years).
4. Describe long-term urban consequences (5–15 years).
5. Provide ONE realistic mitigation strategy suitable for Indian cities.

Rules:
- Use factual, policy-grade language
- Do NOT invent data
- Base reasoning strictly on the metrics provided
- Limit response to 140 words
`;

    // ---------- API CALL ----------
    const resp = await fetch(`${API_BASE}/api/urban-analysis`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`AI backend error ${resp.status}: ${text}`);
    }

    const json = await resp.json();

    // ---------- ROBUST RESPONSE EXTRACTION ----------
    return (
      json.analysis ||
      json.text ||
      json.output ||
      json.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Urban analysis not available."
    );
  } catch (err) {
    console.error("getUrbanAnalysis failed:", err);
    return "Analysis unavailable";
  }
}

// ===================================================
// Helpers
// ===================================================

function clamp(val, min, max) {
  return Math.min(Math.max(Number(val) || 0, min), max);
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
