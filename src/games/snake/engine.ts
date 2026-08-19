/**
 * Snake — the canteen classic. Walls kill, so does biting yourself.
 *
 * Pure functions over a grid, same shape as the other engines here: the
 * component owns the clock and the keyboard, the rules live in this file and
 * are tested without rendering anything.
 */

/**
 * The board is measured from the screen rather than fixed, so the play area
 * fills whatever space it is given instead of letterboxing a 4:3 grid onto a
 * portrait phone. These are the fallback used before the first measurement and
 * the limits a measured board is held inside.
 */
export const DEFAULT_SIZE: BoardSize = { cols: 24, rows: 18 };
export const MIN_CELLS = 8;
export const MAX_CELLS = 48;

export const START_LENGTH = 4;
export const FOOD_POINTS = 10;

/** Milliseconds per tick at the start, and the floor the speed-up stops at. */
export const START_TICK_MS = 150;
export const MIN_TICK_MS = 70;
/** Each apple shaves this much off the clock. */
export const SPEEDUP_MS = 4;

/**
 * How many turns may sit in the queue.
 *
 * Snake is played faster than it ticks: right-then-up around a corner is often
 * two keys inside one tick. Buffering both makes the corner work; buffering
 * more makes the snake feel like it is steering itself.
 */
export const MAX_QUEUED_TURNS = 2;

export type Direction = "up" | "right" | "down" | "left";

export type SnakeStatus = "ready" | "playing" | "paused" | "dead" | "won";

export interface Point {
  row: number;
  col: number;
}

export interface BoardSize {
  cols: number;
  rows: number;
}

/** Hold a measured board inside the playable range. */
export const clampSize = (size: BoardSize): BoardSize => ({
  cols: Math.max(MIN_CELLS, Math.min(MAX_CELLS, Math.round(size.cols))),
  rows: Math.max(MIN_CELLS, Math.min(MAX_CELLS, Math.round(size.rows))),
});

export interface SnakeState {
  /** The board this run is being played on; fixed for the run's lifetime. */
  size: BoardSize;
  /** Head first. Every segment is exactly one cell from its neighbour. */
  snake: Point[];
  /** The direction the last tick moved in — what a reversal is measured against. */
  direction: Direction;
  /** Turns waiting for a tick, oldest first. */
  queue: Direction[];
  /** `null` only when the snake covers the whole board. */
  food: Point | null;
  score: number;
  tick: number;
  status: SnakeStatus;
}

const DELTA: Record<Direction, Point> = {
  up: { row: -1, col: 0 },
  right: { row: 0, col: 1 },
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
};

const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  right: "left",
  down: "up",
  left: "right",
};

const same = (a: Point, b: Point): boolean => a.row === b.row && a.col === b.col;

const inBounds = (p: Point, size: BoardSize): boolean =>
  p.row >= 0 && p.row < size.rows && p.col >= 0 && p.col < size.cols;

/**
 * Drop an apple on a free cell. `random` is injectable so tests can pin it.
 *
 * Picking from the free cells rather than retrying random coordinates keeps the
 * last few apples of a nearly full board from costing an unbounded number of
 * guesses.
 */
export function placeFood(
  snake: Point[],
  random: () => number,
  size: BoardSize,
): Point | null {
  const taken = new Set(snake.map((p) => `${p.row},${p.col}`));
  const free: Point[] = [];
  for (let row = 0; row < size.rows; row++) {
    for (let col = 0; col < size.cols; col++) {
      if (!taken.has(`${row},${col}`)) free.push({ row, col });
    }
  }
  if (free.length === 0) return null;
  return free[Math.min(free.length - 1, Math.floor(random() * free.length))];
}

