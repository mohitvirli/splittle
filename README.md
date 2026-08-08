# Splittle

A daily word chain puzzle. Split today's seed word into a chain of real words that
walk across its letters — finish it in exactly 4, 3, or 2 words.

## How it works

Each round has a seed and a target word count. Starting from the first letter, you
type a word that starts where the last one landed and ends somewhere on the remaining
seed letters — that landing point becomes the start of the next word. The chain has to
use up the whole seed in exactly the target number of words, no more, no fewer.

Every word has to be your own: one the seed already contains — PORT out of SPORT, PLAN
out of PLANT — reads the puzzle back rather than splitting it, and is turned away. A word
is also spent for the day once played, so the three tiers cannot share one — otherwise the
3-word chain is the 4-word one with a join taken out.

Three tiers — 4, 3, and 2 words — share the same seed but demand a shorter chain each
time, so the same puzzle gets harder as the word budget shrinks.

## The daily seed

The seed comes from a pool committed at `src/game/puzzles.json` — a start date and a
list of seeds, one per day, picked by UTC date so everyone plays the same puzzle at the
same moment. Progress and the streak are stored per day.

Seeds are not chosen by hand. The game accepts all 274,937 words in
`an-array-of-english-words`, and against a list that size *every* five-letter seed is
solvable — `STONE` in two words is `SABATON` + `NAARTJE`. So a seed only ships if it can
be solved at 4, 3, **and** 2 words using a frequency-ranked list of common words
(`scripts/common-words.txt`), while the game itself keeps accepting everything:

```bash
npm run puzzles     # rank every candidate seed in scripts/seed-candidates.txt
```

```bash
npm run puzzles -- --write CLEAN BEARD SPORT --from 2026-08-05
```

The ranking shows how many chains each seed has per tier, and how many distinct words
can open and close a two-word chain — a seed with one opener has one answer, however
many chains it reports. Writing refuses any seed that is not solvable at all three
tiers *at once* — since a word is spent for the day, the three chains have to exist
together, not one at a time — and `puzzles.test.ts` re-solves the shipped pool on every
test run, so a seed that goes stale — a bumped dictionary, a changed word-length bound —
fails the build rather than becoming a day nobody can finish. That test also fails once
the pool runs out of days.

## Stack

- [React](https://react.dev) + [TypeScript](https://www.typescriptlang.org), built with [Vite](https://vite.dev)
- [Tailwind CSS](https://tailwindcss.com) for styling
- [GSAP](https://gsap.com) for the intro, screen transitions, and help dialog animation
- [Vitest](https://vitest.dev) for the engine's test suite
- [Oxlint](https://oxc.rs) for linting

The puzzle engine (`src/engine`) is a pure, dependency-free module — it takes a seed,
a dictionary lookup, and a word, and returns where it lands or why it doesn't. The
dictionary itself (`src/dictionary`) is built from `an-array-of-english-words` at
startup, indexed by prefix.

## Development

```bash
npm install
npm run dev
```

Other scripts:

```bash
npm run build       # typecheck + production build
npm run puzzles     # rank seed candidates (see "The daily seed")
npm run lint        # oxlint
npm test            # run the engine test suite once
npm run test:watch  # run it in watch mode
npm run preview      # preview the production build
```
