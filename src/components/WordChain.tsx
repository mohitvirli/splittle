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
      {words.map((entry, i) => {
        const head = seed.slice(entry.from, entry.chunkEnd + 1)
        const tail = seed.slice(entry.chunkEnd + 1, entry.landedAt + 1)
        // Clamped because a short word can, in principle, overlap its two ends.
        const headLen = Math.min(head.length, entry.word.length)
        const tailLen = Math.min(tail.length, entry.word.length - headLen)
        const belly = entry.word.slice(headLen, entry.word.length - tailLen)

        return (
          <li
            key={`${entry.word}-${i}`}
            className="flex items-baseline gap-3"
            style={{ animation: 'fade-rise 460ms var(--ease-out-quint) both' }}
          >
            {i > 0 && <span className="font-body text-sm text-rule">·</span>}
            <span className="font-display text-[1.15rem] tracking-[0.08em]">
              <span className="text-accent">{entry.word.slice(0, headLen)}</span>
              <span className="text-ink-faint">{belly}</span>
              <span className="text-accent">
                {tailLen > 0 ? entry.word.slice(entry.word.length - tailLen) : ''}
              </span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
