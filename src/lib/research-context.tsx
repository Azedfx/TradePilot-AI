'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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

export function ResearchProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<ViewId>('home');
  const [question, setQuestion] = useState('');
  const [session, setSession] = useState<ResearchSessionResponse | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<ResearchSummary[]>([]);

  const refreshRecent = useCallback(async () => {
    try {
      const items = await listResearch();
      setRecent(items);
    } catch {
      // Non-fatal; dashboard keeps whatever it has.
    }
  }, []);

  useEffect(() => {
    void refreshRecent();
  }, [refreshRecent]);

  const openSession = useCallback(
    async (id: string) => {
      setError(null);
      try {
        const s = await getResearch(id);
        setSession(s);
        setSessionId(id);
        setQuestion(s.question);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : 'Failed to load session',
        );
      }
    },
    [],
  );

  const clearSession = useCallback(() => {
    setSession(null);
    setSessionId(null);
    setError(null);
  }, []);

  const runResearch = useCallback(
    async (q?: string) => {
      const text = (q ?? question).trim();
      if (!text) return;
      if (running) return;

      setQuestion(text);
      setView('home');
      setRunning(true);
      setError(null);
      setSession(null);
      setSessionId(null);

      try {
        const { sessionId: id } = await startResearch(text);
        setSessionId(id);

        for (let i = 0; i < MAX_POLLS; i += 1) {
          await sleep(POLL_INTERVAL_MS);
          // The session may have been superseded.
          const s = await getResearch(id);
          setSession(s);
          if (s.status === 'COMPLETED' || s.status === 'FAILED') {
            break;
          }
          if (s.status === 'FAILED') {
            setError('Research pipeline failed. Please try again.');
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
    [question, running, refreshRecent],
  );

  return (
    <ResearchContext.Provider
      value={{
        view,
        navigate: setView,
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