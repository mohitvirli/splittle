import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { allTiersWon, loadProgress, TIERS } from '../game/storage'

type Phase = 'title' | 'shape' | 'open'

const SHAPE_HOLD = 720
const MORPH_MS = 620
const FADE_MS = 320
const IDLE_SHAPE_OPACITY = 0.18
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

const TRAPEZOID = 'polygon(0% 0%, 100% 0%, 92% 100%, 8% 100%)'
const RECTANGLE = 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)'

/** Literal rather than var(): the labels sit on the dark shape before they come home. */
const PAPER = 'oklch(0.968 0.014 82)'

/**
 * One trapezium, cut into three bands — widest target on top, narrowest at the bottom.
 * The sides slope continuously through all three, which is why these are polygons sharing
 * edge points rather than stacked boxes.
 */
const BANDS = [
  { points: '0,0 100,0 92,20 8,20', mid: 10 },
  { points: '8,20 92,20 84,40 16,40', mid: 30 },
  { points: '16,40 84,40 76,60 24,60', mid: 50 },
]

const SEAMS = [
  { x1: 8, x2: 92, y: 20 },
  { x1: 16, x2: 84, y: 40 },
]

const masthead = () => document.querySelector<HTMLElement>('[data-masthead]')
const tierLabel = (tier: number) =>
  document.querySelector<HTMLElement>(`[data-tier-label="${tier}"]`)

/** Measure an element where it would sit with no transform applied. */
function restingRect(el: HTMLElement): DOMRect {
  const transform = el.style.transform
  const transition = el.style.transition
  el.style.transition = 'none'
  el.style.transform = ''
  const rect = el.getBoundingClientRect()
  el.style.transform = transform
  void el.offsetWidth
  el.style.transition = transition
  return rect
}

/**
 * Move an element and fade it in, never both at once.
 *
 * The reposition happens with transitions off and the element already invisible, so the
 * only thing anyone sees is the fade. Sliding instead would mean four elements travelling
 * different directions at once on the way into the game, and a visible lurch on first paint
 * as they left the positions the page had just rendered them in.
 */
function placeThenFade(el: HTMLElement | null, transform: string, delay = 0, color = '') {
  if (!el) return
  el.style.transition = 'none'
  el.style.opacity = '0'
  el.style.transform = transform
  el.style.color = color
  el.style.position = 'relative'
  el.style.zIndex = '30'
  void el.offsetWidth
  el.style.transition = `opacity ${FADE_MS}ms ${EASE} ${delay}ms`
  el.style.opacity = '1'
}

interface Props {
  onDone: () => void
}

/**
 * The title sequence, played with the game's own elements.
 *
 * Nothing here is a copy. The masthead and the three tier labels are the real nodes from
 * the playing screen, moved to their intro positions and later put back — so there is never
 * a swap from a stand-in to the real thing, and never a frame where neither is on screen.
 *
 * The dark trapezium is the one piece that is genuinely the intro's own, and it sits behind
 * the game (z-5, under main's z-10) so the labels read on top of it without any shuffling.
 */
