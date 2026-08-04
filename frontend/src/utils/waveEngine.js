/**
 * waveEngine.js — Shared 2D wave / ink simulation core.
 *
 * Usage:
 *   const field = createWaveField(pixelWidth, pixelHeight, cellSize?);
 *   field.ripple(px, py, strength);        // pixel coords
 *   field.ink(cx, cy, radius, color, intensity);  // grid coords
 *   field.step(frameIndex);                // advance one tick
 *   const imgData = field.getImageData();  // Uint8ClampedArray RGBA
 *   field.resize(newW, newH);              // re-initialise grid
 */

/** Default ink palette — amber / indigo / violet / teal / navy / ivory */
export const INK_PALETTE = [
  [232, 162, 75],   // amber
  [99, 102, 241],   // indigo
  [139, 92, 246],   // violet
  [0, 210, 230],    // cyan-teal
  [11, 18, 32],     // navy dark
  [245, 241, 232],  // ivory highlight
];

/**
 * Create a self-contained wave-field simulation.
 *
 * @param {number} pixelW   viewport pixel width
 * @param {number} pixelH   viewport pixel height
 * @param {number} [cell=4] pixel size of each simulation cell
 * @returns {object} engine instance
 */
export function createWaveField(pixelW, pixelH, cell = 4) {
  const DAMPING = 0.985;
  const DIFF_RATE = 0.008;

  let width = pixelW;
  let height = pixelH;
  let CELL = cell;
  let cols = 0;
  let rows = 0;

  // Simulation buffers
  let buf1 = /** @type {Float32Array} */ (new Float32Array(0));
  let buf2 = /** @type {Float32Array} */ (new Float32Array(0));

  // Ink channels
  let inkR = /** @type {Float32Array} */ (new Float32Array(0));
  let inkG = /** @type {Float32Array} */ (new Float32Array(0));
  let inkB = /** @type {Float32Array} */ (new Float32Array(0));

  // Pixel output buffer (grid-resolution, RGBA)
  let imageData = /** @type {Uint8ClampedArray} */ (new Uint8ClampedArray(0));

  /* ── Initialise / re-initialise grid ── */
  function initGrid() {
    cols = Math.ceil(width / CELL);
    rows = Math.ceil(height / CELL);
    const len = cols * rows;

    buf1 = new Float32Array(len);
    buf2 = new Float32Array(len);

    inkR = new Float32Array(len);
    inkG = new Float32Array(len);
    inkB = new Float32Array(len);

    // Deep navy-black base water
    for (let i = 0; i < len; i++) {
      inkR[i] = 6;
      inkG[i] = 10;
      inkB[i] = 18;
    }

    imageData = new Uint8ClampedArray(cols * rows * 4);

    // Seed some initial ink blooms
    for (let k = 0; k < 6; k++) {
      ink(
        Math.random() * cols,
        Math.random() * rows,
        18 + Math.random() * 28,
        INK_PALETTE[Math.floor(Math.random() * INK_PALETTE.length)],
        0.12 + Math.random() * 0.15,
      );
    }
  }

  /* ── Drop ink at *grid* coordinates ── */
  function ink(cx, cy, radius, color, intensity) {
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
  }

  /* ── Create ripple at *pixel* coordinates ── */
  function ripple(px, py, strength) {
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
  }

  /* ── Advance simulation one tick ── */
  function step(frameIndex) {
    const len = cols * rows;

    // 2D wave equation propagation
    const newBuf = new Float32Array(len);
    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1; x < cols - 1; x++) {
        const idx = y * cols + x;
        newBuf[idx] =
          (buf1[idx - 1] + buf1[idx + 1] + buf1[idx - cols] + buf1[idx + cols]) * 0.5 -
          buf2[idx];
        newBuf[idx] *= DAMPING;
      }
    }
    buf2 = buf1;
    buf1 = newBuf;

    // Slow ink diffusion (every 4th frame)
    if (frameIndex % 4 === 0) {
      for (let y = 1; y < rows - 1; y++) {
        for (let x = 1; x < cols - 1; x++) {
          const idx = y * cols + x;
          const avgR = (inkR[idx - 1] + inkR[idx + 1] + inkR[idx - cols] + inkR[idx + cols]) * 0.25;
          const avgG = (inkG[idx - 1] + inkG[idx + 1] + inkG[idx - cols] + inkG[idx + cols]) * 0.25;
          const avgB = (inkB[idx - 1] + inkB[idx + 1] + inkB[idx - cols] + inkB[idx + cols]) * 0.25;
          inkR[idx] += (avgR - inkR[idx]) * DIFF_RATE;
          inkG[idx] += (avgG - inkG[idx]) * DIFF_RATE;
          inkB[idx] += (avgB - inkB[idx]) * DIFF_RATE;
        }
      }
    }

    // Render water surface into imageData buffer
    const data = imageData;

    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1; x < cols - 1; x++) {
        const idx = y * cols + x;

        // Surface normal from wave height gradient
        const gradX = buf1[idx + 1] - buf1[idx - 1];
        const gradY = buf1[idx + cols] - buf1[idx - cols];

        // Refraction offset
        const srcX = Math.max(0, Math.min(cols - 1, Math.round(x + gradX * 0.45)));
        const srcY = Math.max(0, Math.min(rows - 1, Math.round(y + gradY * 0.45)));
        const srcIdx = srcY * cols + srcX;

        let r = inkR[srcIdx];
        let g = inkG[srcIdx];
        let b = inkB[srcIdx];

        // Specular highlight
        const dot = gradX * -0.4 + gradY * -0.6;
        const specular = Math.pow(Math.max(0, dot * 0.05), 3) * 380;

        // Caustic shimmer
        const absSum = Math.abs(gradX) + Math.abs(gradY);
        const caustic = absSum > 1.2 ? absSum * 8 : 0;

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

    // Edge pixels — navy-black border
    for (let x = 0; x < cols; x++) {
      const topP = x * 4;
      const botP = ((rows - 1) * cols + x) * 4;
      data[topP] = 6; data[topP + 1] = 10; data[topP + 2] = 18; data[topP + 3] = 255;
      data[botP] = 6; data[botP + 1] = 10; data[botP + 2] = 18; data[botP + 3] = 255;
    }
    for (let y = 0; y < rows; y++) {
      const lP = (y * cols) * 4;
      const rP = (y * cols + cols - 1) * 4;
      data[lP] = 6; data[lP + 1] = 10; data[lP + 2] = 18; data[lP + 3] = 255;
      data[rP] = 6; data[rP + 1] = 10; data[rP + 2] = 18; data[rP + 3] = 255;
    }
  }

  /* ── Resize / re-init ── */
  function resize(newW, newH) {
    width = newW;
    height = newH;
    initGrid();
  }

  /* ── Public getters ── */
  function getImageData() {
    return imageData;
  }

  function getCols() { return cols; }
  function getRows() { return rows; }
  function getCellSize() { return CELL; }

  // Boot
  initGrid();

  return {
    ripple,
    ink,
    step,
    resize,
    getImageData,
    get cols() { return getCols(); },
    get rows() { return getRows(); },
    get cellSize() { return getCellSize(); },
    get width() { return width; },
    get height() { return height; },
  };
}
