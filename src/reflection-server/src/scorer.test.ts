import { describe, it, expect } from 'vitest';
import { scoreOutput } from './scorer.js';
import type { Rubric } from '@ai-companion/types';

const testRubric: Rubric = {
  id: 'test_rubric',
  name: 'Test Rubric',
  description: 'For testing',
  criteria: [
    { id: 'criterion_a', description: 'Test A', weight: 0.6, threshold: 0.8 },
    { id: 'criterion_b', description: 'Test B', weight: 0.4, threshold: 1.0 },
  ],
  createdAt: new Date().toISOString(),
};

describe('scoreOutput', () => {
  it('scores perfect measurements as 1.0', () => {
    const result = scoreOutput({
      rubric: testRubric,
      measurements: { criterion_a: 0.8, criterion_b: 1.0 },
    });
    expect(result.score).toBeCloseTo(1.0);
  });

  it('scores zero measurements as 0', () => {
    const result = scoreOutput({
      rubric: testRubric,
      measurements: { criterion_a: 0, criterion_b: 0 },
    });
    expect(result.score).toBe(0);
  });

  it('applies weights correctly', () => {
    // Only criterion_a passes (weight 0.6), criterion_b = 0 (weight 0.4)
    const result = scoreOutput({
      rubric: testRubric,
      measurements: { criterion_a: 0.8, criterion_b: 0 },
    });
    // weighted: 1.0 * 0.6 + 0 * 0.4 = 0.6, total weight = 1.0, score = 0.6
    expect(result.score).toBeCloseTo(0.6);
  });

  it('caps at 1.0 for above-threshold measurements', () => {
    const result = scoreOutput({
      rubric: testRubric,
      measurements: { criterion_a: 2.0, criterion_b: 5.0 },
    });
    expect(result.score).toBeLessThanOrEqual(1.0);
  });

  it('populates criteriaScores for all criteria', () => {
    const result = scoreOutput({
      rubric: testRubric,
      measurements: { criterion_a: 0.5 },
    });
    expect(result.criteriaScores).toHaveProperty('criterion_a');
    expect(result.criteriaScores).toHaveProperty('criterion_b');
  });

  it('assigns task ID when provided', () => {
    const result = scoreOutput({
      rubric: testRubric,
      measurements: { criterion_a: 1, criterion_b: 1 },
      taskId: 42,
    });
    expect(result.taskId).toBe(42);
  });
});
