import { useCallback, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { BangIcon } from './icons'
import { ChainWord } from './WordChain'
import { WordDisplay } from './WordDisplay'
import { DEMO_SEED, DEMO_STEPS, restFrame, stepBeats, stepDuration, stepLoops } from '../game/demo'
import { motion } from '../game/motion'

gsap.registerPlugin(useGSAP)

/**
 * The game playing itself, a step at a time.
 *
 * Every frame goes through the game's own WordDisplay and ChainWord, driven by the same shape
 * of state a real round hands them — so the tutorial cannot drift into showing a board the
 * game does not draw. Each step plays its own words out and then plays them again; only the
 * reader moves the tutorial on, which is why this is stepped rather than one long run.
 *
 * Reduced motion opens every step on its resting board. The steps and their captions are
 * unchanged; only the typing is skipped.
 */
export function Demo({ onDone }: { onDone?: () => void }) {
  const [still] = useState(() => motion() === 0)
  const [index, setIndex] = useState(0)
  const [frameIndex, setFrameIndex] = useState(0)
  const root = useRef<HTMLDivElement>(null)

  const step = DEMO_STEPS[index]
  const beats = useMemo(() => stepBeats(step), [step])
  const last = index === DEMO_STEPS.length - 1

  const go = useCallback((next: number) => {
    setIndex(next)
    setFrameIndex(0)
  }, [])

  useGSAP(
    () => {
      if (still) return
      const t = motion()
      // Every step that types plays again rather than freezing on its last frame. The first
      // beat sits at time 0, which a repeat skips over, so the wrap resets the board itself.
      const tl = gsap.timeline({
        repeat: stepLoops(step) ? -1 : 0,
        onRepeat: () => setFrameIndex(0),
      })
      // Padded to the whole step first, so its last frame is held rather than cut short.
      tl.to({}, { duration: (stepDuration(beats) * t) / 1000 }, 0)
      for (const [i, beat] of beats.entries()) {
        tl.call(() => setFrameIndex(i), undefined, (beat.at * t) / 1000)
      }
    },
    { dependencies: [step, beats, still], scope: root, revertOnUpdate: true },
  )

  const frame = still ? restFrame(beats) : beats[Math.min(frameIndex, beats.length - 1)].frame

  return (
    <div ref={root} className="flex w-full flex-col items-center gap-3">
      <p className="font-display text-[1.05rem] leading-none font-bold tracking-[0.06em] text-accent">
        {step.label}
      </p>

      {/* @container is what WordDisplay sizes itself against — this max-width is the only
          thing deciding how big the tutorial's board is.
          The height is fixed and the board is centred in it: the type scales to whatever the
          row needs, so a short board is a tall one, and letting that through would have the
          dialog growing and shrinking by a few pixels on every keystroke. */}
      <div className="@container flex h-14 w-full max-w-[17rem] items-center justify-center">
        <WordDisplay
          seed={DEMO_SEED}
          currentPos={frame.currentPos}
          effective={frame.effective}
          matched={frame.matched}
          preview={frame.preview}
          mustFinish={frame.mustFinish}
          solved={frame.solved}
          justCovered={null}
        />
      </div>

      {/* Held at a fixed height: the chain grows from nothing to four words and starts over,
          and a box that resizes under the board makes the whole card breathe. */}
      <ol className="flex h-[1.9rem] flex-wrap content-start items-baseline justify-center gap-x-2.5 gap-y-1">
        {frame.words.map((entry) => (
          <li
            key={entry.word}
            className="flex items-baseline gap-2.5"
            style={{ animation: 'fade-rise 460ms var(--ease-out-quint) both' }}
          >
            <ChainWord seed={DEMO_SEED} entry={entry} className="text-[0.95rem]" />
          </li>
        ))}
      </ol>

      {/* The coaching, in a note of its own rather than as more caption under the board.
          Two lines' worth of room whether the step fills them or not — the card's height is
          the one thing that must not move as the steps go by — and pre-line, so the text
          breaks where its sentences do rather than where the box runs out. */}
      <div
        key={index}
        className="pixel-hint w-full"
        style={{ animation: 'fade-in 300ms var(--ease-out-quint) both' }}
      >
        <div className="flex h-[3rem] items-center gap-2.5 px-3">
          <BangIcon className="shrink-0 text-accent" />
          <p className="font-body text-[0.78rem] leading-snug whitespace-pre-line text-ink">
            {step.caption}
          </p>
        </div>
      </div>

      <div className="flex w-full items-center justify-between gap-3">
        <TransportButton onClick={() => go(index - 1)} disabled={index === 0}>
          ← Back
        </TransportButton>

        {/* Where the reader is, without a number to read: one mark per step. */}
        <ol className="flex items-center gap-1.5" aria-label={`Step ${index + 1} of ${DEMO_STEPS.length}`}>
          {DEMO_STEPS.map((other, i) => (
            <li
              key={`${other.label}-${i}`}
              aria-current={i === index ? 'step' : undefined}
              className={`h-1.5 w-1.5 transition-colors duration-200 ${
                i === index ? 'bg-accent' : 'bg-rule'
              }`}
            />
          ))}
        </ol>

        {/* One button, two jobs: on through the steps, and out at the end. Leaving early is
            the × on the card — a second way out sitting beside Next only ever competed with
            the thing the reader is meant to press. */}
        {last ? (
          <TransportButton onClick={onDone} strong accent>
            Play →
          </TransportButton>
        ) : (
          <TransportButton onClick={() => go(index + 1)} strong>
            Next →
          </TransportButton>
        )}
      </div>
    </div>
  )
}

/** The type every control in this row wears, whether or not it is wearing a frame too. */
const transportType = 'font-body text-[0.7rem] font-bold uppercase tracking-[0.14em] leading-none'

/**
 * The row's controls, at two weights.
 *
 * The one that carries the reader on is framed; Back is the same type with nothing round it,
 * because two boxes side by side in a card this size read as a choice between equals, and
 * this is not one. Neither casts — the Play button's shadow is the height of a screen's one
 * action, and inside a dialog it is just a heavy button.
 *
 * Disabled takes pointer-events with it as well as most of its opacity: the frame steps down
 * on press through CSS alone, and a disabled button that still answers the mouse looks like
 * one that would work if you tried harder.
 */
function TransportButton({
  children,
  onClick,
  disabled,
  strong,
  accent,
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  strong?: boolean
  /** The last step's button is the way into the game, so it fills with the sage the Play
   *  button wears. Set inline: it has to beat the utility's own frame colour, and the two
   *  are the same weight in the cascade. */
  accent?: boolean
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={accent ? { color: 'var(--color-paper)' } : undefined}
      className={`${transportType} touch-manipulation transition-colors duration-300 ${
        strong ? 'px-4 py-2.5' : 'py-2.5 text-ink-soft hover:text-ink'
      } ${disabled ? 'pointer-events-none opacity-25' : ''}`}
    >
      {children}
    </button>
  )

  if (!strong) return button

  return (
    <span
      className="pixel-outline transition-colors duration-300"
      // Outline to fill over the same 300ms as the type inside it: the button becoming the
      // sage one is the last step arriving, and a colour that snaps reads as a swap.
      style={
        accent
          ? ({ '--frame': 'var(--color-accent)', '--fill': 'var(--color-accent)' } as React.CSSProperties)
          : undefined
      }
    >
      {button}
    </span>
  )
}
