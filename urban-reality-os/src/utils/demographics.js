export const calculatePopulationDynamics = (currentYear, impactData) => {
  const BASE_YEAR = 2025;
  const BASE_POPULATION = 22280000; // 22.28 Million (2025 Projection)
  
  // Baseline rates for Delhi (approximate based on trends)
  const BASE_NATURAL_RATE = 0.009;   // 0.9% Natural increase (Births - Deaths)
  const BASE_MIGRATION_RATE = 0.012; // 1.2% Net Migration (In - Out)
  
  // Extract Economic Stress (Normalized 0-1)
  // Assuming 'loss' > 3000 Cr indicates high stress driving people away
  const economicStress = impactData?.loss ? Math.min(impactData.loss / 3000, 1) : 0;
  
  // AI/Logic Model: 
  // 1. Migration is highly elastic to quality of life (Economic Stress)
  // 2. Natural rate (TFR) decays slowly over time regardless of short-term stress
  const adjustedMigrationRate = BASE_MIGRATION_RATE * (1 - (economicStress * 0.6));
  
  let population = BASE_POPULATION;

  // Calculate iterative growth to capture compounding effect
  for (let y = BASE_YEAR; y < currentYear; y++) {
    // Natural rate decays as TFR drops further below 1.5
    const yearOffset = y - BASE_YEAR;
    const currentNaturalRate = Math.max(0.002, BASE_NATURAL_RATE - (yearOffset * 0.0004));
    
    const totalRate = currentNaturalRate + adjustedMigrationRate;
    population += Math.round(population * totalRate);
  }

  // Current year specific stats
  const yearOffset = currentYear - BASE_YEAR;
  const finalNaturalRate = Math.max(0.002, BASE_NATURAL_RATE - (yearOffset * 0.0004));
  const totalGrowthRate = (finalNaturalRate + adjustedMigrationRate) * 100;
  const projectedTFR = Math.max(1.2, 1.5 - (yearOffset * 0.015)); // Linear decay model for TFR

  return {
    totalPopulation: population,
    absoluteGrowth: population - BASE_POPULATION,
    growthRate: totalGrowthRate.toFixed(2),
    tfr: projectedTFR.toFixed(2),
    migrationShare: ((adjustedMigrationRate / (totalGrowthRate/100)) * 100).toFixed(0)
  };
};