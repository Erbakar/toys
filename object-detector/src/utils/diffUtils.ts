import type { DetectedObject, DetectionResult, DetectionDiff } from '../types/detection';
import { detectionService } from '../services/detectionService';

export function computeDiff(
  reference: DetectionResult,
  current: DetectionResult
): DetectionDiff {
  return detectionService.compare(reference, current);
}

export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

export function getObjectDisplayName(obj: DetectedObject): string {
  return [obj.dominantColor, obj.label].filter(Boolean).join(' ');
}

export function getObjectEmoji(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes('araba') || lower.includes('car')) return '🚗';
  if (lower.includes('top') || lower.includes('ball')) return '🔵';
  if (lower.includes('lego')) return '🧱';
  if (lower.includes('zar') || lower.includes('dice')) return '🎲';
  if (lower.includes('figür') || lower.includes('figure')) return '🧸';
  if (lower.includes('anahtarlık') || lower.includes('keychain')) return '🔑';
  return '📦';
}
