import { useCallback, useEffect, useState } from 'react';
import { ChevronRight, Clock3, ExternalLink } from 'lucide-react';
import { NumberBadge } from '../ui/NumberBadge';
import { useResearch } from '@/lib/research-context';

interface DisplayItem {
  id: string;
  symbol: string;
  description: string;
  time: string;
  status: 'complete' | 'pending';
}

const MAX_ITEMS = 5;

export function RecentResearch() {
  const { recent, refreshRecent, openSession } = useResearch();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    void refreshRecent();
  }, [refreshRecent]);

  const items: DisplayItem[] = recent.slice(0, MAX_ITEMS).map((r) => ({
    id: r.sessionId,
    symbol: r.symbol ?? 'UNKNOWN',
    description: r.question,
    time: timeAgo(r.createdAt),
    status: r.status === 'COMPLETED' ? 'complete' : 'pending',
  }));

  const onPick = useCallback((id: string) => {
    setSelectedId((cur) => (cur === id ? null : id));
  }, []);

  const selected = items.find((i) => i.id === selectedId) ?? null;

  return (
    <section className="relative rounded-lg border border-[#183651] bg-[#071424]">
      <NumberBadge number="4" />

      <div className="flex items-center justify-between border-b border-[#142c45] px-4 py-3">
        <h2 className="text-[13px] font-semibold">Recent Research</h2>
        <button
          onClick={() => void refreshRecent()}
          className="text-[9px] font-medium text-[#57d9ff]"
        >
          Refresh
        </button>
      </div>

      <div className="flex flex-col gap-3 p-3">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-[#27405e] bg-[#08182a] px-3 py-6 text-center">
            <Clock3 size={14} className="text-[#63778f]" />
            <p className="text-[9px] text-[#8ea2b8]">
              No research runs yet — ask a question to get started.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-1.5">
              {items.map((item) => (
                <CircleChip
                  key={item.id}
                  symbol={item.symbol}
                  status={item.status}
                  selected={item.id === selectedId}
                  onClick={() => onPick(item.id)}
                />
              ))}
            </div>

            {selected ? (
              <div className="anim-pop rounded-lg border border-[#1b3355] bg-[#0a1a2e] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[10px] font-semibold text-[#e3ebf4]">
                    {selected.symbol}
                  </p>
                  <span
                    className={`rounded px-2 py-0.5 text-[7px] font-semibold ${
                      selected.status === 'complete'
                        ? 'bg-[#06413f] text-[#39dcbf]'
                        : 'bg-[#1c3048] text-[#8298b2]'
                    }`}
                  >
                    {selected.status === 'complete'
                      ? 'Complete'
                      : 'In progress'}
                  </span>
                </div>

                <p className="mt-1.5 text-[9px] leading-4 text-[#8ea2b8]">
                  {selected.description}
                </p>

                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[8px] text-[#63778f]">
                    {selected.time}
                  </span>
                  <button
                    onClick={() => void openSession(selected.id)}
                    className="flex items-center gap-1 rounded-md bg-[#16304e] px-2 py-1 text-[8px] font-semibold text-[#57d9ff] transition hover:bg-[#1b3b5f]"
                  >
                    Open
                    <ChevronRight size={10} />
                    <ExternalLink size={9} />
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-center text-[8px] text-[#63778f]">
                Click a chip to see details
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function CircleChip({
  symbol,
  status,
  selected,
  onClick,
}: {
  symbol: string;
  status: 'complete' | 'pending';
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center gap-1.5"
    >
      <span
        className={`relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${
          selected
            ? 'border-[#21d6c1] bg-[#0d2b2e] shadow-[0_0_12px_rgba(33,214,193,.4)]'
            : 'border-[#24496d] bg-[#0a1a2e] group-hover:border-[#3a6e9d] hover:bg-[#0d1f37]'
        }`}
      >
        <span className="text-[11px] font-bold text-[#bcd3ea]">
          {logoMark(symbol)}
        </span>

        <span
          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#071424] ${
            status === 'complete' ? 'bg-[#21d6c1]' : 'bg-[#5184ff]'
          }`}
        />
      </span>

      <span
        className={`max-w-10 truncate text-[7px] font-semibold ${
          selected ? 'text-[#7ef7e2]' : 'text-[#71869f]'
        }`}
      >
        {symbol}
      </span>
    </button>
  );
}

function logoMark(symbol: string): string {
  const s = symbol.toLowerCase();
  if (s.includes('nvda')) return '◉';
  if (s.includes('tsla')) return 'T';
  if (s.includes('aapl')) return '';
  if (s.includes('msft')) return 'MS';
  if (s.includes('amzn')) return 'AZ';
  if (s.includes('meta')) return '∞';
  return symbol.slice(0, 2).toUpperCase();
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}