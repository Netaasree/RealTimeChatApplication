import { useEffect, useRef } from "react";
import { createWaveField, INK_PALETTE } from "../utils/waveEngine";

function CursorField({ variant = "auth", enableClickBurst = false }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reducedMotion) return undefined;

    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    let animationFrameId;
    let width = 0;
    let height = 0;

    /* ── Mouse state ── */
    const mouse = { x: -999, y: -999, px: -999, py: -999 };

    /* ── Ambient drop counter ── */
    const MAX_AMBIENT = 12;
    let ambientCount = 0;

    /* ── Wave engine instance ── */
    let field = null;

    /* ── Offscreen scratch canvas for putImageData → drawImage upscale ── */
    let tmpCanvas = document.createElement("canvas");
    let tmpCtx = tmpCanvas.getContext("2d");

    const resize = () => {
      const parent = canvas.parentElement;
      width = parent ? parent.clientWidth : window.innerWidth;
      height = parent ? parent.clientHeight : window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (field) {
        field.resize(width, height);
      } else {
        field = createWaveField(width, height);
      }

      tmpCanvas.width = field.cols;
      tmpCanvas.height = field.rows;
      tmpCtx = tmpCanvas.getContext("2d");
    };

    resize();
    window.addEventListener("resize", resize);

    /* ── Event handlers (mouse-tracking / click — NOT extracted) ── */
    const CELL = 4; // matches engine default

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.px = mouse.x;
      mouse.py = mouse.y;
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;

      const dx = mouse.x - mouse.px;
      const dy = mouse.y - mouse.py;
      const speed = Math.hypot(dx, dy);

      if (speed > 1 && mouse.px > -500) {
        const steps = Math.max(1, Math.floor(speed / 3));
        for (let s = 0; s < steps; s++) {
          const t = s / steps;
          const ix = mouse.px + dx * t;
          const iy = mouse.py + dy * t;
          field.ripple(ix, iy, Math.min(speed * 0.35, 40));
        }

        if (speed > 8) {
          const col = INK_PALETTE[Math.floor(Math.random() * 3)];
          field.ink(
            mouse.x / CELL,
            mouse.y / CELL,
            6 + speed * 0.12,
            col,
            0.04 + Math.min(speed * 0.003, 0.1),
          );
        }
      }
    };

    const handleClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      field.ripple(cx, cy, 120);

      const col = INK_PALETTE[Math.floor(Math.random() * INK_PALETTE.length)];
      field.ink(cx / CELL, cy / CELL, 25 + Math.random() * 15, col, 0.35);

      for (let i = 0; i < 5; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 30 + Math.random() * 50;
        field.ripple(
          cx + Math.cos(angle) * dist,
          cy + Math.sin(angle) * dist,
          40 + Math.random() * 30,
        );
      }
    };

    const parentEl = canvas.parentElement || window;
    parentEl.addEventListener("mousemove", handleMouseMove);
    parentEl.addEventListener("click", handleClick);

    let frame = 0;

    /* ══════════════════════════ RENDER LOOP ══════════════════════════ */
    const render = () => {
      frame++;

      /* Ambient drops */
      if (frame % 90 === 0 && ambientCount < MAX_AMBIENT) {
        const ax = Math.random() * width;
        const ay = Math.random() * height;
        field.ripple(ax, ay, 18 + Math.random() * 22);
        const col = INK_PALETTE[Math.floor(Math.random() * INK_PALETTE.length)];
        field.ink(
          ax / CELL,
          ay / CELL,
          10 + Math.random() * 18,
          col,
          0.06 + Math.random() * 0.08,
        );
      }

      /* Advance simulation */
      field.step(frame);

      /* Blit to canvas via scratch surface */
      const raw = field.getImageData();
      const imgData = new ImageData(
        new Uint8ClampedArray(raw.buffer, raw.byteOffset, raw.byteLength),
        field.cols,
        field.rows,
      );

      tmpCtx.putImageData(imgData, 0, 0);

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(tmpCanvas, 0, 0, width, height);

      /* Subtle surface gloss */
      const glossGrad = ctx.createRadialGradient(
        width * 0.3, height * 0.25, 0,
        width * 0.5, height * 0.5, Math.max(width, height) * 0.7,
      );
      glossGrad.addColorStop(0, "rgba(200, 220, 255, 0.04)");
      glossGrad.addColorStop(0.5, "rgba(100, 130, 180, 0.015)");
      glossGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = glossGrad;
      ctx.fillRect(0, 0, width, height);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", resize);
      parentEl.removeEventListener("mousemove", handleMouseMove);
      parentEl.removeEventListener("click", handleClick);
      cancelAnimationFrame(animationFrameId);
    };
  }, [variant, enableClickBurst]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}

export default CursorField;
