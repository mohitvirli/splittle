import pool from './puzzles.json'

export interface Puzzle {
  seed: string
  /** 1-based, and stable: puzzle No. 3 is the third seed in the pool, forever. */
  no: number
  /** The UTC day this puzzle belongs to, as YYYY-MM-DD. */
  date: string
}

const MS_PER_DAY = 86_400_000

const asUTC = (date: string): number => Date.parse(`${date}T00:00:00Z`)

/**
 * The day, in UTC.
 *
 * Local dates would put two players in different timezones on different puzzles at the same
 * moment, and make "yesterday" mean two things when a streak is being counted. One clock for
 * everyone is worth the midnight being in the wrong place for most of them.
 */
export const todayUTC = (now: Date = new Date()): string => now.toISOString().slice(0, 10)

export const yesterdayOf = (date: string): string =>
  new Date(asUTC(date) - MS_PER_DAY).toISOString().slice(0, 10)

/** The last day the pool covers. Past this the final puzzle repeats — see `puzzleForDate`. */
export const POOL_ENDS_ON = new Date(
  asUTC(pool.start) + (pool.seeds.length - 1) * MS_PER_DAY,
).toISOString().slice(0, 10)

/** Days of pool left after `date`. `puzzles.test.ts` fails the build when this runs low. */
export const daysRemaining = (date: string): number =>
  Math.floor((asUTC(POOL_ENDS_ON) - asUTC(date)) / MS_PER_DAY)

/**
 * Today's puzzle.
 *
 * A date outside the pool is clamped rather than thrown, because the alternative is a game
 * that goes blank the morning the seeds run out. Repeating the last puzzle is a visible
 * failure someone can fix; a crash on the first day of the gap is not. The pool-length test
 * is what makes sure nobody has to find out either way.
 */
export function puzzleForDate(date: string): Puzzle {
  const index = Math.floor((asUTC(date) - asUTC(pool.start)) / MS_PER_DAY)
  const clamped = Math.min(Math.max(index, 0), pool.seeds.length - 1)
  return { seed: pool.seeds[clamped], no: clamped + 1, date }
}

export const poolSize = pool.seeds.length
export const poolStart = pool.start
