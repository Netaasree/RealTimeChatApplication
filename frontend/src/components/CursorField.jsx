import { useEffect, useRef } from "react";

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

    /* ── Wave simulation grid ── */
    const CELL = 4;          // pixel size of each simulation cell
    let cols = 0;
    let rows = 0;
    let buf1 = [];            // current wave heights
    let buf2 = [];            // previous wave heights
    const DAMPING = 0.985;    // wave energy decay

    /* ── Ink layer (persistent color on the surface) ── */
    let inkR = [];
    let inkG = [];
    let inkB = [];

    /* ── Mouse state ── */
    const mouse = { x: -999, y: -999, px: -999, py: -999 };

    /* ── Ink palette (navy/amber/indigo/violet/teal) ── */
    const inkColors = [
      [232, 162, 75],    // amber
      [99, 102, 241],    // indigo
      [139, 92, 246],    // violet
      [0, 210, 230],     // cyan-teal
      [11, 18, 32],      // navy dark
      [245, 241, 232],   // ivory highlight
    ];

    /* ── Ambient ink drops ── */
    const ambientDrops = [];
    const MAX_AMBIENT = 12;

    const initGrid = () => {
      cols = Math.ceil(width / CELL);
      rows = Math.ceil(height / CELL);
      const len = cols * rows;
      buf1 = new Float32Array(len);
      buf2 = new Float32Array(len);

      inkR = new Float32Array(len);
      inkG = new Float32Array(len);
      inkB = new Float32Array(len);

      // Start with deep navy-black water
      for (let i = 0; i < len; i++) {
        inkR[i] = 6;
        inkG[i] = 10;
        inkB[i] = 18;
      }

      // Seed some initial ink blooms
      for (let k = 0; k < 6; k++) {
        dropInk(
          Math.random() * cols,
          Math.random() * rows,
          18 + Math.random() * 28,
          inkColors[Math.floor(Math.random() * inkColors.length)],
          0.12 + Math.random() * 0.15
        );
      }
    };

    /* ── Drop ink at grid position ── */
    const dropInk = (cx, cy, radius, color, intensity) => {
      const r2 = radius * radius;
      const x0 = Math.max(0, Math.floor(cx - radius));
      const y0 = Math.max(0, Math.floor(cy - radius));
      const x1 = Math.min(cols - 1, Math.ceil(cx + radius));
      const y1 = Math.min(rows - 1, Math.ceil(cy + radius));

      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const dx = x - cx;
          const dy = y - cy;
          const d2 = dx * dx + dy * dy;
          if (d2 < r2) {
            const t = (1 - d2 / r2) * intensity;
            const idx = y * cols + x;
            inkR[idx] = inkR[idx] * (1 - t) + color[0] * t;
            inkG[idx] = inkG[idx] * (1 - t) + color[1] * t;
            inkB[idx] = inkB[idx] * (1 - t) + color[2] * t;
          }
        }
      }
    };

    /* ── Create ripple disturbance ── */
    const createRipple = (px, py, strength) => {
      const gx = Math.floor(px / CELL);
      const gy = Math.floor(py / CELL);
      const radius = 3;

      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = gx + dx;
          const ny = gy + dy;
          if (nx >= 1 && nx < cols - 1 && ny >= 1 && ny < rows - 1) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= radius) {
              const falloff = 1 - dist / radius;
              buf1[ny * cols + nx] += strength * falloff * falloff;
            }
          }
        }
      }
    };

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
      initGrid();
    };

    resize();
    window.addEventListener("resize", resize);

    /* ── Event handlers ── */
    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.px = mouse.x;
      mouse.py = mouse.y;
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;

      // Create ripple trail along mouse path
      const dx = mouse.x - mouse.px;
      const dy = mouse.y - mouse.py;
      const speed = Math.hypot(dx, dy);

      if (speed > 1 && mouse.px > -500) {
        const steps = Math.max(1, Math.floor(speed / 3));
        for (let s = 0; s < steps; s++) {
          const t = s / steps;
          const ix = mouse.px + dx * t;
          const iy = mouse.py + dy * t;
          createRipple(ix, iy, Math.min(speed * 0.35, 40));
        }

        // Mouse drags ink colours along its path
        if (speed > 8) {
          const col = inkColors[Math.floor(Math.random() * 3)];
          dropInk(
            mouse.x / CELL,
            mouse.y / CELL,
            6 + speed * 0.12,
            col,
            0.04 + Math.min(speed * 0.003, 0.1)
          );
        }
      }
    };

    const handleClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      // Big splash ripple
      createRipple(cx, cy, 120);

      // Drop a large ink bloom
      const col = inkColors[Math.floor(Math.random() * inkColors.length)];
      dropInk(cx / CELL, cy / CELL, 25 + Math.random() * 15, col, 0.35);

      // Secondary smaller splashes
      for (let i = 0; i < 5; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 30 + Math.random() * 50;
        createRipple(
          cx + Math.cos(angle) * dist,
          cy + Math.sin(angle) * dist,
          40 + Math.random() * 30
        );
      }
    };

    const parentEl = canvas.parentElement || window;
    parentEl.addEventListener("mousemove", handleMouseMove);
    parentEl.addEventListener("click", handleClick);

    /* ── Offscreen buffer for pixel rendering ── */
    let imageData = ctx.createImageData(cols, rows);

    let frame = 0;

    /* ══════════════════════════ RENDER LOOP ══════════════════════════ */
    const render = () => {
      frame++;

      /* ── Ambient drops: periodically add gentle ink and ripples ── */
      if (frame % 90 === 0 && ambientDrops.length < MAX_AMBIENT) {
        const ax = Math.random() * width;
        const ay = Math.random() * height;
        createRipple(ax, ay, 18 + Math.random() * 22);
        const col = inkColors[Math.floor(Math.random() * inkColors.length)];
        dropInk(
          ax / CELL,
          ay / CELL,
          10 + Math.random() * 18,
          col,
          0.06 + Math.random() * 0.08
        );
      }

      /* ── Wave propagation (2D wave equation) ── */
      const newBuf = new Float32Array(cols * rows);
      for (let y = 1; y < rows - 1; y++) {
        for (let x = 1; x < cols - 1; x++) {
          const idx = y * cols + x;
          // Average of 4 neighbours minus previous value
          newBuf[idx] =
            (buf1[idx - 1] +
              buf1[idx + 1] +
              buf1[idx - cols] +
              buf1[idx + cols]) *
              0.5 -
            buf2[idx];
          newBuf[idx] *= DAMPING;
        }
      }
      buf2 = buf1;
      buf1 = newBuf;

      /* ── Slow ink diffusion (makes colours bleed gently) ── */
      if (frame % 4 === 0) {
        const diffRate = 0.008;
        for (let y = 1; y < rows - 1; y++) {
          for (let x = 1; x < cols - 1; x++) {
            const idx = y * cols + x;
            const avg = (val, arr) =>
              (arr[idx - 1] + arr[idx + 1] + arr[idx - cols] + arr[idx + cols]) * 0.25;
            inkR[idx] += (avg(inkR[idx], inkR) - inkR[idx]) * diffRate;
            inkG[idx] += (avg(inkG[idx], inkG) - inkG[idx]) * diffRate;
            inkB[idx] += (avg(inkB[idx], inkB) - inkB[idx]) * diffRate;
          }
        }
      }

      /* ── Render water surface to pixel buffer ── */
      if (imageData.width !== cols || imageData.height !== rows) {
        imageData = ctx.createImageData(cols, rows);
      }
      const data = imageData.data;

      for (let y = 1; y < rows - 1; y++) {
        for (let x = 1; x < cols - 1; x++) {
          const idx = y * cols + x;

          // Surface normal from wave height gradient (for lighting)
          const gradX = buf1[idx + 1] - buf1[idx - 1];
          const gradY = buf1[idx + cols] - buf1[idx - cols];

          // Refraction offset to look up shifted ink colour
          const refractX = Math.round(x + gradX * 0.45);
          const refractY = Math.round(y + gradY * 0.45);
          const srcX = Math.max(0, Math.min(cols - 1, refractX));
          const srcY = Math.max(0, Math.min(rows - 1, refractY));
          const srcIdx = srcY * cols + srcX;

          let r = inkR[srcIdx];
          let g = inkG[srcIdx];
          let b = inkB[srcIdx];

          // Specular highlight (sun-like light from top-left)
          const lightX = -0.4;
          const lightY = -0.6;
          const dot = gradX * lightX + gradY * lightY;
          const specular = Math.pow(Math.max(0, dot * 0.05), 3) * 380;

          // Caustic shimmer from wave convergence
          const caustic =
            Math.abs(gradX) + Math.abs(gradY) > 1.2
              ? (Math.abs(gradX) + Math.abs(gradY)) * 8
              : 0;

          // Depth darkening for troughs
          const waveH = buf1[idx];
          const depthFactor = waveH < -2 ? 1 + waveH * 0.015 : 1;

          r = Math.max(0, Math.min(255, r * depthFactor + specular + caustic * 0.6));
          g = Math.max(0, Math.min(255, g * depthFactor + specular + caustic * 0.7));
          b = Math.max(0, Math.min(255, b * depthFactor + specular * 1.3 + caustic));

          const pi = idx * 4;
          data[pi] = r;
          data[pi + 1] = g;
          data[pi + 2] = b;
          data[pi + 3] = 255;
        }
      }

      // Edge pixels
      for (let x = 0; x < cols; x++) {
        const topIdx = x * 4;
        const botIdx = ((rows - 1) * cols + x) * 4;
        data[topIdx] = 6; data[topIdx + 1] = 10; data[topIdx + 2] = 18; data[topIdx + 3] = 255;
        data[botIdx] = 6; data[botIdx + 1] = 10; data[botIdx + 2] = 18; data[botIdx + 3] = 255;
      }
      for (let y = 0; y < rows; y++) {
        const lIdx = (y * cols) * 4;
        const rIdx = (y * cols + cols - 1) * 4;
        data[lIdx] = 6; data[lIdx + 1] = 10; data[lIdx + 2] = 18; data[lIdx + 3] = 255;
        data[rIdx] = 6; data[rIdx + 1] = 10; data[rIdx + 2] = 18; data[rIdx + 3] = 255;
      }

      /* ── Draw to canvas (scale up from grid to full resolution) ── */
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // Put the small imageData onto a temp canvas, then drawImage scaled
      const tmpCanvas = document.createElement("canvas");
      tmpCanvas.width = cols;
      tmpCanvas.height = rows;
      const tmpCtx = tmpCanvas.getContext("2d");
      tmpCtx.putImageData(imageData, 0, 0);

      ctx.drawImage(tmpCanvas, 0, 0, width, height);

      /* ── Subtle surface gloss overlay ── */
      const glossGrad = ctx.createRadialGradient(
        width * 0.3,
        height * 0.25,
        0,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.7
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
