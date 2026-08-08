/**
 * Builds the daily seed pool.
 *
 *   npm run puzzles                                  rank every candidate seed
 *   npm run puzzles -- --write CLEAN BEARD --from 2026-08-05
 *
 * The ranking mode is the one you spend time in: it prints how many chains each seed has at
 * each tier, and — more usefully — how many distinct words can open and close a two-word
 * chain. A seed with one opener has one answer, no matter how many chains it reports.
 *
 * The write mode refuses to emit a seed that is not solvable at all three tiers, so a bad
 * pool cannot reach the app through this script. `puzzles.test.ts` re-checks the pool that
 * actually shipped, which is the one that catches a seed going stale later.
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  TARGETS,
  TIGHT,
  WIDE,
  commonWords,
  gameWords,
  inspect,
  isPlayable,
  readCandidates,
} from './solver.ts'

const POOL = fileURLToPath(new URL('../src/game/puzzles.json', import.meta.url))

const args = process.argv.slice(2)
const flag = (name: string): string | null => {
  const at = args.indexOf(name)
  return at === -1 ? null : (args[at + 1] ?? null)
}

const accepted = gameWords()
const tight = commonWords(TIGHT, accepted)
const wide = commonWords(WIDE, accepted)
console.log(`solve lists: ${tight.size} words (top ${TIGHT}), ${wide.size} (top ${WIDE})\n`)

const writeAt = args.indexOf('--write')

if (writeAt === -1) {
  const reports = readCandidates()
    .filter((seed) => accepted.has(seed.toLowerCase()))
    .map((seed) => inspect(seed, tight, wide))
    .filter(isPlayable)

  // Fewest two-word chains first: scarcity at the hardest tier is what makes a seed worth
  // playing, and the seeds with thousands of them are the ones that solve themselves.
  reports.sort((a, b) => a.tight[2].count - b.tight[2].count)

  console.log('SEED   4/3/2 (top 3k)      openers  closers')
  for (const report of reports) {
    const counts = TARGETS.map((t) => report.tight[t].count).join('/')
    const two = report.tight[2]
    console.log(
      `${report.seed}  ${counts.padEnd(20)}${String(two.openers.length).padStart(5)}` +
        `${String(two.closers.length).padStart(9)}`,
    )
  }
  console.log(`\n${reports.length} playable of ${readCandidates().length} candidates`)
} else {
  const from = flag('--from')
  if (!from || !/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    throw new Error('--write needs --from YYYY-MM-DD')
  }

  const seeds = args.slice(writeAt + 1).filter((arg) => /^[A-Za-z]+$/.test(arg)).map((s) => s.toUpperCase())
  if (seeds.length === 0) throw new Error('--write needs at least one seed')
  if (new Set(seeds).size !== seeds.length) throw new Error('duplicate seed in the pool')

  for (const seed of seeds) {
    const report = inspect(seed, tight, wide)
    if (!isPlayable(report)) {
      const dead = TARGETS.filter((t) => report.wide[t].count === 0)
      // A seed can clear every target on its own and still fail here: the three chains have
      // to be findable at the same time, because a word spent in one round is spent for good.
      const why = dead.length > 0
        ? `has no common-word solution at ${dead.join(', ')}`
        : 'cannot be played through without reusing a word between rounds'
      throw new Error(`${seed} ${why} — refusing to write`)
    }
    const two = report.tight[2]
    console.log(
      `${seed}  ${TARGETS.map((t) => report.tight[t].count).join('/')}  ` +
        `openers ${two.openers.length}, closers ${two.closers.length}  ` +
        `e.g. ${(two.samples[0] ?? report.wide[2].samples[0] ?? []).join(' + ')}`,
    )
  }

  writeFileSync(POOL, `${JSON.stringify({ start: from, seeds }, null, 2)}\n`)
  console.log(`\nwrote ${seeds.length} puzzles to ${POOL}, starting ${from}`)
}
