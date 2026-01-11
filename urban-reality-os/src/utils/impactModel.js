export function calculateImpact({
    aqi,
    rainfall,
    rainProb,
    traffic,
    year
}) {
    // Base simulation constants
    const BASE_YEAR = 2025;
    const MAX_YEAR = 2040;

    const timeFactor = (year - BASE_YEAR) / (MAX_YEAR - BASE_YEAR);

    // Flood Risk Model
    // rainfall: mm, rainProb: %
    const rainSevereFactor = Math.min(rainfall / 20, 1); // 20mm is severe
    const rainProbFactor = rainProb / 100;

    const floodRisk = Math.min(
        1,
        0.25 + // Base risk
        (0.4 * timeFactor) + // Climate change factor
        (rainSevereFactor * 0.45) + // Real-time rain impact
        (rainProbFactor * 0.15)    // Forecast impact
    );

    // People Impact Model
    const basePop = 28000;
    const growth = 6000 * timeFactor;

    // Impact algorithm
    const peopleAffected = Math.round(
        (800 + (110 * aqi)) * 0.4 + // AQI Health impact
        (12000 * floodRisk) +       // Flood displacement
        (9000 * traffic) +          // Commuter delays
        (0.05 * (basePop + growth)) // Baseline affected population
    );

    return {
        floodRisk: parseFloat(floodRisk.toFixed(2)),
        peopleAffected: Math.max(100, peopleAffected),
        riskLevel:
            floodRisk > 0.65 ? "Severe 🔴" :
                floodRisk > 0.4 ? "Moderate 🟠" :
                    "Low 🟡"
    };
}
