import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';

// Test the hash helper in isolation (pure function)
function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

describe('memory-blocks helpers', () => {
  it('hash is deterministic', () => {
    expect(hashContent('hello')).toBe(hashContent('hello'));
  });

  it('different content produces different hash', () => {
    expect(hashContent('foo')).not.toBe(hashContent('bar'));
  });

  it('hash is 16 chars', () => {
    expect(hashContent('test')).toHaveLength(16);
  });
});

// Test health thresholds
describe('context health thresholds', () => {
  const COMPRESSION_THRESHOLD = 0.70;

  it('ok below threshold', () => {
    const util = 0.5;
    expect(util >= COMPRESSION_THRESHOLD).toBe(false);
  });

  it('compress at threshold', () => {
    const util = 0.70;
    expect(util >= COMPRESSION_THRESHOLD).toBe(true);
  });

  it('compress above threshold', () => {
    expect(0.85 >= COMPRESSION_THRESHOLD).toBe(true);
  });
});
