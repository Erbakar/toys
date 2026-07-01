import type { DetectionResult } from '../../types/detection';
import { PhotoPreview } from '../Camera/PhotoPreview';

interface ComparisonViewProps {
  reference: DetectionResult;
  current: DetectionResult;
}

export function ComparisonView({ reference, current }: ComparisonViewProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <PhotoPreview
        imageUrl={reference.imageUrl}
        objects={reference.objects}
        label="📷 Referans Fotoğraf"
        showBoundingBoxes={false}
      />
      <PhotoPreview
        imageUrl={current.imageUrl}
        objects={current.objects}
        label="📷 Güncel Fotoğraf"
        showBoundingBoxes={false}
      />
    </div>
  );
}
