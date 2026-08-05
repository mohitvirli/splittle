import { describe, expect, it } from 'vitest'
import {
  applyResult,
  createRound,
  findLanding,
  judge,
  play,
  resolve,
  seedMatchLength,
  submit,
  undoLast,
  withLanding,
  withPivot,
} from './engine'
import type { Dict, RoundState } from './types'
import { getDictionary } from '../dictionary/dictionary'

const dict: Dict = (word) => getDictionary().has(word)

// This suite's own fixture seed — independent of the app's live daily SEED (types.ts),
// which changes as puzzles rotate. Every word below was chosen to solve PLANT specifically.
const PLANT = 'PLANT'

/** [chunkEnd, word, expected landing] */
type Move = [number, string, number]

function walk(moves: Move[], d: Dict = dict, seed = PLANT): RoundState {
  let state = createRound(seed)
  for (const [chunkEnd, word, expected] of moves) {
    const result = submit(state, chunkEnd, word, d)
    if (result.kind !== 'LANDED') {
      throw new Error(`${word} from chunkEnd ${chunkEnd} failed: ${result.kind}`)
    }
    expect(result.word.landedAt, `${word} landing`).toBe(expected)
    state = applyResult(state, result)
    expect(state.currentPos).toBe(expected)
  }
  return state
}

describe('the four PLANT solutions', () => {
  it('solves in 4: PEARL, LAVA, APRON, NIGHT', () => {
    const state = walk([
      [0, 'PEARL', 1],
      [1, 'LAVA', 2],
      [2, 'APRON', 3],
      [3, 'NIGHT', 4],
    ])
    expect(state.solved).toBe(true)
    expect(state.words).toHaveLength(4)
  })

  it('solves in 3: PLASMA, APRON, NIGHT', () => {
    const state = walk([
      [1, 'PLASMA', 2],
      [2, 'APRON', 3],
      [3, 'NIGHT', 4],
    ])
    expect(state.solved).toBe(true)
    expect(state.words).toHaveLength(3)
  })

  it('solves in 2: PLASMA, ACCOUNT', () => {
    const state = walk([
      [1, 'PLASMA', 2],
      [2, 'ACCOUNT', 4],
    ])
    expect(state.solved).toBe(true)
    expect(state.words).toHaveLength(2)
  })

  it('solves in 2: PLAN, NIGHT — the length rule counts the prefix chunk only', () => {
    // PLAN is exactly "PL" + "AN" with no letters of the player's own. Legal, by decision.
    const state = walk([
      [1, 'PLAN', 3],
      [3, 'NIGHT', 4],
    ])
    expect(state.solved).toBe(true)
    expect(state.words).toHaveLength(2)
  })
})

describe('MIN_WORD_LENGTH = 3', () => {
  it('turns two-letter pure seed slices away', () => {
    // LA and AN walk the seed a letter at a time and contribute nothing of the player's own.
    // They were legal single-step moves under the old bound; the dictionary is now built
    // without them, so the engine never has to carry a length rule of its own.
    expect(dict('la')).toBe(false)
    expect(dict('an')).toBe(false)

    let state = createRound(PLANT)
    state = applyResult(state, submit(state, 0, 'PEARL', dict))
    expect(state.currentPos).toBe(1)
    expect(submit(state, 1, 'LA', dict)).toEqual({ kind: 'NOT_A_WORD' })
  })

  it('still admits three letters', () => {
    expect(dict('ant')).toBe(true)
  })

  it('does not let a word skip a seed letter — nothing reaches T from A except on NT', () => {
    // The suffix from chunkEnd 2 is seed[3..4] = "NT". ABOUT ends in "T" and lands nowhere.
    let state = createRound(PLANT)
    state = applyResult(state, submit(state, 1, 'PLASMA', dict))
    expect(state.currentPos).toBe(2)
    expect(submit(state, 2, 'ABOUT', dict)).toEqual({ kind: 'NO_LANDING' })
  })
})

