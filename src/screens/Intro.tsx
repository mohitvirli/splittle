import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { TIERS } from '../game/storage'
import { motion } from '../game/motion'

gsap.registerPlugin(useGSAP)

const masthead = () => document.querySelector<HTMLElement>('[data-masthead]')

const tierLabels = () =>
  TIERS.map((t) => document.querySelector<HTMLElement>(`[data-tier-label="${t}"]`)).filter(
    (el): el is HTMLElement => el !== null,
  )

/** Measure an element where it would sit with no transform applied. */
function restingRect(el: HTMLElement): DOMRect {
  const transform = el.style.transform
  el.style.transform = 'none'
  const rect = el.getBoundingClientRect()
  el.style.transform = transform
  return rect
}

interface Props {
  onDone: () => void
  /** The playing screen's field. Focused on the Play tap — see start(). */
  inputRef: React.RefObject<HTMLInputElement | null>
  onOpenHelp: () => void
}

/**
 * The title screen, played with the game's own masthead.
 *
 * The wordmark is not a copy — it is the real node from the playing screen, held in the
 * middle of the page and flown back to the header on Play. That is what keeps the handover
 * free of a swap between a stand-in and the real thing.
 */
export function Intro({ onDone, inputRef, onOpenHelp }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const leaving = useRef(false)

  const { contextSafe } = useGSAP(
    () => {
      const title = masthead()
      if (!title) return

      const rect = restingRect(title)
      const dx = window.innerWidth / 2 - (rect.left + rect.width / 2)
      const dy = document.documentElement.clientHeight * 0.36 - (rect.top + rect.height / 2)
      const t = motion()

      /* The title is put in place before the first paint and while it is still invisible, so
         the page never shows it up in the header and then lurches — all anyone sees is the
         fade and the tail of the settle. The labels wait; the playing screen brings them in. */
      gsap.set(title, {
        x: dx,
        y: dy,
        scale: 2.6,
        autoAlpha: 0,
        position: 'relative',
        zIndex: 30,
      })
      gsap.set(tierLabels(), { autoAlpha: 0 })

      /* Both ends of every tween are written out. A from() would take whatever the node
         happens to read as its finish, and these nodes are routinely mid-animation or
         still carrying the last pass's inline styles — StrictMode alone mounts this twice
         — which is how a button ends its entrance at the opacity it started from. */
      gsap
        .timeline()
        .fromTo(title, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.7 * t, ease: 'power2.out' }, 0)
        // Runs against the same target as the fade but on other properties: the wordmark
        // drifts up and swells the last fraction of its scale while it is arriving.
        .fromTo(
          title,
          { y: dy + 18, scale: 2.42 },
          { y: dy, scale: 2.6, duration: 1.1 * t, ease: 'expo.out' },
          0,
        )
        .fromTo(
          '[data-intro-action]',
          { autoAlpha: 0, y: 14 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.6 * t,
            stagger: 0.09 * t,
            ease: 'power3.out',
          },
          0.34 * t,
        )
    },
    { scope: root },
  )

  /**
   * Play. The actions clear out first, then the wordmark travels back to the header it came
   * from — one continuous move rather than a crossfade between two positions. The playing
   * screen is only told to take over once the title has landed, and unmounting reverts this
   * context, which strips the inline transform off a node already sitting at rest.
   */
  const start = contextSafe(() => {
    if (leaving.current) return
    leaving.current = true

    /* First thing, and synchronously: a phone opens its keyboard only for a focus() made
       during the tap that called for it. Waiting for the handover to finish is too late —
       the activation this tap granted is gone by then and the request is ignored, which is
       why the game used to open with the caret blinking and no keyboard. The field is
       still behind the title here, but it carries its own `visible` so it can take focus
       anyway. */
    inputRef.current?.focus()

    const title = masthead()
    const t = motion()
    const tl = gsap.timeline({ onComplete: onDone })

    tl.to(
      '[data-intro-action]',
      { autoAlpha: 0, y: -10, duration: 0.24 * t, stagger: 0.05 * t, ease: 'power2.in' },
      0,
    )
    if (title) {
      tl.to(title, { x: 0, y: 0, scale: 1, duration: 0.78 * t, ease: 'expo.inOut' }, 0.08 * t)
    }
  })

  return (
    <div ref={root} className="fixed inset-0 z-30">
      <p
        data-intro-action
        className="absolute top-[calc(36vh+2.5rem)] left-1/2 -translate-x-1/2 whitespace-nowrap font-body text-sm text-ink-soft"
      >
        Split the word into a chain
      </p>

      {/* The intro's tween targets the wrapper, not the button: GSAP owns the transform
          on one and the press owns it on the other, so neither overwrites the other. */}
      <span
        data-intro-action
        className="pixel-notch-lift absolute top-[calc(36vh+5.25rem)] left-1/2 -translate-x-1/2"
      >
        <button
          type="button"
          onClick={start}
          autoFocus
          className="pixel-notch pixel-accent touch-manipulation px-6 py-3.5"
        >
          Play →
        </button>
      </span>

      <span
        data-intro-action
        className="pixel-notch-lift absolute top-[calc(36vh+9.5rem)] left-1/2 -translate-x-1/2"
      >
        <button
          type="button"
          onClick={onOpenHelp}
          aria-label="Open help"
          className="pixel-notch pixel-quiet touch-manipulation px-5 py-3"
        >
          How to play
        </button>
      </span>
    </div>
  )
}
