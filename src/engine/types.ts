/**
 * Two-letter words are more seed than word: LA and AN on PLANT add nothing of the player's
 * own, and admitting them made whole rounds solvable by walking the seed a letter at a time.
 * The dictionary is built to this bound, so anything shorter is simply not a word as far as
 * the engine is concerned — no separate length rule to keep in step.
 */
export const MIN_WORD_LENGTH = 3
export const MAX_WORD_LENGTH = 12

/** Membership test for a single lowercase word. Injected so the engine stays pure. */
export type Dict = (word: string) => boolean

/**
 * Words the day has already spent, in uppercase — the chains standing in the round's *other*
 * targets. Injected like the dictionary, and for the same reason: which words those are is a
 * fact about the player's day, not about the round in front of them.
 */
export type Spent = ReadonlySet<string>

export interface LandedWord {
  word: string
  /** currentPos before the turn */
  from: number
  /** j — last index of the prefix chunk the player selected */
  chunkEnd: number
  /** m — the seed index the word landed on */
  landedAt: number
}

export interface RoundState {
  seed: string
  /** 0..seed.length-1 */
  currentPos: number
  words: LandedWord[]
  solved: boolean
}

export type SubmitResult =
  | { kind: 'LANDED'; word: LandedWord }
  | { kind: 'NOT_A_WORD' }
  /* Its own answer rather than NOT_A_WORD: the dictionary is built to MIN_WORD_LENGTH, so
     AN and IT are missing from it as a rule of the game, not as a fact about English.
     Telling a player that AN is not in the dictionary reads as a bug in the dictionary. */
  | { kind: 'TOO_FEW_LETTERS' }
  | { kind: 'NO_LANDING' }
  | { kind: 'BAD_PREFIX' }
  | { kind: 'TOO_SHORT' }
  | { kind: 'ALREADY_USED' }
  /* Its bigger brother: already used, but in one of the day's other rounds. The three targets
     share a seed, so without this the 3-word chain is the 4-word one with a join taken out. */
  | { kind: 'USED_TODAY' }
  | { kind: 'CONTAINS_SEED' }
  /* The mirror of CONTAINS_SEED: a word that sits inside the seed rather than around it.
     PORT on SPORT is a run of the seed with nothing of the player's own in it — the puzzle
     is meant to be split, not read back. */
  | { kind: 'INSIDE_SEED' }
  // Tier rules. A target of N means exactly N words — not "N or fewer".
  | { kind: 'ENDS_EARLY' }
  | { kind: 'MUST_FINISH' }
  | { kind: 'NO_WORDS_LEFT' }

export type SubmitFailure = Exclude<SubmitResult, { kind: 'LANDED' }>['kind']
