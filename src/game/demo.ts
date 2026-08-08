import { seedMatchLength } from '../engine/engine'
import type { LandedWord, RoundState } from '../engine/types'
import type { Tier } from './storage'

/**
 * The taught puzzle.
 *
 * PLANT, and the same words every time — verified against the real engine and the real
 * dictionary, so nothing here is a drawing of a move the game would refuse.
 *
 * It is taught in four steps because there are only two things a new player cannot work out
 * from the board: a word starts where the last one landed, and — once the chain has to be
 * shorter — a word can take more than one seed letter at either end. The first two steps are
 * the first fact, the last two are the second, and each waits for the reader rather than
 * running past them.
 */
export const DEMO_SEED = 'PLANT'

const at = (word: string, from: number, chunkEnd: number, landedAt: number): LandedWord => ({
  word,
  from,
  chunkEnd,
  landedAt,
})

const PEARL = at('PEARL', 0, 0, 1)
const LAVA = at('LAVA', 1, 1, 2)
const APRON = at('APRON', 2, 2, 3)
const NIGHT = at('NIGHT', 3, 3, 4)
const PLASMA = at('PLASMA', 0, 1, 2)
const ACCOUNT = at('ACCOUNT', 2, 2, 4)

export interface DemoStep {
  /** The tier being demonstrated, as the reader should read it. */
  label: string
  /** The word count the round is actually held to — what decides when a word must finish. */
  target: Tier
  caption: string
  /** Already on the chain when the step opens. Empty means the board starts over. */
  before: LandedWord[]
  /**
   * Typed out while the step plays. Empty is a step that only talks: the board sits at the
   * move it is describing and nothing moves until the reader asks for it — which is why the
   * dialog opens on a still board rather than typing at someone who has read nothing yet.
   */
  play: LandedWord[]
  /**
   * Leave the last word standing on the board rather than committing it.
   *
   * Committing collapses the move back to a single pivot letter, which is right in play and
   * wrong while teaching: the reader is still looking at the word that was just made. Held,
   * the board keeps showing [PLASMA]NT until they ask for the next step.
   */
  hold?: boolean
}

/**
 * Whether the step has anything to play over and over.
 *
 * Every step that types repeats. A reader who looked away, or who arrived at the step mid-word,
 * gets the move again without having to find a control — and the steps that only talk have no
 * motion to loop, so they sit still on the board they are describing.
 */
export const stepLoops = (step: DemoStep): boolean => step.play.length > 0

export const DEMO_STEPS: DemoStep[] = [
  {
    label: '4 words',
    target: 4,
    caption: 'Splitting PLANT into 4 words.\nThe first starts with P and ends with L.',
    before: [],
    play: [PEARL],
    hold: true,
  },
  {
    label: '4 words',
    target: 4,
    caption: 'The other 3 go on the same way.\nEach starts where the last one landed.',
    before: [PEARL],
    play: [LAVA, APRON, NIGHT],
  },
  {
    label: '3 or 2 words',
    target: 2,
    caption: 'For 3 or 2 word split, we need more letters, either at the start or the end.',
    before: [],
    play: [],
  },
  {
    // The sentence before this one said a word would have to take more letters; this is that
    // happening, named. PLASMA is left standing rather than committed.
    label: '3 or 2 words',
    target: 2,
    caption: 'PLASMA starts with PL and ends with A.',
    before: [],
    play: [PLASMA],
    hold: true,
  },
  {
    label: '3 or 2 words',
    target: 2,
    caption: 'If one word is left, so anything like AN_T or A_NT will do.',
    before: [PLASMA],
    play: [],
  },
  {
    label: '3 or 2 words',
    target: 2,
    caption: 'ACCOUNT starts with A and ends in NT.\nTwo words, the word is complete.',
    before: [PLASMA],
    play: [ACCOUNT],
  },
]

/** What the board holds at one instant. Drives the game's own WordDisplay unchanged. */
export interface DemoFrame {
  currentPos: number
  /** The word as the engine would see it — seed chunk, the player's letters, landing. */
  effective: string
  /** Seed letters the word runs along from the cursor. */
  matched: number
  /** Every landing the tutorial shows is one the round takes — it only plays legal moves. */
  preview: { chunkEnd: number; landedAt: number; accepted: boolean } | null
  mustFinish: boolean
  solved: boolean
  words: LandedWord[]
}

export interface DemoBeat {
  /** Milliseconds from the top of the step, before `motion()` scales it. */
  at: number
  /** How long this frame is held. The last one's is the step's tail before it plays again. */
  hold: number
  /**
   * Part of the walk back to the top of the loop rather than part of the lesson.
   *
   * A reader with motion off is shown the step's resting board, which is the last frame that
   * is not one of these — otherwise the held steps would open on the bare pivot they erase
   * back to rather than on the word they exist to show.
   */
  seam?: true
  frame: DemoFrame
}

/* Unscaled. Every one is multiplied by motion(), and a reduced-motion reader never reaches
   the timeline at all — the step opens on its resting frame.

   Slow on purpose: these play under a caption someone is reading for the first time, and the
   loop means nothing here is the reader's only chance to see it. */
