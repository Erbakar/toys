import { useEffect, useRef } from 'react';
import { Button } from '../UI/Button';
import type { UseCameraReturn } from '../../hooks/useCamera';
import { fileToDataUrl, isValidImageFile } from '../../utils/imageUtils';

interface CameraViewProps {
  camera: UseCameraReturn;
  onCapture: (dataUrl: string) => void;
  title: string;
  subtitle?: string;
}

export function CameraView({ camera, onCapture, title, subtitle }: CameraViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (camera.isSupported) {
      camera.startCamera();
    }
    return () => {
      camera.stopCamera();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCapture = () => {
    const dataUrl = camera.capturePhoto();
    if (dataUrl) onCapture(dataUrl);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isValidImageFile(file)) {
      alert('Lütfen geçerli bir resim dosyası seçin.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      onCapture(dataUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Dosya okunamadı.';
      alert(message);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-100">{title}</h2>
        {subtitle && <p className="text-slate-400 mt-1 text-sm">{subtitle}</p>}
      </div>

      {/* Camera area */}
      <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-700 aspect-[4/3] w-full">
        {camera.isSupported && !camera.error ? (
          <>
            <video
              ref={camera.videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {camera.isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
                <div className="flex flex-col items-center gap-3">
                  <svg
                    className="animate-spin h-8 w-8 text-indigo-400"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <p className="text-slate-400 text-sm">Kamera başlatılıyor...</p>
                </div>
              </div>
            )}
            {/* Viewfinder overlay */}
            {!camera.isLoading && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-6 border border-white/20 rounded-xl" />
                <div className="absolute top-6 left-6 w-6 h-6 border-t-2 border-l-2 border-indigo-400 rounded-tl-lg" />
                <div className="absolute top-6 right-6 w-6 h-6 border-t-2 border-r-2 border-indigo-400 rounded-tr-lg" />
                <div className="absolute bottom-6 left-6 w-6 h-6 border-b-2 border-l-2 border-indigo-400 rounded-bl-lg" />
                <div className="absolute bottom-6 right-6 w-6 h-6 border-b-2 border-r-2 border-indigo-400 rounded-br-lg" />
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-slate-500">
            {camera.error ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <p className="text-red-400 text-sm text-center px-4">{camera.error}</p>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-sm opacity-60">Kamera desteklenmiyor</p>
              </>
            )}
          </div>
        )}

        {/* Canvas for capture (hidden) */}
        <canvas ref={camera.canvasRef} className="hidden" />
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3">
        {camera.isSupported && !camera.error && (
          <div className="flex gap-3">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleCapture}
              disabled={!camera.isActive}
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
            >
              Fotoğraf Çek
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={camera.switchCamera}
              title="Kamerayı Değiştir"
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              }
            />
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-700" />
          <span className="text-slate-500 text-xs">veya</span>
          <div className="flex-1 h-px bg-slate-700" />
        </div>

        <Button
          variant="secondary"
          size="md"
          fullWidth
          onClick={() => fileInputRef.current?.click()}
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        >
          Dosyadan Yükle
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
