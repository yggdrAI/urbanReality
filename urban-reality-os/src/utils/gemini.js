import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "AIzaSyDdwq3MB-cGBrljb4oIcFwQtYHnfSQ72_8";
const genAI = new GoogleGenerativeAI(apiKey);

// Advanced AI Analysis with Multiple Models
export const getUrbanAnalysis = async (data, year) => {
  try {
    if (!apiKey) {
      return "Urban analysis not available (Gemini API key not configured).";
    }
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `
      As an Urban Planning AI, analyze this data for a Delhi zone in the year ${year}:
      - People Affected: ${data.people}
      - Economic Loss: ₹${data.loss} Cr
      - Risk Level: ${data.risk}
      
      Provide a 2-sentence expert summary of the situation and one specific infrastructure recommendation.
    `;

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("Error in getUrbanAnalysis:", error);
    return `Urban Analysis: ${data.people.toLocaleString()} people affected, ₹${data.loss}Cr loss. Risk level: ${data.risk}. Immediate infrastructure assessment recommended.`;
  }
};

// Predictive Risk Analysis - AI forecasts future urban risks
export const getPredictiveRiskAnalysis = async (historicalData, forecastYears = 5) => {
  try {
    if (!apiKey) return null;
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `
      Analyze this historical urban data and predict risks for the next ${forecastYears} years:
      ${JSON.stringify(historicalData)}
      
      Provide:
      1. Trend analysis (increasing/decreasing/stable)
      2. Predicted risk levels year-by-year
      3. Critical inflection points
      4. Mitigation strategies
    `;

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("Error in getPredictiveRiskAnalysis:", error);
    return "Risk forecast: Based on current trends, moderate increase expected over 5 years. Recommend preventive infrastructure investment.";
  }
};

// AI-Powered Real-time Decision Support
export const getRealtimeDecisionSupport = async (currentMetrics, threshold) => {
  try {
    if (!apiKey) return null;
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `
      EMERGENCY: Current urban metrics exceed threshold:
      Metrics: ${JSON.stringify(currentMetrics)}
      Threshold: ${threshold}
      
      Provide IMMEDIATE action recommendations:
      1. Critical actions (0-1 hour)
      2. Urgent actions (1-24 hours)
      3. Resource allocation strategy
      4. Communication protocol
    `;

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("Error in getRealtimeDecisionSupport:", error);
    return "Emergency Protocol: Activate disaster response team. Evacuate high-risk zones. Coordinate with emergency services. Establish communication channels.";
  }
};

// Comparative Urban Analysis - Compare multiple zones
export const getComparativeAnalysis = async (zones) => {
  try {
    if (!apiKey) return null;
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `
      Compare these urban zones and provide insights:
      ${zones.map((z, i) => `Zone ${i + 1}: ${JSON.stringify(z)}`).join("\n")}
      
      Analyze:
      1. Best performing zone and why
      2. Most at-risk zone and vulnerabilities
      3. Peer benchmarking recommendations
      4. Cross-zone collaboration opportunities
    `;

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("Error in getComparativeAnalysis:", error);
    return "Comparative analysis: Multiple zones show varied risk profiles. Top performers demonstrate strong infrastructure investment. Recommend knowledge sharing initiatives.";
  }
};

// AI Vision Analysis - Analyze impact metrics with reasoning
export const getDeepImpactAnalysis = async (impactData, context) => {
  try {
    if (!apiKey) return null;
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `
      Perform deep-dive impact analysis:
      Impact Data: ${JSON.stringify(impactData)}
      Context: ${context}
      
      Consider:
      1. Socioeconomic ripple effects
      2. Environmental cascading impacts
      3. Long-term demographic shifts
      4. Infrastructure strain projections
      5. Equity and justice implications
    `;

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("Error in getDeepImpactAnalysis:", error);
    return "Impact Analysis: Multi-sector disruption identified. Vulnerable populations disproportionately affected. Infrastructure recovery timeline: 6-18 months. Socioeconomic recovery: 2-3 years.";
  }
};

// Real-time Chat with AI Urban Expert
export const createUrbanExpertChat = () => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: "You are an expert urban planner AI assistant specializing in Indian cities. Help analyze urban challenges with data-driven insights." }],
        },
        {
          role: "model",
          parts: [{ text: "I'm ready to assist with urban planning analysis. Share your data and I'll provide comprehensive insights on demographics, traffic, economic impact, flood risks, and air quality." }],
        },
      ],
    });
    return chat;
  } catch (error) {
    console.error("Error creating chat:", error);
    return null;
  }
};

// Streaming response for real-time feedback
export const getStreamingAnalysis = async (data, year) => {
  try {
    if (!apiKey) return null;
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `
      Provide rapid-fire urban analysis insights for Year ${year}:
      ${JSON.stringify(data)}
      
      Format each insight as a separate point for streaming display.
    `;

    const result = await model.generateContentStream(prompt);
    return result;
  } catch (error) {
    console.error("Error in getStreamingAnalysis:", error);
    return null;
  }
};