import { calculateImpact } from "../utils/economics";
import EconomicImpact from "./EconomicImpact";

export default function EconomicPanel({ layers, demographics }) {
  // Defaults if data isn't loaded yet
  const population = demographics?.population || 3000000;
  const income = demographics?.per_capita_income || 200000;

  const { peopleAffected, economicLoss, breakdown } = calculateImpact({
    population,
    income,
    aqiOn: layers.aqi,
    floodOn: layers.flood,
    trafficOn: layers.traffic
  });

  return (
    <div
      className="absolute bottom-5 left-5 bg-slate-900/90 text-white p-4 rounded-xl backdrop-blur-md border border-slate-700 shadow-2xl z-10 w-80"
      style={{ fontFamily: "system-ui" }}
    >
      <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
        <span>📊</span> Economic Impact AI
      </h3>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
             <span className="text-gray-400 text-sm">People Affected</span>
             <span className="text-xl font-bold text-orange-400">{peopleAffected.toLocaleString()}</span>
        </div>
        
        <div className="flex justify-between items-center">
             <span className="text-gray-400 text-sm">Daily Loss</span>
             <span className="text-xl font-bold text-red-500">₹{economicLoss.toLocaleString()}</span>
        </div>

        <div className="my-4 h-32 w-full">
            {/* Visual breakdown using Recharts */}
            <EconomicImpactQD data={breakdown} />
        </div>

        <p className="text-xs text-slate-400 italic text-center">
          *Estimates based on active layers & city demographics
        </p>
      </div>
    </div>
  );
}