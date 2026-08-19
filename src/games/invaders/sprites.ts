/**
 * The cast, drawn as pixels.
 *
 * Bitmaps rather than SVG paths, because a bitmap is something you can edit by
 * looking at it. `spritePath` turns the rows into a single `<path>` at module
 * load — one node per sprite instead of one per pixel, which matters when
 * fifty-five of them are on screen at once.
 *
 * The shapes are our own. The genre is free to reuse; Taito's actual artwork is
 * not, so nothing here is traced from the cabinet.
 */

export type Bitmap = readonly string[];

/** Top row: small, fast, worth the most. */
const squidA: Bitmap = [
  "...XX...",
  "..XXXX..",
  ".XXXXXX.",
  "XX.XX.XX",
  "XXXXXXXX",
  "..X..X..",
  ".X.XX.X.",
  "X.X..X.X",
];
const squidB: Bitmap = [
  "...XX...",
  "..XXXX..",
  ".XXXXXX.",
  "XX.XX.XX",
  "XXXXXXXX",
  ".X.XX.X.",
  "X......X",
  ".X....X.",
];

/** The middle pair. */
const crabA: Bitmap = [
  "..X.....X..",
  "...X...X...",
  "..XXXXXXX..",
  ".XX.XXX.XX.",
  "XXXXXXXXXXX",
  "X.XXXXXXX.X",
  "X.X.....X.X",
  "...XX.XX...",
];
const crabB: Bitmap = [
  "..X.....X..",
  "X..X...X..X",
  "X.XXXXXXX.X",
  "XXX.XXX.XXX",
  "XXXXXXXXXXX",
  ".XXXXXXXXX.",
  "..X.....X..",
  ".X.......X.",
];

/** The bottom pair: the wide ones that reach you first. */
const octopusA: Bitmap = [
  "....XXXX....",
  ".XXXXXXXXXX.",
  "XXXXXXXXXXXX",
  "XXX..XX..XXX",
  "XXXXXXXXXXXX",
  "...XX..XX...",
  "..XX.XX.XX..",
  "XX........XX",
];
const octopusB: Bitmap = [
  "....XXXX....",
  ".XXXXXXXXXX.",
  "XXXXXXXXXXXX",
  "XXX..XX..XXX",
  "XXXXXXXXXXXX",
  "..XXX..XXX..",
  ".XX..XX..XX.",
  "..XX....XX..",
];

export const CANNON: Bitmap = [
  "......X......",
  ".....XXX.....",
  ".....XXX.....",
  ".XXXXXXXXXXX.",
  "XXXXXXXXXXXXX",
  "XXXXXXXXXXXXX",
  "XXXXXXXXXXXXX",
  "XXX.......XXX",
];

export const SAUCER: Bitmap = [
  ".....XXXXXX.....",
  "...XXXXXXXXXX...",
  "..XXXXXXXXXXXX..",
  ".XX.XX.XX.XX.XX.",
  "XXXXXXXXXXXXXXXX",
  "..XXX..XX..XXX..",
  "...X........X...",
];

/** Four spokes and a core — a burst, not a mushroom. */
export const EXPLOSION: Bitmap = [
  "X..X.X..X",
  ".X..X..X.",
  "..XXXXX..",
  ".XXXXXXX.",
  "XXXXXXXXX",
  ".XXXXXXX.",
  "..XXXXX..",
  ".X..X..X.",
  "X..X.X..X",
];

/** Rows are the same length in every sprite, so the box is the first row. */
export const spriteWidth = (bitmap: Bitmap): number => bitmap[0].length;
export const spriteHeight = (bitmap: Bitmap): number => bitmap.length;

/**
 * One `d` string covering every lit pixel, runs merged along each row.
 *
 * `M x y h n v1 h-n z` per run: fewer sub-paths than a rect per pixel, and the
 * result scales to any size because the viewBox carries the units.
 */
export function spritePath(bitmap: Bitmap): string {
  let path = "";
  bitmap.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] !== "X") {
        x += 1;
        continue;
      }
      let run = 0;
      while (x + run < row.length && row[x + run] === "X") run += 1;
      path += `M${x} ${y}h${run}v1h${-run}z`;
      x += run;
    }
  });
  return path;
}

export interface Sprite {
  path: string;
  width: number;
  height: number;
}

const toSprite = (bitmap: Bitmap): Sprite => ({
  path: spritePath(bitmap),
  width: spriteWidth(bitmap),
  height: spriteHeight(bitmap),
});

/** `[species][frame]` — species 0 is the top row, 2 the bottom pair. */
export const INVADER_SPRITES: readonly (readonly [Sprite, Sprite])[] = [
  [toSprite(squidA), toSprite(squidB)],
  [toSprite(crabA), toSprite(crabB)],
  [toSprite(octopusA), toSprite(octopusB)],
];

export const CANNON_SPRITE = toSprite(CANNON);
export const SAUCER_SPRITE = toSprite(SAUCER);
export const EXPLOSION_SPRITE = toSprite(EXPLOSION);
