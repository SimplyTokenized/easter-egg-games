/**
 * The maze, plus the handful of tiles the rules need by name.
 *
 * Ladder's levels are declared as geometry because a hand-drawn character grid
 * there is easy to get subtly wrong. A maze is the opposite case: its shape is
 * the design, and ranges would hide it. So this one is drawn — and the
 * invariants that geometry would have guaranteed live in the unit tests
 * instead: the width of every row, left/right symmetry, and that every pellet
 * is reachable from Pac-Man's starting tile.
 *
 * The layout is our own. The genre is free to reuse; the original's maze is not.
 */

/** `#` wall · `.` pellet · `o` power pellet · `-` ghost-house door · ` ` empty. */
export type Tile = "#" | "." | "o" | "-" | " ";

export const MAZE: readonly string[] = [
  "#####################",
  "#.........#.........#",
  "#.##.####.#.####.##.#",
  "#o##.####.#.####.##o#",
  "#...................#",
  "#.##.##.#####.##.##.#",
  "#.##.##.#####.##.##.#",
  "#...................#",
  "####.##.......##.####",
  "####.##.##-##.##.####",
  "........#   #........",
  "####.##.#####.##.####",
  "####.##.......##.####",
  "#...................#",
  "#.##.##.#####.##.##.#",
  "#.##.##.#####.##.##.#",
  "#...................#",
  "#o##.####.#.####.##o#",
  "#.##.####.#.####.##.#",
  "#.........#.........#",
  "#####################",
];

export const ROWS = MAZE.length;
export const COLS = MAZE[0].length;

export interface Vec {
  row: number;
  col: number;
}

/** One number per tile — cheap keys for the pellet sets. */
export const key = (row: number, col: number): number => row * COLS + col;

const WALLS: boolean[][] = MAZE.map((line) =>
  [...line].map((char) => char === "#"),
);

export const isWall = (row: number, col: number): boolean =>
  row < 0 || row >= ROWS || WALLS[row][col] !== false;

/** Row 10 runs off both edges; everything else is walled in. */
export const wrapCol = (col: number): number => (col + COLS) % COLS;

export const tileAt = (row: number, col: number): Tile =>
  (MAZE[row]?.[col] ?? "#") as Tile;

/** The pen: a three-tile room with a door in the middle of its ceiling. */
export const HOUSE_ROW = 10;
export const HOUSE_COLS: readonly number[] = [9, 10, 11];
export const DOOR: Vec = { row: 9, col: 10 };
/** Where a ghost stands once it is out, and what a leaving ghost aims at. */
export const HOUSE_EXIT: Vec = { row: 8, col: 10 };
export const HOUSE_CENTER: Vec = { row: HOUSE_ROW, col: 10 };

export const isDoor = (row: number, col: number): boolean =>
  row === DOOR.row && col === DOOR.col;

export const isHouse = (row: number, col: number): boolean =>
  row === HOUSE_ROW && HOUSE_COLS.includes(col);

export const PLAYER_START: Vec = { row: 13, col: 10 };
/** Under the pen, where the bonus fruit shows up. */
export const FRUIT_TILE: Vec = { row: 12, col: 10 };

/** Pellets and power pellets, read off the drawing. */
export function initialPellets(): { pellets: Set<number>; powers: Set<number> } {
  const pellets = new Set<number>();
  const powers = new Set<number>();
  MAZE.forEach((line, row) => {
    [...line].forEach((char, col) => {
      if (char === ".") pellets.add(key(row, col));
      else if (char === "o") powers.add(key(row, col));
    });
  });
  return { pellets, powers };
}
