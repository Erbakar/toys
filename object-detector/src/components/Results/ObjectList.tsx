import type { DetectedObject } from '../../types/detection';
import { getObjectDisplayName, getObjectEmoji, formatConfidence } from '../../utils/diffUtils';
import { Badge } from '../UI/Badge';

interface ObjectListProps {
  title: string;
  objects: DetectedObject[];
  type: 'removed' | 'added';
  emptyMessage?: string;
}

export function ObjectList({ title, objects, type, emptyMessage }: ObjectListProps) {
  const isRemoved = type === 'removed';
  const badgeVariant = isRemoved ? 'danger' : 'success';
  const iconBg = isRemoved ? 'bg-red-500/15 text-red-400' : 'bg-green-500/15 text-green-400';
  const dot = isRemoved
    ? 'bg-red-500'
    : 'bg-green-500';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className={['w-2 h-2 rounded-full', dot].join(' ')} />
        <h3 className="text-base font-semibold text-slate-200">{title}</h3>
        <Badge variant={badgeVariant}>{objects.length}</Badge>
      </div>

      {objects.length === 0 ? (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 px-4 py-6 text-center">
          <p className="text-slate-500 text-sm">{emptyMessage ?? 'Nesne yok'}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {objects.map((obj) => (
            <div
              key={obj.id}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-700/50"
            >
              <div
                className={[
                  'w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0',
                  iconBg,
                ].join(' ')}
              >
                {getObjectEmoji(obj.label)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-200 truncate">
                  {getObjectDisplayName(obj)}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Güven: {formatConfidence(obj.confidence)}
                </p>
              </div>
              <Badge variant={badgeVariant}>
                {isRemoved ? '−' : '+'}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
