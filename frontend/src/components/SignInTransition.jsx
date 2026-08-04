import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion as Motion, AnimatePresence } from "framer-motion";
import { usePageTransition } from "../context/TransitionContext";
import { createWaveField, INK_PALETTE } from "../utils/waveEngine";

/**
 * Cinematic unseen.co-style page transition with liquid water canvas.
 *
 * Rendered via createPortal into document.body so it's never clipped
 * by parent overflow or broken by framer-motion transforms.
 *
 * Phase 1: clip-path circle expands from button origin (0.75s)
 *          → wave engine seeds strong ripple + ink at origin
 * Phase 2: branding reveal, navigation fires behind overlay (1.15s)
 *          → simulation keeps running, turbulence visible
 * Phase 3: curtain wipes upward (0.8s)
 *          → second ripple burst as the surface recedes
 *
 * Canvas composites with mix-blend-mode: screen over the navy
 * background so wave highlights bleed through the clip-path
 * edge, making the boundary look turbulent instead of geometric.
 *
 * Falls back to clip-path-only when prefers-reduced-motion is set.
 */
function SignInTransition() {
  const { transition, clearTransition } = usePageTransition();
  const { active, originRect, onNavigate } = transition;

  const [phase, setPhase] = useState(0);
  const timers = useRef([]);

  // Canvas + wave engine refs
  const canvasRef = useRef(null);
  const fieldRef = useRef(null);
  const rafRef = useRef(null);
  const frameRef = useRef(0);
  const tmpCanvasRef = useRef(null);

  // Reduced-motion check (stable across renders)
  const prefersReduced = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const addTimer = (fn, ms) => {
    timers.current.push(setTimeout(fn, ms));
  };

  /* ── Stop the wave render loop ── */
  const stopWaveLoop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    fieldRef.current = null;
    frameRef.current = 0;
  }, []);

  /* ── Start the wave render loop ── */
  const startWaveLoop = useCallback(
    (originCx, originCy) => {
      if (prefersReduced.current) return;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      canvas.width = vw;
      canvas.height = vh;
      canvas.style.width = `${vw}px`;
      canvas.style.height = `${vh}px`;

      const field = createWaveField(vw, vh);
      fieldRef.current = field;
      frameRef.current = 0;

      // Scratch canvas for upscale blit
      const tmp = document.createElement("canvas");
      tmp.width = field.cols;
      tmp.height = field.rows;
      tmpCanvasRef.current = tmp;

      // ── Phase-1 seed: strong ripple + ink at origin ──
      field.ripple(originCx, originCy, 160);

      // Staggered secondary ripples around origin
      const offsets = [
        { dx: -90, dy: -60, delay: 80, strength: 80 },
        { dx: 110, dy: 40, delay: 160, strength: 70 },
        { dx: -30, dy: 100, delay: 240, strength: 60 },
      ];
      offsets.forEach(({ dx, dy, delay, strength }) => {
        setTimeout(() => {
          if (!fieldRef.current) return;
          fieldRef.current.ripple(originCx + dx, originCy + dy, strength);
        }, delay);
      });

      // Ink blooms at origin — amber dominant, indigo + violet accents
      field.ink(originCx / field.cellSize, originCy / field.cellSize, 35, INK_PALETTE[0], 0.45);
      field.ink(
        (originCx - 60) / field.cellSize,
        (originCy + 30) / field.cellSize,
        22, INK_PALETTE[1], 0.3,
      );
      field.ink(
        (originCx + 50) / field.cellSize,
        (originCy - 40) / field.cellSize,
        18, INK_PALETTE[2], 0.25,
      );

      // Render loop
      const render = () => {
        frameRef.current += 1;
        const f = fieldRef.current;
        if (!f) return;

        f.step(frameRef.current);

        const raw = f.getImageData();
        const imgData = new ImageData(
          new Uint8ClampedArray(raw.buffer, raw.byteOffset, raw.byteLength),
          f.cols,
          f.rows,
        );
        const tCtx = tmpCanvasRef.current.getContext("2d");
        tCtx.putImageData(imgData, 0, 0);

        ctx.clearRect(0, 0, vw, vh);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(tmpCanvasRef.current, 0, 0, vw, vh);

        rafRef.current = requestAnimationFrame(render);
      };

      rafRef.current = requestAnimationFrame(render);
    },
    [],
  );

  /* ── Phase 3 ripple burst (water receding) ── */
  const seedExitRipples = useCallback(() => {
    const f = fieldRef.current;
    if (!f) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Burst across the top edge (curtain wipes up)
    for (let i = 0; i < 5; i++) {
      const rx = Math.random() * vw;
      const ry = Math.random() * vh * 0.4;
      f.ripple(rx, ry, 60 + Math.random() * 50);
      const col = INK_PALETTE[Math.floor(Math.random() * 3)];
      f.ink(rx / f.cellSize, ry / f.cellSize, 12 + Math.random() * 10, col, 0.2);
    }
  }, []);

  /* ── Phase state machine ── */
  useEffect(() => {
    if (!active) {
      setPhase(0);
      clearTimers();
      stopWaveLoop();
      return;
    }

    setPhase(1);

    // Compute origin for canvas seeding
    const ocx = originRect
      ? originRect.x + originRect.width / 2
      : window.innerWidth / 2;
    const ocy = originRect
      ? originRect.y + originRect.height / 2
      : window.innerHeight / 2;

    // Start wave canvas on next frame (after portal mounts canvas element)
    requestAnimationFrame(() => startWaveLoop(ocx, ocy));

    // Phase 1 → 2
    addTimer(() => {
      setPhase(2);
      if (onNavigate) onNavigate();
    }, 750);

    // Phase 2 → 3
    addTimer(() => {
      setPhase(3);
      seedExitRipples();
    }, 1900);

    // Phase 3 → done
    addTimer(() => {
      setPhase(0);
      stopWaveLoop();
      clearTransition();
    }, 2700);

    return () => {
      clearTimers();
      stopWaveLoop();
    };
  }, [active, onNavigate, clearTransition, originRect, startWaveLoop, stopWaveLoop, seedExitRipples]);

  // ── Clip-path geometry (unchanged) ──
  const cx = originRect
    ? originRect.x + originRect.width / 2
    : typeof window !== "undefined" ? window.innerWidth / 2 : 500;
  const cy = originRect
    ? originRect.y + originRect.height / 2
    : typeof window !== "undefined" ? window.innerHeight / 2 : 400;

  const vw = typeof window !== "undefined" ? window.innerWidth : 1000;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const maxR = Math.ceil(
    Math.sqrt(Math.max(cx, vw - cx) ** 2 + Math.max(cy, vh - cy) ** 2),
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
          exit={{ opacity: 0 }}
          transition={
            phase === 1
              ? { duration: 0.7, ease: [0.76, 0, 0.24, 1] }
              : phase === 2
              ? { duration: 0.01 }
              : { duration: 0.75, ease: [0.76, 0, 0.24, 1] }
          }
        >
          {/* ── Water canvas layer ── */}
          {!prefersReduced.current && (
            <canvas
              ref={canvasRef}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                mixBlendMode: "screen",
                pointerEvents: "none",
                zIndex: 1,
              }}
            />
          )}

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
              zIndex: 2,
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
              zIndex: 2,
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
              zIndex: 3,
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
                    boxShadow:
                      "0 25px 50px rgba(232,162,75,0.3), 0 10px 30px rgba(99,102,241,0.2)",
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

  return createPortal(overlay, document.body);
}

export default SignInTransition;
