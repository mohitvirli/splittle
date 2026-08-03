export type Tier = 4 | 3 | 2

/** Hardest last, so the row order reads as a taper. */
export const TIERS: readonly Tier[] = [4, 3, 2]

export const PUZZLE_NUMBER = 1

export interface Progress {
  tiersWon: Record<Tier, boolean>
  streak: number
}

const KEY = 'trapezium.v1'

export const emptyProgress = (): Progress => ({
  tiersWon: { 4: false, 3: false, 2: false },
  streak: 0,
})

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyProgress()
    const parsed = JSON.parse(raw) as Partial<Progress>
    const base = emptyProgress()
    return {
      tiersWon: { ...base.tiersWon, ...parsed.tiersWon },
      streak: typeof parsed.streak === 'number' ? parsed.streak : 0,
    }
  } catch {
    return emptyProgress()
  }
}

export function saveProgress(progress: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress))
  } catch {
    // Private browsing or a full quota. Losing a prototype streak is not worth handling.
  }
}

export const allTiersWon = (progress: Progress): boolean =>
  TIERS.every((tier) => progress.tiersWon[tier])
