import { FileText, Play, Sparkles } from 'lucide-react';
import { NumberBadge } from '../ui/NumberBadge';
import { useResearch } from '@/lib/research-context';

const TEMPLATES = [
  {
    title: 'Earnings Playbook',
    desc: 'Analyze a stock right after an earnings report.',
    prompt:
      'Should I consider buying NVDA after earnings? Analyze the current market environment, earnings expectations, technical structure, sentiment, and historical scenarios.',
    symbol: 'NVDA',
  },
  {
    title: 'Macro Regime Check',
    desc: 'Understand the macro backdrop for US equities.',
    prompt:
      'Analyze the US equity macro outlook for NVDA: rates, DXY, liquidity, and global risk sentiment. Is this a constructive environment for tech stocks?',
    symbol: 'NVDA',
  },
  {
    title: 'rToken Weekend Risk',
    desc: 'Stress the 7×24 rToken window vs US market hours.',
    prompt:
      'Analyze tokenized NVDA (rToken) risk when the US cash market is closed: weekend macro transmission, on-chain pricing, and how that differs from regular-session trading.',
    symbol: 'NVDA',
  },
  {
    title: 'Tech Stock Technicals',
    desc: 'Pure price-action analysis for a US stock.',
    prompt: 'Analyze AAPL technical structure, support/resistance, and trend direction.',
    symbol: 'AAPL',
  },
  {
    title: 'Position Sizing',
    desc: 'Stress-test a position under bear scenarios.',
    prompt: 'Run stress testing on a TSLA position: drawdowns, recovery time, and risk scenarios.',
    symbol: 'TSLA',
  },
  {
    title: 'Mega-Cap Fundamentals',
    desc: 'Assess a US stock across every research skill.',
    prompt:
      'Analyze MSFT across fundamentals, sentiment, macro, and technicals. Build an investment thesis.',
    symbol: 'MSFT',
  },
];

export function TemplatesView() {
  const { setQuestion, runResearch } = useResearch();

  return (
    <div className="p-2">
      <section className="relative rounded-lg border border-[#173a5a] bg-[#071424]">
        <NumberBadge number="4" />

        <div className="flex items-center justify-between border-b border-[#142b44] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-5 w-5 items-center justify-center rounded-full border border-[#19c8ef]">
              <FileText size={10} className="text-[#21c9ed]" />
            </div>
            <h2 className="text-[13px] font-semibold">Research Templates</h2>
          </div>

          <span className="text-[8px] text-[#71869f]">
            One-click research prompts
          </span>
        </div>

        <div className="p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {TEMPLATES.map((t) => (
              <button
                key={t.title}
                onClick={() => {
                  setQuestion(t.prompt);
                  void runResearch(t.prompt);
                }}
                className="flex flex-col items-start rounded-lg border border-[#112a43] bg-[#08182a] p-4 text-left transition hover:border-[#24496d] hover:bg-[#0b1e33]"
              >
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#163351] text-[#54d8ff]">
                    <Sparkles size={12} />
                  </div>
                  <span className="text-[10px] font-semibold text-[#dbe6f3]">
                    {t.title}
                  </span>
                  <span className="rounded bg-[#1c3048] px-1.5 py-0.5 text-[7px] font-semibold text-[#8298b2]">
                    {t.symbol}
                  </span>
                </div>

                <p className="text-[9px] leading-3.5 text-[#8fa2b7]">
                  {t.desc}
                </p>

                <div className="mt-4 flex items-center gap-1 text-[8px] font-semibold text-[#57d9ff]">
                  <Play size={10} />
                  Run research
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}