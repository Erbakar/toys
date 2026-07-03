import { useState } from 'react';
import { CameraView } from '../components/Camera/CameraView';
import { PhotoPreview } from '../components/Camera/PhotoPreview';
import { Button } from '../components/UI/Button';
import { useCamera } from '../hooks/useCamera';
import { useDetection } from '../hooks/useDetection';
import { compressImageForApi } from '../utils/imageUtils';
import type { DetectionResult } from '../types/detection';

interface ReferencePageProps {
  onComplete: (result: DetectionResult) => void;
}

export function ReferencePage({ onComplete }: ReferencePageProps) {
  const camera = useCamera();
  const { isDetecting, error, detect } = useDetection();
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);

  const handleCapture = async (dataUrl: string) => {
    camera.stopCamera();
    const compressed = await compressImageForApi(dataUrl);
    setCapturedImage(compressed);
    const result = await detect(compressed);
    if (result) setDetectionResult(result);
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setDetectionResult(null);
    camera.startCamera();
  };

  const handleConfirm = () => {
    if (detectionResult) onComplete(detectionResult);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold">
            1
          </div>
          <span className="text-sm font-semibold text-indigo-400">Referans</span>
        </div>
        <div className="flex-1 h-px bg-slate-700" />
        <div className="flex items-center gap-1.5 opacity-40">
          <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 text-xs font-bold">
            2
          </div>
          <span className="text-sm text-slate-500">Kontrol</span>
        </div>
        <div className="flex-1 h-px bg-slate-700" />
        <div className="flex items-center gap-1.5 opacity-40">
          <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 text-xs font-bold">
            3
          </div>
          <span className="text-sm text-slate-500">Sonuç</span>
        </div>
      </div>

      {!capturedImage ? (
        <CameraView
          camera={camera}
          onCapture={handleCapture}
          title="Referans Fotoğraf"
          subtitle="Masadaki tüm nesneleri kapsayacak şekilde fotoğraf çekin"
        />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-100">Referans Fotoğraf</h2>
            <p className="text-slate-400 mt-1 text-sm">
              {isDetecting
                ? 'Nesneler algılanıyor...'
                : detectionResult
                ? `${detectionResult.objects.length} nesne algılandı`
                : 'Hazır'}
            </p>
          </div>

          <PhotoPreview
            imageUrl={capturedImage}
            objects={detectionResult?.objects}
            label="📷 Referans"
            onRetake={handleRetake}
          />

          {isDetecting && (
            <div className="flex flex-col items-center justify-center gap-3 py-4">
              <svg
                className="animate-spin h-5 w-5 text-indigo-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-slate-400 text-sm text-center px-4">
                Backend hazırlanıyor ve nesneler algılanıyor…
                <br />
                <span className="text-slate-500 text-xs">
                  Render free planda ilk istek 30–90 sn sürebilir — sayfayı kapatmayın
                </span>
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-red-950/40 border border-red-500/30 px-4 py-3 flex flex-col gap-3">
              <p className="text-red-400 text-sm">{error}</p>
              {capturedImage && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    const result = await detect(capturedImage);
                    if (result) setDetectionResult(result);
                  }}
                >
                  Tekrar Analiz Et
                </Button>
              )}
            </div>
          )}

          {detectionResult && (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleConfirm}
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              }
            >
              Kontrol Fotoğrafına Geç
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
