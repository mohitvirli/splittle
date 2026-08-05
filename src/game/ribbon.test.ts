import { describe, expect, it } from 'vitest'
import { mask, seedPositions, shareText, weld } from './ribbon'
import type { LandedWord } from '../engine/types'

const played = (word: string, from: number, chunkEnd: number, landedAt: number): LandedWord => ({
  word,
  from,
  chunkEnd,
  landedAt,
})

// SPIT · TWO · OPEN · NICE on STONE — the joins land on T, O and N.
const STONE_4 = [played('SPIT', 0, 0, 1), played('TWO', 1, 1, 2), played('OPEN', 2, 2, 3), played('NICE', 3, 3, 4)]
// CONTROL · LIKE · EXTRA · ACTION on CLEAN, and the shorter chains for the same seed.
const CLEAN_4 = [
  played('CONTROL', 0, 0, 1),
  played('LIKE', 1, 1, 2),
  played('EXTRA', 2, 2, 3),
  played('ACTION', 3, 3, 4),
]
// EASTERN opens on the chunk EA, not on E alone — two seed letters at the front of one word.
const CLEAN_3 = [played('CONTROL', 0, 0, 1), played('LIKE', 1, 1, 2), played('EASTERN', 2, 3, 4)]
// LEARN opens on LEA, which is what a pivot-only mask gets wrong.
const CLEAN_2 = [played('CONTROL', 0, 0, 1), played('LEARN', 1, 3, 4)]

describe('weld', () => {
  it('joins the chain one letter deep at each pivot', () => {
    expect(weld(STONE_4)).toBe('SPITWOPENICE')
    expect(weld(CLEAN_4)).toBe('CONTROLIKEXTRACTION')
    expect(weld(CLEAN_2)).toBe('CONTROLEARN')
  })

  it('leaves a single word alone', () => {
    expect(weld([played('PLANT', 0, 0, 4)])).toBe('PLANT')
  })
})

describe('mask', () => {
  it('leaves the seed standing and blocks the rest', () => {
    expect(mask(STONE_4)).toBe('S██T█O██N██E')
    expect(mask(CLEAN_4)).toBe('C█████L██E███A████N')
    expect(mask(CLEAN_3)).toBe('C█████L██EA████N')
    expect(mask(CLEAN_2)).toBe('C█████LEA█N')
  })

  it('spells the seed out in order, and nothing else', () => {
    expect([...mask(CLEAN_4)].filter((c) => c !== '█').join('')).toBe('CLEAN')
    expect([...mask(CLEAN_2)].filter((c) => c !== '█').join('')).toBe('CLEAN')
  })

  it('keeps the ribbon the length it really is', () => {
    for (const chain of [STONE_4, CLEAN_4, CLEAN_3, CLEAN_2]) {
      expect(mask(chain)).toHaveLength(weld(chain).length)
    }
  })

  /* Playing the same opener into fewer words pulls the seed's letters together, which is what
     makes one player's three rows read as a set. It is not a law about tiers: a 4-word chain of
     short words is a shorter ribbon than a 3-word chain of long ones, so the rows do not always
     tighten downward. What is guaranteed is that two players' rows differ, which is the point. */
  it('bunches the seed letters together as the same opener is played into fewer words', () => {
    const spread = (chain: readonly LandedWord[]) => {
      const at = seedPositions(chain)
      return at[at.length - 1] - at.length + 1
    }
    expect(spread(CLEAN_4)).toBeGreaterThan(spread(CLEAN_3))
    expect(spread(CLEAN_3)).toBeGreaterThan(spread(CLEAN_2))
  })
})

describe('shareText', () => {
  it('leads with the puzzle number and masks by default', () => {
    expect(shareText(1, { 4: CLEAN_4, 3: CLEAN_3, 2: CLEAN_2 })).toBe(
      ['splittle No. 1', 'C█████L██E███A████N', 'C█████L██EA████N', 'C█████LEA█N'].join('\n'),
    )
  })

  it('carries the real words only once revealed', () => {
    const revealed = shareText(1, { 4: CLEAN_4, 3: CLEAN_3, 2: CLEAN_2 }, true)
    expect(revealed).toContain('CONTROLEARN')
    expect(revealed).not.toContain('█')
  })

  it('skips a tier with no chain rather than leaving a hole', () => {
    expect(shareText(2, { 4: CLEAN_4 })).toBe(['splittle No. 2', 'C█████L██E███A████N'].join('\n'))
  })
})
