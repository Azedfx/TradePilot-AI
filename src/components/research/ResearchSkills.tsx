'use client';

import {
  Activity,
  BarChart3,
  ChevronDown,
  Gauge,
  LineChart,
  Newspaper,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { NumberBadge } from '../ui/NumberBadge';
import { useResearch } from '@/lib/research-context';
import type { FindingView } from '@/lib/types';
import { OPEN_SKILL_EVENT } from './AssetNavigation';

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
    description: 'News tone and market positioning',
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
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ skillKey?: string }>).detail;
      if (!detail?.skillKey) return;
      setOpenKey(detail.skillKey);
    };
    window.addEventListener(OPEN_SKILL_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_SKILL_EVENT, onOpen);
  }, []);

  const stateFor = (key: string): 'done' | 'active' | 'pending' | 'idle' => {
    const s = session?.skills.find((s) => s.skillName === key);
    if (!s) return session ? 'pending' : 'idle';
    if (s.status === 'COMPLETED') return 'done';
    if (s.status === 'FAILED') return 'pending';
    if (s.status === 'RUNNING') return 'active';
    return 'pending';
  };

  const findingsFor = (key: string): FindingView[] =>
    (session?.findings ?? []).filter((f) => f.category === key);

  return (
    <section
      id="section-skills"
      className="relative scroll-mt-16 rounded-lg border border-[#173a5a] bg-[#071424]"
    >
      <NumberBadge number="2" />

      <div className="flex items-center justify-between border-b border-[#142b44] px-5 py-4">
        <h2 className="text-[13px] font-semibold">Research Skills</h2>

        <span className="text-[8px] text-[#71869f]">
          Powered by <span className="font-bold text-[#d9e7f5]">⚡Bitget</span>
        </span>
      </div>

      <div className="p-2">
        {SKILLS.map((skill) => {
          const run = session?.skills.find((s) => s.skillName === skill.key);
          const state = stateFor(skill.key);
          const open = openKey === skill.key;
          const canOpen = state === 'done' || state === 'active' || Boolean(run?.summary);

          return (
            <SkillCard
              key={skill.name}
              skill={skill}
              state={state}
              durationMs={run?.durationMs ?? null}
              summary={run?.summary ?? null}
              error={run?.error ?? null}
              findings={findingsFor(skill.key)}
              open={open}
              canOpen={canOpen}
              onToggle={() => {
                if (!canOpen) return;
                setOpenKey((cur) => (cur === skill.key ? null : skill.key));
              }}
            />
          );
        })}
      </div>
    </section>
  );
}

function SkillCard({
  skill,
  state,
  durationMs,
  summary,
  error,
  findings,
  open,
  canOpen,
  onToggle,
}: {
  skill: { name: string; description: string; icon: ReactNode };
  state: 'done' | 'active' | 'pending' | 'idle';
  durationMs: number | null;
  summary?: string | null;
  error?: string | null;
  findings: FindingView[];
  open: boolean;
  canOpen: boolean;
  onToggle: () => void;
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
    <div
      className={`rounded-lg transition ${
        canOpen ? 'hover:bg-[#0b1d31]' : ''
      } ${open ? 'bg-[#0b1d31]' : ''}`}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={!canOpen}
        aria-expanded={open}
        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left ${
          canOpen
            ? 'cursor-pointer'
            : 'cursor-default opacity-80'
        }`}
      >
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

        {canOpen ? (
          <ChevronDown
            size={14}
            className={`shrink-0 text-[#7e94ae] transition-transform ${
              open ? 'rotate-180' : ''
            }`}
          />
        ) : null}
      </button>

      {!open && state === 'done' && summary ? (
        <p className="line-clamp-2 px-3 pb-2.5 pl-14 text-[8px] leading-3 text-[#8fa2b7]">
          {summary}
        </p>
      ) : null}

      {open ? (
        <div className="space-y-2 border-t border-[#142b44] px-3 py-3 pl-14">
          {summary ? (
            <p className="text-[9px] leading-3.5 text-[#b7c7d8]">{summary}</p>
          ) : error ? (
            <p className="text-[9px] leading-3.5 text-[#f05d65]">{error}</p>
          ) : (
            <p className="text-[9px] text-[#71869f]">
              {active ? 'Skill is still running…' : 'No summary for this skill yet.'}
            </p>
          )}

          {findings.length > 0 ? (
            <ul className="space-y-1.5">
              {findings.map((f, i) => (
                <li
                  key={`${f.title}-${i}`}
                  className="rounded-md border border-[#153653] bg-[#08172a] px-2.5 py-2"
                >
                  <p className="text-[8px] font-semibold text-[#9ec4e8]">
                    {f.title}
                  </p>
                  <p className="mt-1 text-[8px] leading-3 text-[#8fa2b7]">
                    {f.statement}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}

          {canOpen && !summary && !error && findings.length === 0 && !active ? (
            <p className="text-[8px] text-[#63778f]">
              Run research to populate this skill.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
