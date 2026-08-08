import { MIN_WORD_LENGTH } from './types'
import type { Dict, RoundState, Spent, SubmitResult } from './types'

export function createRound(seed: string): RoundState {
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
 * Check order follows the spec: length, then dictionary, so NOT_A_WORD always wins over the
 * structural failures. NOT_A_WORD and NO_LANDING are the two the player must be able to
 * tell apart; the rest exist so the UI can say something specific.
 *
 * `spent` is the day's other chains. Left out, the round is judged on its own, which is what
 * the solver and every structural test want — a seed's targets are ranked one at a time.
 */
export function submit(
  state: RoundState,
  chunkEnd: number,
  rawWord: string,
  dict: Dict,
  spent?: Spent,
): SubmitResult {
  if (state.solved) throw new Error('submit called on a solved round')
  if (chunkEnd < state.currentPos || chunkEnd > state.seed.length - 1) {
    throw new Error(`chunkEnd ${chunkEnd} out of range for currentPos ${state.currentPos}`)
  }

  const word = rawWord.trim().toUpperCase()
  const chunk = chunkOf(state, chunkEnd)

  /* Ahead of the dictionary, and the one thing that outranks it: everything below the bound
     is absent from the word list by construction, so NOT_A_WORD would be the answer to every
     two-letter attempt — including the ones that are perfectly good English. */
  if (word.length < MIN_WORD_LENGTH) return { kind: 'TOO_FEW_LETTERS' }
  if (!dict(word.toLowerCase())) return { kind: 'NOT_A_WORD' }
  if (!word.startsWith(chunk)) return { kind: 'BAD_PREFIX' }
  if (word.length <= chunk.length) return { kind: 'TOO_SHORT' }
  if (state.words.some((w) => w.word === word)) return { kind: 'ALREADY_USED' }
  /* Straight after its within-round twin, because it is the same complaint at a wider scope:
     the day's three targets are three ways through one seed, and a word only gets to be part
     of one of them. */
  if (spent?.has(word)) return { kind: 'USED_TODAY' }
  if (word.includes(state.seed)) return { kind: 'CONTAINS_SEED' }
  /* A word the seed already contains is a stretch of the seed read back: PORT out of SPORT,
     PLAN out of PLANT. It lands — that is the trouble with it — but it splits nothing, so the
     chain it builds is the seed walked end to end. Ahead of the landing check, because a word
     this refuses is refused whatever it lands on. */
  if (state.seed.includes(word)) return { kind: 'INSIDE_SEED' }

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
export function resolve(
  state: RoundState,
  rawWord: string,
  dict: Dict,
  spent?: Spent,
): Resolution {
  const maxChunkEnd = state.seed.length - 2
  const word = rawWord.trim().toUpperCase()

  let best: Resolution | null = null
  let bestLanding = -1

  for (let chunkEnd = state.currentPos; chunkEnd <= maxChunkEnd; chunkEnd++) {
    if (!word.startsWith(state.seed.slice(state.currentPos, chunkEnd + 1))) break
    const result = submit(state, chunkEnd, word, dict, spent)
    if (result.kind === 'LANDED' && result.word.landedAt > bestLanding) {
      bestLanding = result.word.landedAt
      best = { chunkEnd, result }
    }
  }

  if (best) return best
  // Nothing landed. The minimal chunk gives the most useful reason why.
  return { chunkEnd: state.currentPos, result: submit(state, state.currentPos, word, dict, spent) }
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
  spent?: Spent,
): Resolution {
  const resolution = resolve(state, rawWord, dict, spent)
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
 *
 * Nothing here has to guard against a word being conjured out of the seed alone — a bare P on
 * SPORT becoming PORT, and the round playing itself. Every completion is offered to the same
 * `judge` a typed word gets, and INSIDE_SEED turns those away wherever they come from.
 *
 * `target` is the tier's word count, and it is what makes the letters inferred the ones the
 * player is actually being shown. A landing the round would reject is not a landing worth
 * putting in their mouth: on BEARD after BEE, with one word left, EARNE must not become
 * EARNER — that R lands on the seed but leaves the round unfinishable, so the box would be
 * holding out a letter Enter refuses. Judged against the target it reaches EARNED instead.
 * Omit it and only the landing is required, which is the raw shape of the move.
 */
export function withLanding(
  state: RoundState,
  rawDraft: string,
  dict: Dict,
  target?: number,
  spent?: Spent,
): string {
  const accepted = (candidate: string) => {
    const { result } =
      target === undefined
        ? resolve(state, candidate, dict, spent)
        : judge(state, candidate, dict, target, spent)
    return result.kind === 'LANDED'
  }

  const word = rawDraft.trim().toUpperCase()
  if (!word || state.solved) return word
  if (accepted(word)) return word

  const { seed, currentPos } = state
  const maxChunkEnd = seed.length - 2

  // Suffix length outside chunk, so the fewest letters are ever put into the player's mouth.
  const complete = (fits: (candidate: string) => boolean): string | null => {
    for (let reach = 1; reach < seed.length - currentPos; reach++) {
      for (let chunkEnd = currentPos; chunkEnd <= maxChunkEnd; chunkEnd++) {
        const m = chunkEnd + reach
        if (m > seed.length - 1) break
        if (!word.startsWith(seed.slice(currentPos, chunkEnd + 1))) break
        const candidate = word + seed.slice(chunkEnd + 1, m + 1)
        if (fits(candidate)) return candidate
      }
    }
    return null
  }

  /**
   * Second choice: a real word that lands, refused only by the day's bookkeeping.
   *
   * The round is asked with an empty chain and no target, so ALREADY_USED, USED_TODAY,
   * ENDS_EARLY and MUST_FINISH all stand aside while NOT_A_WORD, NO_LANDING, CONTAINS_SEED
   * and INSIDE_SEED still hold — PORT is no more conjurable here than it was above.
   *
   * The box is holding that letter out whether or not the completion takes it, so refusing
   * to complete does not un-promise it; it only means Enter judges something shorter than
   * what is on screen. On ESSAY with ERAS spent, typing RA showed ERAS and then complained
   * that ERA does not end on S. Completed anyway, the refusal is the one the player needs:
   * ERAS was already used in your 4-word chain.
   */
  const bare: RoundState = { ...state, words: [] }
  const lands = (candidate: string) => resolve(bare, candidate, dict).result.kind === 'LANDED'

  return complete(accepted) ?? complete(lands) ?? word
}

/**
 * The seed letters the box is holding out in front of the player, and where they start.
 *
 * The word has to come back down onto the seed, and until it does the box shows the letters
 * it would come down on — normally the next one along, and on the round's last word all of
 * what is left, since nothing short of the final letter will do.
 *
 * One home for the formula because two things read it: the display draws those letters, and
 * Enter judges the word including them. Apart, the box promised a letter the engine never
 * saw — SATURDA on screen as SATURDAY, refused as SATURDA.
 */
export function reachOf(
  seed: string,
  currentPos: number,
  wordLength: number,
  matched: number,
  mustFinish: boolean,
): { from: number; letters: string } {
  const headLen = Math.max(Math.min(matched, wordLength), 1)
  const from = currentPos + headLen
  const last = seed.length - 1
  const to = mustFinish ? last : Math.min(from, last)
  return { from, letters: seed.slice(from, to + 1) }
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
  spent?: Spent,
): { result: SubmitResult; state: RoundState } {
  const result = submit(state, chunkEnd, rawWord, dict, spent)
  return { result, state: applyResult(state, result) }
}
