import { yesterdayOf } from './puzzles'
import type { LandedWord } from '../engine/types'

export type Tier = 4 | 3 | 2

/** Hardest last, so the row order reads as a taper. */
export const TIERS: readonly Tier[] = [4, 3, 2]

export type TiersWon = Record<Tier, boolean>

/**
 * The chain played, per tier. Kept whole rather than as bare words: the share card masks the
 * seed's letters out of the ribbon, and which letters those are lives in `chunkEnd`/`landedAt`.
 */
export type Chains = Partial<Record<Tier, readonly LandedWord[]>>

export interface Progress {
  /** The UTC day this stands for. Progress is per-puzzle, so it is always dated. */
  date: string
  tiersWon: TiersWon
  chains: Chains
  /** Consecutive days all three tiers were finished. */
  streak: number
  lastWonDate: string | null
}

const KEY = 'splittle.v2'

/** Days of finished puzzles worth keeping around. Long enough to survive a clock that is
 *  wrong for a while, short enough that the entry never grows without bound. */
const KEEP_DAYS = 30

interface StoredDay {
  won: Partial<TiersWon>
  chains?: Chains
}

interface Stored {
  streak: number
  lastWonDate: string | null
  days: Record<string, StoredDay>
}

const noTiers = (): TiersWon => ({ 4: false, 3: false, 2: false })

export const emptyProgress = (date: string): Progress => ({
  date,
  tiersWon: noTiers(),
  chains: {},
  streak: 0,
  lastWonDate: null,
})

/**
 * A day as it is stored now, from a day as it may have been stored before.
 *
 * The first version of this key held the tier flags directly, with no room for the chains the
 * share card needs. Reading both shapes costs three lines and keeps a streak that is already
 * running from being thrown away over a format change.
 */
function asDay(value: unknown): StoredDay {
  if (!value || typeof value !== 'object') return { won: {} }
  const record = value as Record<string, unknown>
  if ('won' in record) return { won: (record.won ?? {}) as Partial<TiersWon>, chains: record.chains as Chains }
  return { won: record as Partial<TiersWon> }
}

function read(): Stored {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { streak: 0, lastWonDate: null, days: {} }
    const parsed = JSON.parse(raw) as Partial<Stored>
    const days: Record<string, StoredDay> = {}
    if (parsed.days && typeof parsed.days === 'object') {
      for (const [day, value] of Object.entries(parsed.days)) days[day] = asDay(value)
    }
    return {
      streak: typeof parsed.streak === 'number' ? parsed.streak : 0,
      lastWonDate: typeof parsed.lastWonDate === 'string' ? parsed.lastWonDate : null,
      days,
    }
  } catch {
    return { streak: 0, lastWonDate: null, days: {} }
  }
}

export function loadProgress(date: string): Progress {
  const stored = read()
  const day = stored.days[date]
  return {
    date,
    tiersWon: { ...noTiers(), ...day?.won },
    chains: day?.chains ?? {},
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

    const days: Record<string, StoredDay> = {}
    for (const [day, value] of Object.entries(stored.days)) {
      if (day >= cutoff) days[day] = value
    }
    days[progress.date] = { won: progress.tiersWon, chains: progress.chains }

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
