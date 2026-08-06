import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { EyeIcon, EyeOffIcon, HelpIcon, LockIcon, RestartIcon, UndoIcon } from '../components/icons'
import { WordChain } from '../components/WordChain'
import { WordDisplay } from '../components/WordDisplay'
import { motion } from '../game/motion'
import { TIERS } from '../game/storage'
import type { Chains } from '../game/storage'
import { mask, shareText, weld } from '../game/ribbon'
import { useTrapezium } from '../game/useTrapezium'
import type { SubmitFailure } from '../engine/types'

gsap.registerPlugin(useGSAP)

const listLetters = (letters: string): string => {
  const parts = letters.split('')
  if (parts.length === 1) return parts[0]
  return `${parts.slice(0, -1).join(', ')} or ${parts[parts.length - 1]}`
}

interface ErrorContext {
  word: string
  pivot: string
  reachable: string
  seed: string
  used: number
  target: number
}

function errorText(kind: SubmitFailure, ctx: ErrorContext): string {
  const { word, pivot, reachable, seed, used, target } = ctx
  switch (kind) {
    case 'NOT_A_WORD':
      return `${word} isn’t in the dictionary.`
    case 'NO_LANDING':
      return `${word} is a word, but it doesn’t end on ${listLetters(reachable)}.`
    case 'BAD_PREFIX':
      return `It has to start with ${pivot}.`
    case 'TOO_SHORT':
      return `It has to be longer than ${pivot}.`
    case 'ALREADY_USED':
      return `${word} is already in the chain.`
    case 'CONTAINS_SEED':
      return `It can’t contain ${seed}.`
    case 'ENDS_EARLY':
      return `${word} finishes on word ${used + 1}. This round needs exactly ${target}.`
    case 'MUST_FINISH':
      return `${word} is your last word, so it has to reach ${seed[seed.length - 1]}.`
    case 'NO_WORDS_LEFT':
      return `No words left. Undo, or restart the round.`
  }
}

interface PlayingProps {
  /** False while the landing covers the game — nothing here should grab focus behind it. */
  active: boolean
  /**
   * The intro is running. The masthead and the tier labels stay — the intro moves those
   * very elements rather than animating stand-ins — and everything around them waits.
   */
  intro: boolean
  /** Owned by App — the intro's Play tap focuses it before this screen is even on show. */
  inputRef: React.RefObject<HTMLInputElement | null>
  onHome: () => void
  onOpenHelp: () => void
}

