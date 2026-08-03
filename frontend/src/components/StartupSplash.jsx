import { useEffect, useState } from "react";
import { motion as Motion, AnimatePresence } from "framer-motion";

function StartupSplash({ onComplete }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => {
        if (onComplete) onComplete();
      }, 700);
    }, 2200);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {visible && (
        <Motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.08, filter: "blur(16px)" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-navy text-ivory"
        >
          <div className="pointer-events-none absolute h-96 w-96 rounded-full bg-gradient-to-r from-amber/30 via-indigo-600/35 to-violet-600/30 blur-3xl animate-[pulseRing_3s_infinite]" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-amber/20 blur-3xl animate-[float_4s_ease-in-out_infinite]" />

          <div className="relative z-10 text-center px-6">
            <Motion.div
              initial={{ scale: 0.4, opacity: 0, rotate: -25 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 240, damping: 18 }}
              className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-amber via-indigo-500 to-violet-600 text-4xl text-white shadow-2xl shadow-indigo-500/50"
            >
              ✦
            </Motion.div>

            <Motion.p
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="font-display text-xs font-black uppercase tracking-[0.35em] text-amber drop-shadow-[0_0_12px_rgba(232,162,75,0.6)]"
            >
              ✦ Next-Gen Realtime Platform ✦
            </Motion.p>

            <Motion.h1
              initial={{ y: 25, opacity: 0, scale: 0.92 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ delay: 0.45, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
              className="font-display mt-3 text-4xl font-black tracking-tight text-white sm:text-6xl"
            >
              WELCOME TO{" "}
              <span className="bg-gradient-to-r from-amber via-amber-300 to-indigo-400 bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(232,162,75,0.5)]">
                NOVACHAT
              </span>
            </Motion.h1>

            <Motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.7, duration: 1.2, ease: "easeInOut" }}
              className="mx-auto mt-8 h-1 w-48 origin-center rounded-full bg-gradient-to-r from-transparent via-amber to-transparent shadow-[0_0_15px_#E8A24B]"
            />
          </div>
        </Motion.div>
      )}
    </AnimatePresence>
  );
}

export default StartupSplash;
