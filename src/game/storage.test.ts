import { describe, expect, it } from 'vitest'
import { bankDay, emptyProgress } from './storage'
import type { Progress } from './storage'

const won = (date: string, extra: Partial<Progress> = {}): Progress => ({
  ...emptyProgress(date),
  tiersWon: { 4: true, 3: true, 2: true },
  ...extra,
})

describe('bankDay', () => {
  it('ignores a day that is not finished', () => {
    const partial: Progress = { ...emptyProgress('2026-08-06'), tiersWon: { 4: true, 3: true, 2: false } }
    expect(bankDay(partial)).toBe(partial)
  })

  it('starts a streak at 1', () => {
    expect(bankDay(won('2026-08-05'))).toMatchObject({ streak: 1, lastWonDate: '2026-08-05' })
  })

  it('extends a streak from yesterday', () => {
    const today = won('2026-08-06', { streak: 3, lastWonDate: '2026-08-05' })
    expect(bankDay(today)).toMatchObject({ streak: 4, lastWonDate: '2026-08-06' })
  })

  it('restarts at 1 after a missed day', () => {
    const today = won('2026-08-08', { streak: 9, lastWonDate: '2026-08-06' })
    expect(bankDay(today)).toMatchObject({ streak: 1, lastWonDate: '2026-08-08' })
  })

  it('does not pay twice for the same day', () => {
    const replayed = won('2026-08-06', { streak: 4, lastWonDate: '2026-08-06' })
    expect(bankDay(replayed)).toBe(replayed)
  })
})