export function Playing({ active, intro, inputRef, onHome, onOpenHelp }: PlayingProps) {
  const game = useTrapezium()
  const root = useRef<HTMLElement>(null)
  /**
   * The last state the screen was actually animated for. Null means the first pass, which
   * has to arrive at its opening state without moving — there is nothing to move from yet.
   * A plain "have I run before" flag is not enough: StrictMode mounts, reverts and mounts
   * again, and a flag burnt on the first pass leaves the second one animating the whole
   * game out on load. Comparing values instead makes the repeated pass a no-op.
   */
  const shown = useRef<boolean | null>(null)

  // The display IS the input, so the field must hold focus for the keyboard to stay up.
  const keepFocus = useCallback(() => {
    if (active) inputRef.current?.focus()
  }, [active, inputRef])

  useEffect(() => {
    // Kept focused through a solve too — that's what lets Enter carry straight on to the
    // next target instead of the keyboard dropping the moment the round finishes.
    if (game.ready && !game.allDone) keepFocus()
  }, [keepFocus, game.ready, game.allDone, game.tier, game.round.words.length, game.error?.nonce])

  const shake = game.error?.kind === 'NOT_A_WORD'
  /**
   * Everything the intro is not carrying holds back until the landing has handed over.
   * Visibility is GSAP's now — js-chrome is only the handle it picks these nodes up by —
   * but pointer-events-none still matters as much: without it, buttons underneath the
   * intro (undo, restart, play again, the collapsed tier rows) stay clickable while
   * invisible, so a tap that looks like it hit the intro can silently act on the game.
   */
  const quiet = `js-chrome ${intro ? 'pointer-events-none' : ''}`

  /**
   * The screen opens itself once the landing lets go: the tier titles lean in from the
   * margin, then everything the intro was holding back rises after them. On the way back
   * out it is one fade — the title is already flying home over the top of it, and a
   * staggered exit underneath that reads as two animations arguing.
   */
  useGSAP(
    () => {
      const chrome = gsap.utils.toArray<HTMLElement>('.js-chrome')
      const labels = gsap.utils.toArray<HTMLElement>('[data-tier-label]')
      // Only a real change is worth animating: the opening pass, and StrictMode's repeat of
      // it, both land on their state instantly.
      const changed = shown.current !== null && shown.current !== intro
      const t = changed ? motion() : 0
      shown.current = intro

      if (intro) {
        gsap.to(chrome, { autoAlpha: 0, duration: 0.3 * t, ease: 'power2.in' })
      } else {
        /* fromTo, not from: these nodes are hidden right now — the intro put them that way
           — so anything reading its finish off the element would animate them to nothing. */
        gsap
          /* The field can only take focus once it is actually visible: it rides in on
             .js-chrome, and autoAlpha holds those at visibility:hidden until this timeline
             has run. Asking any earlier — the effect below fires while they are still
             hidden — is a silent no-op, which left the screen open with nothing focused. */
          .timeline({ defaults: { ease: 'power3.out' }, onComplete: keepFocus })
          .fromTo(
            labels,
            { autoAlpha: 0, x: -14 },
            {
              autoAlpha: 1,
              x: 0,
              duration: 0.55 * t,
              stagger: 0.08 * t,
              clearProps: 'transform,opacity,visibility',
            },
            0,
          )
          .fromTo(
            chrome,
            { autoAlpha: 0, y: 12 },
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.5 * t,
              stagger: 0.045 * t,
              // Hands the nodes back to the stylesheet once they have arrived, rather than
              // leaving an identity transform and an inline opacity on half the screen.
              clearProps: 'transform,opacity,visibility',
            },
            0.12 * t,
          )
      }
    },
    { dependencies: [intro], scope: root, revertOnUpdate: true },
  )

  return (
    <main
      ref={root}
      className="relative z-10 mx-auto flex h-[var(--app-height)] w-full max-w-[30rem] flex-col px-6 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <header
        className={`flex shrink-0 items-baseline justify-between border-b pb-1.5 transition-colors duration-500 ${
          intro ? 'border-transparent' : 'border-ink'
        }`}
      >
        <button
          type="button"
          onClick={onHome}
          aria-label="Back to the title"
          data-masthead
          className="origin-center touch-manipulation font-display text-xl font-bold tracking-[0.03em]"
        >
          splittle
        </button>
        <div className={`flex items-center gap-3 ${quiet}`}>
          <IconButton label="Open help" onClick={onOpenHelp}>
            <HelpIcon />
          </IconButton>
          <span className="label tnum">No. {game.puzzleNo}</span>
        </div>
      </header>

      {game.allDone ? (
        // Gated on the intro like everything else — without this, a refresh or a click on
        // the masthead showed the results screen and the intro's title/shape stacked on
        // top of each other, since this branch was never told to make way.
        <div className={`flex min-h-0 flex-1 flex-col ${quiet}`}>
          <AllDone
            streak={game.progress.streak}
            puzzleNo={game.puzzleNo}
            chains={game.progress.chains}
            onPlayAgain={game.playAgain}
          />
        </div>
      ) : (
        /* One section per target. The one being played expands to hold the game; the rest
           stay as rules you can drop onto once they have opened. An already-unlocked but
           inactive row (3 or 2 words, once 4 is done) is a real button underneath the
           intro — pointer-events-none keeps a tap on the intro from also switching tiers. */
        <div className={`flex min-h-0 flex-1 flex-col ${intro ? 'pointer-events-none' : ''}`}>
          {TIERS.map((t) => {
            const open = game.isOpen(t)
            const won = game.progress.tiersWon[t]
            const playing = game.tier === t

            return (
              <section
                key={t}
                data-playfield={playing ? '' : undefined}
                /* flex-grow is the accordion: the open section takes the free space and the
                   others give it back, both over the same 420ms. overflow-hidden lets the
                   round's content be clipped while the section is still growing into it. */
                style={{ flexGrow: playing ? 1 : 0 }}
                /* overflow-hidden is what lets the accordion clip a growing round — but it
                   would also clip the labels the intro lifts out onto the shape, so it only
                   applies once the intro has handed them back. */
                className={`flex min-h-0 shrink-0 flex-col border-b transition-[flex-grow,border-color] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  intro ? 'overflow-visible border-transparent' : 'overflow-hidden border-rule'
                }`}
              >
                {playing ? (
                  /* The open section is titled rather than tabbed, so it carries the round's
                     standing, the controls that act on it, and now the banner that speaks
                     for it — title and prompt read as one block, top to bottom. */
                  <div className="shrink-0 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-baseline gap-2">
                        <h2
                          data-tier-label={t}
                          className="origin-left font-body text-[1.35rem] leading-none font-bold tracking-[-0.01em] whitespace-nowrap"
                        >
                          {t} words
                        </h2>
                        {won && <span className={`text-lg text-accent ${quiet}`}>✓</span>}
                      </div>

                      {/* Arrives with the rest of the chrome. A CSS fade-rise used to run
                          here as well, and a fill:both animation pins opacity to 1 — it
                          would win against anything holding these back. */}
                      <div className={`-mr-2 flex shrink-0 items-center gap-1 ${quiet}`}>
                        <IconButton
                          label="Undo last word"
                          onClick={game.undo}
                          disabled={game.round.words.length === 0}
                        >
                          <UndoIcon />
                        </IconButton>
                        <IconButton
                          label="Restart this round"
                          onClick={game.restart}
                          disabled={game.round.words.length === 0}
                        >
                          <RestartIcon />
                        </IconButton>
                      </div>
                    </div>

                    <div className={quiet}>{playing && <Banner game={game} />}</div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={!open}
                    onClick={() => game.setTier(t)}
                    aria-expanded={false}
                    className="label flex w-full touch-manipulation items-center gap-2 py-3 text-left transition-colors duration-200 disabled:cursor-default"
                  >
                    <span
                      data-tier-label={t}
                      className={`origin-left whitespace-nowrap ${open ? 'text-ink-soft' : 'text-ink-faint'}`}
                    >
                      {t} words
                    </span>
                    {won && <span className={`text-accent ${quiet}`}>✓</span>}
                    {!open && <LockIcon className={`text-ink-faint ${quiet}`} />}
                    {open && !won && (
                      // A part-played section says so, so it is obvious a chain is waiting.
                      <span className={`ml-auto text-ink-faint ${quiet}`}>
                        {game.rounds[t].words.length > 0
                          ? `${game.rounds[t].words.length} down`
                          : 'open'}
                      </span>
                    )}
                  </button>
                )}

                {playing && (
                  // Keyed on the tier so opening a different section replays the entrance
                  // rather than swapping its contents underneath you. Rendered even during
                  // the intro so the layout — and so the labels' real resting places — is
                  // already settled when the intro measures where to send them.
                  <Round
                    key={t}
                    game={game}
                    inputRef={inputRef}
                    keepFocus={keepFocus}
                    shake={shake}
                    quiet={quiet}
                  />
                )}
              </section>
            )
          })}
        </div>
      )}
    </main>
  )
}

