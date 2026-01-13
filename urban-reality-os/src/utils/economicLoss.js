export function calculateEconomicLoss({
  aqi,
  rainfallMm,
  floodRisk,
  trafficCongestion,
  worldBank
}) {
  // --- Safe Input Parsing ---
  const safeAQI = Number(aqi) || 0;
  const safeRain = Number(rainfallMm) || 0;
  const safeFlood = Number(floodRisk) || 0;
  const safeTraffic = Number(trafficCongestion) || 0;

  // --- Base economy (Default to Delhi/General Metro stats if missing) ---
  // Default GDP Per Capita ~ $2,500 USD (Approx Indian Metro Avg)
  // Default Pop ~ 20 Million (Delhi NCR)
  const gdpPerCapita = Number(worldBank?.gdpPerCapita?.value) || 2500; 
  const population = Number(worldBank?.population?.value) || 20000000;

  // Daily GDP = (Annual GDP) / 365
  const dailyGDP_USD = (gdpPerCapita * population) / 365;

  // --- Impact multipliers (0.0 to 1.0 scale) ---
  // AQI: Starts impacting > 50, max impact at 400+
  const aqiLoss = Math.min(Math.max(0, (safeAQI - 50) / 400), 1);
  
  // Rain: Moderate rain (20mm) ok, 150mm+ causes standstill
  const rainLoss = Math.min(safeRain / 150, 1);
  
  // Flood: Direct risk index from model
  const floodLoss = Math.min(safeFlood, 1);
  
  // Traffic: Congestion index
  const trafficLoss = Math.min(safeTraffic, 1);

  // --- Weighted Impact Factor ---
  // Weights reflect how much each factor paralyzes the city
  // Flood (0.4) > Traffic (0.25) > Rain (0.2) > AQI (0.15)
  const impactFactor =
    (0.15 * aqiLoss) +
    (0.20 * rainLoss) +
    (0.40 * floodLoss) +
    (0.25 * trafficLoss);

  // --- Final economic loss ---
  const lossUSD = dailyGDP_USD * impactFactor;

  // Convert to INR Crores (1 USD ≈ 84 INR)
  const EXCHANGE_RATE = 84;
  const lossINR = lossUSD * EXCHANGE_RATE;
  
  // Convert to Crores (1 Crore = 10,000,000)
  const lossCr = lossINR / 10000000;

  // Return formatted number, minimum 0
  return Math.max(0, Math.round(lossCr * 100) / 100);
}