describe('failure modes', () => {
  it('NOT_A_WORD for a non-word', () => {
    expect(submit(createRound(PLANT), 0, 'ZZZZZ', dict)).toEqual({ kind: 'NOT_A_WORD' })
  })

  it('NO_LANDING for a real word that ends nowhere on the remaining seed', () => {
    expect(submit(createRound(PLANT), 1, 'PLASTIC', dict)).toEqual({ kind: 'NO_LANDING' })
  })

  it('checks the dictionary before anything structural', () => {
    // Wrong prefix AND not a word — NOT_A_WORD wins, per the spec's check order.
    expect(submit(createRound(PLANT), 0, 'QQQQ', dict)).toEqual({ kind: 'NOT_A_WORD' })
  })

  it('BAD_PREFIX when the word does not start with the chunk', () => {
    expect(submit(createRound(PLANT), 1, 'PEARL', dict)).toEqual({ kind: 'BAD_PREFIX' })
  })

  it('TOO_SHORT when the word is not longer than its chunk', () => {
    const state = createRound(PLANT)
    // "PLAN" as the whole chunk (chunkEnd 3) with the word PLAN: 4 letters, 4-letter chunk.
    expect(submit(state, 3, 'PLAN', dict)).toEqual({ kind: 'TOO_SHORT' })
  })

  it('ALREADY_USED for a word already in the chain', () => {
    const played = play(createRound(PLANT), 0, 'PEARL', dict)
    // Roll the cursor back but keep the word on the chain, so PEARL is otherwise legal again.
    const state: RoundState = { ...played.state, currentPos: 0 }
    expect(submit(state, 0, 'PEARL', dict)).toEqual({ kind: 'ALREADY_USED' })
    // Undo removes it from the chain, and it becomes playable again.
    expect(submit(undoLast(state), 0, 'PEARL', dict).kind).toBe('LANDED')
  })

  it('CONTAINS_SEED for a word containing PLANT', () => {
    expect(submit(createRound(PLANT), 0, 'PLANTER', dict)).toEqual({ kind: 'CONTAINS_SEED' })
  })

  it('CONTAINS_SEED for the seed itself', () => {
    expect(submit(createRound(PLANT), 0, 'PLANT', dict)).toEqual({ kind: 'CONTAINS_SEED' })
  })
})

describe('furthest landing wins', () => {
  // PLANT cannot exercise this rule: no seed chunk seed[j+1..m] is a suffix of a longer
  // one, so at most one m ever matches. SANAS can — "ANA" (m=3) and "A" (m=1) both match.
  const synthetic: Dict = (word) => new Set(['sanana']).has(word)

  it('picks the furthest landing when several match', () => {
    expect(findLanding('SANAS', 0, 'SANANA')).toBe(3)
    expect('SANANA'.endsWith('ANA')).toBe(true)
    expect('SANANA'.endsWith('A')).toBe(true)

    const state = createRound('SANAS')
    const result = submit(state, 0, 'SANANA', synthetic)
    expect(result).toMatchObject({ kind: 'LANDED', word: { landedAt: 3 } })
  })

  it('returns null when nothing matches', () => {
    expect(findLanding('PLANT', 1, 'PLASTIC')).toBeNull()
  })

  it('cannot land when the chunk consumes the whole seed', () => {
    expect(findLanding('PLANT', 4, 'PLANTS')).toBeNull()
  })
})

