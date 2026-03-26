import { getConfig, createLogger } from '@ai-companion/utils';

const log = createLogger('ollama-client');

const MODEL = 'nomic-embed-text';
const EMBEDDING_DIM = 768;

export interface EmbeddingResponse {
  embedding: number[];
  model: string;
  tokenCount: number;
}

export async function embed(text: string): Promise<EmbeddingResponse> {
  const cfg = getConfig();
  const url = `${cfg.ollama.baseUrl}/api/embeddings`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt: text }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ollama embedding failed: ${err}`);
  }

  const data = await res.json() as { embedding: number[] };
  log.debug(`Embedded text (${text.length} chars) -> ${data.embedding.length}d vector`);

  return {
    embedding: data.embedding,
    model: MODEL,
    tokenCount: Math.ceil(text.length / 4),
  };
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error(`Vector dim mismatch: ${a.length} vs ${b.length}`);
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export { EMBEDDING_DIM };
