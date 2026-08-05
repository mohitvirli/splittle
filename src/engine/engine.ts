import { SEED } from './types'
import type { Dict, RoundState, SubmitResult } from './types'

export function createRound(seed: string = SEED): RoundState {
  return { seed: seed.toUpperCase(), currentPos: 0, words: [], solved: false }
}

/** The prefix chunk seed[currentPos..chunkEnd] the player has selected. */
export function chunkOf(state: RoundState, chunkEnd: number): string {
  return state.seed.slice(state.currentPos, chunkEnd + 1)
}

/**
 * Find where `word` lands on the seed, given a prefix chunk ending at `chunkEnd`.
 *
 * Iterates m downward from the last seed index so the FURTHEST landing wins — a longer
 * reach is always the better score, and taking the first match on the way down is what
 * makes that true.
 *
 * The suffix is seed[chunkEnd+1..m], always contiguous from chunkEnd+1. A word cannot
 * skip a seed letter: from chunk "A" on PLANT, landing on T means ending in "NT", not "T".
 */
export function findLanding(seed: string, chunkEnd: number, word: string): number | null {
  for (let m = seed.length - 1; m > chunkEnd; m--) {
    if (word.endsWith(seed.slice(chunkEnd + 1, m + 1))) return m
  }
  return null
}

/**
 * Validate a word against the current round. Pure — does not mutate or advance state.
 * Feed the result to `applyResult` to move the cursor.
 *
 * Check order follows the spec: dictionary first, so NOT_A_WORD always wins over the
 * structural failures. NOT_A_WORD and NO_LANDING are the two the player must be able to
 * tell apart; the rest exist so the UI can say something specific.
 */
export function submit(
  state: RoundState,
  chunkEnd: number,
  rawWord: string,
  dict: Dict,
): SubmitResult {
  if (state.solved) throw new Error('submit called on a solved round')
  if (chunkEnd < state.currentPos || chunkEnd > state.seed.length - 1) {
    throw new Error(`chunkEnd ${chunkEnd} out of range for currentPos ${state.currentPos}`)
  }

  const word = rawWord.trim().toUpperCase()
  const chunk = chunkOf(state, chunkEnd)

  if (!dict(word.toLowerCase())) return { kind: 'NOT_A_WORD' }
  if (!word.startsWith(chunk)) return { kind: 'BAD_PREFIX' }
  if (word.length <= chunk.length) return { kind: 'TOO_SHORT' }
  if (state.words.some((w) => w.word === word)) return { kind: 'ALREADY_USED' }
  if (word.includes(state.seed)) return { kind: 'CONTAINS_SEED' }

  const landedAt = findLanding(state.seed, chunkEnd, word)
  if (landedAt === null) return { kind: 'NO_LANDING' }

  return { kind: 'LANDED', word: { word, from: state.currentPos, chunkEnd, landedAt } }
}

export interface Resolution {
  chunkEnd: number
  result: SubmitResult
}

/**
 * Pick the chunk on the player's behalf.
 *
 * The player only types a word — they never choose where the seed splits. Several
 * chunks can be compatible with the same word and most of them land nowhere, so this
 * tries each one and keeps the furthest landing. PLASMA is the case that matters: its
 * longest seed match is PLA, which lands nowhere, while PL lands on A.
 *
 * Ties go to the shortest chunk, which is only a presentation choice — the seed letters
 * consumed are the same either way.
 */
export function resolve(state: RoundState, rawWord: string, dict: Dict): Resolution {
  const maxChunkEnd = state.seed.length - 2
  const word = rawWord.trim().toUpperCase()

  let best: Resolution | null = null
  let bestLanding = -1

  for (let chunkEnd = state.currentPos; chunkEnd <= maxChunkEnd; chunkEnd++) {
    if (!word.startsWith(state.seed.slice(state.currentPos, chunkEnd + 1))) break
    const result = submit(state, chunkEnd, word, dict)
    if (result.kind === 'LANDED' && result.word.landedAt > bestLanding) {
      bestLanding = result.word.landedAt
      best = { chunkEnd, result }
    }
  }

  if (best) return best
  // Nothing landed. The minimal chunk gives the most useful reason why.
  return { chunkEnd: state.currentPos, result: submit(state, state.currentPos, word, dict) }
}

/**
 * `resolve`, plus the tier's word count as a hard contract.
 *
 * A target of N means exactly N words. Finishing the seed in fewer is not a better score,
 * it is the wrong shape, so a word that would end the round early is rejected rather than
 * accepted-and-penalised. The mirror case is guarded too: the last word the target allows
 * has to reach the end, so the player is never walked into a round they cannot win.
 *
 * Landing failures come back untouched — the dictionary still has the first word.
 */
