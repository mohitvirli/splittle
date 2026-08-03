export const SEED = 'PLANT'

export const MIN_WORD_LENGTH = 2
export const MAX_WORD_LENGTH = 12

/** Membership test for a single lowercase word. Injected so the engine stays pure. */
export type Dict = (word: string) => boolean

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
  | { kind: 'NO_LANDING' }
  | { kind: 'BAD_PREFIX' }
  | { kind: 'TOO_SHORT' }
  | { kind: 'ALREADY_USED' }
  | { kind: 'CONTAINS_SEED' }
  // Tier rules. A target of N means exactly N words — not "N or fewer".
  | { kind: 'ENDS_EARLY' }
  | { kind: 'MUST_FINISH' }
  | { kind: 'NO_WORDS_LEFT' }

export type SubmitFailure = Exclude<SubmitResult, { kind: 'LANDED' }>['kind']
