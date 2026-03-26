export interface ConfidenceSignals {
  taskDescription: string;
  targetFile?: string;
  blastRadiusDepth?: number;
  callDepth?: number;
  priorSimilarTaskScore?: number;
  isAtomicChange?: boolean;
}

export interface ConfidenceResult {
  score: number;
  complexity: number;
  risk: number;
  reasons: string[];
}

export function scoreConfidence(signals: ConfidenceSignals): ConfidenceResult {
  const reasons: string[] = [];
  let complexity = 0.5;
  let risk = 0.5;

  // Single file target reduces risk
  if (signals.targetFile) {
    risk -= 0.15;
    reasons.push('Targets single file (-risk)');
  }

  if (signals.isAtomicChange) {
    complexity -= 0.2;
    risk -= 0.1;
    reasons.push('Atomic change (-complexity, -risk)');
  }

  // Blast radius signals
  if (signals.blastRadiusDepth !== undefined) {
    if (signals.blastRadiusDepth > 5) {
      risk += 0.2;
      reasons.push('High blast radius depth (+risk)');
    } else if (signals.blastRadiusDepth <= 2) {
      risk -= 0.1;
      reasons.push('Low blast radius (+risk reduction)');
    }
  }

  if (signals.callDepth !== undefined) {
    if (signals.callDepth > 4) {
      complexity += 0.15;
      reasons.push('Deep call chain (+complexity)');
    }
  }

  if (signals.priorSimilarTaskScore !== undefined) {
    const boost = (signals.priorSimilarTaskScore - 0.5) * 0.3;
    complexity -= boost;
    reasons.push(`Prior similar task score: ${signals.priorSimilarTaskScore.toFixed(2)}`);
  }

  // Clamp
  complexity = Math.max(0, Math.min(1, complexity));
  risk = Math.max(0, Math.min(1, risk));

  // Confidence = inverse of combined penalty
  const score = Math.max(0, Math.min(1, 1 - (complexity * 0.5 + risk * 0.5)));

  return { score, complexity, risk, reasons };
}

export function routeToModel(complexity: number, risk: number): 'haiku' | 'sonnet' | 'opus' {
  if (complexity < 0.3 && risk < 0.2) return 'haiku';
  if (complexity < 0.7 && risk < 0.6) return 'sonnet';
  return 'opus';
}