describe('resolve — the engine picks the chunk', () => {
  /** Walk a round by word alone, the way the screen does. */
  function walkWords(words: string[], seed = PLANT) {
    let state = createRound(seed)
    const landings: number[] = []
    for (const word of words) {
      const { result } = resolve(state, word, dict)
      if (result.kind !== 'LANDED') throw new Error(`${word} failed: ${result.kind}`)
      landings.push(result.word.landedAt)
      state = applyResult(state, result)
    }
    return { state, landings }
  }

  it('prefers PL over the longer PLA match, which lands nowhere', () => {
    const { chunkEnd, result } = resolve(createRound(PLANT), 'PLASMA', dict)
    expect(chunkEnd).toBe(1)
    expect(result).toMatchObject({ kind: 'LANDED', word: { landedAt: 2 } })
    // The longer match really is a dead end, which is why the search cannot stop early.
    expect(submit(createRound(PLANT), 2, 'PLASMA', dict)).toEqual({ kind: 'NO_LANDING' })
  })

  it('takes the furthest landing across every viable chunk', () => {
    // From A: chunk A reaches T via NT. Nothing reaches further.
    let state = createRound(PLANT)
    state = applyResult(state, resolve(state, 'PLASMA', dict).result)
    const { chunkEnd, result } = resolve(state, 'ACCOUNT', dict)
    expect(chunkEnd).toBe(2)
    expect(result).toMatchObject({ kind: 'LANDED', word: { landedAt: 4 } })
  })

  it('breaks ties toward the shortest chunk', () => {
    // PLAN reaches N from P (+LAN), PL (+AN) and PLA (+N) alike. The shortest wins.
    const { chunkEnd, result } = resolve(createRound(PLANT), 'PLAN', dict)
    expect(chunkEnd).toBe(0)
    expect(result).toMatchObject({ kind: 'LANDED', word: { landedAt: 3 } })
    for (const alternative of [1, 2]) {
      expect(submit(createRound(PLANT), alternative, 'PLAN', dict)).toMatchObject({
        kind: 'LANDED',
        word: { landedAt: 3 },
      })
    }
  })

  it('solves every known solution from words alone', () => {
    expect(walkWords(['PEARL', 'LAVA', 'APRON', 'NIGHT']).landings).toEqual([1, 2, 3, 4])
    expect(walkWords(['PLASMA', 'APRON', 'NIGHT']).landings).toEqual([2, 3, 4])
    expect(walkWords(['PLASMA', 'ACCOUNT']).landings).toEqual([2, 4])
    expect(walkWords(['PLAN', 'NIGHT']).landings).toEqual([3, 4])
    expect(walkWords(['PLASMA', 'ACCOUNT']).state.solved).toBe(true)
  })

  it('reports the failure from the minimal chunk', () => {
    expect(resolve(createRound(PLANT), 'PLASTIC', dict).result).toEqual({ kind: 'NO_LANDING' })
    expect(resolve(createRound(PLANT), 'ZZZZZ', dict).result).toEqual({ kind: 'NOT_A_WORD' })
    expect(resolve(createRound(PLANT), 'APRON', dict).result).toEqual({ kind: 'BAD_PREFIX' })
    expect(resolve(createRound(PLANT), 'PLANTER', dict).result).toEqual({ kind: 'CONTAINS_SEED' })
  })
})

describe('judge — the tier target is an exact word count', () => {
  /** Play words under a target, returning the state and the last result. */
  function run(target: number, words: string[]) {
    let state = createRound(PLANT)
    let last = judge(state, words[0], dict, target)
    for (const word of words) {
      last = judge(state, word, dict, target)
      if (last.result.kind !== 'LANDED') return { state, last }
      state = applyResult(state, last.result)
    }
    return { state, last }
  }

  it('accepts a run that finishes on exactly the target word', () => {
    for (const [target, words] of [
      [4, ['PEARL', 'LAVA', 'APRON', 'NIGHT']],
      [3, ['PLASMA', 'APRON', 'NIGHT']],
      [2, ['PLASMA', 'ACCOUNT']],
    ] as const) {
      const { state, last } = run(target, [...words])
      expect(last.result.kind, `${target}-word run`).toBe('LANDED')
      expect(state.solved).toBe(true)
      expect(state.words).toHaveLength(target)
    }
  })

  it('ENDS_EARLY when a word would finish before the target is reached', () => {
    // PLASMA then ACCOUNT solves in 2 — right for the 2-word target, wrong for 4 and 3.
    for (const target of [4, 3]) {
      const { last } = run(target, ['PLASMA', 'ACCOUNT'])
      expect(last.result, `target ${target}`).toEqual({ kind: 'ENDS_EARLY' })
    }
    expect(run(2, ['PLASMA', 'ACCOUNT']).last.result.kind).toBe('LANDED')
  })

  it('MUST_FINISH when the last word the target allows does not reach the end', () => {
    // Under a 2-word target, APRON is the last word and only reaches N.
    const { last } = run(2, ['PLASMA', 'APRON'])
    expect(last.result).toEqual({ kind: 'MUST_FINISH' })
    // The same move is fine under a 3-word target, where a word still follows it.
    expect(run(3, ['PLASMA', 'APRON']).last.result.kind).toBe('LANDED')
  })

  it('blocks a valid shorter solution when a longer one is the target', () => {
    // PLASMA, APRON, NIGHT is a clean 3-word solve, and that is exactly why a 4-word
    // round rejects it: NIGHT would finish on word three. The two words before it stand.
    const three = run(4, ['PLASMA', 'APRON', 'NIGHT'])
    expect(three.last.result).toEqual({ kind: 'ENDS_EARLY' })
    expect(three.state.words).toHaveLength(2)
    expect(three.state.solved).toBe(false)
  })

  it('NO_WORDS_LEFT once the budget is spent', () => {
    const solved = run(2, ['PLASMA', 'ACCOUNT']).state
    // Defensive: the guards above stop this being reachable through normal play.
    const spent: RoundState = { ...solved, currentPos: 0, solved: false }
    expect(judge(spent, 'PEARL', dict, 2).result).toEqual({ kind: 'NO_WORDS_LEFT' })
  })

  it('reports landing failures ahead of tier rules', () => {
    expect(judge(createRound(PLANT), 'ZZZZZ', dict, 4).result).toEqual({ kind: 'NOT_A_WORD' })
    expect(judge(createRound(PLANT), 'PLASTIC', dict, 4).result).toEqual({ kind: 'NO_LANDING' })
  })
})

