import { HeroSection } from '../research/HeroSection';
import { RecentResearch } from '../research/RecentResearch';
import { ResearchProgress } from '../research/ResearchProgress';
import { ResearchSkills } from '../research/ResearchSkills';
import { AssetNavigation } from '../research/AssetNavigation';
import { ResearchThesis } from '../research/ResearchThesis';
import { AIConclusion } from '../research/AIConclusion';
import { useResearch } from '@/lib/research-context';

export function HomeView() {
  const { error } = useResearch();

  return (
    <div className="grid min-h-[calc(100vh-52px)] grid-cols-1 xl:grid-cols-[minmax(0,1fr)_350px]">
      {/* CENTER COLUMN */}
      <div className="min-w-0">
        {error ? (
          <div className="p-2">
            <div className="rounded-lg border border-[#5c2b34] bg-[#2a141b] px-4 py-3 text-[10px] text-[#f5a0a6]">
              {error}
            </div>
          </div>
        ) : null}

        {/* TOP: HERO + SKILLS */}
        <div className="grid grid-cols-1 gap-2 p-2 xl:grid-cols-[minmax(0,1fr)_300px]">
          <HeroSection />
          <ResearchSkills />
        </div>

        {/* MIDDLE: PROGRESS + RECENT RESEARCH */}
        <div className="grid grid-cols-1 gap-2 p-2 xl:grid-cols-[minmax(0,1fr)_300px]">
          <ResearchProgress />
          <RecentResearch />
        </div>

        {/* BOTTOM: ASSET NAV + THESIS */}
        <div className="grid grid-cols-1 gap-2 p-2 xl:grid-cols-[194px_minmax(0,1fr)]">
          <AssetNavigation />
          <div className="min-w-0">
            <ResearchThesis />
          </div>
        </div>
      </div>

      {/* RIGHT DESKTOP COLUMN */}
      <AIConclusion />
    </div>
  );
}