import type { DetectionResult } from './detection';

export type AppStep = 'reference' | 'control' | 'results';

export interface AppState {
  step: AppStep;
  referenceResult: DetectionResult | null;
  controlResult: DetectionResult | null;
}

export type AppAction =
  | { type: 'SET_REFERENCE'; payload: DetectionResult }
  | { type: 'SET_CONTROL'; payload: DetectionResult }
  | { type: 'RESET' }
  | { type: 'GO_BACK' };
