/**
 * Image preprocessing utilities for MobileNetV2 inference pipeline.
 * Normalizes lighting, corrects colors, and isolates the center object (Focal Masking).
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
 * Color Balancing using the Gray World Assumption.
 * Adjusts color channels so the average color is neutral gray.
 * This neutralizes ambient warm (yellow) or cool (blue) lighting biases.
 */
function applyColorBalance(imageData: ImageData): void {
  const data = imageData.data;
  let sumR = 0, sumG = 0, sumB = 0;
  const numPixels = data.length / 4;

  // Pass 1: Sum all channels
  for (let i = 0; i < data.length; i += 4) {
    sumR += data[i];
    sumG += data[i + 1];
    sumB += data[i + 2];
  }

  // Calculate channel averages
  const avgR = sumR / numPixels || 1;
  const avgG = sumG / numPixels || 1;
  const avgB = sumB / numPixels || 1;

  // Target average is the overall gray scale average of all channels combined
  const avgGray = (avgR + avgG + avgB) / 3;

  // Scaling factors
  const scaleR = avgGray / avgR;
  const scaleG = avgGray / avgG;
  const scaleB = avgGray / avgB;

  // Pass 2: Apply scaling factors
  for (let i = 0; i < data.length; i += 4) {
    data[i]     = Math.min(255, Math.max(0, data[i]     * scaleR));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * scaleG));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * scaleB));
  }
}

/**
 * Focal Masking (100% Vignette Background Eraser).
 * Isolates the center area of the camera reticle and blackens out all background noise.
 */
function applyCenterVignette(imageData: ImageData, width: number, height: number): void {
  const data = imageData.data;
  const cx = width / 2;
  const cy = height / 2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = (x - cx) / cx;
      const dy = (y - cy) / cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Outer boundary (> 0.70 radius) goes to 100% black
      if (dist > 0.70) {
        const idx = (y * width + x) * 4;
        data[idx]     = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
      } else if (dist > 0.50) {
        // Smooth fade between 0.50 and 0.70
        const fade = 1 - ((dist - 0.50) / 0.20);
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
 * Takes a 224x224 canvas, applies contrast stretch, color balancing, and focal masking.
 * Returns a new preprocessed canvas ready for MobileNetV2 inference.
 *
 * Performance: ~3-6ms.
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

  // Step 2: Color balance (Gray World)
  applyColorBalance(imageData);

  // Step 3: Focal Masking (Vignette)
  applyCenterVignette(imageData, width, height);

  ctx.putImageData(imageData, 0, 0);
  return outCanvas;
}
