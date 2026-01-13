import React from "react";

const getAQIMeta = (aqi) => {
  if (!Number.isFinite(aqi)) return { label: "Unknown", color: "gray" };
  if (aqi <= 50) return { label: "Good", color: "green" };
  if (aqi <= 100) return { label: "Moderate", color: "yellow" };
  if (aqi <= 200) return { label: "Poor", color: "orange" };
  return { label: "Severe", color: "red" };
};

const InfoPanel = ({ data }) => {
  // Safer normalization
  const city = data?.city ?? "City";
  const condition = data?.condition ?? "Unknown";

  const rainProbRaw = data?.rainProbability;
  const rainProb =
    Number.isFinite(rainProbRaw)
      ? rainProbRaw > 1
        ? rainProbRaw
        : Math.round(rainProbRaw * 100)
      : 0;

  const rainfall =
    Number.isFinite(data?.rainfall) ? data.rainfall : 0;

  const aqi =
    Number.isFinite(data?.aqi) ? data.aqi : null;

  const aqiMeta = getAQIMeta(aqi);

  return (
    <div className="w-full max-w-sm p-4 rounded-2xl shadow-lg bg-white dark:bg-slate-800 dark:border dark:border-slate-700">
      
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">
          {city}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {condition}
        </p>
      </div>

      {/* AQI */}
      <div
        className={`mb-4 p-4 rounded-xl border
          ${
            aqiMeta.color === "green"
              ? "bg-green-50 border-green-100 dark:bg-green-900/30"
              : aqiMeta.color === "yellow"
              ? "bg-yellow-50 border-yellow-100 dark:bg-yellow-900/30"
              : aqiMeta.color === "orange"
              ? "bg-orange-50 border-orange-100 dark:bg-orange-900/30"
              : aqiMeta.color === "red"
              ? "bg-red-50 border-red-100 dark:bg-red-900/30"
              : "bg-slate-50 border-slate-200 dark:bg-slate-700/30"
          }
        `}
      >
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider">
              Air Quality
            </p>
            <p className="text-2xl font-bold">
              {aqi ?? "—"}{" "}
              <span className="text-sm font-normal text-gray-500">
                AQI ({aqiMeta.label})
              </span>
            </p>
          </div>
          <div className="h-10 w-10 rounded-full flex items-center justify-center">
            💨
          </div>
        </div>
      </div>

      {/* Rain */}
      <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50">
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium">Rain Chance</span>
          <span className="text-lg font-bold">{rainProb}%</span>
        </div>

        <div className="h-px w-full bg-blue-200 dark:bg-blue-800 my-2" />

        <div className="flex justify-between">
          <span className="text-sm font-medium">Rainfall</span>
          <span className="text-lg font-bold">
            {rainfall.toFixed(1)}{" "}
            <span className="text-xs font-normal">mm</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default InfoPanel;
