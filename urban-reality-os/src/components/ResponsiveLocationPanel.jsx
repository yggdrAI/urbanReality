import { useState, useEffect, useRef } from "react";
import LocationPopup from "./LocationPopup";

export default function ResponsiveLocationPanel({
  show,
  onClose,
  ...props
}) {
  const [open, setOpen] = useState(false);
  const isClosingRef = useRef(false);

  /* ------------------------------
     Sync open state with show
  ------------------------------ */
  useEffect(() => {
    setOpen(show);
  }, [show]);

  /* ------------------------------
     Graceful close (mobile)
  ------------------------------ */
  const handleClose = () => {
    isClosingRef.current = true;
    setOpen(false);

    // wait for animation to finish
    setTimeout(() => {
      isClosingRef.current = false;
      onClose?.();
    }, 300);
  };

  if (!show && !open) return null;

  return (
    <>
      {/* ================= DESKTOP ================= */}
      <div className="hidden md:block fixed right-4 top-24 z-50 transition-all duration-300">
        <div className="relative">
          <button
            onClick={handleClose}
            className="absolute -left-3 -top-3 w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center border border-slate-700 hover:bg-slate-700 z-[60] shadow-lg"
          >
            ✕
          </button>
          <LocationPopup {...props} />
        </div>
      </div>

      {/* ================= MOBILE ================= */}
      <div
        className={`md:hidden fixed bottom-0 left-0 right-0 z-50 
        transition-transform duration-300 ease-out
        ${open ? "translate-y-0" : "translate-y-[85%]"}`}
      >
        {/* Drag Handle (tap only) */}
        <div
          className="bg-slate-950/80 backdrop-blur-md rounded-t-3xl pt-3 pb-1 border-t border-slate-800 shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.3)]"
          onClick={() => setOpen((v) => !v)}
        >
          <div className="mx-auto h-1.5 w-12 rounded-full bg-slate-600 mb-2" />
        </div>

        {/* Content */}
        <div className="bg-slate-950 px-4 pb-8 max-h-[80vh] overflow-y-auto">
          <div className="relative pt-2">
            <LocationPopup {...props} />
          </div>
        </div>

        {/* Close Button */}
        {open && (
          <button
            onClick={handleClose}
            className="absolute right-4 top-4 w-10 h-10 rounded-full bg-slate-800/80 text-white flex items-center justify-center border border-slate-700"
          >
            ✕
          </button>
        )}
      </div>

      {/* ================= LOADING OVERLAY ================= */}
      {props.analysisLoading && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 md:block" />
      )}
    </>
  );
}
