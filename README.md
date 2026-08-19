# @simplytokenized/easter-egg-games

A hidden arcade for a web app. Click the host application's logo **six times**
(within ~1.2 s between clicks) and a full-screen arcade opens. Two games are
playable: Klondike **Solitaire** and **Ladder**, a tribute to the 1983
character-mode platformer.

The package exists as its own module for one reason: an easter egg must be
impossible to feel. Keeping it out of the host repository makes "does this cost
the app anything?" a question you can answer by reading one small file rather
than by auditing five thousand lines of game code.

## What the host pays for

Four modules, about **1 kB gzipped**, are all that reach a browser that never
finds the egg:

| Module | Size (gzip) | Job |
| --- | --- | --- |
| `index.js` | 0.17 kB | re-exports |
| `useLogoEasterEgg.js` | 0.42 kB | click counter, chunk prefetch |
| `EasterEggArcade.js` | 0.29 kB | the lazy boundary |
| `lib/lazy.js` | 0.24 kB | `React.lazy` + the host's chunk-failure hook |

Everything else — the modal, both games, the beach animation, all five
translations, `canvas-confetti` — sits behind `import()`. Concretely:

- **Nothing loads until you find it.** The arcade chunk is prefetched on click 3,
  so the modal opens without a wait, and each game is a further chunk of its own.
- **No re-renders while counting.** The counter lives in refs; state changes only
  on the sixth click.
- **Unmounted when closed.** `EasterEggArcade` returns `null`, so there is no
  dialog, no timer and no keyboard listener in the host's tree during normal use.
- **No host coupling.** No shared locale file, i18n namespace, store, route,
  design-system import or global listener. The arcade carries its own strings and
  builds its dialog straight on Radix.

## Installing

```bash
npm install @simplytokenized/easter-egg-games
```

Peer dependencies — all of them things a Tailwind + Radix app already has:
`react`, `react-dom`, `@radix-ui/react-dialog`, `lucide-react`, `clsx`,
`tailwind-merge`.

### 1. Wire it to the logo

```tsx
import { EasterEggArcade, useLogoEasterEgg } from "@simplytokenized/easter-egg-games";

const { arcadeOpen, closeArcade, registerLogoClick } = useLogoEasterEgg();

<img
  src={logo}
  onClick={() => {
    registerLogoClick();
    navigate("/dashboard");   // whatever the logo already did stays
  }}
/>

<EasterEggArcade open={arcadeOpen} onClose={closeArcade} language={i18n.language} />
```

`language` is a BCP-47 tag (`de`, `de-AT`, …). English is the fallback for
anything unrecognised. That prop is the whole of the i18n contract — the arcade
never touches the host's i18n runtime.

### 2. Tailwind

The package ships **no CSS**. Its components are Tailwind classes, compiled by
the host's own Tailwind so there is one stylesheet per page instead of two, and
so the arcade inherits the host's Tailwind version rather than pinning its own.

Point the host's `content` at the built package. Resolving through
`package.json` rather than hard-coding `node_modules/…` matters: it survives npm
symlinks, monorepo hoisting and git worktrees at different depths.

```ts
// tailwind.config.ts
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const easterEggDist = path.join(
  path.dirname(require.resolve("@simplytokenized/easter-egg-games/package.json")),
  "dist/**/*.js",
);

export default {
  content: ["./src/**/*.{ts,tsx}", easterEggDist],
  // …
};
```

The arcade is always dark and self-contained, so it needs nothing from the
host's theme — no `darkMode` interaction, no CSS variables, no preflight.

### 3. Stale-chunk recovery (optional)

A single-page app redeployed while a tab sat open will 404 on every chunk it has
not fetched yet, and the arcade is nothing but chunks. If the host already has a
recovery routine, hand it over once at start-up:

```ts
import { setChunkLoadErrorHandler } from "@simplytokenized/easter-egg-games";
import { handleChunkLoadFailure } from "@/lib/chunkLoadRecovery";

setChunkLoadErrorHandler(handleChunkLoadFailure);
```

Without it, a failed chunk simply propagates to the nearest error boundary.

## Developing

```bash
npm install
npm run dev        # standalone playground on :5180 — a fake header, one logo
npm test           # 70 unit tests, no browser needed
npm run build      # dist/ — ES modules, one file per source module
npm run typecheck
```

The playground is the whole point of the split: the arcade runs with no host app
around it, with a language switcher and a click counter, so you never need to be
logged into anything to work on a game.

`npm run build` uses `preserveModules`, so the `import()` boundaries written in
the source survive into `dist/` and the host's bundler splits them the same way.
Flattening the output into one file would silently undo everything above.

## Layout

```
src/
  index.ts                 public surface                    ← host bundle
  useLogoEasterEgg.ts      click counter + chunk prefetch     ← host bundle
  EasterEggArcade.tsx      lazy boundary                      ← host bundle
  lib/lazy.ts              React.lazy + chunk-failure hook    ← host bundle
  ArcadeModal.tsx          full-screen shell + game picker    ← arcade chunk
  BeachSpinner.tsx         stick figure walks to the beach    ← arcade chunk
  strings.ts               en/de/es/fr/ar                     ← arcade chunk
  lib/Dialog.tsx           full-bleed dialog on Radix
  lib/cn.ts                clsx + tailwind-merge
  games/
    registry.ts            the catalogue
    GameArt.tsx            inline SVG cover art per game
    solitaire/
      engine.ts            Klondike rules, pure functions
      SolitaireGame.tsx    board + interactions               ← own chunk
      PlayingCardView.tsx  card rendering
      useFlipAnimation.ts  cards glide instead of teleport
      useCardDrag.ts       drag and drop (pointer events)
    ladder/
      engine.ts            grid physics, rocks, scoring
      levels.ts            the five stages, as geometry
      LadderGame.tsx       terminal screen + input            ← own chunk
tests/                     one suite per engine, plus a LadderGame component test
dev/                       the standalone playground
```

