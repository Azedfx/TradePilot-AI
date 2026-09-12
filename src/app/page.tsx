'use client';

import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { HomeView } from '@/components/views/HomeView';
import { DeskView } from '@/components/views/DeskView';
import { MyResearchView } from '@/components/views/MyResearchView';
import { WatchlistView } from '@/components/views/WatchlistView';
import { TemplatesView } from '@/components/views/TemplatesView';
import {
  ResearchProvider,
  useResearch,
} from '@/lib/research-context';

export default function Home() {
  return (
    <ResearchProvider>
      <Shell />
    </ResearchProvider>
  );
}

function Shell() {
  const { view, navigate } = useResearch();

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#020814] text-white">
      <Header />

      <div className="flex min-h-screen pt-13">
        <Sidebar view={view} onNavigate={navigate} />

        <div className="ml-0 w-full lg:ml-48.5">
          {view === 'home' && <HomeView />}
          {view === 'desk' && <DeskView />}
          {view === 'my-research' && <MyResearchView />}
          {view === 'watchlist' && <WatchlistView />}
          {view === 'templates' && <TemplatesView />}
        </div>
      </div>
    </main>
  );
}