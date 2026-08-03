import { useEffect, useId } from 'react'

interface Props {
  open: boolean
  onClose: () => void
}

export function HelpDialog({ open, onClose }: Props) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[color:var(--color-night)]/70 px-4 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-[24rem] rounded-[1.4rem] border border-rule bg-[color:var(--color-paper)] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="label">How it works</p>
            <h2 id={titleId} className="mt-1 font-display text-xl tracking-[0.02em]">
              Make a chain
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close help"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-rule text-lg leading-none text-ink-soft transition-colors hover:border-ink hover:text-ink"
          >
            ×
          </button>
        </div>

        <div className="mt-4 space-y-3 text-sm leading-6 text-ink-soft">
          <p>
            Build a chain of real words that move across the seed, using each word to advance the current landing point and finish the required tier in exactly 4, 3, or 2 words.
          </p>

          <div className="rounded-2xl border border-rule bg-[color:var(--color-paper-deep)] p-3">
            <p className="font-medium text-ink">If the seed is <span className="font-semibold text-ink">PLANT</span>, these are the options:</p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="font-display text-sm tracking-[0.08em]">
                <span className="font-semibold text-accent">4 words</span>{' '}
                <span className="text-ink">·</span>{' '}
                <span className="text-accent">P</span><span className="text-ink-faint">EARL</span>{' '}
                <span className="text-ink">·</span>{' '}
                <span className="text-accent">L</span><span className="text-ink-faint">AVA</span>{' '}
                <span className="text-ink">·</span>{' '}
                <span className="text-accent">A</span><span className="text-ink-faint">PRON</span>{' '}
                <span className="text-ink">·</span>{' '}
                <span className="text-accent">NIGHT</span>
              </div>
              <div className="font-display text-sm tracking-[0.08em]">
                <span className="font-semibold text-accent">3 words</span>{' '}
                <span className="text-ink">·</span>{' '}
                <span className="text-accent">PL</span><span className="text-ink-faint">ASMA</span>{' '}
                <span className="text-ink">·</span>{' '}
                <span className="text-accent">A</span><span className="text-ink-faint">PRON</span>{' '}
                <span className="text-ink">·</span>{' '}
                <span className="text-accent">NIGHT</span>
              </div>
              <div className="font-display text-sm tracking-[0.08em]">
                <span className="font-semibold text-accent">2 words</span>{' '}
                <span className="text-ink">·</span>{' '}
                <span className="text-accent">PL</span><span className="text-ink-faint">ASMA</span>{' '}
                <span className="text-ink">·</span>{' '}
                <span className="text-accent">A</span><span className="text-ink-faint">CCOUNT</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