export function judge(
  state: RoundState,
  rawWord: string,
  dict: Dict,
  target: number,
): Resolution {
  const resolution = resolve(state, rawWord, dict)
  if (resolution.result.kind !== 'LANDED') return resolution

  const used = state.words.length
  if (used >= target) return { ...resolution, result: { kind: 'NO_WORDS_LEFT' } }

  const finishes = resolution.result.word.landedAt === state.seed.length - 1
  const isLastAllowed = used + 1 === target
  if (finishes && !isLastAllowed) return { ...resolution, result: { kind: 'ENDS_EARLY' } }
  if (!finishes && isLastAllowed) return { ...resolution, result: { kind: 'MUST_FINISH' } }

  return resolution
}

/**
 * The word the engine should judge, given what the player actually typed.
 *
 * Every word has to start on the pivot, so the pivot is assumed rather than demanded: from
 * A, both PRON and APRON mean APRON. Typing it yourself stays legal, which is why the letter
 * is only prepended when it is missing.
 *
 * The ambiguous case is a word that genuinely doubles the pivot. From A, "ARDVARK" is taken
 * at face value rather than expanded to AARDVARK — so AARDVARK is reached by typing it in
 * full. Reading it the other way would make the shorthand unable to express ARDVARK at all.
 */
export function withPivot(state: RoundState, rawDraft: string): string {
  const draft = rawDraft.trim().toUpperCase()
  if (!draft) return ''
  const pivot = state.seed[state.currentPos]
  return draft[0] === pivot ? draft : pivot + draft
}

/**
 * The word the engine should judge, given a draft that stops short of the seed.
 *
 * The mirror of `withPivot`. A word has to come back down onto the seed, so the letters it
 * lands on are assumed the same way the pivot is: from S on STONE, SHO, HO, SHOT and HOT all
 * mean SHOT. This is what the display has been promising the whole time — the box holds the
 * letter it is reaching for out in front of the player as they type — so accepting it closes
 * the gap between what is shown and what Enter will take.
 *
 * A draft that already lands is taken at face value and returned untouched, which keeps every
 * word that worked before working unchanged. Only one that goes nowhere is completed, and the
 * shortest completion wins, so the letter inferred is the nearest one — the one on screen.
 */
export function withLanding(state: RoundState, rawDraft: string, dict: Dict): string {
  const word = rawDraft.trim().toUpperCase()
  if (!word || state.solved) return word
  if (resolve(state, word, dict).result.kind === 'LANDED') return word

  /* Nothing of the player's own yet — the draft is still running along the seed. Completing
     here would hand back a word made only of seed letters: on STONE a bare S becomes ST,
     which is a move the player never asked for. Typing ST out in full still plays it; it
     just is not something a single keystroke should conjure. */
  if (seedMatchLength(state, word) === word.length) return word

  const { seed, currentPos } = state
  const maxChunkEnd = seed.length - 2

  // Suffix length outside chunk, so the fewest letters are ever put into the player's mouth.
  for (let reach = 1; reach < seed.length - currentPos; reach++) {
    for (let chunkEnd = currentPos; chunkEnd <= maxChunkEnd; chunkEnd++) {
      const m = chunkEnd + reach
      if (m > seed.length - 1) break
      if (!word.startsWith(seed.slice(currentPos, chunkEnd + 1))) break
      const candidate = word + seed.slice(chunkEnd + 1, m + 1)
      if (resolve(state, candidate, dict).result.kind === 'LANDED') return candidate
    }
  }
  return word
}

/**
 * How many seed letters the typed word runs along from the cursor. Drives the gap the
 * player sees open up in the seed as they type; it is not the chunk the word will use.
 */
export function seedMatchLength(state: RoundState, rawWord: string): number {
  const word = rawWord.trim().toUpperCase()
  const maxChunkEnd = state.seed.length - 2
  let matched = 0
  while (
    state.currentPos + matched <= maxChunkEnd &&
    matched < word.length &&
    word[matched] === state.seed[state.currentPos + matched]
  ) {
    matched++
  }
  return matched
}

export function applyResult(state: RoundState, result: SubmitResult): RoundState {
  if (result.kind !== 'LANDED') return state
  const currentPos = result.word.landedAt
  return {
    ...state,
    currentPos,
    words: [...state.words, result.word],
    solved: currentPos === state.seed.length - 1,
  }
}

export function undoLast(state: RoundState): RoundState {
  if (state.words.length === 0) return state
  const last = state.words[state.words.length - 1]
  return {
    ...state,
    currentPos: last.from,
    words: state.words.slice(0, -1),
    solved: false,
  }
}

/** Convenience for callers that want validate-and-advance in one step. */
export function play(
  state: RoundState,
  chunkEnd: number,
  rawWord: string,
  dict: Dict,
): { result: SubmitResult; state: RoundState } {
  const result = submit(state, chunkEnd, rawWord, dict)
  return { result, state: applyResult(state, result) }
}
