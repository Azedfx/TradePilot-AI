import {
  Activity,
  BarChart3,
  Gauge,
  LineChart,
  Newspaper,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { NumberBadge } from '../ui/NumberBadge';
import { useResearch } from '@/lib/research-context';

const SKILLS: {
  name: string;
  key: string;
  description: string;
  icon: ReactNode;
}[] = [
  {
    name: 'News Briefing',
    key: 'news',
    description: 'Latest news, events, and narratives',
    icon: <Newspaper size={16} />,
  },
  {
    name: 'Market Intel',
    key: 'market',
    description: 'Market and institutional intelligence',
    icon: <BarChart3 size={16} />,
  },
  {
    name: 'Sentiment Analyst',
    key: 'sentiment',
    description: 'Sentiment, positioning, fear & greed',
    icon: <Gauge size={16} />,
  },
  {
    name: 'Macro Analyst',
    key: 'macro',
    description: 'Macro, rates, DXY, global markets',
    icon: <Activity size={16} />,
  },
  {
    name: 'Technical Analysis',
    key: 'technical',
    description: 'Indicators and chart analysis',
    icon: <LineChart size={16} />,
  },
];

export function ResearchSkills() {
  const { session } = useResearch();

  const stateFor = (key: string): 'done' | 'active' | 'pending' | 'idle' => {
    const s = session?.skills.find((s) => s.skillName === key);
    if (!s) return session ? 'pending' : 'idle';
    if (s.status === 'COMPLETED') return 'done';
    if (s.status === 'FAILED') return 'pending';
    if (s.status === 'RUNNING') return 'active';
    return 'pending';
  };

  return (
    <section className="relative rounded-lg border border-[#173a5a] bg-[#071424]">
      <NumberBadge number="2" />

      <div className="flex items-center justify-between border-b border-[#142b44] px-5 py-4">
        <h2 className="text-[13px] font-semibold">Research Skills</h2>

        <span className="text-[8px] text-[#71869f]">
          Powered by <span className="font-bold text-[#d9e7f5]">⚡Bitget</span>
        </span>
      </div>

      <div className="p-2">
        {SKILLS.map((skill) => (
          <SkillCard
            key={skill.name}
            skill={skill}
            state={stateFor(skill.key)}
            durationMs={
              session?.skills.find((s) => s.skillName === skill.key)
                ?.durationMs ?? null
            }
            summary={
              session?.skills.find((s) => s.skillName === skill.key)?.summary ??
              null
            }
          />
        ))}
      </div>
    </section>
  );
}

function SkillCard({
  skill,
  state,
  durationMs,
  summary,
}: {
  skill: { name: string; description: string; icon: ReactNode };
  state: 'done' | 'active' | 'pending' | 'idle';
  durationMs: number | null;
  summary?: string | null;
}) {
  const active = state === 'active';

  const badge = {
    done: {
      cls: 'bg-[#073b3b] text-[#43dcbf]',
      label: durationMs != null ? `${(durationMs / 1000).toFixed(0)}s` : 'Done',
    },
    active: {
      cls: 'bg-[#063e3e] text-[#31e5bb]',
      label: 'Running',
    },
    pending: {
      cls: 'bg-[#1c3048] text-[#8298b2]',
      label: 'Pending',
    },
    idle: {
      cls: 'bg-[#1c3048] text-[#8298b2]',
      label: 'Pending',
    },
  }[state];

  return (
    <div className="rounded-lg px-3 py-2.5 transition hover:bg-[#0b1d31]">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            active ? 'bg-[#466fff] text-white' : 'bg-[#28364e] text-[#a0b3cc]'
          }`}
        >
          {skill.icon}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold text-[#dbe6f3]">{skill.name}</p>
          <p className="truncate text-[8px] text-[#71869f]">
            {skill.description}
          </p>
        </div>

        <span className={`rounded-md px-2 py-1 text-[7px] font-semibold ${badge.cls}`}>
          {badge.label}
        </span>
      </div>

      {state === 'done' && summary ? (
        <p className="mt-2 line-clamp-2 pl-11 text-[8px] leading-3 text-[#8fa2b7]">
          {summary}
        </p>
      ) : null}
    </div>
  );
}