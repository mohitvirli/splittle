import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  applyResult,
  createRound,
  judge,
  seedMatchLength,
  undoLast,
  withLanding,
  withPivot,
} from '../engine/engine'
import { MAX_WORD_LENGTH, MIN_WORD_LENGTH } from '../engine/types'
import type { RoundState, SubmitFailure } from '../engine/types'
import { getDictionary } from '../dictionary/dictionary'
import type { Dictionary } from '../dictionary/dictionary'
import { TIERS, allTiersWon, loadProgress, saveProgress } from './storage'
import type { Progress, Tier } from './storage'

/** Seed letters consumed so far. The first word claims both its ends at once. */
export const coveredCount = (round: RoundState): number =>
  round.words.length === 0 ? 0 : round.currentPos + 1

const freshRounds = (): Record<Tier, RoundState> => ({
  4: createRound(),
  3: createRound(),
  2: createRound(),
})

export function useTrapezium() {
  const [dict, setDict] = useState<Dictionary | null>(null)
  const [tier, setTierState] = useState<Tier>(4)
  // Every tier holds its own chain, so leaving a section and coming back resumes it.
  const [rounds, setRounds] = useState<Record<Tier, RoundState>>(freshRounds)
  const round = rounds[tier]
  const setRound = useCallback(
    (next: RoundState) => setRounds((all) => ({ ...all, [tier]: next })),
    [tier],
  )
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<{ kind: SubmitFailure; word: string; nonce: number } | null>(
    null,
  )
  const [justCovered, setJustCovered] = useState<{ indices: number[]; nonce: number } | null>(null)
  const [progress, setProgress] = useState<Progress>(() => loadProgress())

  // ~170ms of synchronous index building. Kept off the first paint.
  useEffect(() => {
    const id = window.setTimeout(() => setDict(getDictionary()), 0)
    return () => window.clearTimeout(id)
  }, [])

  useEffect(() => {
    if (!justCovered) return
    const id = window.setTimeout(() => setJustCovered(null), 1000)
    return () => window.clearTimeout(id)
  }, [justCovered])

  const pivot = round.seed[round.currentPos]

  /**
   * The word the engine actually sees: the pivot assumed at the front, the landing assumed
   * at the back. See `withPivot` and `withLanding` — between them, HO, SHO, HOT and SHOT all
   * reach the engine as SHOT.
   *
   * The completion needs the dictionary to tell a real word from a fragment, so until it has
   * loaded this is the pivot alone. Nothing can be submitted in that window anyway.
   */
  const effective = useMemo(() => {
    const typed = withPivot(round, draft)
    if (!dict) return typed
    return withLanding(round, typed, (w) => dict.has(w))
  }, [round, draft, dict])

  /** How far the word runs along the seed from the cursor. */
  const matched = useMemo(() => seedMatchLength(round, effective), [round, effective])

  /**
   * How the word would land right now, or null. Turns the box active, and carries the chunk
   * boundary so the display can tell the seed's letters from the player's.
   *
   * This runs the full `resolve`, dictionary included, rather than a structure-only check.
   * A structural check makes the box flicker: typing PLASMA would activate it on PL (ends
   * on L), drop on PLAS, and activate again on PLASMA, because those fragments land even
   * though they are not words. The cost is that an active box also confirms the word is real.
   */
  const preview = useMemo(() => {
    if (!dict || round.solved || effective.length < MIN_WORD_LENGTH) return null
    const { chunkEnd, result } = judge(round, effective, (w) => dict.has(w), tier)
    return result.kind === 'LANDED' ? { chunkEnd, landedAt: result.word.landedAt } : null
  }, [dict, round, effective, tier])

  /** Nothing of the current word has been typed, so backspace steps back a word instead. */
  const canStepBack = round.words.length > 0 && draft.length === 0

  const restart = useCallback(() => {
    setRound(createRound())
    setDraft('')
    setError(null)
    setJustCovered(null)
  }, [setRound])

  /** Switching sections leaves each chain standing; only the half-typed word is dropped. */
  const setTier = useCallback((next: Tier) => {
    setTierState(next)
    setDraft('')
    setError(null)
    setJustCovered(null)
  }, [])

  /**
   * A section opens once the one above it is finished, and a finished section stays open
   * so it can be replayed. The longest target is always available.
   */
  const isOpen = useCallback(
    (t: Tier) => {
      const i = TIERS.indexOf(t)
      return i === 0 || progress.tiersWon[TIERS[i - 1]] || progress.tiersWon[t]
    },
    [progress],
  )

  const submitWord = useCallback(() => {
    if (!dict || round.solved) return
    const word = effective.trim()
    if (!word) return

    const { result } = judge(round, word, (w) => dict.has(w), tier)
    if (result.kind !== 'LANDED') {
      // Report the word the engine judged, not the shorthand that was typed.
      setError({ kind: result.kind, word, nonce: performance.now() })
      return
    }

    const before = coveredCount(round)
    const next = applyResult(round, result)
    const indices: number[] = []
    for (let i = before; i < coveredCount(next); i++) indices.push(i)

    setRound(next)
    setJustCovered({ indices, nonce: performance.now() })
    setDraft('')
    setError(null)

    if (next.solved) {
      setProgress((current) => {
        // `judge` only lets a round finish on its target word, so the tier played is the
        // only one won — a short solve is no longer a win for the longer targets.
        const tiersWon = { ...current.tiersWon, [tier]: true }
        const completed = !allTiersWon(current) && allTiersWon({ ...current, tiersWon })
        const updated: Progress = {
          tiersWon,
          streak: completed ? current.streak + 1 : current.streak,
        }
        saveProgress(updated)
        return updated
      })
    }
  }, [dict, effective, round, setRound, tier])

  /**
   * The only way out of "all three crossed" — there is no daily rotation, so without this
   * finishing the puzzle once would strand every future visit on the results screen with
   * nothing left to play. Streak survives; everything about the attempt itself does not.
   */
  const playAgain = useCallback(() => {
    setProgress((current) => {
      const updated: Progress = { tiersWon: { 4: false, 3: false, 2: false }, streak: current.streak }
      saveProgress(updated)
      return updated
    })
    setRounds(freshRounds())
    setTierState(4)
    setDraft('')
    setError(null)
    setJustCovered(null)
  }, [])

  const undo = useCallback(() => {
    if (round.words.length === 0) return
    setRound(undoLast(round))
    setDraft('')
    setError(null)
  }, [round, setRound])

  const updateDraft = useCallback((value: string) => {
    setDraft(
      value
        .replace(/[^a-zA-Z]/g, '')
        .slice(0, MAX_WORD_LENGTH)
        .toUpperCase(),
    )
    setError(null)
  }, [])

  return {
    ready: dict !== null,
    seed: round.seed,
    round,
    rounds,
    tier,
    progress,
    isOpen,
    allDone: allTiersWon(progress),
    /** Seed letters still ahead of the cursor — what a word has to land on. */
    reachable: round.seed.slice(round.currentPos + 1),
    pivot,
    matched,
    preview,
    canStepBack,
    draft,
    effective,
    error,
    justCovered,
    canSubmit: dict !== null && effective.length >= MIN_WORD_LENGTH && !round.solved,
    updateDraft,
    submitWord,
    undo,
    restart,
    setTier,
    playAgain,
  }
}

export type Trapezium = ReturnType<typeof useTrapezium>
