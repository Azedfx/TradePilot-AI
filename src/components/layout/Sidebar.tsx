import {
  Brain,
  FileText,
  Folder,
  Home,
  Search,
  Sparkles,
  Star,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { ViewId } from '@/lib/research-context';
import { DemoMetricsPanel } from '../research/DemoMetricsPanel';

const NAV_ITEMS: { view: ViewId; icon: ReactNode; label: string }[] = [
  { view: 'home', icon: <Home size={17} />, label: 'Home' },
  { view: 'desk', icon: <Search size={17} />, label: 'Research Desk' },
  { view: 'my-research', icon: <Folder size={17} />, label: 'My Research' },
  { view: 'watchlist', icon: <Star size={17} />, label: 'Watchlist' },
  { view: 'templates', icon: <FileText size={17} />, label: 'Templates' },
];

export function Sidebar({
  view,
  onNavigate,
}: {
  view: ViewId;
  onNavigate: (view: ViewId) => void;
}) {
  return (
    <aside className="fixed bottom-0 left-0 top-13 z-40 hidden w-48.5 border-r border-[#152b45] bg-[#05101f] lg:block">
      <div className="flex h-full flex-col">
        {/* Navigation */}
        <nav className="space-y-1 p-2">
          {NAV_ITEMS.map((item) => (
            <SidebarItem
              key={item.view}
              icon={item.icon}
              label={item.label}
              active={view === item.view}
              onClick={() => onNavigate(item.view)}
            />
          ))}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        <DemoMetricsPanel />

        {/* Tagline */}
        <div className="mx-4 mb-6 rounded-lg border border-[#163755] bg-[#082039] p-3">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles size={17} className="text-[#79e4ff]" />
            <div>
              <p className="text-[11px] font-semibold text-white">
                Trade Smarter
              </p>
              <p className="text-[11px] font-semibold text-white">
                Not Harder
              </p>
            </div>
          </div>

          <p className="text-[9px] leading-4 text-[#6f849d]">
            AI-powered research.
            <br />
            Human decisions.
          </p>
        </div>

        {/* Powered By */}
        <div className="mx-4 mb-4 border-t border-[#162b43] pt-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#103c67]">
              <Brain size={14} className="text-[#75dcff]" />
            </div>

            <div>
              <p className="text-[8px] text-[#71859d]">Built with</p>
              <p className="text-[10px] font-semibold text-[#e3edf8]">
                Bitget Research Skills
              </p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function SidebarItem({
  icon,
  label,
  active = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition ${
        active
          ? 'border border-[#1c3858] bg-[#132c4a] text-[#62e8f5]'
          : 'text-[#a0b0c3] hover:bg-[#0b1c30] hover:text-white'
      }`}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}