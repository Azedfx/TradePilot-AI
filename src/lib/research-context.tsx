'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import {
  getResearch,
  listResearch,
  startResearch,
  sleep,
} from './api';
import type {
  ResearchSessionResponse,
  ResearchSummary,
} from './types';

export type ViewId =
  | 'home'
  | 'desk'
  | 'my-research'
  | 'watchlist'
  | 'templates';

interface ResearchContextValue {
  view: ViewId;
  navigate: (view: ViewId) => void;
  question: string;
  setQuestion: (q: string) => void;
  session: ResearchSessionResponse | null;
  sessionId: string | null;
  running: boolean;
  error: string | null;
  runResearch: (q?: string) => Promise<void>;
  recent: ResearchSummary[];
  refreshRecent: () => Promise<void>;
  openSession: (sessionId: string) => Promise<void>;
  clearSession: () => void;
}

const ResearchContext = createContext<ResearchContextValue | null>(null);

const POLL_INTERVAL_MS = 1100;
const MAX_POLLS = 300;
const LAST_SESSION_KEY = 'tradepilot:lastSessionId';
const LAST_VIEW_KEY = 'tradepilot:lastView';

function readSessionFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  const fromUrl = new URLSearchParams(window.location.search).get('session');
  if (fromUrl) return fromUrl;
  try {
    return sessionStorage.getItem(LAST_SESSION_KEY);
  } catch {
    return null;
  }
}

function persistSessionId(id: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (id) sessionStorage.setItem(LAST_SESSION_KEY, id);
    else sessionStorage.removeItem(LAST_SESSION_KEY);
  } catch {
    // ignore
  }
  const url = new URL(window.location.href);
  if (id) url.searchParams.set('session', id);
  else url.searchParams.delete('session');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

function persistView(view: ViewId): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(LAST_VIEW_KEY, view);
  } catch {
    // ignore
  }
}

function readView(): ViewId {
  if (typeof window === 'undefined') return 'home';
  try {
    const v = sessionStorage.getItem(LAST_VIEW_KEY);
    if (
      v === 'home' ||
      v === 'desk' ||
      v === 'my-research' ||
      v === 'watchlist' ||
      v === 'templates'
    ) {
      return v;
    }
  } catch {
    // ignore
  }
  return 'home';
}

export function ResearchProvider({ children }: { children: ReactNode }) {
  const [view, setViewState] = useState<ViewId>('home');
  const [question, setQuestion] = useState('');
  const [session, setSession] = useState<ResearchSessionResponse | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<ResearchSummary[]>([]);
  const restoredRef = useRef(false);
  const activePollId = useRef<string | null>(null);

  const navigate = useCallback((next: ViewId) => {
    setViewState(next);
    persistView(next);
  }, []);

  const refreshRecent = useCallback(async () => {
    try {
      const items = await listResearch();
      setRecent(items);
    } catch {
      // Non-fatal; dashboard keeps whatever it has.
    }
  }, []);

  const openSession = useCallback(async (id: string) => {
    setError(null);
    try {
      const s = await getResearch(id);
      setSession(s);
      setSessionId(id);
      setQuestion(s.question);
      persistSessionId(id);
      // Show the research workspace after reload / reopen.
      setViewState('home');
      persistView('home');
    } catch (e) {
      setSession(null);
      setSessionId(null);
      persistSessionId(null);
      setError(e instanceof Error ? e.message : 'Failed to load session');
      throw e;
    }
  }, []);

  const clearSession = useCallback(() => {
    activePollId.current = null;
    setSession(null);
    setSessionId(null);
    setError(null);
    persistSessionId(null);
  }, []);

  // Restore last session + view after a browser refresh.
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    setViewState(readView());
    const id = readSessionFromLocation();
    if (!id) return;
    void openSession(id).catch(() => {
      persistSessionId(null);
    });
  }, [openSession]);

  useEffect(() => {
    void refreshRecent();
  }, [refreshRecent]);

  const runResearch = useCallback(
    async (q?: string) => {
      const text = (q ?? question).trim();
      if (!text) return;
      if (running) return;

      setQuestion(text);
      navigate('home');
      setRunning(true);
      setError(null);
      setSession(null);
      setSessionId(null);

      try {
        const { sessionId: id } = await startResearch(text);
        activePollId.current = id;
        setSessionId(id);
        persistSessionId(id);

        for (let i = 0; i < MAX_POLLS; i += 1) {
          await sleep(POLL_INTERVAL_MS);
          if (activePollId.current !== id) break;
          const s = await getResearch(id);
          if (activePollId.current !== id) break;
          setSession(s);
          if (s.status === 'COMPLETED' || s.status === 'FAILED') {
            if (s.status === 'FAILED') {
              setError('Research pipeline failed. Please try again.');
            }
            break;
          }
        }
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : 'Failed to start research. Is the backend running?',
        );
      } finally {
        setRunning(false);
        void refreshRecent();
      }
    },
    [question, running, refreshRecent, navigate],
  );

  return (
    <ResearchContext.Provider
      value={{
        view,
        navigate,
        question,
        setQuestion,
        session,
        sessionId,
        running,
        error,
        runResearch,
        recent,
        refreshRecent,
        openSession,
        clearSession,
      }}
    >
      {children}
    </ResearchContext.Provider>
  );
}

export function useResearch(): ResearchContextValue {
  const ctx = useContext(ResearchContext);
  if (!ctx) {
    throw new Error('useResearch must be used within a ResearchProvider');
  }
  return ctx;
}