const PIVOT_HOLD = 640
const TYPE = 200
const LAND_HOLD = 1150
const COMMIT_HOLD = 460
/** A step with nothing to type is one frame long — held only so the timeline has a length. */
const STILL_HOLD = 900
/** How long a held step sits on its finished word before it starts taking it back. */
const LOOP_HOLD = 1700
/** How long a step that commits its last word rests on the finished board before starting over. */
const LOOP_END_HOLD = 1700
/** Backspacing is quicker than typing — it is the reset, not part of the lesson. */
const ERASE = 110
/** The beat on the bare pivot at the bottom of the loop, before the word is made again. */
const LOOP_TAIL = 620

/**
 * One step, as a list of (time, board) pairs.
 *
 * Pure and total: no timers, no GSAP, nothing that has to be running for this to be
 * inspectable. Demo does nothing but seek along it.
 */
export function stepBeats(step: DemoStep): DemoBeat[] {
  const seed = DEMO_SEED
  const beats: DemoBeat[] = []
  const played = [...step.before]
  let clock = 0

  const cursor = () => (played.length === 0 ? 0 : played[played.length - 1].landedAt)

  const push = (frame: Omit<DemoFrame, 'words'>, ms: number, seam?: true) => {
    beats.push({ at: clock, hold: ms, seam, frame: { ...frame, words: [...played] } })
    clock += ms
  }

  const matchedFor = (effective: string): number => {
    const state: RoundState = { seed, currentPos: cursor(), words: played, solved: false }
    return Math.max(seedMatchLength(state, effective), 1)
  }

  const waiting = (mustFinish: boolean) => ({
    currentPos: cursor(),
    effective: seed[cursor()],
    matched: 1,
    preview: null,
    mustFinish,
    solved: false,
  })

  // A step that only talks still has to draw the move it is talking about: the board waits
  // on the word the reader is about to be shown.
  if (step.play.length === 0) {
    push(waiting(played.length + 1 === step.target), STILL_HOLD)
    return beats
  }

  for (const [index, entry] of step.play.entries()) {
    const lastOfStep = index === step.play.length - 1
    const mustFinish = played.length + 1 === step.target
    const landing = seed.slice(entry.chunkEnd + 1, entry.landedAt + 1)
    // The letters the player would actually type. The landing is assumed for them — the box
    // has been holding it out in front of them the whole way — so it is never typed.
    const typed = entry.word.slice(0, entry.word.length - landing.length)

    // The pivot, a blank, and the letters the word could still reach: the shape of the move
    // before anyone has made it.
    push(waiting(mustFinish), PIVOT_HOLD)

    for (let k = 2; k <= typed.length; k++) {
      push({ ...waiting(mustFinish), effective: typed.slice(0, k), matched: matchedFor(typed.slice(0, k)) }, TYPE)
    }

    // Landed. The box closes onto the seed letters the word reached.
    push(
      {
        currentPos: cursor(),
        effective: entry.word,
        matched: matchedFor(entry.word),
        preview: { chunkEnd: entry.chunkEnd, landedAt: entry.landedAt, accepted: true },
        mustFinish,
        solved: false,
      },
      step.hold && lastOfStep ? LOOP_HOLD : LAND_HOLD,
    )

    // Held: the word stays in the box, and the step ends looking at it. The next step opens
    // with it committed to the chain, so nothing is lost by not committing here.
    if (step.hold && lastOfStep) {
      // The step takes its own word back a letter at a time rather than blinking back to the
      // pivot — the same hand that typed it, in reverse, so the loop has a seam.
      for (let k = typed.length - 1; k >= 2; k--) {
        push(
          { ...waiting(mustFinish), effective: typed.slice(0, k), matched: matchedFor(typed.slice(0, k)) },
          ERASE,
          true,
        )
      }
      push(waiting(mustFinish), LOOP_TAIL, true)
      break
    }

    played.push(entry)

    // Committed. The cursor sits on the landing letter, which is the next word's first.
    const solved = entry.landedAt === seed.length - 1
    push(
      {
        currentPos: entry.landedAt,
        effective: solved ? '' : seed[entry.landedAt],
        matched: 1,
        preview: null,
        mustFinish: !solved && played.length + 1 === step.target,
        solved,
      },
      // The finished board is what the step was working towards, so it is rested on before
      // the loop takes it away and starts the chain over.
      lastOfStep ? LOOP_END_HOLD : COMMIT_HOLD,
    )
  }

  return beats
}

/**
 * Total unscaled length of a step, so the timeline can be padded out to it.
 *
 * The tail is the last frame's own hold: whatever the step ends on — a finished board, or the
 * bare pivot a held step erases back to — is given its time rather than cut short.
 */
export const stepDuration = (beats: DemoBeat[]): number =>
  beats.length === 0 ? 0 : beats[beats.length - 1].at + beats[beats.length - 1].hold

/**
 * The board the step settles on, for a reader who has motion turned off.
 *
 * Not simply the last frame: a held step's last frame is the bottom of its loop, and opening
 * on that would show an empty box where the word the caption names should be.
 */
export const restFrame = (beats: DemoBeat[]): DemoFrame =>
  (beats.filter((beat) => !beat.seam).at(-1) ?? beats[beats.length - 1]).frame
