# @simplytokenized/easter-egg-games

A hidden arcade for a web app. Click the host application's logo **six times**
(within ~1.2 s between clicks) and a full-screen arcade opens. Five games are
playable: Klondike **Solitaire**, **Ladder** — a tribute to the 1983
character-mode platformer — **Snake**, **Space Invaders** and **Pac-Man**.

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

Everything else — the modal, every game, the beach animation, all five
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
npm test           # 148 unit tests, no browser needed
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
    snake/
      engine.ts            grid rules, growth, collisions, aiming
      SnakeGame.tsx        measured board + pointer input     ← own chunk
    invaders/
      engine.ts            fleet, shots, bunkers, waves
      sprites.ts           pixel bitmaps → one path each
      InvadersGame.tsx     the field + input                  ← own chunk
    pacman/
      maze.ts              the maze, drawn, plus its landmarks
      engine.ts            movement, ghost AI, fright, scoring
      PacmanGame.tsx       SVG board + input                  ← own chunk
tests/                     one suite per engine, plus component tests for the
                           four games with a clock
dev/                       the standalone playground
```

## Playing

**Solitaire** — three ways to move a card, all live at once: **drag** it, **tap
it then tap the destination**, or **double-tap** to send it straight to the aces.
Keyboard: `⌘Z` undoes, `N` deals a new game, `Esc` closes the arcade.

**Ladder** — arrows or `WASD` to move and climb, `Space` to jump. On touch
devices an on-screen pad appears (`@media (pointer: coarse)`).

**Snake** — point where you want to go and the snake heads there: touch or
cursor, no on-screen pad. Arrows or `WASD` steer too, and whichever was used
last is the one in charge. `Space` pauses, as does losing window focus. Walls and
your own body are fatal; each apple lengthens the snake and shortens the clock,
down to a floor of 70 ms per step.

The board is measured, not fixed: the grid is derived from the space the arcade
gives it, so the play area fills a portrait phone and a laptop alike instead of
letterboxing one shape onto both. A new grid is only adopted between runs —
moving the walls while the snake is running at them would not be a kindness.

**Space Invaders** — arrows or `A`/`D` to move, `Space` to fire. Holding fire is
enough: only one shot is ever in the air. On a touch screen, drag anywhere on
the field and the cannon follows your finger and fires by itself; the arrow pad
is there too for anyone who prefers thumbs.

**Pac-Man** — arrows or `WASD` to steer; a direction you ask for early is held
until the corner arrives, so turns are forgiving. On touch, **swipe the maze**
in the direction you want; a pad appears too, wherever there is height for one.

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

## Space Invaders

Endless waves: clear the fleet and the next one starts lower and marches faster.
Shots and bunkers behave the way the cabinet's did — one shot in the air at a
time, bunkers that erode from both sides and are ground away by the fleet
passing over them, and a fleet that ends the game outright if it lands.

As with Ladder, the implementation is our own. The genre and its mechanics are
free to reuse; Taito's artwork and ROM data are not, so every sprite in
`sprites.ts` is drawn here.

Worth knowing before editing it:

- **Nothing is interpolated between ticks.** Ladder needs interpolation because
  it ticks at 95 ms; this ticks at 33 ms, and — more to the point — the fleet is
  *supposed* to jump. Invaders hold still and then move `STEP_X` at once, which
  is what makes a march look like a march. Only the cannon and the shots move
  every tick, and at 30 Hz they need no help.
- **The fleet marches on its own clock.** `stepInterval` returns ticks per
  march, from the number of invaders left and the wave, so the fleet speeds up
  as you shoot it down. That acceleration is the whole difficulty curve; it is
  not a rendering effect.
- **Randomness lives in the state.** Bombs pick a column at random, so the seed
  is a field of `InvadersState` and `step` advances it. `step` stays pure — the
  same state and the same keys always give the same next state — which is what
  makes the bombing testable and a replay reproducible.
- **The fleet and the bunkers are memoised.** Fifty-five sprites and ninety-six
  bunker blocks must not re-render thirty times a second, so `Fleet` and
  `Bunkers` are `memo`ised and the engine returns the *same* shield objects when
  nothing hit them. Copying a shield on every tick would quietly undo that.
- **Touch steering is absolute, the keys are relative.** Chasing an invader with
  two arrow buttons is the worst part of every phone port of this game, so a
  finger on the field sets a target column and the per-tick input is derived
  from where the cannon actually is. The engine never learns about pointers.
- **The screen is measured, not stretched.** The field is letterboxed to its
  4:3, because the sprites are pixel art and a field that is not the shape its
  units describe makes the invaders tall on a phone and squat on a desktop.
  `aspect-ratio` alone will not do it: inside a flex row a `width: auto` item
  takes the line's width, which is the stretch it was supposed to prevent.
- **Sprites are bitmaps, not paths.** `sprites.ts` holds character art you can
  edit by looking at it; `spritePath` merges each row's lit pixels into one
  `<path>` at module load, so an invader costs one DOM node rather than eighty.

## Pac-Man

Clear the maze, dodge four ghosts, and eat a power pellet to spend a few seconds
being the dangerous one. Levels are endless and the ghosts speed up as they go;
the fruit under the pen turns up twice a maze.

The implementation is independent, on the same footing as Ladder: the genre and
its mechanics are free to reuse, the original's maze, artwork and code are not,
so the maze here is our own. The *name* is Namco's trademark, which a hidden
easter egg is unlikely to trouble — but if this ever ships somewhere public,
`pacmanName` in `strings.ts` is the one line to change.

Worth knowing before editing it:

- **The maze is drawn, not declared.** This is the deliberate opposite of
  Ladder's geometry: a maze's whole shape *is* the design, and ranges would hide
  it. The invariants geometry would have given for free are unit tests instead —
  row widths, left/right symmetry, and a flood fill proving every pellet is
  reachable from Pac-Man's start tile.
- **The pen door is one-way by intent.** Ghosts may cross it on the way out, or
  as eyes on the way home; nobody else may. Without that rule a ghost whose
  target sits below the pen routes straight through it and never comes out.
- **Ghost personality is one target tile each.** Blinky aims at Pac-Man, Pinky
  four tiles ahead of him, Inky at Blinky's position mirrored through the tile
  two ahead, Clyde at Pac-Man until he gets close and then at his own corner.
  Each ghost simply steps to whichever legal neighbour is nearest its target and
  never turns back — which is the whole of the AI, and enough for four
  distinguishable hunters.
- **Ties break up, left, down, right.** Two equally short routes are not a coin
  flip; the fixed order is what makes the ghosts feel like they have habits.
- **Frightened movement is a hash, not `Math.random`.** A tick has to be
  replayable for the tests, so the wobble is an integer hash of the tick and the
  ghost.
- **Ticks are cells, frames are pixels — the same split as Ladder.** React owns
  which sprites exist and turns them; the frame loop owns the `transform` on
  anything carrying `data-entity`. A tunnel crossing is the one jump the loop
  must *not* interpolate, or the sprite skates back across the whole maze.
- **A tick is 140 ms, and every other timing is counted in ticks.** That is a
  little over seven tiles a second — quick enough to feel like an arcade, slow
  enough that a corner can still be answered. Fright, the fruit, the pen
  releases and the scatter/chase schedule are all sized against that number, so
  changing it rescales the whole game and those constants need scaling back.
- **Touch gets swipe first, the pad second.** A maze wants a direction, not a
  button, so a swipe anywhere on the board steers and the origin resets after
  each turn — a thumb can stay down and keep steering. The board is
  `touch-none`, or the same drag would scroll the arcade behind it.
- **A landscape phone rearranges rather than shrinks.** Stacked above a board,
  the readouts and a pad leave a maze barely 140 px tall. Under
  `(max-height: 560px)` the pad gives way to swiping and the readouts move into
  a column beside the board, which buys back roughly half the height.

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
what Memory and 2048 currently are.
