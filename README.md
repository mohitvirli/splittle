# Splittle

A daily word chain puzzle. Split today's seed word into a chain of real words that
walk across its letters — finish it in exactly 4, 3, or 2 words.

## How it works

Each round has a seed (today's is `STONE`) and a target word count. Starting from the
first letter, you type a word that starts where the last one landed and ends
somewhere on the remaining seed letters — that landing point becomes the start of the
next word. The chain has to use up the whole seed in exactly the target number of
words, no more, no fewer.

Three tiers — 4, 3, and 2 words — share the same seed but demand a shorter chain each
time, so the same puzzle gets harder as the word budget shrinks.

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
npm run build      # typecheck + production build
npm run lint        # oxlint
npm test            # run the engine test suite once
npm run test:watch  # run it in watch mode
npm run preview      # preview the production build
```
