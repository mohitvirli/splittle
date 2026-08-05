interface Props {
  seed: string
  currentPos: number
  /** The word the engine sees — the typed letters with the pivot assumed. */
  effective: string
  /** Seed letters the word runs along from the cursor. */
  matched: number
  /** How the word would land, or null. Also carries the chunk boundary. */
  preview: { chunkEnd: number; landedAt: number } | null
  solved: boolean
  justCovered: { indices: number[]; nonce: number } | null
}

/**
 * One box, and it is always the live one.
 *
 * It brackets the whole move: the seed chunk the word starts on, the letters the player
 * supplies, and — once it reaches — the seed chunk it ends on. Spent seed letters sit
 * quietly to its left and unreached ones to its right.
 *
 * The blank is the constant. Until the player has contributed a letter of their own the box
 * holds a bare underscore between the chunk and the nearest letter it could reach; after
 * that the blank becomes the rule those letters sit on. Either way it marks which letters
 * are the player's, and the seed's own letters stand clear of it.
 */
export function WordDisplay({
  seed,
  currentPos,
  effective,
  matched,
  preview,
  solved,
  justCovered,
}: Props) {
  const last = seed.length - 1
  const lands = preview !== null && !solved
  const active = lands || solved

  const seedTone = active ? 'text-accent' : 'text-ink'
  // Slightly softer than the seed's own letters — enough to read as "yours", not enough
  // to break the word up.
  const mineTone = active ? 'text-accent-soft' : 'text-ink-soft'

  // Split the word into the seed's letters and the player's. Before it lands there is no
  // end chunk yet, so everything past the run along the seed belongs to the player.
  const headLen = lands
    ? preview.chunkEnd - currentPos + 1
    : Math.max(Math.min(matched, effective.length), 1)
  const tailLen = lands
    ? Math.min(preview.landedAt - preview.chunkEnd, effective.length - headLen)
    : 0

  const head = effective.length > 0 ? effective.slice(0, headLen) : seed[currentPos]
  const mine = effective.slice(headLen, effective.length - tailLen)
  const tail = tailLen > 0 ? effective.slice(effective.length - tailLen) : ''

  // Until the word lands the box keeps reaching for the nearest letter it could land on,
  // so the shape of the move is on screen the whole way through: P_L becomes P OO L, and
  // when POOL lands that same L is simply the real ending. The blank only stands in while
  // the player has contributed nothing yet.
  const headEnd = currentPos + headLen - 1
  const showTarget = !lands && !solved
  const blank = showTarget && mine.length === 0
  const targetIndex = Math.min(headEnd + 1, last)

  const boxEnd = solved ? last : lands ? preview.landedAt : targetIndex
  const spent = solved ? '' : seed.slice(0, currentPos)
  const ahead = solved ? '' : seed.slice(boxEnd + 1)

  // A long word plus the seed it still has to reach will not fit at a fixed size, so the
  // type scales down to whatever the row actually needs. cqw measures the container, which
  // is capped by max-width — vw would be wrong on anything wider than the column.
  // The brackets are pulled in tight and collapse entirely once the rectangle takes over,
  // so they are budgeted at well under a cell each and only while they are on screen.
  const boxCells =
    (active ? 0 : 0.8) +
    (solved
      ? seed.length
      : head.length + (blank ? 0.7 : mine.length) + (showTarget ? 1 : tail.length))
  const cells = spent.length + boxCells + ahead.length
  const widthInEm = (cells * 0.78 + 0.34) * 1.05
  // Height is measured against the *visible* viewport, not the layout one — with the
  // keyboard up, vh would still report the whole screen and size the seed off-screen.
  const fontSize = `min(clamp(1.5rem, min(15vw, calc(var(--app-height) * 0.11)), 4.5rem), ${(100 / widthInEm).toFixed(2)}cqw)`

  const letter = (char: string, key: string, tone: string, seedIndex?: number) => {
    const claiming = seedIndex !== undefined && (justCovered?.indices.includes(seedIndex) ?? false)

    return (
      <span
        key={key}
        className={`block min-w-[0.74em] text-center transition-colors duration-300 ${tone}`}
        style={
          claiming
            ? {
                animation: 'claim-settle 520ms var(--ease-out-quint)',
                animationDelay: `${justCovered!.indices.indexOf(seedIndex!) * 90}ms`,
              }
            : undefined
        }
      >
        {char}
      </span>
    )
  }

  /**
   * Decorative — the rectangle says the same thing to a screen reader that these do.
   *
   * A bracket keeps its own advance rather than the 0.74em cell the letters are held to:
   * the face is not fixed-advance, and a bracket sitting in a letter's cell is mostly air.
   * On the way out that advance is cancelled by negative margins, so the bracket collapses
   * to nothing and the rectangle closes onto the word instead of inheriting two empty
   * columns. 0.171em a side is exactly half the glyph's own 0.342em.
   */
  const bracket = (char: string) => (
    <span
      aria-hidden
      className={`block text-center text-ink-faint transition-all duration-300 ${
        active ? 'opacity-0' : 'opacity-100'
      }`}
      style={active ? { marginLeft: '-0.171em', marginRight: '-0.171em' } : undefined}
    >
      {char}
    </span>
  )

  return (
    <div
      className="pointer-events-none flex items-baseline justify-center font-display leading-none"
      style={{ fontSize }}
      aria-label={`${seed}, ${effective || 'nothing typed'}`}
    >
      {spent.split('').map((char, i) => letter(char, `s${i}`, 'text-ink-faint', i))}

      {/* Two states, one shape. While the move is still open the box is a pair of square
          brackets — [S _ T], a slot waiting to be filled. The moment the word lands they
          hand over to a drawn rectangle, which closes around it. Both are always in the
          layout and only cross-fade, so the letters never move for the swap. */}
      <span
        className={`relative flex items-baseline border px-[0.06em] py-[0.06em] transition-colors duration-300 ${
          active ? 'border-accent' : 'border-transparent'
        }`}
      >
        {bracket('[')}

        {solved
          ? seed.split('').map((char, i) => letter(char, `b${i}`, seedTone, i))
          : head
              .split('')
              .map((char, i) => letter(char, `h${i}`, seedTone, currentPos + i))}

        {blank ? (
          /* The blank, at its own natural width rather than a letter cell. Nothing else on
             the screen is asking to be typed into, so it blinks like a caret. */
          <span
            className={`block px-[0.04em] ${mineTone}`}
            style={{ animation: 'caret-blink 1.1s steps(1, end) infinite' }}
          >
            _
          </span>
        ) : (
          mine.length > 0 && (
            // Positioned, not padded: a border on this wrapper would lift the player's
            // letters off the baseline the seed's letters sit on.
            <span className="relative flex items-baseline">
              {mine.split('').map((char, i) => letter(char, `m${i}`, mineTone))}
              <span
                aria-hidden
                className={`absolute inset-x-0 -bottom-[0.05em] h-px transition-colors duration-300 ${
                  active ? 'bg-accent-soft' : 'bg-ink-faint'
                }`}
              />
            </span>
          )
        )}

        {showTarget
          ? letter(seed[targetIndex], 'target', seedTone, targetIndex)
          : tail.split('').map((char, i) => letter(char, `t${i}`, seedTone))}

        {bracket(']')}
      </span>

      {ahead.split('').map((char, i) => letter(char, `a${i}`, 'text-ink-faint', boxEnd + 1 + i))}
    </div>
  )
}
