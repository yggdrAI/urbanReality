/**
 * Calculates population dynamics based on economic and environmental stress.
 * @param {number} currentYear - The target year for simulation
 * @param {object} impactData - Object containing { loss: number, aqi: number }
 * @param {number} [customBasePopulation] - Optional override for base population
 */
export const calculatePopulationDynamics = (currentYear, impactData, customBasePopulation) => {
  const BASE_YEAR = 2024; // Moved back one year to allow 2025 calculation
  // Default to Delhi (22.2M) if no custom pop provided, but allow overrides
  const BASE_POPULATION = customBasePopulation || 22280000; 
  
  // Baseline rates (Indian Metro Average)
  const BASE_NATURAL_RATE = 0.009;   // 0.9% Natural increase (Births - Deaths)
  const BASE_MIGRATION_RATE = 0.012; // 1.2% Net Migration baseline (In - Out)
  
  // 1. Calculate Economic Stress Factor (0.0 to 1.0)
  // Loss > 4000 Cr implies severe distress driving migration OUT
  const lossMetric = impactData?.loss || impactData?.economicLossCr || 0;
  const economicStress = Math.min(lossMetric / 4000, 1);
  
  // 2. Adjust Migration based on stress
  // If stress is high, migration drops or becomes negative (exodus)
  // Logic: 1.2% base becomes -0.6% at max stress (net outflow)
  const adjustedMigrationRate = BASE_MIGRATION_RATE - (economicStress * 0.018);
  
  let population = BASE_POPULATION;
  let yearIterator = BASE_YEAR;

  // 3. Iterative Growth Loop
  // We assume stress affects the RATE of growth leading up to the target year
  const targetYear = Math.max(BASE_YEAR, currentYear);
  
  while (yearIterator < targetYear) {
    // TFR (Total Fertility Rate) decays naturally over time
    const yearOffset = yearIterator - BASE_YEAR;
    
    // Natural rate floor at 0.2%
    const currentNaturalRate = Math.max(0.002, BASE_NATURAL_RATE - (yearOffset * 0.0003));
    
    // Total growth for this year
    const totalRate = currentNaturalRate + adjustedMigrationRate;
    
    population = Math.floor(population * (1 + totalRate));
    yearIterator++;
  }

  // 4. Final Year Stats
  const yearOffset = targetYear - BASE_YEAR;
  const finalNaturalRate = Math.max(0.002, BASE_NATURAL_RATE - (yearOffset * 0.0003));
  const finalGrowthRatePercent = (finalNaturalRate + adjustedMigrationRate) * 100;
  
  // Estimated TFR (Total Fertility Rate)
  const projectedTFR = Math.max(1.2, 1.6 - (yearOffset * 0.02)); 

  return {
    totalPopulation: population,
    absoluteGrowth: population - BASE_POPULATION,
    growthRate: finalGrowthRatePercent.toFixed(2), // Percentage string
    tfr: projectedTFR.toFixed(2),
    // If growth is negative, migration share logic changes, but we return a metric for the UI
    migrationShare: finalGrowthRatePercent !== 0 
      ? ((adjustedMigrationRate * 100) / finalGrowthRatePercent * 100).toFixed(0) 
      : "0"
  };
};