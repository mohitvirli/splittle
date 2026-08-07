import type { LandedWord } from '../engine/types'

interface Props {
  seed: string
  words: LandedWord[]
}

/**
 * The chain, running horizontally directly under the display it came out of. Each word keeps
 * its seed letters in accent and its own letters muted, so the chain reads as a record of
 * which parts of the seed each word claimed.
 *
 * There is no empty state here — before the first word the banner does the talking.
 */
export function WordChain({ seed, words }: Props) {
  if (words.length === 0) return null

  return (
    <ol className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1">
      {words.map((entry, i) => (
        <li
          key={`${entry.word}-${i}`}
          className="flex items-baseline gap-3"
          style={{ animation: 'fade-rise 460ms var(--ease-out-quint) both' }}
        >
          {i > 0 && <span className="font-body text-sm text-rule">·</span>}
          <ChainWord seed={seed} entry={entry} className="text-[1.15rem]" />
        </li>
      ))}
    </ol>
  )
}

/**
 * One word of a chain, split the way it was played: the seed letters it started on, its own
 * letters, the seed letters it landed on. Exported because the tutorial's chain is the same
 * object as the game's and must stay the same object — a second copy of this split is a
 * second thing to keep true.
 */
export function ChainWord({
  seed,
  entry,
  className = '',
}: {
  seed: string
  entry: LandedWord
  className?: string
}) {
  const head = seed.slice(entry.from, entry.chunkEnd + 1)
  const tail = seed.slice(entry.chunkEnd + 1, entry.landedAt + 1)
  // Clamped because a short word can, in principle, overlap its two ends.
  const headLen = Math.min(head.length, entry.word.length)
  const tailLen = Math.min(tail.length, entry.word.length - headLen)
  const belly = entry.word.slice(headLen, entry.word.length - tailLen)

  return (
    <span className={`font-display tracking-[0.08em] ${className}`}>
      <span className="text-accent">{entry.word.slice(0, headLen)}</span>
      <span className="text-ink-faint">{belly}</span>
      <span className="text-accent">
        {tailLen > 0 ? entry.word.slice(entry.word.length - tailLen) : ''}
      </span>
    </span>
  )
}
