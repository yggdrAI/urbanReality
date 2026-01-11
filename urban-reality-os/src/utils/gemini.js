// Browser-safe Gemini helper
// This module proxies AI requests to a backend service at /api/urban-analysis
// which should host the @google/generative-ai SDK and your GEMINI_API_KEY.

const API_BASE = import.meta.env.VITE_GEMINI_BACKEND_URL || "http://localhost:3001";

export const getUrbanAnalysis = async (data, year, metrics) => {
  try {
    const resp = await fetch(`${API_BASE}/api/urban-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, year, metrics })
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => null);
      throw new Error(`AI backend error: ${resp.status} ${text || ''}`);
    }

    const json = await resp.json();
    return json.analysis || null;
  } catch (err) {
    console.error('getUrbanAnalysis failed:', err);
    return `Urban Analysis not available. ${data.people.toLocaleString()} people affected, ₹${data.loss} Cr loss. Risk: ${data.risk}`;
  }
};

// Fallback stubs for other functions (can be implemented similarly on backend)
export const getPredictiveRiskAnalysis = async () => null;
export const getRealtimeDecisionSupport = async () => null;
export const getComparativeAnalysis = async () => null;
export const getDeepImpactAnalysis = async () => null;
export const createUrbanExpertChat = () => null;
export const getStreamingAnalysis = async () => null;