import { ReactNode } from 'react';
import { NumberBadge } from './NumberBadge';

export function Panel({
  badge,
  title,
  right,
  children,
  className = 'border border-[#173a5a] bg-[#071424]',
}: {
  badge?: string;
  title?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`relative rounded-lg ${className}`}>
      {badge ? <NumberBadge number={badge} /> : null}
      {title || right ? (
        <div className="flex items-center justify-between border-b border-[#142b44] px-5 py-4">
          {title ? <div className="text-[13px] font-semibold">{title}</div> : <div />}
          {right}
        </div>
      ) : null}
      {children}
    </section>
  );
}