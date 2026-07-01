
interface CardProps {
  children: React.ReactNode;
  className?: string;
  glass?: boolean;
}

export function Card({ children, className = '', glass = false }: CardProps) {
  return (
    <div
      className={[
        'rounded-2xl border',
        glass
          ? 'bg-white/5 backdrop-blur-sm border-white/10'
          : 'bg-slate-800 border-slate-700/60',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function CardHeader({ children, className = '' }: CardHeaderProps) {
  return (
    <div className={['px-5 pt-5 pb-3', className].join(' ')}>{children}</div>
  );
}

export function CardBody({ children, className = '' }: CardHeaderProps) {
  return (
    <div className={['px-5 pb-5', className].join(' ')}>{children}</div>
  );
}
