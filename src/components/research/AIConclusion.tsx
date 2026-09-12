import { FileText, Search, Sparkles } from 'lucide-react';
import { NumberBadge } from '../ui/NumberBadge';
import { useResearch } from '@/lib/research-context';
import type { ResearchSessionResponse } from '@/lib/types';

interface Evidence {
  icon: string;
  title: string;
  source: string;
  time: string;
  positive?: boolean;
  warning?: boolean;
  blue?: boolean;
}

export function AIConclusion() {
  const { session } = useResearch();
  const thesis = session?.thesis;
  const done = session?.status === 'COMPLETED';

  const conclusion =
    thesis?.rationale ??
      'Run a research prompt to generate an AI conclusion. The system pulls from news, market data, and historical scenarios before summarizing a recommended direction.';

  const evidence = buildEvidence(session);

  return (
    <aside className="hidden border-l border-[#142d47] bg-[#04101e] xl:block">
      {/* AI Conclusion */}
      <section className="relative border-b border-[#17324d] p-5">
        <NumberBadge number="7" />

        <div className="mb-4 flex items-center gap-2">
          <Sparkles size={15} className="text-[#7298ff]" />
          <h2 className="text-[13px] font-semibold text-[#dce8f7]">
            AI Conclusion
          </h2>
        </div>

        <p className="text-[10px] leading-4.25 text-[#a8b9cc]">
          {conclusion}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            disabled={!done}
            className="flex items-center justify-center gap-1 rounded-md bg-[#6177ff] py-2.5 text-[9px] font-semibold text-white shadow-[0_5px_20px_rgba(79,95,220,.25)] hover:bg-[#7185ff] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FileText size={10} />
            Save Thesis
          </button>

          <button
            disabled={!done}
            className="rounded-md border border-[#35506d] py-2.5 text-[9px] font-medium text-[#a5b6ca] hover:bg-[#0b1c30] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Reject Thesis
          </button>
        </div>
      </section>

      {/* Evidence */}
      <section className="relative p-5">
        <NumberBadge number="8" />

        <div className="mb-4 flex items-center gap-2">
          <Search size={14} className="text-[#67b9ff]" />
          <h2 className="text-[13px] font-semibold">Key Evidence</h2>
        </div>

        {evidence.length ? (
          evidence.map((e) => <EvidenceItem key={e.title} {...e} />)
        ) : (
          <p className="text-[9px] leading-3.5 text-[#5f7189]">
            Key evidence from the live research run will appear here once data is
            returned by the skills.
          </p>
        )}
      </section>
    </aside>
  );
}

function buildEvidence(
  session: ResearchSessionResponse | null,
): Evidence[] {
  const catalysts = (session?.thesis?.catalysts ?? [])
    .map((c) => typeof c === 'string' ? c : String((c as { title?: string })?.title ?? ''))
    .filter(Boolean);
  const risks = (session?.thesis?.risks ?? [])
    .map((r) => typeof r === 'string' ? r : String((r as { title?: string })?.title ?? ''))
    .filter(Boolean);
  const md = session?.marketData;

  const list: Evidence[] = [];

  if (md?.price) {
    list.push({
      icon: '◉',
      title: `${session?.symbol ?? 'Asset'} trading at $${md.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}${(md.change24h ?? 0) >= 0 ? ' (+' : ' ('}${(md.change24h ?? 0).toFixed(2)}% 24h)`,
      source: 'Live market data',
      time: 'real-time',
      blue: true,
    });
  }

  catalysts.slice(0, 2).forEach((c) => {
    list.push({ icon: '✓', title: c, source: 'Research findings', time: 'live', positive: true });
  });

  risks.slice(0, 2).forEach((r) => {
    list.push({ icon: '✗', title: r, source: 'Risk analysis', time: 'live', warning: true });
  });

  if (!list.length) {
    return [];
  }

  return list;
}

function EvidenceItem({
  icon,
  title,
  source,
  time,
  positive,
  warning,
  blue,
}: {
  icon: string;
  title: string;
  source: string;
  time: string;
  positive?: boolean;
  warning?: boolean;
  blue?: boolean;
}) {
  return (
    <div className="mb-3 flex gap-3">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[12px] font-semibold ${
          positive
            ? 'bg-[#075044] text-[#3bdbbc]'
            : warning
              ? 'bg-[#513024] text-[#ef805d]'
              : blue
                ? 'bg-[#253c75] text-[#789dff]'
                : 'bg-[#23344a] text-[#88a0bb]'
        }`}
      >
        {icon}
      </div>

      <div className="min-w-0">
        <p className="text-[9px] leading-3.5 text-[#c9d6e5]">{title}</p>
        <p className="mt-1 text-[8px] text-[#6f849d]">
          Source: {source} | {time}
        </p>
      </div>
    </div>
  );
}