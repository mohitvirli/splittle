import { yesterdayOf } from './puzzles'

export type Tier = 4 | 3 | 2

/** Hardest last, so the row order reads as a taper. */
export const TIERS: readonly Tier[] = [4, 3, 2]

export type TiersWon = Record<Tier, boolean>

export interface Progress {
  /** The UTC day this stands for. Progress is per-puzzle, so it is always dated. */
  date: string
  tiersWon: TiersWon
  /** Consecutive days all three tiers were finished. */
  streak: number
  lastWonDate: string | null
}

const KEY = 'splittle.v2'

/** Days of finished puzzles worth keeping around. Long enough to survive a clock that is
 *  wrong for a while, short enough that the entry never grows without bound. */
const KEEP_DAYS = 30

interface Stored {
  streak: number
  lastWonDate: string | null
  days: Record<string, Partial<TiersWon>>
}

const noTiers = (): TiersWon => ({ 4: false, 3: false, 2: false })

export const emptyProgress = (date: string): Progress => ({
  date,
  tiersWon: noTiers(),
  streak: 0,
  lastWonDate: null,
})

function read(): Stored {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { streak: 0, lastWonDate: null, days: {} }
    const parsed = JSON.parse(raw) as Partial<Stored>
    return {
      streak: typeof parsed.streak === 'number' ? parsed.streak : 0,
      lastWonDate: typeof parsed.lastWonDate === 'string' ? parsed.lastWonDate : null,
      days: parsed.days && typeof parsed.days === 'object' ? parsed.days : {},
    }
  } catch {
    return { streak: 0, lastWonDate: null, days: {} }
  }
}

export function loadProgress(date: string): Progress {
  const stored = read()
  return {
    date,
    tiersWon: { ...noTiers(), ...stored.days[date] },
    streak: stored.streak,
    lastWonDate: stored.lastWonDate,
  }
}

export function saveProgress(progress: Progress): void {
  try {
    const stored = read()
    const cutoff = new Date(Date.parse(`${progress.date}T00:00:00Z`) - KEEP_DAYS * 86_400_000)
      .toISOString()
      .slice(0, 10)

    const days: Record<string, Partial<TiersWon>> = {}
    for (const [day, tiers] of Object.entries(stored.days)) {
      if (day >= cutoff) days[day] = tiers
    }
    days[progress.date] = progress.tiersWon

    const next: Stored = { streak: progress.streak, lastWonDate: progress.lastWonDate, days }
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Private browsing or a full quota. Losing a streak is not worth handling.
  }
}

export const allTiersWon = (progress: Progress): boolean =>
  TIERS.every((tier) => progress.tiersWon[tier])

/**
 * Bank the day, if it has just been finished.
 *
 * A day can only be banked once — replaying it does not extend the streak — and a gap of any
 * size restarts at 1 rather than resuming. Missing yesterday is the whole thing a streak is
 * for; forgiving it would leave the number meaning nothing.
 */
export function bankDay(progress: Progress): Progress {
  if (!allTiersWon(progress) || progress.lastWonDate === progress.date) return progress
  const continues = progress.lastWonDate === yesterdayOf(progress.date)
  return { ...progress, streak: continues ? progress.streak + 1 : 1, lastWonDate: progress.date }
}
