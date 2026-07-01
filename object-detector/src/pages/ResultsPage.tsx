import { useMemo } from 'react';
import type { DetectionResult } from '../types/detection';
import { computeDiff } from '../utils/diffUtils';
import { StatCard } from '../components/Results/StatCard';
import { ObjectList } from '../components/Results/ObjectList';
import { ComparisonView } from '../components/Results/ComparisonView';
import { Button } from '../components/UI/Button';

interface ResultsPageProps {
  referenceResult: DetectionResult;
  controlResult: DetectionResult;
  onReset: () => void;
  onBack: () => void;
}

export function ResultsPage({
  referenceResult,
  controlResult,
  onReset,
  onBack,
}: ResultsPageProps) {
  const diff = useMemo(
    () => computeDiff(referenceResult, controlResult),
    [referenceResult, controlResult]
  );

  const refCount = referenceResult.objects.length;
  const curCount = controlResult.objects.length;
  const removedCount = diff.removed.length;
  const addedCount = diff.added.length;

  return (
    <div className="flex flex-col gap-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 opacity-60">
          <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="text-sm text-slate-500">Referans</span>
        </div>
        <div className="flex-1 h-px bg-green-700/60" />
        <div className="flex items-center gap-1.5 opacity-60">
          <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="text-sm text-slate-500">Kontrol</span>
        </div>
        <div className="flex-1 h-px bg-green-700/60" />
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-indigo-400">Sonuç</span>
        </div>
      </div>

      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Karşılaştırma Sonuçları</h1>
        <p className="text-slate-400 text-sm mt-1">
          Referans ve kontrol fotoğrafları arasındaki farklar
        </p>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon="📷"
          label="Referans"
          value={refCount}
          subtitle="nesne sayısı"
        />
        <StatCard
          icon="📷"
          label="Güncel"
          value={curCount}
          subtitle="nesne sayısı"
          variant={curCount < refCount ? 'warning' : 'default'}
        />
        <StatCard
          icon="❌"
          label="Eksik"
          value={removedCount}
          variant={removedCount > 0 ? 'danger' : 'default'}
          subtitle={removedCount > 0 ? 'nesne kaldırıldı' : 'nesne eksilmedi'}
        />
        <StatCard
          icon="➕"
          label="Yeni"
          value={addedCount}
          variant={addedCount > 0 ? 'success' : 'default'}
          subtitle={addedCount > 0 ? 'nesne eklendi' : 'nesne eklenmedi'}
        />
      </div>

      {/* Summary banner */}
      {removedCount === 0 && addedCount === 0 ? (
        <div className="rounded-xl bg-green-950/40 border border-green-500/30 px-4 py-3 flex items-center gap-3">
          <span className="text-xl">✅</span>
          <div>
            <p className="text-sm font-semibold text-green-400">Değişiklik yok</p>
            <p className="text-xs text-slate-400">Tüm nesneler yerli yerinde.</p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-amber-950/40 border border-amber-500/30 px-4 py-3 flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-amber-400">
              {removedCount} nesne eksik{addedCount > 0 ? `, ${addedCount} yeni nesne` : ''}
            </p>
            <p className="text-xs text-slate-400">Tablodaki nesneler değişmiş.</p>
          </div>
        </div>
      )}

      {/* Photo comparison */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Fotoğraf Karşılaştırması
        </h2>
        <ComparisonView reference={referenceResult} current={controlResult} />
      </div>

      {/* Object lists */}
      {(removedCount > 0 || addedCount > 0) && (
        <div className="flex flex-col gap-5">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            Nesne Detayları
          </h2>
          <ObjectList
            title="Eksik Nesneler"
            objects={diff.removed}
            type="removed"
            emptyMessage="Hiçbir nesne kaldırılmadı"
          />
          <ObjectList
            title="Yeni Nesneler"
            objects={diff.added}
            type="added"
            emptyMessage="Yeni nesne eklenmedi"
          />
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col gap-3 pt-2">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={onReset}
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          }
        >
          Yeni Karşılaştırma
        </Button>
        <Button
          variant="secondary"
          size="md"
          fullWidth
          onClick={onBack}
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          }
        >
          Kontrol Fotoğrafını Güncelle
        </Button>
      </div>
    </div>
  );
}
