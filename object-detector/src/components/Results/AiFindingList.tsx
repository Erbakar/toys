import type { AiFinding } from '../../types/detection';
import { formatConfidence } from '../../utils/diffUtils';
import { Badge } from '../UI/Badge';

interface AiFindingListProps {
  findings: AiFinding[];
}

export function AiFindingList({ findings }: AiFindingListProps) {
  if (findings.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-indigo-400" />
        <h3 className="text-base font-semibold text-slate-200">Detaylı Görsel Analiz</h3>
        <Badge variant="info">{findings.length}</Badge>
      </div>

      <div className="flex flex-col gap-2">
        {findings.map((finding, index) => (
          <div
            key={`${finding.type}-${index}`}
            className="rounded-xl bg-indigo-950/30 border border-indigo-500/25 px-4 py-3"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/15 text-indigo-300 flex items-center justify-center flex-shrink-0">
                ✦
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-100">{finding.title}</p>
                <p className="text-xs text-slate-400 mt-1">{finding.detail}</p>
              </div>
              <Badge variant={finding.confidence >= 0.7 ? 'info' : 'warning'}>
                {formatConfidence(finding.confidence)}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
