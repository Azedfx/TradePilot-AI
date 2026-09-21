'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock3, History } from 'lucide-react';
import { useResearch } from '@/lib/research-context';

/**
 * Compact recent-runs control for the header — keeps the home desk less crowded.
 */
export function RecentResearchMenu() {
  const { recent, refreshRecent, openSession, navigate } = useResearch();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void refreshRecent();
  }, [refreshRecent]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const items = recent.slice(0, 6);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Recent research"
        className={`relative flex h-7 w-7 items-center justify-center rounded-md border transition ${
          open
            ? 'border-[#2a6a8a] bg-[#0d2a3a] text-[#57d9ff]'
            : 'border-[#29415d] bg-[#0a1828] text-[#8ea2b8] hover:border-[#3a6e9d] hover:text-[#d9e7f5]'
        }`}
      >
        <History size={14} />
        {items.length > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#21d6c1] px-0.5 text-[7px] font-bold text-[#04201c]">
            {Math.min(items.length, 9)}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-9 z-50 w-72 rounded-lg border border-[#1b3355] bg-[#071424] shadow-[0_12px_40px_rgba(0,0,0,.45)]">
          <div className="flex items-center justify-between border-b border-[#142c45] px-3 py-2">
            <p className="text-[10px] font-semibold text-[#dbe6f3]">
              Recent research
            </p>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate('my-research');
              }}
              className="text-[8px] font-medium text-[#57d9ff] hover:underline"
            >
              View all
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto p-1.5">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 px-3 py-6 text-center">
                <Clock3 size={14} className="text-[#63778f]" />
                <p className="text-[9px] text-[#8ea2b8]">No runs yet</p>
              </div>
            ) : (
              items.map((r) => (
                <button
                  key={r.sessionId}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    void openSession(r.sessionId);
                  }}
                  className="flex w-full flex-col gap-0.5 rounded-md px-2.5 py-2 text-left hover:bg-[#0d1f37]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold text-[#e3ebf4]">
                      {r.symbol ?? '—'}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[7px] font-semibold ${
                        r.status === 'COMPLETED'
                          ? 'bg-[#06413f] text-[#39dcbf]'
                          : 'bg-[#1c3048] text-[#8298b2]'
                      }`}
                    >
                      {r.status === 'COMPLETED' ? 'Done' : 'Running'}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-[8px] leading-3 text-[#8ea2b8]">
                    {r.question}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