describe('withPivot — the pivot is assumed, not demanded', () => {
  const afterPlasma = () =>
    applyResult(createRound(PLANT), resolve(createRound(PLANT), 'PLASMA', dict).result)

  it('accepts the word with or without its leading pivot letter', () => {
    const state = afterPlasma()
    expect(state.currentPos).toBe(2)
    expect(withPivot(state, 'PRON')).toBe('APRON')
    expect(withPivot(state, 'APRON')).toBe('APRON')

    for (const typed of ['PRON', 'APRON']) {
      expect(resolve(state, withPivot(state, typed), dict).result).toMatchObject({
        kind: 'LANDED',
        word: { word: 'APRON', landedAt: 3 },
      })
    }
  })

  it('takes a doubled pivot at face value', () => {
    // From A, ARDVARK stays ARDVARK. AARDVARK is reached by typing it out — reading it the
    // other way would leave no way to express ARDVARK at all.
    const state = afterPlasma()
    expect(withPivot(state, 'ARDVARK')).toBe('ARDVARK')
    expect(withPivot(state, 'AARDVARK')).toBe('AARDVARK')
  })

  it('is a no-op on an empty draft, and normalises case', () => {
    expect(withPivot(createRound(PLANT), '')).toBe('')
    expect(withPivot(createRound(PLANT), '  earl ')).toBe('PEARL')
  })
})

describe('withLanding — the landing is assumed, not demanded', () => {
  const start = () => createRound(PLANT)

  it('completes a draft that stops short of the seed', () => {
    // PEAR goes nowhere. The L it is one letter away from is the same L the box has been
    // holding out in front of the player since they started typing.
    expect(withLanding(start(), 'PEAR', dict)).toBe('PEARL')
    expect(resolve(start(), 'PEARL', dict).result).toMatchObject({
      kind: 'LANDED',
      word: { word: 'PEARL', landedAt: 1 },
    })
  })

  it('reaches past the first chunk when that is where the word lands', () => {
    // Nothing completes PLASM on chunk P; on PL it is one A short of PLASMA.
    expect(withLanding(start(), 'PLASM', dict)).toBe('PLASMA')
  })

  it('leaves a draft that already lands untouched', () => {
    expect(withLanding(start(), 'PEARL', dict)).toBe('PEARL')
    expect(withLanding(start(), 'PLASMA', dict)).toBe('PLASMA')
  })

  it('will not conjure a word out of seed letters alone', () => {
    // P is still running along the seed — the player has contributed nothing to complete.
    // PL would otherwise appear from a single keystroke.
    expect(withLanding(start(), 'P', dict)).toBe('P')
    expect(withLanding(start(), 'PL', dict)).toBe('PL')
    // Typed out in full it is still whatever the rules make of it — untouched either way.
    expect(withLanding(start(), 'PLAN', dict)).toBe('PLAN')
  })

  it('leaves a draft that no completion rescues alone', () => {
    expect(withLanding(start(), 'PZZZ', dict)).toBe('PZZZ')
    expect(withLanding(start(), '', dict)).toBe('')
  })

  it('composes with withPivot — every shorthand arrives as the same word', () => {
    const state = start()
    for (const typed of ['EAR', 'PEAR', 'EARL', 'PEARL']) {
      expect(withLanding(state, withPivot(state, typed), dict), typed).toBe('PEARL')
    }
  })
})