type Game = ReturnType<typeof useTrapezium>

function Round({
  game,
  inputRef,
  keepFocus,
  shake,
  quiet,
}: {
  game: Game
  inputRef: React.RefObject<HTMLInputElement | null>
  keepFocus: () => void
  shake: boolean
  quiet: string
}) {
  const done = game.round.words.length
  const left = game.tier - done

  return (
    <div className={`flex min-h-0 flex-1 flex-col pb-2 ${quiet}`}>
      {/* Display, typing and chain are one object. Tapping anywhere raises the keyboard. */}
      <div
        className="relative flex min-h-0 flex-1 flex-col justify-center gap-[clamp(0.5rem,calc(var(--app-height)*0.03),1.5rem)] py-2"
        onPointerDown={keepFocus}
      >
        <p className="label text-center">
          <span className="tnum text-ink">{done}</span> done
          {!game.round.solved && (
            <>
              <span className="mx-2 text-rule">·</span>
              <span className={left === 1 ? 'text-accent' : undefined}>
                <span className="tnum">{left}</span> to go
              </span>
            </>
          )}
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            // A disabled input never receives Enter, so once the round is solved this is
            // the only way Enter still does something — it carries on to the next target
            // instead of playing a word.
            if (game.round.solved) {
              const next = TIERS.find((t) => !game.progress.tiersWon[t])
              if (next) game.setTier(next)
              return
            }
            game.submitWord()
          }}
          style={shake ? { animation: 'reject 420ms var(--ease-out-quint) both' } : undefined}
          key={shake ? game.error?.nonce : 'steady'}
          className="@container"
        >
          <WordDisplay
            seed={game.seed}
            currentPos={game.round.currentPos}
            effective={game.effective}
            matched={game.matched}
            preview={game.preview}
            mustFinish={game.mustFinish}
            solved={game.round.solved}
            justCovered={game.justCovered}
          />
          <input
            ref={inputRef}
            value={game.draft}
            onChange={(e) => game.updateDraft(e.target.value)}
            onKeyDown={(e) => {
              // Nothing of the current word is on screen, so backspace steps back into the
              // previous one rather than doing nothing.
              if (e.key === 'Backspace' && game.canStepBack) {
                e.preventDefault()
                game.undo()
              }
            }}
            // Only gated on readiness now — staying enabled through a solve is what lets
            // Enter reach the form above. WordDisplay ignores the draft once solved, so
            // stray keystrokes here have nowhere to show up.
            disabled={!game.ready}
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="go"
            inputMode="text"
            aria-label="Your word"
            /* 16px keeps iOS Safari from zooming the page on focus. The text itself is
               invisible — WordDisplay renders it.
               `visible` is load-bearing: visibility inherits, but a child may override a
               hidden parent, and this field has to be focusable while the chrome it rides
               in on is still held at autoAlpha 0. Nothing shows either way — the text and
               caret are transparent — and the intro's pointer-events-none keeps it from
               swallowing taps meant for the title screen. */
            className="visible absolute inset-0 h-full w-full cursor-default bg-transparent text-[16px] text-transparent caret-transparent outline-none select-none"
          />
        </form>

        <WordChain seed={game.seed} words={game.round.words} />

        {game.round.solved && <NextTier game={game} />}
      </div>
    </div>
  )
}

