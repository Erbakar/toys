
interface StatCardProps {
  icon: string;
  label: string;
  value: number;
  variant?: 'default' | 'danger' | 'success' | 'warning';
  subtitle?: string;
}

const variantStyles = {
  default: {
    bg: 'bg-slate-800',
    border: 'border-slate-700/60',
    icon: 'bg-slate-700',
    value: 'text-slate-100',
  },
  danger: {
    bg: 'bg-red-950/40',
    border: 'border-red-500/30',
    icon: 'bg-red-500/20',
    value: 'text-red-400',
  },
  success: {
    bg: 'bg-green-950/40',
    border: 'border-green-500/30',
    icon: 'bg-green-500/20',
    value: 'text-green-400',
  },
  warning: {
    bg: 'bg-amber-950/40',
    border: 'border-amber-500/30',
    icon: 'bg-amber-500/20',
    value: 'text-amber-400',
  },
};

export function StatCard({ icon, label, value, variant = 'default', subtitle }: StatCardProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={[
        'rounded-2xl border p-4 flex flex-col gap-3',
        styles.bg,
        styles.border,
      ].join(' ')}
    >
      <div className={['w-10 h-10 rounded-xl flex items-center justify-center text-xl', styles.icon].join(' ')}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</p>
        <p className={['text-3xl font-bold mt-0.5', styles.value].join(' ')}>{value}</p>
        {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}
