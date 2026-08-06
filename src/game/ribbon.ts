import { TIERS } from './storage'
import type { Chains } from './storage'
import type { LandedWord } from '../engine/types'

/**
 * A chain, welded into one word.
 *
 * Every word after the first starts on the letter the one before it landed on, so the join is
 * always exactly one letter deep — SPIT, TWO, OPEN, NICE on STONE become SPITWOPENICE. The
 * overlap is not a guess about the words; it is the rule the round was played under.
 */
export const weld = (chain: readonly LandedWord[]): string =>
  chain.reduce((ribbon, played, i) => (i === 0 ? played.word : ribbon + played.word.slice(1)), '')

/**
 * Where the seed's own letters sit in the welded ribbon.
 *
 * A word touches the seed at both ends: the chunk it starts on, `seed[from..chunkEnd]`, and the
 * letters it comes back down onto, `seed[chunkEnd+1..landedAt]`. Marking only the pivot is the
 * mistake worth naming — most chunks are one letter, so it looks right until a word claims
 * several. LEARN on CLEAN opens with LEA, and a pivot-only mask hides two letters of the seed.
 */
export function seedPositions(chain: readonly LandedWord[]): number[] {
  const positions = new Set<number>()
  let offset = 0

  for (const { word, from, chunkEnd, landedAt } of chain) {
    for (let i = 0; i <= chunkEnd - from; i++) positions.add(offset + i)
    for (let i = 0; i < landedAt - chunkEnd; i++) positions.add(offset + word.length - 1 - i)
    offset += word.length - 1
  }

  return [...positions].sort((a, b) => a - b)
}

export const BLOCK = '█'

/**
 * The ribbon with the player's letters blocked out and the seed's left standing.
 *
 * This is the shareable half. It gives away how long each word was and where the seed broke,
 * and nothing else — the reader sees CLEAN stretched across a chain they have to make
 * themselves. Two players who solved the same tier differently get different rows, which is
 * where the card gets its variance from: nothing extra is tracked to produce it.
 */
export function mask(chain: readonly LandedWord[]): string {
  const ribbon = weld(chain)
  const seed = new Set(seedPositions(chain))
  return [...ribbon].map((letter, i) => (seed.has(i) ? letter : BLOCK)).join('')
}

/** Where a reader who has just been sent a chain goes to play it. */
export const HOME = 'splittle.clevir.li'

/**
 * The card. Tiers run 4, 3, 2 — the same order as the sections, so the rows tighten downward.
 *
 * Blank lines above and below the rows: pasted into a chat the ribbons are the picture, and
 * they only read as one if the title and the link are not crowding them.
 *
 * `revealed` is the toggle the results screen owns: the masked ribbon is what leaves by
 * default, because the unmasked one is the answer. CONTROLEARN is CONTROL and LEARN to anyone
 * who looks at it twice.
 */
export function shareText(puzzleNo: number, chains: Chains, revealed = false): string {
  const rows = TIERS.map((tier) => {
    const chain = chains[tier]
    return chain && chain.length > 0 ? (revealed ? weld(chain) : mask(chain)) : null
  }).filter((row): row is string => row !== null)

  return [`splittle No. ${puzzleNo}`, '', ...rows, '', HOME].join('\n')
}
