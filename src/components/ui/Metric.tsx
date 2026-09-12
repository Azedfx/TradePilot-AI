interface MetricProps {
  label: string;
  value: string;
  positive?: boolean;
  danger?: boolean;
  muted?: boolean;
}

export default function Metric({
  label,
  value,
  positive,
  danger,
  muted,
}: MetricProps) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-4">
      <p className="text-[10px] uppercase tracking-wider text-zinc-600">
        {label}
      </p>
      <p
        className={`mt-2 text-sm font-semibold ${
          positive
            ? 'text-emerald-400'
            : danger
              ? 'text-red-400'
              : muted
                ? 'text-zinc-500'
                : 'text-zinc-200'
        }`}
      >
        {value}
      </p>
    </div>
  );
}