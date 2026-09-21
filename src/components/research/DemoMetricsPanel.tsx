'use client';

import { useEffect, useState } from 'react';
import { getMetrics, type DemoMetrics } from '@/lib/api';

/**
 * Compact validation strip for judges (Track 3 form part 3).
 * Pulled from GET /api/metrics — completed runs, human decisions, reviews.
 */
export function DemoMetricsPanel() {
  const [metrics, setMetrics] = useState<DemoMetrics | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const m = await getMetrics();
      if (!cancelled) setMetrics(m);
    };
    void load();
    const id = setInterval(() => void load(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!metrics) {
    return (
      <div className="mx-4 mb-4 rounded-lg border border-[#163755] bg-[#082039] p-3">
        <p className="text-[8px] font-semibold uppercase tracking-wide text-[#6f849d]">
          Demo metrics
        </p>
        <p className="mt-1 text-[8px] text-[#5f7189]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-4 mb-4 rounded-lg border border-[#163755] bg-[#082039] p-3">
      <p className="text-[8px] font-semibold uppercase tracking-wide text-[#79e4ff]">
        Demo metrics · Track 3
      </p>
      <p className="mt-0.5 text-[7px] text-[#6f849d]">{metrics.theme}</p>
      <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1.5 text-[8px]">
        <Metric label="Completed" value={String(metrics.completedSessions)} />
        <Metric
          label="Completion %"
          value={`${metrics.completionRatePct}%`}
        />
        <Metric label="Human calls" value={String(metrics.humanDecisions)} />
        <Metric
          label="Reviews"
          value={String(metrics.selfEvolutionReviews)}
        />
        <Metric label="Skill runs" value={String(metrics.skillRunsCompleted)} />
        <Metric label="Sessions" value={String(metrics.researchSessions)} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[7px] text-[#6f849d]">{label}</p>
      <p className="font-semibold text-[#dce7f3]">{value}</p>
    </div>
  );
}
