import { useState } from "react";
import { calculateImpact } from "../utils/economics";
import EconomicImpact from "./EconomicImpact";

export default function EconomicPanel({ layers, demographics }) {
  const [isHovered, setIsHovered] = useState(false);

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
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`absolute bottom-8 left-8 transition-all duration-500 ease-in-out z-20 overflow-hidden border border-white/10 shadow-2xl backdrop-blur-xl ${
        isHovered ? "w-80 h-auto rounded-2xl bg-slate-900/90" : "w-48 h-14 rounded-full bg-slate-900/60 hover:bg-slate-900/80 cursor-pointer"
      }`}
    >
      {/* HEADER / COLLAPSED STATE */}
      <div className="flex items-center justify-between p-4 h-14">
        <div className="flex items-center gap-3">
          <span className="text-xl">📊</span>
          <div>
            <h3 className="text-sm font-bold text-white leading-tight">Economic Impact</h3>
            {!isHovered && (
               <p className="text-xs text-red-400 font-mono">₹{economicLoss.toLocaleString()} Loss</p>
            )}
          </div>
        </div>
        {/* Expand Icon */}
        <div className={`text-slate-400 transition-transform duration-300 ${isHovered ? "rotate-180" : ""}`}>
           ▼
        </div>
      </div>

      {/* EXPANDED CONTENT */}
      <div className={`px-4 pb-4 space-y-4 transition-opacity duration-300 ${isHovered ? "opacity-100" : "opacity-0"}`}>
        <hr className="border-white/10" />
        
        <div className="flex justify-between items-center">
             <span className="text-slate-400 text-xs uppercase tracking-wider">Affected Citizens</span>
             <span className="text-lg font-bold text-orange-400 font-mono">{peopleAffected.toLocaleString()}</span>
        </div>
        
        <div className="flex justify-between items-center">
             <span className="text-slate-400 text-xs uppercase tracking-wider">Daily Loss</span>
             <span className="text-lg font-bold text-red-500 font-mono">₹{economicLoss.toLocaleString()}</span>
        </div>

        <div className="h-32 w-full mt-2">
            <EconomicImpact data={breakdown} />
        </div>

        <p className="text-[10px] text-slate-500 text-center italic">
          *Real-time impact based on active map layers
        </p>
      </div>
    </div>
  );
}