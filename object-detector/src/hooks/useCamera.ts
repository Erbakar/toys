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

  // Her startCamera çağrısına benzersiz bir ID atanır.
  // getUserMedia çözümlendiğinde ID eşleşmiyorsa başka bir çağrı
  // gelmiş ya da component unmount olmuş demektir → stream iptal edilir.
  const callIdRef = useRef(0);

  const [isSupported] = useState(() => !!(navigator.mediaDevices?.getUserMedia));
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<CameraFacing>('environment');

  const stopCamera = useCallback(() => {
    // Mevcut çağrıyı geçersiz kıl — devam eden getUserMedia varsa
    // çözümlendiğinde kendini sonlandıracak.
    callIdRef.current += 1;

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
      // Bu çağrının ID'si — yarış koşulu tespiti için
      callIdRef.current += 1;
      const myCallId = callIdRef.current;

      setIsLoading(true);
      setError(null);

      // Önceki stream'i temizle (callIdRef artırılmadan önce yapılmalı —
      // burada zaten artırdık, stopCamera içindeki artırma bunu geçersiz
      // kılmasın diye doğrudan stream'i durduruyoruz)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setIsActive(false);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });

        // getUserMedia beklerken stopCamera çağrıldı veya yeni bir
        // startCamera geldi → bu stream'i hemen durdur, işlemi bırak.
        if (myCallId !== callIdRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try {
            await videoRef.current.play();
          } catch (playErr) {
            // AbortError: element DOM'dan kaldırıldı ya da srcObject
            // değiştirildi — güvenle görmezden gelinebilir.
            if (playErr instanceof DOMException && playErr.name === 'AbortError') {
              return;
            }
            throw playErr;
          }
        }

        // Hâlâ geçerli çağrıysa state'i güncelle
        if (myCallId !== callIdRef.current) return;

        setFacing(facingMode);
        setIsActive(true);
      } catch (err) {
        if (myCallId !== callIdRef.current) return;

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
        if (myCallId === callIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [facing]
  );

  const switchCamera = useCallback(async () => {
    const next: CameraFacing = facing === 'environment' ? 'user' : 'environment';
    await startCamera(next);
  }, [facing, startCamera]);

  const capturePhoto = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !isActive) return null;

    const videoW = video.videoWidth;
    const videoH = video.videoHeight;
    const displayW = video.clientWidth;
    const displayH = video.clientHeight;

    // Video element'i object-cover ile gösteriliyor:
    // CSS'in uyguladığı kırpmayı hesaplayıp canvas'a aynısını uygula.
    // Böylece "ne görüyorsan onu çekmiş olursun".
    const scale = Math.max(displayW / videoW, displayH / videoH);
    const cropX = (videoW - displayW / scale) / 2;
    const cropY = (videoH - displayH / scale) / 2;
    const cropW = displayW / scale;
    const cropH = displayH / scale;

    canvas.width = Math.round(cropW);
    canvas.height = Math.round(cropH);

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.92);
  }, [isActive]);

  // Component unmount olduğunda stream'i temizle
  useEffect(() => {
    return () => {
      callIdRef.current += 1;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

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
