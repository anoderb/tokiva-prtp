import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';
import { normalizeCanvas } from './image-preprocess';

let model: mobilenet.MobileNet | null = null;
let isLoading = false;

/**
 * Loads the MobileNetV2 model with alpha=1.0.
 * Once loaded, it is cached in the module scope.
 */
export async function loadModel(): Promise<mobilenet.MobileNet> {
  if (model) return model;
  
  if (isLoading) {
    while (isLoading) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (model) return model;
  }

  isLoading = true;
  try {
    console.log('Initializing TensorFlow.js...');
    await tf.ready();
    
    // Set WebGL backend if available, fallback to CPU
    try {
      await tf.setBackend('webgl');
      console.log('TensorFlow.js using WebGL backend.');
    } catch (e) {
      console.warn('WebGL backend failed. Falling back to CPU backend.', e);
      await tf.setBackend('cpu');
    }

    console.log('Loading MobileNet V2 (alpha=1.0)...');
    // Load MobileNetV2 (version 2) with alpha 1.0 for high-quality 1280-dimension embeddings
    model = await mobilenet.load({
      version: 2,
      alpha: 1.0,
    });
    console.log('MobileNet V2 loaded successfully.');
    return model;
  } catch (error) {
    console.error('Error loading MobileNet V2:', error);
    throw error;
  } finally {
    isLoading = false;
  }
}

/**
 * Generates an embedding vector (1280 dimensions) for a given image, canvas, or video frame.
 */
export async function getEmbedding(
  image: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement
): Promise<number[]> {
  const m = await loadModel();
  
  // Apply preprocessing if canvas
  let processedImage: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement = image;
  if (image instanceof HTMLCanvasElement) {
    processedImage = normalizeCanvas(image);
  }

  return tf.tidy(() => {
    const embeddingTensor = m.infer(processedImage, true);
    const data = embeddingTensor.dataSync();
    return Array.from(data);
  });
}

/**
 * Creates augmented canvas variations for richer embedding registration.
 * From 1 source canvas, generates 5 additional variations:
 * - Rotate +10° and -10°
 * - Flip horizontal (mirror)
 * - Brightness +15% and -15%
 * Returns array of all 6 embeddings (original + 5 augmented).
 */
export async function generateAugmentedEmbeddings(
  sourceCanvas: HTMLCanvasElement
): Promise<number[][]> {
  const embeddings: number[][] = [];

  // 1. Original embedding
  const originalEmb = await getEmbedding(sourceCanvas);
  embeddings.push(originalEmb);

  const w = sourceCanvas.width;
  const h = sourceCanvas.height;

  // Helper: create a transformed canvas
  const createVariant = (
    transform: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void
  ): HTMLCanvasElement => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    transform(ctx, c);
    return c;
  };

  // 2. Rotate +10°
  const rotPlus = createVariant((ctx, c) => {
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate((10 * Math.PI) / 180);
    ctx.drawImage(sourceCanvas, -w / 2, -h / 2);
  });
  embeddings.push(await getEmbedding(rotPlus));

  // 3. Rotate -10°
  const rotMinus = createVariant((ctx, c) => {
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate((-10 * Math.PI) / 180);
    ctx.drawImage(sourceCanvas, -w / 2, -h / 2);
  });
  embeddings.push(await getEmbedding(rotMinus));

  // 4. Flip horizontal
  const flipped = createVariant((ctx, c) => {
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(sourceCanvas, 0, 0);
  });
  embeddings.push(await getEmbedding(flipped));

  // 5. Brightness +15%
  const brightUp = createVariant((ctx, c) => {
    ctx.drawImage(sourceCanvas, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(0, 0, c.width, c.height);
  });
  embeddings.push(await getEmbedding(brightUp));

  // 6. Brightness -15%
  const brightDown = createVariant((ctx, c) => {
    ctx.drawImage(sourceCanvas, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgba(217,217,217,1)'; // ~85% brightness
    ctx.fillRect(0, 0, c.width, c.height);
  });
  embeddings.push(await getEmbedding(brightDown));

  return embeddings;
}

/**
 * Calculates the Cosine Similarity between two numeric vectors.
 * Returns a score between -1 and 1 (usually 0 to 1 for non-negative vectors).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    console.warn(`Vector size mismatch. Vector A has ${a.length} elements, Vector B has ${b.length} elements.`);
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface MatchResult {
  id: number;
  similarity: number;
}

/**
 * Finds products whose embeddings match the query embedding above a threshold.
 * Uses Weighted Top-3 Average scoring for more robust matching:
 * score = (s1×3 + s2×2 + s3×1) / 6
 * This rewards products with consistently high similarity across multiple embeddings
 * and reduces false positives from single outlier embeddings.
 */
export function findNearest(
  query: number[],
  products: Array<{ id: number; embeddings: number[][] }>,
  threshold = 0.5
): MatchResult[] {
  const results: MatchResult[] = [];

  for (const product of products) {
    const productEmbeddings = product.embeddings;
    if (!productEmbeddings || productEmbeddings.length === 0) continue;

    // Calculate similarity against ALL embeddings for this product
    const similarities: number[] = [];
    for (const emb of productEmbeddings) {
      if (!emb || emb.length === 0) continue;
      similarities.push(cosineSimilarity(query, emb));
    }

    if (similarities.length === 0) continue;

    // Sort descending and take top 3
    similarities.sort((a, b) => b - a);
    const topK = similarities.slice(0, 3);

    // Weighted average: top-1 gets weight 3, top-2 gets 2, top-3 gets 1
    let weightedSum = 0;
    let weightTotal = 0;
    const weights = [3, 2, 1];
    for (let i = 0; i < topK.length; i++) {
      const w = weights[i] || 1;
      weightedSum += topK[i] * w;
      weightTotal += w;
    }
    const weightedScore = weightedSum / weightTotal;

    if (weightedScore >= threshold) {
      results.push({
        id: product.id,
        similarity: weightedScore,
      });
    }
  }

  // Sort descending by weighted similarity score
  return results.sort((a, b) => b.similarity - a.similarity);
}
