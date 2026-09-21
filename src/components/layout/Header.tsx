'use client';

import { TradePilotLogo } from '../ui/TradePilotLogo';
import { RecentResearchMenu } from '../research/RecentResearchMenu';

export function Header() {
  return (
    <header className="fixed left-0 right-0 top-0 z-50 h-13 border-b border-[#19304c] bg-[#06101f]/95 backdrop-blur-xl">
      <div className="flex h-full items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center">
            <TradePilotLogo />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[19px] font-bold tracking-tight">
              TradePilot AI
            </span>

            <span className="h-5 w-px bg-[#29415d]" />

            <span className="hidden text-[11px] text-[#8296b0] sm:block">
              AI Research Desk for Smarter Trades
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <div className="hidden items-center gap-1.5 text-[9px] text-[#73869e] md:flex">
            <span>Powered by</span>
            <span className="font-bold text-[#e5edf7]">⚡Bitget</span>
          </div>

          <RecentResearchMenu />

          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[#4472a3] bg-[#a8d6ff] text-[9px] font-bold text-[#16385c]">
            JD
          </div>
        </div>
      </div>
    </header>
  );
}
