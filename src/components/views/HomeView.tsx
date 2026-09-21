import { HeroSection } from '../research/HeroSection';
import { ResearchProgress } from '../research/ResearchProgress';
import { ResearchSkills } from '../research/ResearchSkills';
import { AssetNavigation } from '../research/AssetNavigation';
import { ResearchThesis } from '../research/ResearchThesis';
import { SelfReview } from '../research/SelfReview';
import { AIConclusion } from '../research/AIConclusion';
import { useResearch } from '@/lib/research-context';

export function HomeView() {
  const { error } = useResearch();

  return (
    <div className="grid min-h-[calc(100vh-52px)] grid-cols-1 xl:grid-cols-[minmax(0,1fr)_350px]">
      <div className="min-w-0">
        {error ? (
          <div className="p-2">
            <div className="rounded-lg border border-[#5c2b34] bg-[#2a141b] px-4 py-3 text-[10px] text-[#f5a0a6]">
              {error}
            </div>
          </div>
        ) : null}

        {/* Ask + live skills */}
        <div className="grid grid-cols-1 gap-2 p-2 xl:grid-cols-[minmax(0,1fr)_300px]">
          <HeroSection />
          <ResearchSkills />
        </div>

        {/* Progress only — recent moved to header icon */}
        <div className="p-2">
          <ResearchProgress />
        </div>

        {/* Thesis workspace */}
        <div className="grid grid-cols-1 gap-2 p-2 xl:grid-cols-[194px_minmax(0,1fr)]">
          <AssetNavigation />
          <div className="min-w-0">
            <ResearchThesis />
          </div>
        </div>

        <div className="p-2">
          <SelfReview />
        </div>

        <div className="p-2 xl:hidden">
          <AIConclusion embedded />
        </div>
      </div>

      <AIConclusion />
    </div>
  );
}