/** A fresh snake, mid-board, heading right with an apple already down. */
export function createGame(
  random: () => number = Math.random,
  requested: BoardSize = DEFAULT_SIZE,
): SnakeState {
  const size = clampSize(requested);
  const row = Math.floor(size.rows / 2);
  const col = Math.floor(size.cols / 2);
  // A narrow board must not be dealt a snake that already runs off its edge.
  const length = Math.max(2, Math.min(START_LENGTH, col + 1));
  const snake = Array.from({ length }, (_, i) => ({ row, col: col - i }));
  return {
    size,
    snake,
    direction: "right",
    queue: [],
    food: placeFood(snake, random, size),
    score: 0,
    tick: 0,
    status: "ready",
  };
}

/**
 * Queue a turn.
 *
 * A reversal is judged against the last *queued* direction rather than the one
 * on the board: without that, a quick right-then-down-then-left would let the
 * snake fold back into its own neck within a single tick.
 */
export function turn(state: SnakeState, direction: Direction): SnakeState {
  if (state.status !== "ready" && state.status !== "playing") return state;
  if (state.queue.length >= MAX_QUEUED_TURNS) return state;
  const last = state.queue[state.queue.length - 1] ?? state.direction;
  if (direction === last || direction === OPPOSITE[last]) return state;
  return { ...state, queue: [...state.queue, direction] };
}

/** Advance one tick. Anything but `playing` sits still. */
export function step(
  state: SnakeState,
  random: () => number = Math.random,
): SnakeState {
  if (state.status !== "playing") return state;

  const [queued, ...rest] = state.queue;
  const direction = queued ?? state.direction;
  const delta = DELTA[direction];
  const head: Point = {
    row: state.snake[0].row + delta.row,
    col: state.snake[0].col + delta.col,
  };
  const moved = { ...state, direction, queue: rest, tick: state.tick + 1 };

  if (!inBounds(head, state.size)) return { ...moved, status: "dead" };

  const eating = state.food !== null && same(head, state.food);
  // The tail vacates its cell on this same tick unless the apple grows us into
  // it, so chasing your own tail is legal — a rule players expect.
  const body = eating ? state.snake : state.snake.slice(0, -1);
  if (body.some((p) => same(p, head))) return { ...moved, status: "dead" };

  const snake = [head, ...body];
  const food = eating ? placeFood(snake, random, state.size) : state.food;

  return {
    ...moved,
    snake,
    food,
    score: eating ? state.score + FOOD_POINTS : state.score,
    // Eating the last free cell means the snake *is* the board — the only way
    // Snake is ever actually won.
    status: eating && food === null ? "won" : "playing",
  };
}

/**
 * Which way to turn to head for `target` — the whole of the pointer control.
 *
 * The axis with more ground to cover wins, so the snake commits to the long leg
 * first and arrives in an L rather than a staircase. A leg that would double
 * back is dropped in favour of the other one; `null` means stay the course,
 * which is what happens when the target is straight ahead or under the head.
 */
export function directionToward(
  state: SnakeState,
  target: Point,
): Direction | null {
  const head = state.snake[0];
  const dRow = target.row - head.row;
  const dCol = target.col - head.col;

  const horizontal: Direction | null =
    dCol === 0 ? null : dCol > 0 ? "right" : "left";
  const vertical: Direction | null =
    dRow === 0 ? null : dRow > 0 ? "down" : "up";
  const legs =
    Math.abs(dCol) >= Math.abs(dRow)
      ? [horizontal, vertical]
      : [vertical, horizontal];

  // Measured against the last *queued* turn, for the same reason `turn` is.
  const last = state.queue[state.queue.length - 1] ?? state.direction;
  for (const leg of legs) {
    if (!leg) continue;
    // Already pointed the right way: hold the course rather than falling
    // through to the shorter leg and zig-zagging towards the target.
    if (leg === last) return null;
    if (leg === OPPOSITE[last]) continue;
    return leg;
  }
  return null;
}

/** The clock tightens with every apple, down to `MIN_TICK_MS`. */
export const tickInterval = (state: SnakeState): number =>
  Math.max(
    MIN_TICK_MS,
    START_TICK_MS - (state.snake.length - START_LENGTH) * SPEEDUP_MS,
  );
