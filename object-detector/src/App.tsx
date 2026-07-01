import { useReducer } from 'react';
import type { AppState, AppAction } from './types/app';
import type { DetectionResult } from './types/detection';
import { ReferencePage } from './pages/ReferencePage';
import { ControlPage } from './pages/ControlPage';
import { ResultsPage } from './pages/ResultsPage';

const initialState: AppState = {
  step: 'reference',
  referenceResult: null,
  controlResult: null,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_REFERENCE':
      return { ...state, step: 'control', referenceResult: action.payload };
    case 'SET_CONTROL':
      return { ...state, step: 'results', controlResult: action.payload };
    case 'GO_BACK':
      return {
        ...state,
        step: state.step === 'results' ? 'control' : 'reference',
        controlResult: state.step === 'results' ? null : state.controlResult,
      };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

export default function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const handleReferenceComplete = (result: DetectionResult) => {
    dispatch({ type: 'SET_REFERENCE', payload: result });
  };

  const handleControlComplete = (result: DetectionResult) => {
    dispatch({ type: 'SET_CONTROL', payload: result });
  };

  const handleBack = () => {
    dispatch({ type: 'GO_BACK' });
  };

  const handleReset = () => {
    dispatch({ type: 'RESET' });
  };

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-indigo-500/30">
              🔍
            </div>
            <span className="font-bold text-slate-100 text-base">ObjectTracker</span>
          </div>
          {state.step !== 'reference' && (
            <button
              onClick={handleReset}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Sıfırla
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        {state.step === 'reference' && (
          <ReferencePage onComplete={handleReferenceComplete} />
        )}

        {state.step === 'control' && state.referenceResult && (
          <ControlPage
            referenceResult={state.referenceResult}
            onComplete={handleControlComplete}
            onBack={handleBack}
          />
        )}

        {state.step === 'results' &&
          state.referenceResult &&
          state.controlResult && (
            <ResultsPage
              referenceResult={state.referenceResult}
              controlResult={state.controlResult}
              onReset={handleReset}
              onBack={handleBack}
            />
          )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-3">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <p className="text-xs text-slate-600">
            Mock Detection Servisi aktif — ileride FastAPI + YOLO11 + CLIP ile değiştirilecek
          </p>
        </div>
      </footer>
    </div>
  );
}
