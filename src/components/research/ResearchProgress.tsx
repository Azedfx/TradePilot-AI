import {
  Check,
  CheckCircle2,
  Clock3,
  Sparkles,
} from 'lucide-react';
import { NumberBadge } from '../ui/NumberBadge';
import { useResearch } from '@/lib/research-context';
import type { SkillStatus } from '@/lib/types';

const STEPS: { label: string; label2: string; skills?: string[] }[] = [
  { label: 'Understanding', label2: 'Your Question' },
  { label: 'Analyzing', label2: 'News & Sentiment', skills: ['news', 'sentiment'] },
  { label: 'Checking', label2: 'Market Conditions', skills: ['market'] },
  { label: 'Technical', label2: 'Analysis', skills: ['technical'] },
  { label: 'Macro', label2: 'Environment', skills: ['macro'] },
  { label: 'Building', label2: 'Your Thesis' },
];

const TASKS: { text: string; skill?: string }[] = [
  { text: 'Parsing your question', skill: 'plan' },
  { text: 'Analyzing latest news', skill: 'news' },
  { text: 'Checking market conditions', skill: 'market' },
  { text: 'Fundamentals & earnings', skill: 'fundamentals' },
  { text: 'Macro & global environment', skill: 'macro' },
  { text: 'Market sentiment & positioning', skill: 'sentiment' },
  { text: 'Technical indicators', skill: 'technical' },
];

type StepState = 'done' | 'active' | 'pending' | 'idle';

