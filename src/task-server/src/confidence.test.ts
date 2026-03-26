import { describe, it, expect } from 'vitest';
import { scoreConfidence, routeToModel } from './confidence.js';

describe('scoreConfidence', () => {
  it('returns score between 0 and 1', () => {
    const result = scoreConfidence({ taskDescription: 'Fix a bug in login.ts' });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('single-file target reduces risk', () => {
    const withFile = scoreConfidence({ taskDescription: 'Update foo', targetFile: 'foo.ts' });
    const withoutFile = scoreConfidence({ taskDescription: 'Update foo' });
    expect(withFile.risk).toBeLessThan(withoutFile.risk);
  });

  it('high blast radius increases risk', () => {
    const low = scoreConfidence({ taskDescription: 'x', blastRadiusDepth: 1 });
    const high = scoreConfidence({ taskDescription: 'x', blastRadiusDepth: 10 });
    expect(high.risk).toBeGreaterThan(low.risk);
  });

  it('atomic change reduces complexity', () => {
    const atomic = scoreConfidence({ taskDescription: 'x', isAtomicChange: true });
    const nonAtomic = scoreConfidence({ taskDescription: 'x', isAtomicChange: false });
    expect(atomic.complexity).toBeLessThan(nonAtomic.complexity);
  });

  it('provides reasons array', () => {
    const result = scoreConfidence({ taskDescription: 'x', targetFile: 'x.ts', isAtomicChange: true });
    expect(result.reasons.length).toBeGreaterThan(0);
  });
});

describe('routeToModel', () => {
  it('routes low complexity/risk to haiku', () => {
    expect(routeToModel(0.1, 0.1)).toBe('haiku');
  });

  it('routes medium complexity/risk to sonnet', () => {
    expect(routeToModel(0.5, 0.4)).toBe('sonnet');
  });

  it('routes high complexity/risk to opus', () => {
    expect(routeToModel(0.9, 0.9)).toBe('opus');
  });

  it('routes borderline to opus', () => {
    expect(routeToModel(0.7, 0.6)).toBe('opus');
  });
});
