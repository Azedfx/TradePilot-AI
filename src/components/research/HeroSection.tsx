import {
  Activity,
  ArrowRight,
  BarChart3,
  Gauge,
  History,
  LineChart,
  Newspaper,
  Sparkles,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { NumberBadge } from '../ui/NumberBadge';
import { useResearch } from '@/lib/research-context';
import { loadDeskPreferences, saveDeskPreferences } from '@/lib/api';

const EXAMPLES = [
  { text: 'NVDA after earnings', prompt: 'Should I consider buying NVDA after earnings?' },
  { text: 'TSLA outlook', prompt: 'Analyze the TSLA outlook and major risks.' },
  { text: 'AAPL technical analysis', prompt: 'Analyze AAPL technical structure.' },
  { text: 'rToken weekend risk', prompt: 'Analyze tokenized NVDA (rToken) weekend risk vs US market hours.' },
];

export function HeroSection() {
  const { question, setQuestion, runResearch, running } = useResearch();
  const [riskAppetite, setRiskAppetite] = useState<
    'conservative' | 'balanced' | 'aggressive'
  >('balanced');
  const [focus, setFocus] = useState<
    'earnings' | 'macro' | 'technical' | 'rToken' | 'balanced'
  >('balanced');

  useEffect(() => {
    const prefs = loadDeskPreferences();
    if (prefs.riskAppetite) setRiskAppetite(prefs.riskAppetite);
    if (prefs.focus) setFocus(prefs.focus);
  }, []);

  useEffect(() => {
    saveDeskPreferences({ riskAppetite, focus });
  }, [riskAppetite, focus]);

  const submit = () => {
    void runResearch();
  };

  return (
    <section
      id="section-hero"
      className="relative min-h-81 scroll-mt-16 overflow-hidden rounded-lg border border-[#173b5c] bg-[radial-gradient(circle_at_72%_45%,rgba(12,76,120,.24),transparent_32%),linear-gradient(135deg,#061a30,#03101f)]"
    >
      {/* Decorative lines */}
      <div className="pointer-events-none absolute -right-12.5 -top-12.5 h-82.5 w-107.5 opacity-40">
        <div className="absolute inset-0 rounded-full border border-[#12476a]" />
        <div className="absolute inset-7.5 rounded-full border border-[#123c5d]" />
        <div className="absolute inset-16.25 rounded-full border border-[#0d3451]" />
        <div className="absolute inset-25 rounded-full border border-[#0d2d48]" />
      </div>

      <NumberBadge number="1" />

      <div className="relative z-10 p-7">
        <div className="mb-2 text-[10px] font-medium tracking-wide text-[#86b2db]">
          AI RESEARCH DESK
        </div>

        <h1 className="max-w-102.5 text-[26px] font-bold leading-[1.12] tracking-tight">
          Turn Questions into
          <br />
          Actionable Insights
        </h1>

        <p className="mt-2 max-w-112.5 text-[12px] leading-4.5 text-[#a5b6ca]">
          Get comprehensive market research powered by AI.
          <br />
          We analyze the data, find the signal, and give you the full picture —
          <br />
          so you can make the final call.
        </p>

        {/* Input */}
        <div className="mt-6 flex max-w-140 items-center gap-3 rounded-xl border border-[#355c83] bg-[#0b1d34]/90 p-3 shadow-[0_10px_35px_rgba(0,0,0,.25)]">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#163a68] text-[#83a9ff]">
            <Sparkles size={17} />
          </div>

          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            disabled={running}
            placeholder="Ask a research question… e.g. Should I buy NVDA ahead of earnings?"
            className="h-10 flex-1 resize-none bg-transparent text-[10px] leading-3.75 text-[#d7e4f3] outline-none placeholder:text-[#5f7189]"
          />

          <button
            onClick={submit}
            disabled={running}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#5e78ff] shadow-[0_0_20px_rgba(94,120,255,.45)] transition hover:scale-105 hover:bg-[#7088ff] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ArrowRight size={18} />
          </button>
        </div>

        <div className="mt-3 flex max-w-140 flex-wrap gap-3 text-[8px] text-[#8fa2b7]">
          <label className="flex items-center gap-1.5">
            Risk
            <select
              value={riskAppetite}
              onChange={(e) =>
                setRiskAppetite(
                  e.target.value as 'conservative' | 'balanced' | 'aggressive',
                )
              }
              className="rounded border border-[#355c83] bg-[#0b1d34] px-1.5 py-1 text-[#d7e4f3] outline-none"
            >
              <option value="conservative">Conservative</option>
              <option value="balanced">Balanced</option>
              <option value="aggressive">Aggressive</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            Focus
            <select
              value={focus}
              onChange={(e) =>
                setFocus(
                  e.target.value as
                    | 'earnings'
                    | 'macro'
                    | 'technical'
                    | 'rToken'
                    | 'balanced',
                )
              }
              className="rounded border border-[#355c83] bg-[#0b1d34] px-1.5 py-1 text-[#d7e4f3] outline-none"
            >
              <option value="balanced">Balanced</option>
              <option value="earnings">Earnings</option>
              <option value="macro">Macro</option>
              <option value="technical">Technical</option>
              <option value="rToken">rToken / 7×24</option>
            </select>
          </label>
        </div>

        {/* Examples */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-[9px] text-[#7e94ae]">Try example:</span>

          {EXAMPLES.map((ex) => (
            <ExampleButton
              key={ex.text}
              text={ex.text}
              onClick={() => setQuestion(ex.prompt)}
            />
          ))}
        </div>
      </div>

      {/* AI network */}
      <div className="absolute right-5 top-13.75 hidden h-57.5 w-61.25 lg:block">
        <NetworkLine className="left-10 top-22.5 w-18.75 rotate-8" />
        <NetworkLine className="left-26.25 top-13.25 w-15 -rotate-18" />
        <NetworkLine className="left-33.75 top-20.75 w-17.5 -rotate-5" />
        <NetworkLine className="left-25 top-31.5 w-20 rotate-24" />
        <NetworkLine className="left-10.75 top-33.75 w-18.75 -rotate-20" />
        <NetworkLine className="left-32.5 top-40 w-20 -rotate-28" />

        <div className="absolute left-24 top-18.75 flex h-14 w-14 items-center justify-center rounded-xl border border-[#29b7ed]/60 bg-[#124a78]/70 text-2xl font-semibold text-[#9ee8ff] shadow-[0_0_30px_rgba(31,159,222,.4)]">
          AI
        </div>

        <NetworkTag text="News" icon={<Newspaper size={9} />} className="left-8 top-3" />
        <NetworkTag text="Market" icon={<BarChart3 size={9} />} className="left-32.5 -top-2.5" />
        <NetworkTag text="Sentiment" icon={<Gauge size={9} />} className="-right-2.5 top-11.25" />
        <NetworkTag text="Macro" icon={<Activity size={9} />} className="right-5 top-26.25" />
        <NetworkTag text="Historical" icon={<History size={9} />} className="right-5 top-37.5" />
        <NetworkTag text="Technical" icon={<LineChart size={9} />} className="left-5 top-28.75" />
        <NetworkTag text="Macro" icon={<Activity size={9} />} className="left-0 top-15" />
      </div>
    </section>
  );
}

function NetworkLine({ className }: { className?: string }) {
  return (
    <div
      className={`absolute h-px origin-left bg-linear-to-r from-[#278cc0] to-transparent ${className}`}
    />
  );
}

function NetworkTag({
  text,
  icon,
  className,
}: {
  text: string;
  icon: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`absolute flex items-center gap-1 rounded-lg border border-[#1b6893] bg-[#071a2d]/90 px-2.5 py-1.5 text-[8px] text-[#b6cde1] ${className}`}
    >
      <span className="text-[#5ac8f1]">{icon}</span>
      {text}
    </div>
  );
}

function ExampleButton({
  text,
  onClick,
}: {
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border border-[#234765] bg-[#0b2037] px-3 py-1.5 text-[8px] text-[#94a9c1] transition hover:border-[#3d658a] hover:text-white"
    >
      {text}
    </button>
  );
}