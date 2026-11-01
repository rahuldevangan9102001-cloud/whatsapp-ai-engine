export const CONFIDENCE_THRESHOLDS = Object.freeze({ intent: 0.7, stage: 0.7, knowledge: 0.7 });

export function isConfident(value, threshold = 0.7) {
  return Number.isFinite(Number(value)) && Number(value) >= threshold;
}

export function safeConfidence(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0;
}