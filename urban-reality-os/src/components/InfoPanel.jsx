export default function InfoPanel({ selected }) {
  if (!selected) return null;

  return (
    <div className="pointer-events-none animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="bg-slate-900/90 backdrop-blur-xl border border-white/20 p-5 rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.5)] text-white w-72">
        <div className="flex justify-between items-start mb-2">
            <h3 className="font-bold text-lg text-emerald-400 leading-tight">
              {selected.title}
            </h3>
            <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
              LIVE
            </span>
        </div>
        
        <p className="text-sm text-slate-300 mb-4 border-b border-white/10 pb-3">
          {selected.description}
        </p>

        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">Reality Gap</span>
              <span className="font-mono font-bold text-white">{selected.gap}%</span>
            </div>
            <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
               <div 
                 className="bg-gradient-to-r from-emerald-500 to-blue-500 h-full transition-all duration-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" 
                 style={{ width: `${selected.gap}%` }}
               />
            </div>
          </div>
          
          <div className="flex justify-between text-xs items-center bg-white/5 p-2 rounded-lg">
            <span className="text-slate-400">Projected Loss</span>
            <span className="font-mono text-red-400 font-bold">₹{selected.loss} Cr/yr</span>
          </div>
        </div>
      </div>
    </div>
  );
}