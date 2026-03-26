import { describe, it, expect } from 'vitest';
import { cosineSimilarity } from './ollama-client.js';

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const v = [0.5, 0.5, 0.5, 0.5];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0.0);
  });

  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1.0);
  });

  it('throws on dimension mismatch', () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow('dim mismatch');
  });

  it('returns 0 for zero vectors', () => {
    expect(cosineSimilarity([0, 0], [0, 0])).toBe(0);
  });
});
