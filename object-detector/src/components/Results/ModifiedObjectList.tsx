import type { ModifiedObject } from '../../types/detection';
import { formatConfidence, getObjectDisplayName, getObjectEmoji } from '../../utils/diffUtils';
import { Badge } from '../UI/Badge';

interface ModifiedObjectListProps {
  objects: ModifiedObject[];
}

export function ModifiedObjectList({ objects }: ModifiedObjectListProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-amber-500" />
        <h3 className="text-base font-semibold text-slate-200">Değişmiş Nesneler</h3>
        <Badge variant="warning">{objects.length}</Badge>
      </div>

      {objects.length === 0 ? (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 px-4 py-6 text-center">
          <p className="text-slate-500 text-sm">Görünümü değişen nesne bulunmadı</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {objects.map((item) => (
            <div
              key={`${item.reference.id}-${item.current.id}`}
              className="flex items-start gap-3 px-4 py-3 rounded-xl bg-slate-800/80 border border-amber-500/25"
            >
              <div className="w-9 h-9 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center text-lg flex-shrink-0">
                {getObjectEmoji(item.current.label)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-200 truncate">
                  {getObjectDisplayName(item.current)}
                </p>
                <p className="text-xs text-amber-300 mt-0.5">{item.reason}</p>
                <p className="text-xs text-slate-500 mt-1">
                  Güven: {formatConfidence(item.current.confidence)} · Görsel benzerlik: {formatConfidence(item.visualSimilarity)}
                </p>
              </div>
              <Badge variant="warning">{formatConfidence(item.score)}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
