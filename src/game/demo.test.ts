import { describe, expect, it } from 'vitest'
import { DEMO_SEED, DEMO_STEPS, stepBeats, stepDuration } from './demo'
import { judge } from '../engine/engine'
import type { Dict, LandedWord, RoundState } from '../engine/types'
import { gameWords } from '../../scripts/solver.ts'

/** The chains the tutorial teaches, reassembled from the steps that teach them. */
const chains = (): { target: number; words: LandedWord[] }[] => {
  const out: { target: number; words: LandedWord[] }[] = []
  for (const step of DEMO_STEPS) {
    // A step back at an empty board opens a new chain — unless the chain in hand is empty
    // too, which is a step that talks before the first word is played.
    const open = out[out.length - 1]
    if (step.before.length === 0 && (!open || open.words.length > 0)) {
      out.push({ target: step.target, words: [] })
    }
    const current = out[out.length - 1]
    expect(current.words.map((word) => word.word)).toEqual(step.before.map((word) => word.word))
    current.words.push(...step.play)
  }
  return out
}

/**
 * The tutorial is a claim about the game, so it is checked against the game.
 *
 * Every word it types is replayed through `judge` with the dictionary the app itself ships.
 * A move that stops being playable — a bumped word list, a changed landing rule — fails here
 * rather than going out as a tutorial teaching something the game refuses.
 */
describe('the tutorial', () => {
  const accepted = gameWords()
  const dict: Dict = (word) => accepted.has(word.toLowerCase())

  it.each(chains())('finishes $target words the way the game would', ({ target, words }) => {
    expect(words).toHaveLength(target)

    let state: RoundState = { seed: DEMO_SEED, currentPos: 0, words: [], solved: false }
    for (const entry of words) {
      const { result } = judge(state, entry.word, dict, target)
      expect(result.kind, `${entry.word} on ${DEMO_SEED}`).toBe('LANDED')
      if (result.kind !== 'LANDED') return

      // The board draws the split it declares, so the engine has to agree about where the
      // word starts and where it lands — not merely that it is legal somewhere.
      expect(result.word).toEqual(entry)
      state = {
        ...state,
        currentPos: result.word.landedAt,
        words: [...state.words, result.word],
        solved: result.word.landedAt === DEMO_SEED.length - 1,
      }
    }

    expect(state.solved).toBe(true)
  })

  it('shows a chunk and a landing that span more than one letter', () => {
    const spans = DEMO_STEPS.flatMap((step) =>
      step.play.map((word) => ({
        chunk: word.chunkEnd - word.from + 1,
        landing: word.landedAt - word.chunkEnd,
      })),
    )

    // The two rules a player cannot read off the board. Lose either and the tutorial is
    // showing four-word moves twice over.
    expect(spans.some((span) => span.chunk > 1)).toBe(true)
    expect(spans.some((span) => span.landing > 1)).toBe(true)
  })
})

describe('a step', () => {
  it.each(DEMO_STEPS)('$label: $caption', (step) => {
    const beats = stepBeats(step)
    expect(beats.length).toBeGreaterThan(0)

    for (let i = 1; i < beats.length; i++) {
      expect(beats[i].at).toBeGreaterThan(beats[i - 1].at)
    }
    expect(stepDuration(step, beats)).toBeGreaterThan(beats[beats.length - 1].at)

    // It opens on the board the step before it left behind, and closes with its words played
    // — bar a held step, whose last word is still standing in the box rather than on the
    // chain. The step after it opens with that word committed, so nothing goes missing.
    expect(beats[0].frame.words).toEqual(step.before)
    const played = step.hold ? step.play.slice(0, -1) : step.play
    expect(beats[beats.length - 1].frame.words).toEqual([...step.before, ...played])
  })

  it('types out of the seed letters the word starts on, never past its landing', () => {
    for (const step of DEMO_STEPS) {
      for (const { frame } of stepBeats(step)) {
        if (frame.effective === '') continue
        expect(frame.effective.startsWith(DEMO_SEED[frame.currentPos])).toBe(true)
        expect(frame.effective.slice(0, frame.matched)).toBe(
          DEMO_SEED.slice(frame.currentPos, frame.currentPos + frame.matched),
        )
      }
    }
  })

  it('asks the last word of a target to finish the seed', () => {
    for (const step of DEMO_STEPS) {
      for (const { frame } of stepBeats(step)) {
        if (frame.solved) continue
        expect(frame.mustFinish).toBe(frame.words.length + 1 === step.target)
      }
    }
  })
})
