// Simple explainable economic impact model

export function calculateEconomicImpact({
  aqi,
  flood,
  traffic,
  populationDensity,
  year
}) {
  const yearFactor = (year - 2025) / 15;

  const factors = {
    aqi: aqi * 0.35,
    flood: flood * 0.45,
    traffic: traffic * 0.2
  };

  // ✅ FIXED LINE
  const totalFactor =
    factors.aqi +
    factors.flood +
    factors.traffic;

  const peopleAffected = Math.round(
    800 +
    populationDensity * 0.02 +
    totalFactor * 12000 +
    yearFactor * 1500
  );

  const economicLoss = Math.round(
    peopleAffected * 0.0028 +
    flood * 40 +
    traffic * 18
  );

  const risk =
    economicLoss > 120
      ? "Severe 🔴"
      : economicLoss > 70
      ? "High 🟠"
      : economicLoss > 35
      ? "Moderate 🟡"
      : "Low 🟢";

  return {
    people: peopleAffected,
    loss: economicLoss,
    risk
  };
}
