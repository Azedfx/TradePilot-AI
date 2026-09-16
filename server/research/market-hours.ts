export type UsMarketSession =
  | 'regular'
  | 'pre-market'
  | 'after-hours'
  | 'closed-overnight'
  | 'closed-weekend';

export interface UsMarketStatus {
  session: UsMarketSession;
  isRegularSessionOpen: boolean;
  /** Human-readable ET clock time, e.g. "Sat 14:32". */
  etClock: string;
  /** Human-readable description of when the next regular session opens. */
  nextOpenDescription: string;
}

/**
 * US cash-equity market status (NYSE/Nasdaq regular hours: 9:30-16:00 ET,
 * Mon-Fri), derived from wall-clock time in America/New_York. This is a
 * simplification — it does not account for market holidays — but it is
 * enough to flag the core S2 scenario: a tokenized US stock (rToken) keeps
 * pricing 24/7 on-chain while the underlying exchange is closed nights and
 * weekends, so a macro/news catalyst can land with no arb or halt window.
 */
export function usEquityMarketStatus(date: Date = new Date()): UsMarketStatus {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0') % 24;
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  const minutesOfDay = hour * 60 + minute;
  const etClock = `${weekday} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  const isWeekend = weekday === 'Sat' || weekday === 'Sun';
  const OPEN = 9 * 60 + 30; // 9:30
  const CLOSE = 16 * 60; // 16:00
  const PRE_OPEN = 4 * 60; // 4:00
  const AFTER_CLOSE = 20 * 60; // 20:00

  let session: UsMarketSession;
  if (isWeekend) {
    session = 'closed-weekend';
  } else if (minutesOfDay >= OPEN && minutesOfDay < CLOSE) {
    session = 'regular';
  } else if (minutesOfDay >= PRE_OPEN && minutesOfDay < OPEN) {
    session = 'pre-market';
  } else if (minutesOfDay >= CLOSE && minutesOfDay < AFTER_CLOSE) {
    session = 'after-hours';
  } else {
    session = 'closed-overnight';
  }

  return {
    session,
    isRegularSessionOpen: session === 'regular',
    etClock: `${etClock} ET`,
    nextOpenDescription: nextOpenDescription(weekday, minutesOfDay, OPEN),
  };
}

function nextOpenDescription(weekday: string, minutesOfDay: number, openMinutes: number): string {
  if (weekday !== 'Fri' && weekday !== 'Sat' && weekday !== 'Sun') {
    // Same day (weekday) but before/after regular hours.
    return minutesOfDay < openMinutes
      ? 'today at 9:30 ET'
      : 'tomorrow at 9:30 ET';
  }
  if (weekday === 'Fri' && minutesOfDay < openMinutes) {
    return 'today at 9:30 ET';
  }
  // Fri after close, Sat, or Sun -> next Monday.
  return 'Monday at 9:30 ET';
}
