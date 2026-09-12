import { HeroSection } from '../research/HeroSection';
import { ResearchProgress } from '../research/ResearchProgress';
import { ResearchSkills } from '../research/ResearchSkills';
import { ResearchThesis } from '../research/ResearchThesis';
import { AIConclusion } from '../research/AIConclusion';
import { useResearch } from '@/lib/research-context';

export function DeskView() {
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

        <div className="p-2">
          <HeroSection />
        </div>

        <div className="grid grid-cols-1 gap-2 p-2 xl:grid-cols-[minmax(0,1fr)_350px]">
          <ResearchProgress />
          <ResearchSkills />
        </div>

        <div className="p-2">
          <ResearchThesis />
        </div>
      </div>

      <AIConclusion />
    </div>
  );
}