import wordList from 'an-array-of-english-words'
import { MAX_WORD_LENGTH, MIN_WORD_LENGTH } from '../engine/types'

/** Longest key length held in the prefix and suffix indexes. */
export const INDEX_KEY_MAX = 3

export interface Dictionary {
  words: Set<string>
  prefixIndex: Map<string, Set<string>>
  suffixIndex: Map<string, Set<string>>
  has(word: string): boolean
  /** Powers the live counter on PLAYING. Case-insensitive. */
  countWordsStartingWith(chunk: string): number
}

function addTo(index: Map<string, Set<string>>, key: string, word: string): void {
  let bucket = index.get(key)
  if (!bucket) {
    bucket = new Set()
    index.set(key, bucket)
  }
  bucket.add(word)
}

/** Pure builder — takes a raw word list so it can be exercised with fixtures in tests. */
export function buildDictionary(source: readonly string[]): Dictionary {
  const words = new Set<string>()
  const prefixIndex = new Map<string, Set<string>>()
  const suffixIndex = new Map<string, Set<string>>()

  for (const raw of source) {
    const word = raw.toLowerCase()
    if (word.length < MIN_WORD_LENGTH || word.length > MAX_WORD_LENGTH) continue
    if (!/^[a-z]+$/.test(word)) continue

    words.add(word)
    for (let n = 1; n <= Math.min(INDEX_KEY_MAX, word.length); n++) {
      addTo(prefixIndex, word.slice(0, n), word)
      addTo(suffixIndex, word.slice(word.length - n), word)
    }
  }

  return {
    words,
    prefixIndex,
    suffixIndex,
    has: (word) => words.has(word.toLowerCase()),
    countWordsStartingWith(chunk) {
      const key = chunk.toLowerCase()
      if (key.length === 0) return words.size
      if (key.length <= INDEX_KEY_MAX) return prefixIndex.get(key)?.size ?? 0

      // Longer chunks narrow an already-small bucket, so the scan stays instant.
      const bucket = prefixIndex.get(key.slice(0, INDEX_KEY_MAX))
      if (!bucket) return 0
      let count = 0
      for (const word of bucket) if (word.startsWith(key)) count++
      return count
    },
  }
}

let cached: Dictionary | null = null

/** Lazily builds the indexes over the bundled word list, once per session. */
export function getDictionary(): Dictionary {
  if (!cached) {
    const started = performance.now()
    cached = buildDictionary(wordList)
    const ms = Math.round(performance.now() - started)
    console.info(`[trapezium] dictionary: ${cached.words.size} words indexed in ${ms}ms`)
  }
  return cached
}