export function Intro({ onDone }: Props) {
  const [phase, setPhase] = useState<Phase>('title')
  const anchorRefs = useRef<(SVGTextElement | null)[]>([])
  const bandRef = useRef<SVGPolygonElement>(null)
  const morphRef = useRef<HTMLDivElement>(null)

  /** Put a borrowed element back exactly as the playing screen styles it. */
  const release = useCallback((el: HTMLElement | null) => {
    if (!el) return
    el.style.transition = ''
    el.style.transform = ''
    el.style.color = ''
    el.style.opacity = ''
    el.style.zIndex = ''
    el.style.position = ''
  }, [])

  const start = useCallback(() => {
    // Nothing to open into when every tier is already won — the accordion isn't on screen
    // to morph the shape onto or to hand the tier labels back to. Skip straight through,
    // the same as the reduced-motion path, rather than playing the shape dance into a void.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || allTiersWon(loadProgress())) {
      release(masthead())
      TIERS.forEach((t) => release(tierLabel(t)))
      onDone()
      return
    }
    setPhase('shape')
  }, [onDone, release])

  // Take the title to the middle. Runs before paint, so the page never shows it anywhere else.
  useLayoutEffect(() => {
    const title = masthead()
    if (!title) return
    const rect = restingRect(title)
    const dx = window.innerWidth / 2 - (rect.left + rect.width / 2)
    const dy = document.documentElement.clientHeight * 0.36 - (rect.top + rect.height / 2)
    placeThenFade(title, `translate(${dx}px, ${dy}px) scale(2.6)`)
    TIERS.forEach((t) => {
      const label = tierLabel(t)
      if (label) {
        label.style.transition = 'none'
        label.style.opacity = '0'
      }
    })
  }, [])

  // Labels take their places on the bands.
  useLayoutEffect(() => {
    if (phase !== 'shape') return
    TIERS.forEach((tier, i) => {
      const label = tierLabel(tier)
      const anchor = anchorRefs.current[i]
      if (!label || !anchor) return
      const from = restingRect(label)
      const to = anchor.getBoundingClientRect()
      const dx = to.left + to.width / 2 - (from.left + from.width / 2)
      const dy = to.top + to.height / 2 - (from.top + from.height / 2)
      placeThenFade(label, `translate(${dx}px, ${dy}px) scale(${to.height / from.height})`, i * 110, PAPER)
    })
  }, [phase])

  useEffect(() => {
    if (phase !== 'shape') return
    const id = window.setTimeout(() => setPhase('open'), SHAPE_HOLD)
    return () => window.clearTimeout(id)
  }, [phase])

  // Everything goes home: back to its own place, and back into view there.
  useLayoutEffect(() => {
    if (phase !== 'open') return

    placeThenFade(masthead(), '')
    TIERS.forEach((tier, i) => placeThenFade(tierLabel(tier), '', 60 + i * 50))

    // The 4-band straightens and grows into the round's area behind them.
    const playfield = document.querySelector('[data-playfield]')
    const band = bandRef.current?.getBoundingClientRect()
    if (morphRef.current && playfield && band) {
      const to = playfield.getBoundingClientRect()
      morphRef.current.animate(
        [
          { transform: 'none', clipPath: TRAPEZOID, opacity: 1 },
          { clipPath: RECTANGLE, offset: 0.5 },
          { opacity: 1, offset: 0.8 },
          {
            transform: `translate(${to.left - band.left}px, ${to.top - band.top}px) scale(${to.width / band.width}, ${to.height / band.height})`,
            opacity: 0,
          },
        ],
        { duration: MORPH_MS, easing: EASE, fill: 'forwards' },
      )
    }
  }, [phase])

  useEffect(() => {
    if (phase !== 'open') return
    const id = window.setTimeout(() => {
      release(masthead())
      TIERS.forEach((t) => release(tierLabel(t)))
      onDone()
    }, MORPH_MS + 80)
    return () => window.clearTimeout(id)
  }, [phase, onDone, release])

  // Leaving early — a home click on the way back out — must not strand the borrowed nodes.
  useEffect(() => () => {
    release(masthead())
    TIERS.forEach((t) => release(tierLabel(t)))
  }, [release])

  const opening = phase === 'open'
  const shapeOpacity = phase === 'title' ? IDLE_SHAPE_OPACITY : phase === 'shape' ? 1 : 0

  return (
    <>
      {/* Behind the game, which paints at z-10 over a transparent background. */}
      <div className="pointer-events-none fixed inset-0 z-[5] flex flex-col items-center justify-center px-6">
        <svg
          viewBox="0 0 100 60"
          aria-hidden
          data-intro-shape
          className="mt-[26vh] w-full max-w-[19rem] transition-opacity duration-300"
          style={{ opacity: shapeOpacity }}
        >
          {BANDS.map((band, i) => (
            <g key={TIERS[i]}>
              <polygon
                ref={i === 0 ? bandRef : undefined}
                points={band.points}
                fill="var(--color-night)"
              />
              {/* Invisible: these only mark where the real labels should go. */}
              <text
                ref={(el) => {
                  anchorRefs.current[i] = el
                }}
                x="50"
                y={band.mid}
                textAnchor="middle"
                dominantBaseline="central"
                fill="transparent"
                fontSize="4.6"
                fontWeight="500"
                letterSpacing="0.9"
                fontFamily="var(--font-body)"
              >
                {TIERS[i]} words
              </text>
            </g>
          ))}

          {SEAMS.map((seam) => (
            <line
              key={seam.y}
              x1={seam.x1}
              x2={seam.x2}
              y1={seam.y}
              y2={seam.y}
              stroke="var(--color-paper)"
              strokeWidth="0.7"
            />
          ))}
        </svg>
      </div>

      {opening && bandRef.current && (
        <div
          ref={morphRef}
          aria-hidden
          className="pointer-events-none fixed z-[5] origin-top-left bg-night"
          style={{
            left: bandRef.current.getBoundingClientRect().left,
            top: bandRef.current.getBoundingClientRect().top,
            width: bandRef.current.getBoundingClientRect().width,
            height: bandRef.current.getBoundingClientRect().height,
            clipPath: TRAPEZOID,
          }}
        />
      )}

      {phase === 'title' && (
        <div className="fixed inset-0 z-30">
          <button
            type="button"
            onClick={start}
            autoFocus
            className="label absolute left-1/2 top-[calc(36vh+3.45rem)] -translate-x-1/2 touch-manipulation border-b border-ink pb-1 text-ink transition-opacity duration-200 hover:opacity-60"
            style={{
              animation: 'fade-in 500ms var(--ease-out-quint) both',
              animationDelay: '420ms',
            }}
          >
            Play →
          </button>
        </div>
      )}
    </>
  )
}