/** Sits under the chain once the round is done — the way on to the next target. */
function NextTier({ game }: { game: Game }) {
  const next = TIERS.find((t) => !game.progress.tiersWon[t])
  if (!next) return null

  return (
    <div
      className="flex justify-center"
      style={{ animation: 'fade-rise 520ms var(--ease-out-quint) both', animationDelay: '160ms' }}
    >
      <button
        type="button"
        onClick={() => game.setTier(next)}
        className="label touch-manipulation border-b border-ink py-1.5 text-ink transition-colors duration-200"
      >
        {next} words →
      </button>
    </div>
  )
}

/**
 * The round's single line of speech — coaching, prompting, rejecting — sitting directly
 * under the section title it belongs to. Committing a word is Enter / the keyboard's Go
 * key, same as it always was; this strip only ever talks, it doesn't act.
 */
function Banner({ game }: { game: Game }) {
  // Solved rounds have nothing left to say; the chain and the next-tier button carry it.
  if (game.round.solved) return null

  const left = game.tier - game.round.words.length
  const finish = game.seed[game.seed.length - 1]

  // At 4 words every chunk is exactly one seed letter — the pivots use up the whole seed,
  // so there's no room for a chunk to run longer. Below that, some chunks necessarily span
  // more than one letter, which is the one thing a new player can't guess from the display
  // alone, so the opening line is the one place it gets spelled out.
  const opening =
    game.tier === 4
      ? `Split today's word into 4 words. Start with ${game.pivot}.`
      : `Split today's word into ${game.tier} words — a start or end can span more than one letter. Start with ${game.pivot}.`

  // The prompt tracks the target it belongs to, so a 4-word round never reads like a
  // 2-word one. Kept to a phrase — the count above already carries the arithmetic.
  const hint =
    game.round.words.length === 0
      ? opening
      : left === 1
        ? `Last word — ${game.pivot} to ${finish}.`
        : `${left} more, carrying on from ${game.pivot}.`

  const message = game.error
    ? {
        key: `err-${game.error.nonce}`,
        alert: true,
        text: errorText(game.error.kind, {
          word: game.error.word,
          pivot: game.pivot,
          reachable: game.reachable,
          seed: game.seed,
          used: game.round.words.length,
          target: game.tier,
        }),
      }
    : { key: `hint-${game.tier}-${left}`, alert: false, text: hint }

  return (
    <p
      key={message.key}
      role="status"
      className={`mt-1 text-left font-body text-[0.8rem] leading-snug transition-colors duration-300 ${
        message.alert ? 'text-accent' : 'text-ink-soft'
      }`}
      style={{ animation: 'fade-in 300ms var(--ease-out-quint) both' }}
    >
      {message.text}
    </p>
  )
}

