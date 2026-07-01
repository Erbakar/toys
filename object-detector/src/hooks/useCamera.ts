import { useState, useRef, useCallback, useEffect } from 'react';

export type CameraFacing = 'user' | 'environment';

export interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isSupported: boolean;
  isActive: boolean;
  isLoading: boolean;
  error: string | null;
  facing: CameraFacing;
  startCamera: (facing?: CameraFacing) => Promise<void>;
  stopCamera: () => void;
  switchCamera: () => Promise<void>;
  capturePhoto: () => string | null;
}

export function useCamera(): UseCameraReturn {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isSupported] = useState(() => !!(navigator.mediaDevices?.getUserMedia));
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<CameraFacing>('environment');

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  }, []);

  const startCamera = useCallback(
    async (facingMode: CameraFacing = facing) => {
      setIsLoading(true);
      setError(null);

      try {
        stopCamera();

        const constraints: MediaStreamConstraints = {
          video: {
            facingMode,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setFacing(facingMode);
        setIsActive(true);
      } catch (err) {
        const message =
          err instanceof DOMException
            ? err.name === 'NotAllowedError'
              ? 'Kamera izni reddedildi. Lütfen kamera erişimine izin verin.'
              : err.name === 'NotFoundError'
              ? 'Kamera bulunamadı.'
              : `Kamera hatası: ${err.message}`
            : 'Kamera başlatılamadı.';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [facing, stopCamera]
  );

  const switchCamera = useCallback(async () => {
    const next: CameraFacing = facing === 'environment' ? 'user' : 'environment';
    await startCamera(next);
  }, [facing, startCamera]);

  const capturePhoto = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !isActive) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.92);
  }, [isActive]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    videoRef,
    canvasRef,
    isSupported,
    isActive,
    isLoading,
    error,
    facing,
    startCamera,
    stopCamera,
    switchCamera,
    capturePhoto,
  };
}
