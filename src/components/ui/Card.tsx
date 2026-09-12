import type { ReactNode } from 'react';

interface CardProps {
  title: string;
  subtitle?: string;
  headerRight?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function Card({
  title,
  subtitle,
  headerRight,
  children,
  className = '',
}: CardProps) {
  return (
    <section
      className={`hover-lift rounded-2xl border border-white/[0.08] bg-[#0c0f14] ${className}`}
    >
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {subtitle && <p className="mt-1 text-[11px] text-zinc-600">{subtitle}</p>}
        </div>
        {headerRight}
      </div>
      {children}
    </section>
  );
}