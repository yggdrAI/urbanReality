export function calculateImpact({
  population,
  income,
  aqiOn,
  floodOn,
  trafficOn
}) {
  let impactFactor = 0;

  if (aqiOn) impactFactor += 0.12;
  if (floodOn) impactFactor += 0.18;
  if (trafficOn) impactFactor += 0.08;

  const peopleAffected = Math.round(population * impactFactor);

  const economicLoss =
    Math.round(
      peopleAffected * income * 0.015
    );

  return {
    impactFactor,
    peopleAffected,
    economicLoss
  };
}
