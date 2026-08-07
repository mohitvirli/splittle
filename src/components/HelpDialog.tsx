import { useEffect, useId, useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { motion } from '../game/motion'
import { Demo } from './Demo'

gsap.registerPlugin(useGSAP)

interface Props {
  open: boolean
  onClose: () => void
}

export function HelpDialog({ open, onClose }: Props) {
  const titleId = useId()
  const root = useRef<HTMLDivElement>(null)
  const backdrop = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  /** Stays mounted a beat past `open` going false, so the close has something to animate. */
  const [rendered, setRendered] = useState(open)

  useEffect(() => {
    if (open) setRendered(true)
  }, [open])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const { contextSafe } = useGSAP(
    () => {
      if (!rendered) return
      const t = motion()

      if (open) {
        gsap
          .timeline()
          .fromTo(backdrop.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.28 * t }, 0)
          .fromTo(
            card.current,
            { autoAlpha: 0, y: 18, scale: 0.96 },
            { autoAlpha: 1, y: 0, scale: 1, duration: 0.4 * t, ease: 'back.out(1.6)' },
            0.03 * t,
          )
      }
    },
    { dependencies: [open, rendered], scope: root },
  )

  // A click outside the card, the × button and Escape all funnel through here — every way out
  // plays the same close, then unmounts once it has actually finished closing.
  const close = contextSafe(() => {
    const t = motion()
    gsap
      .timeline({ onComplete: () => setRendered(false) })
      .to(card.current, { autoAlpha: 0, y: 12, scale: 0.97, duration: 0.2 * t, ease: 'power2.in' }, 0)
      .to(backdrop.current, { autoAlpha: 0, duration: 0.22 * t }, 0)
    onClose()
  })

  if (!rendered) return null

  return (
    <div ref={root} className="fixed inset-0 z-[60]">
      {/* Enough to push the game back a step and no more: the board behind is part of what
          the tutorial is talking about, so it stays legible rather than being blacked out. */}
      <div
        ref={backdrop}
        className="absolute inset-0 bg-[color:var(--color-night)]/20 backdrop-blur-[2px]"
        onClick={close}
      />
      <div className="flex h-full items-center justify-center px-4" onClick={close}>
        {/* Cut the way the share card is: a stepped frame with its own cast, rather than a
            rounded rectangle under a soft shadow. Three boxes — the lift carries the shadow,
            the panel the frame, and the innermost one the paper the content sits on — because
            a clip-path cuts a border and a pseudo-element along with everything else. */}
        <div
          ref={card}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="pixel-panel-lift w-full max-w-[24rem]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="pixel-panel">
            <div className="relative px-5 pt-5 pb-4">
              {/* Bare. It is the way out of a dialog nobody is being kept in, and a frame
                  around it put it in competition with the button meant to be pressed. */}
              <button
                type="button"
                onClick={close}
                aria-label="Close help"
                className="absolute top-3 right-3 flex h-8 w-8 touch-manipulation items-center justify-center font-body text-base leading-none text-ink-soft transition-colors duration-200 hover:text-ink"
              >
                ×
              </button>

              <h2 id={titleId} className="font-display text-xl tracking-[0.02em]">
                How to play
              </h2>

              {/* One sentence, and then the demo does the rest. Everything this used to say in
                  prose — where a word starts, where it lands, why a shorter chain needs longer
                  chunks — is a thing the steps below show happening. */}
              <p className="mt-2 pr-10 text-sm leading-6 text-ink-soft">
                Split the five-letter word of the day into a group of words — 4, then 3, then
                2. If the word is{' '}
                <span className="font-display tracking-[0.06em] text-ink">PLANT</span>:
              </p>

              {/* The sentence sets the puzzle up; everything under the rule is the worked
                  example. Different kinds of thing, so they get a line between them. */}
              <hr className="mt-4 border-0 border-t border-rule" />

              <div className="mt-4">
                <Demo onDone={close} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
