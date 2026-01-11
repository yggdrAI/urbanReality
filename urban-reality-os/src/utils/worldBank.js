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

const CACHE_KEY = "wb_IND_cache";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

/**
 * Fetch raw indicator pages (returns array of entries)
 */
async function fetchIndicatorSeries(country, indicator) {
  const url = `${BASE_URL}/${country}/indicator/${indicator}?format=json&per_page=100`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("World Bank API error");

  const data = await res.json();
  if (!Array.isArray(data) || !data[1]) return [];

  // return array of { year: int, value: number|null }
  return data[1].map(d => ({ year: parseInt(d.date, 10), value: d.value }));
}

function latestFromSeries(series) {
  if (!series || !series.length) return null;
  for (const item of series) {
    if (item.value !== null && item.value !== undefined) return { value: item.value, year: item.year };
  }
  return null;
}

function linearExtrapolate(series, targetYear) {
  // series: array sorted by year descending (World Bank returns desc)
  const points = series.filter(s => s.value !== null && s.value !== undefined).map(s => ({ year: s.year, value: s.value }));
  if (!points.length) return null;

  // If exact year exists
  const exact = points.find(p => p.year === targetYear);
  if (exact) return exact.value;

  // Sort ascending
  points.sort((a, b) => a.year - b.year);

  // If targetYear before first known year, return first known
  if (targetYear <= points[0].year) return points[0].value;

  // If after last known year -> extrapolate using slope of last two known points (or last point if only one)
  const last = points[points.length - 1];
  const prev = points[points.length - 2] || points[points.length - 1];
  const slope = (last.value - prev.value) / (last.year - prev.year || 1);
  return last.value + slope * (targetYear - last.year);
}

function buildInterpolated(series, startYear = 2025, endYear = 2040) {
  const result = {};
  for (let y = startYear; y <= endYear; y++) {
    const v = linearExtrapolate(series, y);
    result[y] = v !== null && v !== undefined ? v : null;
  }
  return result;
}

async function fetchWithCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.ts < CACHE_TTL_MS && parsed.data) {
        return parsed.data;
      }
    }
  } catch (e) {
    // ignore cache errors
  }

  // Fetch all indicators in parallel
  const [
    populationSeries,
    urbanPctSeries,
    gdpSeries,
    gdpPerCapitaSeries,
    povertyNAHCSeries,
    povertyDDAYSeries
  ] = await Promise.all([
    fetchIndicatorSeries("IND", "SP.POP.TOTL"),
    fetchIndicatorSeries("IND", "SP.URB.TOTL.IN.ZS"),
    fetchIndicatorSeries("IND", "NY.GDP.MKTP.CD"),
    fetchIndicatorSeries("IND", "NY.GDP.PCAP.CD"),
    fetchIndicatorSeries("IND", "SI.POV.NAHC"),
    fetchIndicatorSeries("IND", "SI.POV.DDAY")
  ]);

  const data = {
    populationSeries,
    urbanPctSeries,
    gdpSeries,
    gdpPerCapitaSeries,
    povertyNAHCSeries,
    povertyDDAYSeries
  };

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch (e) {
    // ignore storage errors
  }

  return data;
}

export async function fetchIndiaMacroData() {
  const raw = await fetchWithCache();

  const population = latestFromSeries(raw.populationSeries);
  const urbanPct = latestFromSeries(raw.urbanPctSeries);
  const gdp = latestFromSeries(raw.gdpSeries);
  const gdpPerCapita = latestFromSeries(raw.gdpPerCapitaSeries);
  const povertyNAHC = latestFromSeries(raw.povertyNAHCSeries);
  const povertyDDAY = latestFromSeries(raw.povertyDDAYSeries);

  const poverty = povertyNAHC ?? povertyDDAY ?? null;

  // Build interpolated series for 2025-2040
  const interpolated = {
    population: buildInterpolated(raw.populationSeries),
    gdpPerCapita: buildInterpolated(raw.gdpPerCapitaSeries),
    gdp: buildInterpolated(raw.gdpSeries)
  };

  return {
    population,
    urbanPct,
    gdp,
    gdpPerCapita,
    poverty,
    povertyDDAY,
    interpolated
  };
}