/**
 * Shelved, not deleted. The live "how many words start with this chunk" readout is
 * unused while chunk selection is inferred from typing rather than chosen up front.
 * `Dictionary.countWordsStartingWith` still backs it.
 */
export interface Drop {
  from: number
  to: number
  nonce: number
}

interface Props {
  count: number | null
  baseCount: number | null
  chunk: string
  drop: Drop | null
}

/**
 * The screen's centre of gravity. The figure itself carries the risk: the player
 * watches their options collapse as they reach further into the seed.
 */
export function Counter({ count, baseCount, chunk, drop }: Props) {
  // Square root, not linear or log. Linear makes every chunk past the first read as
  // "gone"; log flatters the drop. This keeps later taps legible and still stings.
  const ratio =
    count !== null && baseCount !== null && baseCount > 0
      ? Math.sqrt(count / baseCount)
      : 1

  return (
    <div className="relative">
      <div className="relative flex items-baseline">
        <span className="relative block overflow-hidden pb-1">
          <span
            key={count ?? 'idle'}
            className="tnum block font-body text-[clamp(2.5rem,min(20vw,calc(var(--app-height)*0.12)),5.5rem)] leading-[0.9] font-[350] text-ink"
            style={{ animation: 'figure-in 560ms var(--ease-out-quint) both' }}
          >
            {count === null ? '—' : count.toLocaleString('en-US')}
          </span>
        </span>

        {drop && (
          <span
            key={drop.nonce}
            className="tnum ml-3 self-start pt-2 font-body text-lg font-medium text-accent"
            style={{ animation: 'delta-in 1000ms var(--ease-out-quint) both' }}
          >
            {drop.to - drop.from > 0 ? '+' : '−'}
            {Math.abs(drop.to - drop.from).toLocaleString('en-US')}
          </span>
        )}
      </div>

      {/* How much of the starting field is left. Shrinks with every letter taken. */}
      <div className="mt-1 h-px w-full bg-rule">
        <div
          className="h-px origin-left bg-accent transition-transform duration-[700ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{ transform: `scaleX(${Math.max(ratio, 0.012)})` }}
        />
      </div>

      <p className="label mt-2.5">
        {count === null ? 'Reading the dictionary' : <>Words starting with {chunk}</>}
      </p>
    </div>
  )
}
