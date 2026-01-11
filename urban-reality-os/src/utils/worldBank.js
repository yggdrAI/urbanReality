const BASE_URL = "https://api.worldbank.org/v2/country";

/**
 * Fetch latest available value for an indicator
 */
async function fetchIndicator(country, indicator) {
  const url = `${BASE_URL}/${country}/indicator/${indicator}?format=json&per_page=60`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("World Bank API error");

  const data = await res.json();
  if (!Array.isArray(data) || !data[1]) return null;

  // pick latest non-null value
  const latest = data[1].find(d => d.value !== null);
  return latest ? { value: latest.value, year: latest.date } : null;
}

export async function fetchIndiaMacroData() {
  const [
    population,
    urbanPct,
    gdp,
    gdpPerCapita,
    poverty
  ] = await Promise.all([
    fetchIndicator("IND", "SP.POP.TOTL"),
    fetchIndicator("IND", "SP.URB.TOTL.IN.ZS"),
    fetchIndicator("IND", "NY.GDP.MKTP.CD"),
    fetchIndicator("IND", "NY.GDP.PCAP.CD"),
    fetchIndicator("IND", "SI.POV.NAHC")
  ]);

  return {
    population,
    urbanPct,
    gdp,
    gdpPerCapita,
    poverty
  };
}