export function ResearchProgress() {
  const { session, running } = useResearch();
  const complete = session?.status === 'COMPLETED';
  const failed = session?.status === 'FAILED';
  const finished = complete || failed;

  const skillStatus = (name: string): SkillStatus | undefined =>
    session?.skills.find((s) => s.skillName === name)?.status;

  const hasSkills = !!session?.skills.length;
  // Planning is done once we have a session past PENDING, any skills, or a finished run.
  const planDone =
    finished ||
    hasSkills ||
    session?.status === 'PLANNING' ||
    session?.status === 'RESEARCHING' ||
    session?.status === 'ANALYZING' ||
    Boolean(session?.question);

  const stepState = (
    index: number,
    skills?: string[],
  ): StepState => {
    if (finished) return 'done';

    if (index === 0) {
      if (planDone && hasSkills) return 'done';
      if (running || session) return 'active';
      return 'idle';
    }

    if (index === 5) {
      if (session?.status === 'ANALYZING') return 'active';
      if (hasSkills && session?.skills.every((s) => s.status === 'COMPLETED' || s.status === 'FAILED')) {
        return running ? 'active' : 'done';
      }
      return hasSkills ? 'active' : running ? 'active' : 'idle';
    }

    if (!skills?.length) return 'pending';

    const statuses = skills.map(skillStatus);
    if (statuses.some((s) => s === 'RUNNING')) return 'active';
    // Only mark done when every expected skill has a terminal status.
    if (
      statuses.length > 0 &&
      statuses.every((s) => s === 'COMPLETED' || s === 'FAILED')
    ) {
      return 'done';
    }
    if (statuses.some((s) => s === 'COMPLETED' || s === 'FAILED' || s === 'PENDING')) {
      return 'active';
    }
    return hasSkills || running ? 'active' : 'pending';
  };

  const fillFraction = (() => {
    if (finished) return 1;
    const states = STEPS.map((s, i) => stepState(i, s.skills));
    const firstActive = states.indexOf('active');
    const lastDone = states.reduce(
      (acc, st, i) => (st === 'done' ? i : acc),
      -1,
    );
    const front =
      firstActive >= 0
        ? firstActive + 0.5
        : lastDone >= 0
          ? lastDone + 1
          : 0;
    return Math.max(0, Math.min(1, front / (STEPS.length - 1)));
  })();

  const taskDone = (skill?: string): boolean => {
    if (finished) return true;
    if (!skill || skill === 'plan') return planDone && (hasSkills || finished);
    const st = skillStatus(skill);
    return st === 'COMPLETED' || st === 'FAILED';
  };

  const taskActive = (skill?: string): boolean => {
    if (finished) return false;
    if (!skill || skill === 'plan') {
      return Boolean(running || session) && !taskDone(skill);
    }
    return skillStatus(skill) === 'RUNNING';
  };

  return (
    <section
      id="section-overview"
      className="relative scroll-mt-16 rounded-lg border border-[#173a5a] bg-[#071424]"
    >
      <NumberBadge number="3" />

      <div className="flex items-center justify-between border-b border-[#142b44] px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-5 w-5 items-center justify-center rounded-full border border-[#19c8ef]">
            <PlusIcon />
          </div>

          <span className="text-[12px] font-semibold">
            {complete
              ? 'Research Complete'
              : failed
                ? 'Research Failed'
                : 'Research in Progress'}
          </span>

          {complete ? (
            <span className="rounded bg-[#063e3e] px-2 py-1 text-[8px] font-semibold text-[#31e5bb]">
              Done
            </span>
          ) : hasSkills && !finished ? (
            <span className="rounded bg-[#063e3e] px-2 py-1 text-[8px] font-semibold text-[#31e5bb]">
              Live
            </span>
          ) : null}
        </div>

        <span className="flex items-center gap-1 text-[8px] text-[#71849a]">
          <Clock3 size={10} />
          {complete ? 'Finished' : running ? 'Running…' : '2–3 min'}
        </span>
      </div>

      <div className="px-5 pb-5 pt-6">
        {/* Timeline */}
        <div className="relative px-4">
          <div className="absolute left-[7%] right-[7%] top-3 h-px bg-[#29435f]" />

          <div
            className="absolute left-[7%] top-3 h-px bg-linear-to-r from-[#21d6c1] via-[#19c8ef] to-[#6b7fff] transition-[width] duration-700 ease-out"
            style={{ width: `${fillFraction * 86}%` }}
          />

          <span
            className="absolute top-1.75 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-[#7ef7e2] shadow-[0_0_12px_rgba(33,214,193,.9)] transition-[left] duration-700 ease-out"
            style={{ left: `${7 + fillFraction * 86}%` }}
          />

          <div className="relative flex justify-between">
            {STEPS.map((step, index) => {
              const st = stepState(index, step.skills);
              const done = st === 'done';
              const active = st === 'active';

              return (
                <div key={index} className="flex w-17.5 flex-col items-center">
                  <div
                    className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full border transition-all duration-300 ${
                      done
                        ? 'border-[#21d6c1] bg-[#1cd6c1]'
                        : active
                          ? 'border-[#6b7fff] bg-[#516bff] shadow-[0_0_15px_rgba(81,107,255,.5)]'
                          : 'border-[#27425e] bg-[#08182a]'
                    }`}
                  >
                    {done ? (
                      <Check size={12} className="anim-pop text-[#062c2b]" />
                    ) : active ? (
                      <>
                        <span className="absolute -inset-1.25 animate-ping rounded-full bg-[#19c8ef]/40" />
                        <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                      </>
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-[#47627f]" />
                    )}
                  </div>

                  <div
                    className={`mt-3 text-center text-[8px] leading-3 transition-colors duration-300 ${
                      active || done ? 'text-[#c4d4e6]' : 'text-[#788da5]'
                    }`}
                  >
                    {step.label}
                    <br />
                    {step.label2}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Activity box */}
        <div className="mt-5 rounded-lg border border-[#173756] bg-[#091b30] p-4">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-medium text-[#d9e8f8]">
            <Sparkles size={12} className="text-[#668dff]" />
            {complete
              ? 'Research complete — thesis generated.'
              : failed
                ? 'Research pipeline failed. Try again.'
                : hasSkills
                  ? 'Analyzing latest news and market sentiment…'
                  : running
                    ? 'Kicking off research pipeline…'
                    : 'Type a question and press Enter to start research.'}
          </div>

          {(hasSkills || running) && !finished ? (
            <div className="relative mb-3 h-0.5 overflow-hidden rounded-full bg-[#132b45]">
              <div className="load-sweep absolute inset-y-0 w-1/3 rounded-full bg-linear-to-r from-transparent via-[#19c8ef] to-transparent" />
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-x-8 gap-y-2 md:grid-cols-2">
            {TASKS.map((task) => (
              <ProgressTask
                key={task.text}
                text={task.text}
                done={taskDone(task.skill)}
                active={taskActive(task.skill)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function PlusIcon() {
  return (
    <span className="relative block h-2.5 w-2.5">
      <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[#21c9ed]" />
      <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-[#21c9ed]" />
    </span>
  );
}

function ProgressTask({
  text,
  done,
  active,
}: {
  text: string;
  done: boolean;
  active: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-[9px]">
      {done ? (
        <CheckCircle2 size={12} className="shrink-0 text-[#32d9c2]" />
      ) : (
        <span
          className={`flex h-3 w-3 shrink-0 items-center justify-center rounded-full border ${
            active ? 'border-[#6b7fff]' : 'border-[#344c67]'
          }`}
        >
          <span
            className={
              active
                ? 'h-1 w-1 animate-pulse rounded-full bg-[#8ea8ff]'
                : 'h-1 w-1 rounded-full bg-[#667b94]'
            }
          />
        </span>
      )}

      <span
        className={
          done
            ? 'text-[#d3e0ef]'
            : active
              ? 'text-[#a9bfff]'
              : 'text-[#70839a]'
        }
      >
        {text}
      </span>
    </div>
  );
}
