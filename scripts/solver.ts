/**
 * Offline solver. Answers the only question that matters about a seed: can a person
 * actually finish it in exactly 4, 3, and 2 words?
 *
 * The game accepts `an-array-of-english-words` — 274,937 entries, SABBAT and TABASHEER
 * included. Against that list every seed is solvable, so it cannot tell a fair puzzle from
 * an unfair one. Solutions are therefore counted against a much smaller frequency-ranked
 * list (`common-words.txt`), while the game keeps accepting everything. A seed ships only
 * if it can be solved with words people know.
 *
 * `resolve` is imported rather than reimplemented on purpose: it decides where a word lands,
 * and it always takes the FURTHEST landing. A chain that needs a word to land short is not
 * reachable through the UI, so a solver of its own would happily certify puzzles nobody can
 * type. Sharing the function is what keeps "solvable" and "playable" the same word.
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from '../src/engine/engine.ts'
import { MAX_WORD_LENGTH, MIN_WORD_LENGTH } from '../src/engine/types.ts'
import type { Dict, RoundState } from '../src/engine/types.ts'

/** Frequency-ranked, most common first. Public domain, from google-10000-english. */
const COMMON_WORDS = fileURLToPath(new URL('./common-words.txt', import.meta.url))

/** Every seed the pool draws from. Ranked output tells you which are worth shipping. */
export const CANDIDATES = fileURLToPath(new URL('./seed-candidates.txt', import.meta.url))

export const TARGETS = [4, 3, 2] as const

/**
 * How strict "common" is. The top 3,000 is roughly the vocabulary a puzzle can assume;
 * the top 10,000 is the generous reading. A seed is reported at both so the margin is
 * visible — one that only works at 10k is one word away from being unsolvable in practice.
 */
export const TIGHT = 3000
export const WIDE = 10000

/** Loading the raw list here keeps this script off the app's dictionary module, which
 *  imports a JSON word list Node cannot resolve without an import attribute. */
export function gameWords(): Set<string> {
  const require = createRequire(import.meta.url)
  const list = require('an-array-of-english-words') as string[]
  return new Set(list)
}

/** The `limit` most common words, minus anything the game would reject anyway. */
export function commonWords(limit: number, accepted: Set<string>): Set<string> {
  const out = new Set<string>()
  for (const raw of readFileSync(COMMON_WORDS, 'utf8').trim().split('\n').slice(0, limit)) {
    const word = raw.trim().toLowerCase()
    if (word.length < MIN_WORD_LENGTH || word.length > MAX_WORD_LENGTH) continue
    if (!/^[a-z]+$/.test(word)) continue
    if (!accepted.has(word)) continue
    out.add(word)
  }
  return out
}

export type Edges = Map<number, string[]>[]

/**
 * Every move the seed allows, as `position -> landing -> the words that get you there`.
 *
 * Five nodes and a handful of arcs, which is what makes counting chains cheap: the
 * expensive part is asking `resolve` about a few thousand words, and that happens once.
 */
export function buildEdges(seed: string, solve: Set<string>): Edges {
  const dict: Dict = (word) => solve.has(word.toLowerCase())
  const edges: Edges = []

  for (let pos = 0; pos < seed.length; pos++) {
    const byLanding = new Map<number, string[]>()
    edges.push(byLanding)
    if (pos === seed.length - 1) continue

    const state: RoundState = { seed, currentPos: pos, words: [], solved: false }
    const pivot = seed[pos].toLowerCase()

    for (const lower of solve) {
      if (lower[0] !== pivot) continue
      const word = lower.toUpperCase()
      const found = resolve(state, word, dict)
      if (found.result.kind !== 'LANDED') continue
      const landing = found.result.word.landedAt
      const bucket = byLanding.get(landing)
      if (bucket) bucket.push(word)
      else byLanding.set(landing, [word])
    }
  }
  return edges
}

export interface ChainReport {
  count: number
  samples: string[][]
  /** Distinct words that can open and close a chain — the real fairness signal. A seed with
   *  one of either is a seed with one answer, however many chains it technically has. */
  openers: string[]
  closers: string[]
}

/**
 * Chains of exactly `target` distinct words running the whole seed.
 *
 * The exact count is a rule, not a target to beat — `judge` rejects a word that finishes the
 * seed early — so only the last word may land on the final letter. Counting stops at `cap`;
 * past a few thousand the number stops meaning anything.
 */
export function countChains(edges: Edges, length: number, target: number, cap = 5000): ChainReport {
  const chains: string[][] = []
  const used = new Set<string>()
  const path: string[] = []
  let count = 0

  const walk = (pos: number, depth: number) => {
    if (count >= cap) return
    if (depth === target) {
      if (pos === length - 1) {
        count++
        if (chains.length < 200) chains.push([...path])
      }
      return
    }
    for (const [landing, words] of edges[pos]) {
      if ((landing === length - 1) !== (depth + 1 === target)) continue
      for (const word of words) {
        if (used.has(word)) continue
        used.add(word)
        path.push(word)
        walk(landing, depth + 1)
        path.pop()
        used.delete(word)
        if (count >= cap) return
      }
    }
  }

  walk(0, 0)

  return {
    count,
    samples: chains.slice(0, 4),
    openers: [...new Set(chains.map((chain) => chain[0]))],
    closers: [...new Set(chains.map((chain) => chain[chain.length - 1]))],
  }
}

export interface SeedReport {
  seed: string
  tight: Record<number, ChainReport>
  wide: Record<number, ChainReport>
}

export function inspect(seed: string, tight: Set<string>, wide: Set<string>): SeedReport {
  const tightEdges = buildEdges(seed, tight)
  const wideEdges = buildEdges(seed, wide)
  const report: SeedReport = { seed, tight: {}, wide: {} }
  for (const target of TARGETS) {
    report.tight[target] = countChains(tightEdges, seed.length, target)
    report.wide[target] = countChains(wideEdges, seed.length, target)
  }
  return report
}

/** Ships or it does not: every tier has to be reachable with common words. */
export const isPlayable = (report: SeedReport): boolean =>
  TARGETS.every((target) => report.wide[target].count > 0)

export function readCandidates(): string[] {
  return readFileSync(CANDIDATES, 'utf8').trim().split(/\s+/).map((word) => word.toUpperCase())
}
