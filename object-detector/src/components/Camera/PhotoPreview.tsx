import { useState } from 'react';
import type { DetectedObject } from '../../types/detection';
import { Button } from '../UI/Button';

interface PhotoPreviewProps {
  imageUrl: string;
  objects?: DetectedObject[];
  label: string;
  showBoundingBoxes?: boolean;
  onRetake?: () => void;
}

export function PhotoPreview({
  imageUrl,
  objects = [],
  label,
  showBoundingBoxes = false,
  onRetake,
}: PhotoPreviewProps) {
  const [showBoxes, setShowBoxes] = useState(showBoundingBoxes);
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-300">{label}</span>
        <div className="flex items-center gap-2">
          {objects.length > 0 && (
            <button
              onClick={() => setShowBoxes((v: boolean) => !v)}
              className={[
                'text-xs px-2.5 py-1 rounded-lg border transition-colors cursor-pointer',
                showBoxes
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                  : 'bg-slate-700 text-slate-400 border-slate-600',
              ].join(' ')}
            >
              {showBoxes ? 'Kutuları Gizle' : 'Kutuları Göster'}
            </button>
          )}
          {onRetake && (
            <Button variant="ghost" size="sm" onClick={onRetake}>
              Yeniden Çek
            </Button>
          )}
        </div>
      </div>

      <div className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-700">
        <img
          src={imageUrl}
          alt={label}
          className="w-full h-auto"
          onLoad={handleImageLoad}
        />

        {/* Bounding boxes overlay */}
        {showBoxes && objects.length > 0 && (
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
            preserveAspectRatio="none"
          >
            {objects.map((obj) => {
              const { x, y, width, height } = obj.boundingBox;
              const px = x * imageSize.width;
              const py = y * imageSize.height;
              const pw = width * imageSize.width;
              const ph = height * imageSize.height;

              return (
                <g key={obj.id}>
                  <rect
                    x={px}
                    y={py}
                    width={pw}
                    height={ph}
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth="2"
                    rx="4"
                  />
                  <rect
                    x={px}
                    y={py - 20}
                    width={Math.max(pw, obj.label.length * 7 + 8)}
                    height={20}
                    fill="#6366f1"
                    rx="3"
                  />
                  <text
                    x={px + 4}
                    y={py - 6}
                    fill="white"
                    fontSize="11"
                    fontWeight="600"
                  >
                    {obj.label}
                  </text>
                </g>
              );
            })}
          </svg>
        )}

        {/* Object count badge */}
        {objects.length > 0 && (
          <div className="absolute bottom-2 right-2">
            <span className="bg-slate-900/80 backdrop-blur-sm text-slate-300 text-xs px-2.5 py-1 rounded-full border border-slate-700 font-semibold">
              {objects.length} nesne
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
