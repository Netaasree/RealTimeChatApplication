import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { motion as Motion, AnimatePresence } from "framer-motion";
import { usePageTransition } from "../context/TransitionContext";

/**
 * Cinematic unseen.co-style page transition.
 * Rendered via createPortal into document.body so it's never clipped
 * by parent overflow or broken by framer-motion transforms.
 *
 * Phase 1: clip-path circle expands from button origin (0.7s)
 * Phase 2: branding reveal while navigation happens behind overlay (1.2s)
 * Phase 3: curtain wipes upward to reveal destination page (0.8s)
 */
function SignInTransition() {
  const { transition, clearTransition } = usePageTransition();
  const { active, originRect, onNavigate } = transition;

  const [phase, setPhase] = useState(0);
  const timers = useRef([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const addTimer = (fn, ms) => {
    timers.current.push(setTimeout(fn, ms));
  };

  useEffect(() => {
    if (!active) {
      setPhase(0);
      clearTimers();
      return;
    }

    // Phase 1: circle expanding
    setPhase(1);

    // Phase 1 → 2: after circle expand completes
    addTimer(() => {
      setPhase(2);
      // Navigate NOW while overlay fully covers screen
      if (onNavigate) onNavigate();
    }, 750);

    // Phase 2 → 3: branding lingers
    addTimer(() => setPhase(3), 1900);

    // Phase 3 → done: curtain exit finishes
    addTimer(() => {
      setPhase(0);
      clearTransition();
    }, 2700);

    return clearTimers;
  }, [active, onNavigate, clearTransition]);

  // Circle origin from button center
  const cx = originRect
    ? originRect.x + originRect.width / 2
    : typeof window !== "undefined" ? window.innerWidth / 2 : 500;
  const cy = originRect
    ? originRect.y + originRect.height / 2
    : typeof window !== "undefined" ? window.innerHeight / 2 : 400;

  // Radius to cover full viewport from origin
  const vw = typeof window !== "undefined" ? window.innerWidth : 1000;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const maxR = Math.ceil(
    Math.sqrt(Math.max(cx, vw - cx) ** 2 + Math.max(cy, vh - cy) ** 2)
  );

  const overlay = (
    <AnimatePresence>
      {phase >= 1 && phase <= 3 && (
        <Motion.div
          key="page-transition-overlay"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            background: "#0B1220",
            pointerEvents: "all",
          }}
          initial={{
            clipPath: `circle(0px at ${cx}px ${cy}px)`,
            y: 0,
          }}
          animate={
            phase <= 2
              ? {
                  clipPath: `circle(${maxR + 100}px at ${cx}px ${cy}px)`,
                  y: 0,
                }
              : {
                  clipPath: `circle(${maxR + 100}px at ${cx}px ${cy}px)`,
                  y: "-100vh",
                }
          }
          exit={{
            opacity: 0,
          }}
          transition={
            phase === 1
              ? { duration: 0.7, ease: [0.76, 0, 0.24, 1] }
              : phase === 2
              ? { duration: 0.01 }
              : { duration: 0.75, ease: [0.76, 0, 0.24, 1] }
          }
        >
          {/* Ambient glow */}
          <div
            style={{
              position: "absolute",
              top: "-8rem",
              left: "-8rem",
              width: "28rem",
              height: "28rem",
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(232,162,75,0.25) 0%, rgba(99,102,241,0.15) 50%, transparent 100%)",
              filter: "blur(60px)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: "-6rem",
              right: "-6rem",
              width: "24rem",
              height: "24rem",
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)",
              filter: "blur(50px)",
              pointerEvents: "none",
            }}
          />

          {/* Scan-line sweep */}
          <Motion.div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(232,162,75,0.03) 3px, rgba(232,162,75,0.03) 4px)",
              pointerEvents: "none",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.2, 0] }}
            transition={{ duration: 1.6, delay: 0.2, ease: "easeInOut" }}
          />

          {/* Branding content */}
          <AnimatePresence>
            {phase >= 2 && phase < 3 && (
              <Motion.div
                key="branding-content"
                style={{
                  position: "relative",
                  zIndex: 10,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "1.25rem",
                  textAlign: "center",
                }}
                initial={{ opacity: 0, y: 40, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -50, scale: 0.9 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                {/* Logo */}
                <Motion.div
                  initial={{ scale: 0, rotate: -120 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 260,
                    damping: 18,
                    delay: 0.05,
                  }}
                  style={{
                    width: "5rem",
                    height: "5rem",
                    display: "grid",
                    placeItems: "center",
                    borderRadius: "1.5rem",
                    background:
                      "linear-gradient(135deg, #E8A24B 0%, #6366F1 50%, #8B5CF6 100%)",
                    fontSize: "2.5rem",
                    color: "white",
                    boxShadow: "0 25px 50px rgba(232,162,75,0.3), 0 10px 30px rgba(99,102,241,0.2)",
                  }}
                >
                  ✦
                </Motion.div>

                {/* Subtitle */}
                <Motion.p
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, duration: 0.35 }}
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: "0.7rem",
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: "0.3em",
                    color: "#E8A24B",
                    textShadow: "0 0 12px rgba(232,162,75,0.5)",
                  }}
                >
                  Entering workspace
                </Motion.p>

                {/* Title */}
                <Motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: 0.25,
                    duration: 0.45,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: "clamp(2rem, 5vw, 3.2rem)",
                    fontWeight: 900,
                    letterSpacing: "-0.02em",
                    color: "white",
                    margin: 0,
                  }}
                >
                  Nova
                  <span
                    style={{
                      background:
                        "linear-gradient(90deg, #E8A24B, #818CF8)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    Chat
                  </span>
                </Motion.h2>

                {/* Energy bar */}
                <Motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{
                    delay: 0.35,
                    duration: 0.9,
                    ease: "easeInOut",
                  }}
                  style={{
                    height: "2px",
                    width: "10rem",
                    borderRadius: "999px",
                    background:
                      "linear-gradient(90deg, transparent, #E8A24B, transparent)",
                    boxShadow: "0 0 14px #E8A24B",
                    transformOrigin: "center",
                  }}
                />

                {/* Loading dots */}
                <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                  {[0, 1, 2].map((i) => (
                    <Motion.div
                      key={i}
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        backgroundColor: "rgba(232,162,75,0.7)",
                      }}
                      animate={{
                        opacity: [0.3, 1, 0.3],
                        scale: [0.8, 1.3, 0.8],
                      }}
                      transition={{
                        duration: 0.8,
                        repeat: Infinity,
                        delay: i * 0.15,
                        ease: "easeInOut",
                      }}
                    />
                  ))}
                </div>
              </Motion.div>
            )}
          </AnimatePresence>
        </Motion.div>
      )}
    </AnimatePresence>
  );

  // Portal into document.body to escape all parent clipping/transforms
  return createPortal(overlay, document.body);
}

export default SignInTransition;
