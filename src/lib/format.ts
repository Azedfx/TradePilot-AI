export function fmtUsd(n?: number | null): string {
  if (n == null || Number.isNaN(n) || n === 0) return '—';
  return n >= 1000
    ? `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    : `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

export function fmtPct(n?: number | null, signed = false): string {
  if (n == null || Number.isNaN(n)) return '—';
  const prefix = signed && n > 0 ? '+' : '';
  return `${prefix}${n.toFixed(2)}%`;
}

export function humanize(s: string): string {
  return s
    .split(/[_-]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function biasLabel(direction: 'long' | 'short' | 'neutral'): string {
  if (direction === 'long') return 'Bullish';
  if (direction === 'short') return 'Bearish';
  return 'Neutral';
}