/**
 * Ladder — a tribute to the 1983 CP/M game that ran on Kaypro machines, where
 * the whole arcade was drawn out of the character set.
 *
 * Everything here is a pure function over a character grid, same as the
 * solitaire engine: the component owns the clock and the keyboard, the rules
 * live here and can be tested without rendering anything.
 */

export const GRID_WIDTH = 56;
export const GRID_HEIGHT = 18;

export const START_LIVES = 5;
export const START_BONUS = 5000;
/** Bonus burnt per tick — reaching zero is fatal, as in the original. */
export const BONUS_DRAIN = 8;
export const TREASURE_POINTS = 100;
/** Ticks a jump spends rising; gravity brings you back down. */
export const JUMP_TICKS = 2;

export type Cell = " " | "=" | "H" | "*" | "$";
export type Direction = -1 | 1;

export interface Position {
  row: number;
  col: number;
}

export interface FloorSpec {
  row: number;
  /** Inclusive column range. A floor that stops short is where rocks drop. */
  from: number;
  to: number;
}

export interface LadderSpec {
  col: number;
  /** Row of the upper floor — the ladder punches a hole through it. */
  top: number;
  /** Row just above the lower floor. */
  bottom: number;
}

export interface SpawnSpec extends Position {
  dir: Direction;
}

export interface LevelSpec {
  name: string;
  floors: FloorSpec[];
  ladders: LadderSpec[];
  treasures: Position[];
  start: Position;
  goal: Position;
  spawns: SpawnSpec[];
  /** Ticks between rock releases. */
  rockInterval: number;
  /** Ticks between rolling steps. Falling is always one row per tick. */
  rockMoveEvery: number;
}

export interface Rock extends Position {
  id: number;
  dir: Direction;
  falling: boolean;
}

export type LadderStatus =
  | "ready"
  | "playing"
  | "dead"
  | "levelCleared"
  | "gameOver"
  | "victory";

export interface LadderState {
  levelIndex: number;
  grid: Cell[][];
  player: Position & { jumpTicks: number };
  rocks: Rock[];
  score: number;
  bonus: number;
  lives: number;
  tick: number;
  status: LadderStatus;
  nextRockId: number;
}

export interface Input {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
}

export const NO_INPUT: Input = {
  left: false,
  right: false,
  up: false,
  down: false,
  jump: false,
};

const inBounds = (row: number, col: number): boolean =>
  row >= 0 && row < GRID_HEIGHT && col >= 0 && col < GRID_WIDTH;

const at = (grid: Cell[][], row: number, col: number): Cell =>
  inBounds(row, col) ? grid[row][col] : " ";

export const isSolid = (grid: Cell[][], row: number, col: number): boolean =>
  at(grid, row, col) === "=";

export const isLadder = (grid: Cell[][], row: number, col: number): boolean =>
  at(grid, row, col) === "H";

/** Walls and floors block; everything else can be walked or fallen through. */
const passable = (grid: Cell[][], row: number, col: number): boolean =>
  inBounds(row, col) && !isSolid(grid, row, col);

/**
 * Standing on a floor, hanging on a ladder, or standing on a ladder's top rung
 * all count as supported — the last one is what lets you step off a ladder onto
 * the floor it pokes through.
 */
export const isSupported = (grid: Cell[][], row: number, col: number): boolean =>
  isSolid(grid, row + 1, col) ||
  isLadder(grid, row, col) ||
  isLadder(grid, row + 1, col);

export function buildGrid(spec: LevelSpec): Cell[][] {
  const grid: Cell[][] = Array.from({ length: GRID_HEIGHT }, () =>
    Array<Cell>(GRID_WIDTH).fill(" "),
  );

  for (const floor of spec.floors) {
    for (let col = floor.from; col <= floor.to; col++) {
      if (inBounds(floor.row, col)) grid[floor.row][col] = "=";
    }
  }
  // Ladders last, so they cut through the floor they reach.
  for (const ladder of spec.ladders) {
    for (let row = ladder.top; row <= ladder.bottom; row++) {
      if (inBounds(row, ladder.col)) grid[row][ladder.col] = "H";
    }
  }
  for (const treasure of spec.treasures) {
    if (inBounds(treasure.row, treasure.col)) {
      grid[treasure.row][treasure.col] = "*";
    }
  }
  if (inBounds(spec.goal.row, spec.goal.col)) {
    grid[spec.goal.row][spec.goal.col] = "$";
  }
  return grid;
}

export function createLevel(
  levels: LevelSpec[],
  levelIndex: number,
  score: number,
  lives: number,
): LadderState {
  const spec = levels[levelIndex];
  return {
    levelIndex,
    grid: buildGrid(spec),
    player: { ...spec.start, jumpTicks: 0 },
    rocks: [],
    score,
    bonus: START_BONUS,
    lives,
    tick: 0,
    status: "ready",
    nextRockId: 1,
  };
}

export const createGame = (levels: LevelSpec[]): LadderState =>
  createLevel(levels, 0, 0, START_LIVES);

const samePlace = (a: Position, b: Position): boolean =>
  a.row === b.row && a.col === b.col;

