// ===============================
// SIMPLE IMPACT (FAST MODEL)
// ===============================
export function calculateImpact({
    aqi,
    rainfall,
    rainProb,
    traffic,
    year
}) {
    const BASE_YEAR = 2025;
    const MAX_YEAR = 2040;

    const timeFactor = Math.max(
        0,
        Math.min(1, (year - BASE_YEAR) / (MAX_YEAR - BASE_YEAR))
    );

    // ---- FLOOD RISK ----
    const rainSevereFactor = Math.min(rainfall / 20, 1);
    const rainProbFactor = rainProb / 100;

    const floodRisk = Math.min(
        1,
        0.25 +
        (0.4 * timeFactor) +
        (rainSevereFactor * 0.45) +
        (rainProbFactor * 0.15)
    );

    // ---- PEOPLE AFFECTED ----
    const basePop = 28_000;
    const growth = 6000 * timeFactor;

    const peopleAffected = Math.round(
        (800 + 110 * (aqi || 0)) * 0.4 +
        12000 * floodRisk +
        9000 * (traffic || 0) +
        0.05 * (basePop + growth)
    );

    return {
        floodRisk: Number(floodRisk.toFixed(2)),
        peopleAffected: Math.max(100, peopleAffected),
        riskLevel:
            floodRisk > 0.65 ? "Severe 🔴" :
            floodRisk > 0.4 ? "Moderate 🟠" :
            "Low 🟡"
    };
}

// ===============================
// FULL IMPACT MODEL (ECON + POP)
// ===============================
export function calculateImpactModel({
    year,
    baseYear = 2025,
    populationBase,
    populationGrowthRate = 1.6,
    aqi = 0,
    rainfallMm = 0,
    trafficCongestion = 0,
    floodRisk = 0,
    worldBank = {}
}) {
    const yearsElapsed = year - baseYear;

    // --- Population ---
    const annualGrowthRate = 0.016; // 1.6%
    const population =
        Math.round(populationBase * Math.pow(1 + annualGrowthRate, yearsElapsed));

    // --- Risk Index (0–1) ---
    const riskIndex = Math.min(
        1,
        floodRisk * 0.45 +
        (aqi / 300) * 0.35 +
        trafficCongestion * 0.2
    );

    // --- People affected ---
    // Exposure factor based on risk (realistic values)
    let exposureFactor = 0.08; // Low
    if (riskIndex > 0.6) exposureFactor = 0.18; // High
    else if (riskIndex > 0.3) exposureFactor = 0.12; // Medium

    const peopleAffected = Math.round(population * exposureFactor);

    // --- Economic loss (yearly, per-person baseline) ---
    const LOSS_PER_PERSON_PER_YEAR = 120000; // ₹1.2 Lakh
    const MAX_CITY_LOSS_CR = 150000; // Hard cap (₹1.5 lakh Cr)

    let economicLossCr = Math.round((peopleAffected * LOSS_PER_PERSON_PER_YEAR) / 1e7);
    economicLossCr = Math.min(economicLossCr, MAX_CITY_LOSS_CR);

    return {
        population,
        risk: riskIndex < 0.3 ? "Low" : riskIndex < 0.6 ? "Medium" : "High",
        peopleAffected,
        economicLossCr
    };
}
