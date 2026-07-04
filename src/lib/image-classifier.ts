import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';

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
  
  return tf.tidy(() => {
    // Generate feature vector (embedding) by passing true as the second argument
    const embeddingTensor = m.infer(image, true);
    const data = embeddingTensor.dataSync();
    return Array.from(data);
  });
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
 * Returns sorted list of candidate product IDs and their max similarity score.
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

    let maxSimilarity = 0;

    for (const emb of productEmbeddings) {
      if (!emb || emb.length === 0) continue;
      const sim = cosineSimilarity(query, emb);
      if (sim > maxSimilarity) {
        maxSimilarity = sim;
      }
    }

    if (maxSimilarity >= threshold) {
      results.push({
        id: product.id,
        similarity: maxSimilarity,
      });
    }
  }

  // Sort descending by similarity score
  return results.sort((a, b) => b.similarity - a.similarity);
}
