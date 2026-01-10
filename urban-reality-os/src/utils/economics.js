// src/utils/economics.js

export function calculateImpact({
  population = 3000000, // Default safe values
  income = 200000,
  aqiOn = false,
  floodOn = false,
  trafficOn = false
} = {}) {
  
  // Impact factors (percentage of productivity lost)
  const factors = {
    aqi: aqiOn ? 0.12 : 0,
    flood: floodOn ? 0.18 : 0,
    traffic: trafficOn ? 0.08 : 0
  };

  const totalFactor = factors.aqi + factors.flood + factors.traffic;
  
  // Daily income estimation (approximate)
  const dailyIncome = income / 365;

  // Calculate detailed losses for the Chart
  const breakdown = [
    { name: "AQI", loss: Math.round(population * factors.aqi * dailyIncome) },
    { name: "Flood", loss: Math.round(population * factors.flood * dailyIncome) },
    { name: "Traffic", loss: Math.round(population * factors.traffic * dailyIncome) }
  ];

  const peopleAffected = Math.round(population * totalFactor);
  const economicLoss = Math.round(peopleAffected * dailyIncome); // Daily loss

  return {
    peopleAffected,
    economicLoss,
    breakdown
  };
}