function IconButton({
  children,
  label,
  onClick,
  disabled,
  className = '',
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center text-ink-soft transition-opacity duration-200 disabled:opacity-25 ${className}`}
    >
      {children}
    </button>
  )
}

/** Placeholder. The share card lands here. */
/**
 * The card.
 *
 * Each row is one tier's chain welded into a single word — every word starts on the letter the
 * one before it landed on, so the joins are one letter deep and the whole chain reads as one
 * ribbon. Masked, the seed's own letters are all that survive, which is the puzzle stated as a
 * picture: CLEAN stretched across a chain the reader has to make themselves.
 *
 * Masked is what leaves. The unmasked ribbon is the answer — CONTROLEARN is CONTROL and LEARN
 * to anyone who looks at it twice — so revealing it is a deliberate tap, and only then does
 * the share carry it.
 */
function ShareCard({
  puzzleNo,
  chains,
  children,
}: {
  puzzleNo: number
  chains: Chains
  /** Rendered beside Share. The screen's other action belongs on that row, not under it —
   *  two buttons on one line leave one silhouette where stacking them left three. */
  children?: React.ReactNode
}) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [fallback, setFallback] = useState<string | null>(null)

  const rows = TIERS.map((tier) => {
    const words = chains[tier]
    if (!words || words.length === 0) return null
    return { tier, ribbon: revealed ? weld(words) : mask(words) }
  }).filter((row) => row !== null)

  const share = useCallback(async () => {
    const text = shareText(puzzleNo, chains, revealed)
    try {
      // The share sheet where there is one. A cancelled sheet rejects, and falling through to
      // the clipboard would then copy something nobody asked for — hence the two catches.
      if (navigator.share) {
        await navigator.share({ text })
        return
      }
    } catch {
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      // A denied clipboard is the one failure the player would otherwise experience as the
      // button doing nothing at all. Put the text on screen, ready to select, and let them
      // take it by hand.
      setFallback(text)
    }
  }, [puzzleNo, chains, revealed])

  useEffect(() => {
    if (!copied) return
    const id = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(id)
  }, [copied])

  if (rows.length === 0) return null

  return (
    /* One grid column, sized to fit its widest child. Both rows stretch to it, so the panel
       takes its minimum width from the button row and grows past it only when a long chain
       needs the space. max-w-full keeps that from pushing off a narrow screen. */
    <div className="mx-auto grid w-fit max-w-full gap-7">
      {/* The card, made an object: the chain sits in a panel of the same cut as the buttons,
          and the eye that uncovers it lives on that panel rather than floating underneath.
          Padding is lopsided on purpose — the rows start at the left edge, and only the right
          has an icon to clear. */}
      <div className="pixel-panel-lift">
        <div className="pixel-panel">
          <div className="relative py-5 pr-10 pl-5">
            {/* The rows never wrap, so the viewport term has to leave room for the longest
                chain a 4-word round can weld — past about 5vw a run of 20 letters pushes the
                panel through its own max-width and scrolls the page. */}
            <div className="flex flex-col items-start gap-1.5 font-display text-[clamp(1.1rem,5vw,1.6rem)] leading-tight font-bold tracking-[0.08em]">
              {rows.map((row) => (
                <span key={row.tier} className="whitespace-nowrap">
                  {row.ribbon}
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setRevealed((current) => !current)
                setCopied(false)
                setFallback(null)
              }}
              aria-label={revealed ? 'Hide the chain' : 'Reveal the chain'}
              aria-pressed={revealed}
              className="absolute top-1/2 right-1 flex h-11 w-11 -translate-y-1/2 touch-manipulation items-center justify-center text-ink-soft transition-colors duration-200 hover:text-ink"
            >
              {revealed ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>
      </div>
      <div className="flex items-flex-end justify-center gap-3">
        <span className="pixel-notch-lift">
          <button
            type="button"
            onClick={share}
            className="pixel-notch pixel-ink touch-manipulation px-5 py-3"
          >
            {copied ? 'Copied' : 'Share'}
          </button>
        </span>
        {children}
      </div>
      {fallback !== null && (
        <textarea
          readOnly
          value={fallback}
          rows={4}
          onFocus={(e) => e.currentTarget.select()}
          ref={(node) => node?.select()}
          aria-label="Your result, ready to copy"
          className="w-full max-w-[24rem] resize-none rounded-sm border border-ink-soft bg-transparent p-2 text-center font-display text-xs leading-tight tracking-[0.08em] text-ink"
        />
      )}
    </div>
  )
}

function AllDone({
  streak,
  puzzleNo,
  chains,
  onPlayAgain,
}: {
  streak: number
  puzzleNo: number
  chains: Chains
  onPlayAgain: () => void
}) {
  return (
    /* Spacing does the grouping. An even gap between all four blocks left the streak floating
       equidistant from the headline it belongs to and the ribbon it doesn't, which is most of
       what read as clutter — tight within a group, open between them. */
    <div
      className="flex min-h-0 flex-1 flex-col items-center justify-center text-center"
      style={{ animation: 'fade-rise 620ms var(--ease-out-quint) both' }}
    >
      <p className="font-display text-[clamp(2rem,10vw,3rem)] leading-none">
        All three <span className="text-accent">crossed</span>
      </p>
      <p className="label mt-3">
        Streak <span className="tnum text-ink">{streak}</span>
      </p>
      <div className="mt-10 w-full">
        <ShareCard puzzleNo={puzzleNo} chains={chains}>
          {/* A finished puzzle would otherwise be a dead end until the seed turns over at
              midnight UTC — every visit before then landing back here with nothing left to
              play. Sage, and last on the row: it is the way onward. */}
          <span className="pixel-notch-lift">
            <button
              type="button"
              onClick={onPlayAgain}
              className="pixel-notch pixel-accent touch-manipulation px-5 py-3"
            >
              Play again →
            </button>
          </span>
        </ShareCard>
      </div>
    </div>
  )
}