describe('seedMatchLength — how far the gap slides', () => {
  it('tracks the typed word along the seed', () => {
    const start = createRound(PLANT)
    expect(seedMatchLength(start, '')).toBe(0)
    expect(seedMatchLength(start, 'P')).toBe(1)
    expect(seedMatchLength(start, 'PL')).toBe(2)
    expect(seedMatchLength(start, 'PLASMA')).toBe(3)
    expect(seedMatchLength(start, 'PEARL')).toBe(1)
    expect(seedMatchLength(start, 'XYZ')).toBe(0)
  })

  it('never runs past the last selectable letter', () => {
    // A chunk covering the whole seed leaves nothing to land on.
    expect(seedMatchLength(createRound(PLANT), 'PLANT')).toBe(4)
  })

  it('measures from the cursor, not from the start of the seed', () => {
    const state = applyResult(createRound(PLANT), resolve(createRound(PLANT), 'PLASMA', dict).result)
    expect(state.currentPos).toBe(2)
    expect(seedMatchLength(state, 'APRON')).toBe(1)
    expect(seedMatchLength(state, 'AN')).toBe(2)
  })
})

describe('state transitions', () => {
  it('leaves state untouched on a failed submit', () => {
    const state = createRound(PLANT)
    expect(applyResult(state, submit(state, 0, 'ZZZZZ', dict))).toBe(state)
  })

  it('undo rolls the cursor back to where the word started', () => {
    const first = play(createRound(PLANT), 1, 'PLASMA', dict)
    const second = play(first.state, 2, 'ACCOUNT', dict)
    expect(second.state.solved).toBe(true)

    const back = undoLast(second.state)
    expect(back.currentPos).toBe(2)
    expect(back.solved).toBe(false)
    expect(back.words).toHaveLength(1)

    expect(undoLast(createRound(PLANT)).words).toHaveLength(0)
  })

  it('refuses to accept a word once the round is solved', () => {
    const state = walk([
      [1, 'PLASMA', 2],
      [2, 'ACCOUNT', 4],
    ])
    expect(() => submit(state, 4, 'TIGHT', dict)).toThrow(/solved/)
  })

  it('refuses a chunk that starts behind the cursor', () => {
    const state = play(createRound(PLANT), 1, 'PLASMA', dict).state
    expect(() => submit(state, 1, 'LAVA', dict)).toThrow(/out of range/)
  })
})

describe('dictionary', () => {
  it('contains every word used by the known solutions', () => {
    const d = getDictionary()
    for (const word of [
      'pearl',
      'lava',
      'apron',
      'night',
      'plasma',
      'account',
      'plan',
      'plastic',
    ]) {
      expect(d.has(word), word).toBe(true)
    }
  })

  it('counts words by prefix, and the count falls as the chunk grows', () => {
    const d = getDictionary()
    const p = d.countWordsStartingWith('P')
    const pl = d.countWordsStartingWith('PL')
    const pla = d.countWordsStartingWith('PLA')
    const plan = d.countWordsStartingWith('PLAN')

    expect(p).toBeGreaterThan(pl)
    expect(pl).toBeGreaterThan(pla)
    expect(pla).toBeGreaterThan(plan)
    expect(plan).toBeGreaterThan(0)
  })

  it('counts chunks longer than the index key length', () => {
    const d = getDictionary()
    const expected = [...d.words].filter((w) => w.startsWith('plant')).length
    expect(d.countWordsStartingWith('PLANT')).toBe(expected)
  })

  it('returns 0 for a prefix no word has', () => {
    expect(getDictionary().countWordsStartingWith('zqx')).toBe(0)
  })

  it('excludes words outside the length bounds', () => {
    const d = getDictionary()
    for (const word of d.words) {
      expect(word.length).toBeGreaterThanOrEqual(2)
      expect(word.length).toBeLessThanOrEqual(12)
    }
  })
})
