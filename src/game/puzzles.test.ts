import { describe, expect, it } from 'vitest'
import { POOL_ENDS_ON, poolSize, poolStart, puzzleForDate, todayUTC, yesterdayOf } from './puzzles'
import pool from './puzzles.json'
import { TARGETS, TIGHT, WIDE, commonWords, gameWords, inspect } from '../../scripts/solver.ts'

/**
 * The pool that actually shipped, re-solved from scratch.
 *
 * `generate-puzzles` already refused to write an unsolvable seed, but it only ran on the day
 * someone ran it. This runs on every build, so a seed that stops being solvable — a bumped
 * dictionary, a changed MIN_WORD_LENGTH, a tweak to how `resolve` picks a landing — fails
 * here instead of shipping as a day nobody can finish.
 */
describe('the shipped pool', () => {
  const accepted = gameWords()
  const tight = commonWords(TIGHT, accepted)
  const wide = commonWords(WIDE, accepted)

  it('has no duplicate seeds', () => {
    expect(new Set(pool.seeds).size).toBe(pool.seeds.length)
  })

  it.each(pool.seeds)('%s is a word the game accepts', (seed) => {
    expect(accepted.has(seed.toLowerCase())).toBe(true)
  })

  it.each(pool.seeds)('%s can be solved at every tier with common words', (seed) => {
    const report = inspect(seed, tight, wide)
    for (const target of TARGETS) {
      expect(report.wide[target].count, `${seed} has no ${target}-word chain`).toBeGreaterThan(0)
    }
  })

  /**
   * The pool running dry is the one failure the app cannot show you: `puzzleForDate` clamps,
   * so the last seed would quietly repeat every day from then on. This is the alarm.
   */
  it('still covers today', () => {
    expect(
      todayUTC() <= POOL_ENDS_ON,
      `pool ran out on ${POOL_ENDS_ON} — run: npm run puzzles`,
    ).toBe(true)
  })
})

describe('puzzleForDate', () => {
  it('walks the pool one seed per day', () => {
    expect(puzzleForDate(poolStart)).toEqual({ seed: pool.seeds[0], no: 1, date: poolStart })
    expect(puzzleForDate(POOL_ENDS_ON).no).toBe(poolSize)
    expect(puzzleForDate(POOL_ENDS_ON).seed).toBe(pool.seeds[poolSize - 1])
  })

  it('holds the ends rather than falling off them', () => {
    expect(puzzleForDate('2020-01-01').no).toBe(1)
    expect(puzzleForDate('2099-01-01').no).toBe(poolSize)
  })

  it('reads dates as UTC, not as the machine happens to be set', () => {
    // 23:30 UTC is already tomorrow in Delhi and still yesterday in Los Angeles. Everyone
    // gets the same puzzle regardless.
    expect(todayUTC(new Date('2026-08-06T23:30:00Z'))).toBe('2026-08-06')
    expect(todayUTC(new Date('2026-08-06T00:30:00Z'))).toBe('2026-08-06')
  })

  it('steps back a day across a month boundary', () => {
    expect(yesterdayOf('2026-08-01')).toBe('2026-07-31')
    expect(yesterdayOf('2027-01-01')).toBe('2026-12-31')
  })
})