## Playing

**Solitaire** — three ways to move a card, all live at once: **drag** it, **tap
it then tap the destination**, or **double-tap** to send it straight to the aces.
Keyboard: `⌘Z` undoes, `N` deals a new game, `Esc` closes the arcade.

**Ladder** — arrows or `WASD` to move and climb, `Space` to jump. On touch
devices an on-screen pad appears (`@media (pointer: coarse)`).

## Ladder

A tribute to the 1983 CP/M game that ran on Kaypro machines, where the whole
arcade was drawn out of the character set. Climb from the bottom floor to the
`$` at the top, collect `*`, dodge the rolling `o`, and beat the bonus timer —
running it to zero is fatal, as in the original.

The implementation is independent. Genre and mechanics are free to reuse; the
original's code and its `LADDER.DAT` level data are not, and the well-known
`mecparts/Ladder` reconstruction is GPL-3.0, which this codebase cannot take on.
So the stages here are our own, and the level names are too.

Two things worth knowing before editing it:

- **Levels are geometry, not ASCII art.** Hand-drawn character rows read nicely
  but one misplaced space makes a ladder that goes nowhere, and you only find out
  by playing. `levels.ts` declares floors and ladders as ranges, and the unit
  tests assert that every ladder joins two floors and that nothing floats.
- **A floor that stops short of the edge is a rock drop.** Rocks turn around as
  they land, so where you end a floor determines the zigzag down the screen.
- **The logic ticks in cells; the picture is interpolated every frame.** A tick
  is 95 ms, so drawing entities on their logical cell means ten discrete jumps a
  second, which judders. The frame loop keeps where each glyph came from and
  where it is heading and writes a fractional `transform` every frame.
  A CSS `transition` was tried first and is the wrong tool: ticks land on frame
  boundaries, so they arrive 83 ms or 100 ms apart, and a transition restarting
  from a partial position on every tick never reaches a steady velocity.
- **Only one writer per property.** React owns which glyphs exist and places the
  static ones; the loop owns `transform` on anything carrying `data-entity` and
  React must never set it there. Two writers for one property has caused three
  separate bugs here — cards snapping at the end of a move, a card stuck behind
  its own pile, and the player parked in the top-left corner.

## Design notes

The arcade is deliberately its own world: a full-screen dark surface that ignores
the host's light/dark theme, with layered radial light, a masked grid and slowly
drifting colour. The chrome is frosted glass; tiles lift on hover, catch a light
sweep and settle on `cubic-bezier(0.22, 1, 0.36, 1)` — one easing curve is used
everywhere so the whole thing feels like one object.

Constraints worth knowing before editing:

- **Cards must never use CSS `transform` for hover or selection.**
  `useFlipAnimation` and `useCardDrag` both write that property directly. FLIP
  measures every `[data-card-id]` after each render and plays the difference
  backwards, so cards glide to their new pile and flip when they turn over; the
  drag handler moves the held run by writing `transform` per pointer event
  without going through React. A competing CSS transform makes cards snap at the
  end of every move. Selection is drawn with rings and shadows instead.
- **FLIP measures the layout position, with any transform backed out.**
  `getBoundingClientRect()` includes the transform, so a card measured mid-flight
  reports a position it will not keep, and the naive version reads a card's own
  animation as movement.
- **Nothing may re-render the board on a timer.** The FLIP layout effect runs on
  every render of `SolitaireGame` — that is what lets it see each move — and it
  costs ~100 forced synchronous layout reads. The clock therefore lives in its
  own `ClockStat` component, so a tick repaints eight characters rather than the
  whole table. Anything else that updates on an interval belongs in a leaf too.
- **The drifting orbs render on the picker only.** Scaling a 64 px-blurred layer
  forces the compositor to re-rasterise a large surface every frame, and a
  running game needs those frames more.
- **`will-change` is applied while dragging, never statically.** A permanent
  `will-change: transform` on all 52 cards promotes every one to its own
  composited layer for the whole session to serve the two or three that move.
- **The felt reserves a fixed minimum height.** Without it the board would drift
  upward each time a column grew, and the table would twitch on every move.

## The loading animation

`BeachSpinner` is pure SVG + CSS keyframes: a *Strichmännchen* strolls in from
the left, drops onto its towel and sunbathes while the sun turns overhead. One
cycle is `--ee-cycle` (4.2 s) and `ArcadeModal` holds the spinner for
`MIN_SPINNER_MS` (3.3 s) so the payoff is always seen, even when the chunk
arrives instantly. `prefers-reduced-motion` skips straight to the sunbathing pose
with no movement.

## Adding a game

1. Create `src/games/<id>/YourGame.tsx` with a default export taking `GameProps`
   (`{ strings, onExit }`). It is rendered inside a full-screen flex column —
   use `h-full` and let the game manage its own scrolling.
2. Add the display strings to every language in `src/strings.ts` (the
   `EasterEggStrings` interface makes a missing one a type error).
3. Draw cover art in `src/games/GameArt.tsx` and register it under the game's id.
4. Add an entry to `GAMES` in `src/games/registry.ts` with
   `component: lazyWithRetry(() => import("./<id>/YourGame"))`.

Entries without a `component` render as a disabled "coming soon" tile — that is
what Snake, Memory and 2048 currently are.
