/**
 * Image preprocessing utilities for MobileNetV2 inference pipeline.
 * Normalizes lighting and reduces background noise before embedding extraction.
 */

/**
 * Auto contrast stretching — expands pixel histogram to full [0, 255] range.
 * This makes embeddings more consistent across different lighting conditions.
 */
function autoContrastStretch(imageData: ImageData): void {
  const data = imageData.data;
  let minR = 255, minG = 255, minB = 255;
  let maxR = 0, maxG = 0, maxB = 0;

  // Pass 1: Find min/max per channel
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
    if (g < minG) minG = g;
    if (g > maxG) maxG = g;
    if (b < minB) minB = b;
    if (b > maxB) maxB = b;
  }

  const rangeR = maxR - minR || 1;
  const rangeG = maxG - minG || 1;
  const rangeB = maxB - minB || 1;

  // Pass 2: Stretch to [0, 255]
  for (let i = 0; i < data.length; i += 4) {
    data[i]     = ((data[i]     - minR) / rangeR) * 255;
    data[i + 1] = ((data[i + 1] - minG) / rangeG) * 255;
    data[i + 2] = ((data[i + 2] - minB) / rangeB) * 255;
  }
}

/**
 * Center-weighted vignette — darkens the outer 25% edges of the image
 * to reduce background noise influence on MobileNetV2 embeddings.
 * The center (product area) remains fully bright.
 */
function applyCenterVignette(imageData: ImageData, width: number, height: number): void {
  const data = imageData.data;
  const cx = width / 2;
  const cy = height / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = (x - cx) / cx;
      const dy = (y - cy) / cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Only darken if distance > 0.6 (outer 40% of radius)
      if (dist > 0.6) {
        const fade = 1 - Math.min((dist - 0.6) / 0.8, 0.45); // Max 45% darkening
        const idx = (y * width + x) * 4;
        data[idx]     = data[idx]     * fade;
        data[idx + 1] = data[idx + 1] * fade;
        data[idx + 2] = data[idx + 2] * fade;
      }
    }
  }
}

/**
 * Main preprocessing function.
 * Takes a 224x224 canvas, applies contrast normalization and center vignette,
 * returns a new preprocessed canvas ready for MobileNetV2 inference.
 *
 * Performance: ~2-5ms on modern devices.
 */
export function normalizeCanvas(sourceCanvas: HTMLCanvasElement): HTMLCanvasElement {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = width;
  outCanvas.height = height;
  const ctx = outCanvas.getContext('2d');
  if (!ctx) return sourceCanvas;

  ctx.drawImage(sourceCanvas, 0, 0);
  const imageData = ctx.getImageData(0, 0, width, height);

  // Step 1: Auto contrast stretch
  autoContrastStretch(imageData);

  // Step 2: Center-weighted vignette
  applyCenterVignette(imageData, width, height);

  ctx.putImageData(imageData, 0, 0);
  return outCanvas;
}