/** One rock step: fall if unsupported, otherwise roll; flip on landing. */
function stepRock(grid: Cell[][], rock: Rock, rolling: boolean): Rock | null {
  if (!isSolid(grid, rock.row + 1, rock.col)) {
    const row = rock.row + 1;
    if (row >= GRID_HEIGHT) return null;

    // Turn around in the same tick it touches down, otherwise a rock spends a
    // beat sitting still on every platform it reaches.
    return isSolid(grid, row + 1, rock.col)
      ? { ...rock, row, falling: false, dir: (rock.dir * -1) as Direction }
      : { ...rock, row, falling: true };
  }

  if (!rolling) return rock;

  const col = rock.col + rock.dir;
  if (col < 0 || col >= GRID_WIDTH) return null;
  if (isSolid(grid, rock.row, col)) {
    return { ...rock, dir: (rock.dir * -1) as Direction };
  }
  return { ...rock, col };
}

function movePlayer(
  grid: Cell[][],
  player: LadderState["player"],
  input: Input,
): LadderState["player"] {
  let { row, col, jumpTicks } = player;
  const dc = input.left ? -1 : input.right ? 1 : 0;

  // A jump only starts from firm ground, never off a ladder.
  if (
    input.jump &&
    jumpTicks === 0 &&
    isSupported(grid, row, col) &&
    !isLadder(grid, row, col)
  ) {
    jumpTicks = JUMP_TICKS;
  }

  if (jumpTicks > 0) {
    jumpTicks -= 1;
    if (passable(grid, row - 1, col)) row -= 1;
    if (dc !== 0 && passable(grid, row, col + dc)) col += dc;
    return { row, col, jumpTicks };
  }

  const canGoUp =
    input.up && (isLadder(grid, row, col) || isLadder(grid, row - 1, col));
  const canGoDown = input.down && isLadder(grid, row + 1, col);

  if (canGoUp && passable(grid, row - 1, col)) {
    return { row: row - 1, col, jumpTicks };
  }
  if (canGoDown) {
    return { row: row + 1, col, jumpTicks };
  }

  if (dc !== 0 && passable(grid, row, col + dc)) col += dc;
  // Walking off a ledge drops you the same tick, so edges feel continuous.
  if (!isSupported(grid, row, col) && passable(grid, row + 1, col)) row += 1;

  return { row, col, jumpTicks };
}

/**
 * Advance the world one tick. Returns a new state; `grid` is shared by
 * reference unless a treasure was picked up, so a tick stays cheap.
 */
export function step(
  state: LadderState,
  input: Input,
  levels: LevelSpec[],
): LadderState {
  if (state.status !== "playing") return state;

  const spec = levels[state.levelIndex];
  const tick = state.tick + 1;
  let { grid, score, bonus } = state;

  const player = movePlayer(grid, state.player, input);

  // Treasure sits in the grid, so collecting it edits one row.
  if (at(grid, player.row, player.col) === "*") {
    grid = grid.map((r, i) =>
      i === player.row
        ? r.map((cell, c) => (c === player.col ? " " : cell))
        : r,
    );
    score += TREASURE_POINTS;
  }

  // Reaching the goal banks whatever bonus is left.
  if (samePlace(player, spec.goal)) {
    const cleared = score + bonus;
    const last = state.levelIndex === levels.length - 1;
    return {
      ...state,
      grid,
      player,
      score: cleared,
      tick,
      status: last ? "victory" : "levelCleared",
    };
  }

  const die = (): LadderState => ({
    ...state,
    grid,
    player,
    score,
    bonus: Math.max(0, bonus),
    tick,
    lives: state.lives - 1,
    status: state.lives - 1 > 0 ? "dead" : "gameOver",
  });

  if (state.rocks.some((rock) => samePlace(rock, player))) return die();

  const rolling = tick % spec.rockMoveEvery === 0;
  let rocks = state.rocks
    .map((rock) => stepRock(grid, rock, rolling))
    .filter((rock): rock is Rock => rock !== null);

  let nextRockId = state.nextRockId;
  if (tick % spec.rockInterval === 0) {
    for (const spawn of spec.spawns) {
      rocks = [
        ...rocks,
        {
          id: nextRockId++,
          row: spawn.row,
          col: spawn.col,
          dir: spawn.dir,
          falling: false,
        },
      ];
    }
  }

  if (rocks.some((rock) => samePlace(rock, player))) {
    return { ...die(), rocks };
  }

  bonus -= BONUS_DRAIN;
  if (bonus <= 0) return { ...die(), rocks, bonus: 0 };

  return {
    ...state,
    grid,
    player,
    rocks,
    score,
    bonus,
    tick,
    nextRockId,
    status: "playing",
  };
}

/** Restart the current level after a death, keeping score and lives. */
export const retryLevel = (
  state: LadderState,
  levels: LevelSpec[],
): LadderState => ({
  ...createLevel(levels, state.levelIndex, state.score, state.lives),
  status: "playing",
});

export const advanceLevel = (
  state: LadderState,
  levels: LevelSpec[],
): LadderState => ({
  ...createLevel(levels, state.levelIndex + 1, state.score, state.lives),
  status: "playing",
});

/** Rows as strings, for rendering the terrain in one go. */
export const renderTerrain = (grid: Cell[][]): string[] =>
  grid.map((row) => row.join(""));
