import { describe, expect, it } from "vitest";
import {
  clampSize,
  createGame,
  DEFAULT_SIZE,
  directionToward,
  FOOD_POINTS,
  MAX_CELLS,
  MAX_QUEUED_TURNS,
  MIN_CELLS,
  MIN_TICK_MS,
  placeFood,
  START_LENGTH,
  START_TICK_MS,
  step,
  tickInterval,
  turn,
  type BoardSize,
  type Direction,
  type Point,
  type SnakeState,
} from "@easter-egg/games/snake/engine";

const { cols: COLS, rows: ROWS } = DEFAULT_SIZE;

/** A deterministic stand-in for `Math.random`, cycling through fixed values. */
const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

/** A board built by hand, so behaviour never depends on where an apple landed. */
const board = (
  snake: Point[],
  overrides: Partial<SnakeState> = {},
): SnakeState => ({
  size: DEFAULT_SIZE,
  snake,
  direction: "right",
  queue: [],
  food: null,
  score: 0,
  tick: 0,
  status: "playing",
  ...overrides,
});

const row = (r: number, cols: number[]): Point[] => cols.map((col) => ({ row: r, col }));

const run = (state: SnakeState, ticks: number, random = sequence(0)) => {
  let current = state;
  for (let i = 0; i < ticks; i++) current = step(current, random);
  return current;
};

describe("snake engine — a new game", () => {
  it("starts mid-board, waiting, with an apple down", () => {
    const state = createGame(sequence(0));

    expect(state.snake).toHaveLength(START_LENGTH);
    expect(state.status).toBe("ready");
    expect(state.direction).toBe("right");
    expect(state.score).toBe(0);
    expect(state.food).not.toBeNull();
  });

  it("lays the body out behind the head, one cell apart", () => {
    const { snake } = createGame(sequence(0));

    snake.forEach((segment, i) => {
      if (i === 0) return;
      const previous = snake[i - 1];
      const distance =
        Math.abs(segment.row - previous.row) + Math.abs(segment.col - previous.col);
      expect(distance).toBe(1);
    });
  });

  it("never puts the apple under the snake", () => {
    const snake = row(0, [2, 1, 0]);
    const food = placeFood(snake, sequence(0), DEFAULT_SIZE);

    expect(food).toEqual({ row: 0, col: 3 });
  });

  it("reports no room left when the snake covers the board", () => {
    const full: Point[] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) full.push({ row: r, col: c });
    }

    expect(placeFood(full, sequence(0), DEFAULT_SIZE)).toBeNull();
  });
});

describe("snake engine — moving", () => {
  it("advances one cell per tick and drags the tail along", () => {
    const state = board(row(5, [5, 4, 3]));

    const next = step(state, sequence(0));

    expect(next.snake).toEqual(row(5, [6, 5, 4]));
    expect(next.tick).toBe(1);
  });

  it("only moves while playing", () => {
    for (const status of ["ready", "paused", "dead", "won"] as const) {
      const state = board(row(5, [5, 4, 3]), { status });
      expect(step(state, sequence(0))).toBe(state);
    }
  });

  it("takes one queued turn per tick, in order", () => {
    let state = board(row(5, [5, 4, 3]));
    state = turn(state, "up");
    state = turn(state, "left");
    expect(state.queue).toEqual<Direction[]>(["up", "left"]);

    state = step(state, sequence(0));
    expect(state.direction).toBe("up");
    expect(state.snake[0]).toEqual({ row: 4, col: 5 });
    expect(state.queue).toEqual<Direction[]>(["left"]);

    state = step(state, sequence(0));
    expect(state.direction).toBe("left");
    expect(state.snake[0]).toEqual({ row: 4, col: 4 });
    expect(state.queue).toEqual([]);
  });
});

describe("snake engine — steering rules", () => {
  it("refuses a reversal into its own neck", () => {
    const state = board(row(5, [5, 4, 3]));

    expect(turn(state, "left")).toBe(state);
  });

  it("refuses a reversal of an already queued turn", () => {
    const queued = turn(board(row(5, [5, 4, 3])), "up");

    expect(turn(queued, "down")).toBe(queued);
  });

  it("ignores a turn that repeats the current heading", () => {
    const state = board(row(5, [5, 4, 3]));

    expect(turn(state, "right")).toBe(state);
  });

  it("buffers no more than two turns", () => {
    let state = board(row(5, [5, 4, 3]));
    state = turn(state, "up");
    state = turn(state, "left");
    state = turn(state, "down");

    expect(state.queue).toHaveLength(MAX_QUEUED_TURNS);
  });

  it("cannot be steered once the run is over", () => {
    const dead = board(row(5, [5, 4, 3]), { status: "dead" });

    expect(turn(dead, "up")).toBe(dead);
  });

  it("can be steered while the board is still waiting to start", () => {
    const ready = board(row(5, [5, 4, 3]), { status: "ready" });

    expect(turn(ready, "up").queue).toEqual<Direction[]>(["up"]);
  });
});

describe("snake engine — dying", () => {
  it("dies against the right wall", () => {
    const state = board(row(5, [COLS - 1, COLS - 2]));

    const next = step(state, sequence(0));

    expect(next.status).toBe("dead");
    // The body stays put, so the last frame shows where it went wrong.
    expect(next.snake).toEqual(state.snake);
  });

  it("dies against the top wall", () => {
    const state = board([{ row: 0, col: 5 }, { row: 1, col: 5 }], {
      direction: "up",
    });

    expect(step(state, sequence(0)).status).toBe("dead");
  });

  it("dies on its own body", () => {
    // A closed loop: heading right from the top-left corner of it walks the
    // head into the segment below after three turns.
    const state = board(
      [
        { row: 0, col: 1 },
        { row: 1, col: 1 },
        { row: 1, col: 0 },
        { row: 0, col: 0 },
      ],
      { direction: "right", queue: ["down", "left"] },
    );

    const next = run(state, 3);

    expect(next.status).toBe("dead");
  });

  it("lets the head move into the cell its tail is leaving", () => {
    // A tight 2x2 ring turning into its own tail. Without the tail vacating on
    // the same tick this is instant death, and players expect it to work.
    const state = board(
      [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 1, col: 1 },
        { row: 1, col: 0 },
      ],
      { direction: "left", queue: ["down"] },
    );

    const next = step(state, sequence(0));

    expect(next.status).toBe("playing");
    expect(next.snake[0]).toEqual({ row: 1, col: 0 });
  });
});

describe("snake engine — eating", () => {
  it("scores, grows and drops a new apple", () => {
    const state = board(row(5, [5, 4, 3]), { food: { row: 5, col: 6 } });

    const next = step(state, sequence(0));

    expect(next.score).toBe(FOOD_POINTS);
    expect(next.snake).toHaveLength(4);
    expect(next.snake[0]).toEqual({ row: 5, col: 6 });
    // The tail stayed where it was — that is what growing means.
    expect(next.snake[3]).toEqual({ row: 5, col: 3 });
    expect(next.food).not.toEqual({ row: 5, col: 6 });
  });

  it("keeps the apple where it is on a tick that misses it", () => {
    const food = { row: 9, col: 9 };
    const state = board(row(5, [5, 4, 3]), { food });

    expect(step(state, sequence(0)).food).toBe(food);
  });

  it("is won when the last free cell is eaten", () => {
    // Every cell but one belongs to the snake, and the head is next to it.
    const snake: Point[] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (r === ROWS - 1 && c === COLS - 1) continue;
        snake.push({ row: r, col: c });
      }
    }
    // Head last-but-one cell, apple on the only hole beneath it.
    const ordered = [{ row: ROWS - 2, col: COLS - 1 }, ...snake.filter(
      (p) => !(p.row === ROWS - 2 && p.col === COLS - 1),
    )];
    const state = board(ordered, {
      direction: "down",
      food: { row: ROWS - 1, col: COLS - 1 },
    });

    const next = step(state, sequence(0));

    expect(next.status).toBe("won");
    expect(next.food).toBeNull();
    expect(next.snake).toHaveLength(COLS * ROWS);
  });
});

describe("snake engine — the board it is played on", () => {
  it("takes the size it is given", () => {
    const size: BoardSize = { cols: 14, rows: 26 };
    const state = createGame(sequence(0), size);

    expect(state.size).toEqual(size);
    expect(state.snake[0]).toEqual({ row: 13, col: 7 });
  });

  it("holds a measured board inside the playable range", () => {
    expect(clampSize({ cols: 2, rows: 500 })).toEqual({
      cols: MIN_CELLS,
      rows: MAX_CELLS,
    });
    expect(clampSize({ cols: 20.4, rows: 15.6 })).toEqual({ cols: 20, rows: 16 });
  });

  it("dies at the wall of its own board, not the default one", () => {
    const size: BoardSize = { cols: 10, rows: 10 };
    const state = board(row(5, [9, 8]), { size });

    expect(step(state, sequence(0)).status).toBe("dead");
  });

  it("never deals a snake that already hangs off a narrow board", () => {
    const state = createGame(sequence(0), { cols: MIN_CELLS, rows: MIN_CELLS });

    for (const segment of state.snake) {
      expect(segment.col).toBeGreaterThanOrEqual(0);
      expect(segment.row).toBeGreaterThanOrEqual(0);
    }
  });

  it("keeps the apple on the board it was given", () => {
    const size: BoardSize = { cols: 9, rows: 9 };
    const food = placeFood([{ row: 0, col: 0 }], sequence(0.999), size)!;

    expect(food.row).toBeLessThan(size.rows);
    expect(food.col).toBeLessThan(size.cols);
  });
});

describe("snake engine — steering by pointer", () => {
  it("commits to the longer leg first, so it arrives in an L", () => {
    // Head at (5,5) heading right; the target is a little right and far up, so
    // the vertical leg is the one to cover first.
    const state = board(row(5, [5, 4, 3]));

    expect(directionToward(state, { row: 0, col: 7 })).toBe("up");
  });

  it("holds its course when the longer leg is the way it already faces", () => {
    // Far right and a little up: turning up now would only zig-zag there.
    const state = board(row(5, [5, 4, 3]));

    expect(directionToward(state, { row: 3, col: 15 })).toBeNull();
  });

  it("holds its course when the target is straight ahead", () => {
    const state = board(row(5, [5, 4, 3]));

    expect(directionToward(state, { row: 5, col: 12 })).toBeNull();
  });

  it("holds its course when the target is under the head", () => {
    const state = board(row(5, [5, 4, 3]));

    expect(directionToward(state, { row: 5, col: 5 })).toBeNull();
  });

  it("takes the other leg rather than doubling back", () => {
    // Straight behind: turning left is fatal, so it peels off vertically.
    const state = board(row(5, [5, 4, 3]));

    expect(directionToward(state, { row: 8, col: 0 })).toBe("down");
  });

  it("has nowhere legal to go for a target directly behind it", () => {
    const state = board(row(5, [5, 4, 3]));

    expect(directionToward(state, { row: 5, col: 0 })).toBeNull();
  });

  it("judges a reversal against the turn already queued", () => {
    const queued = turn(board(row(5, [5, 4, 3])), "up");

    // "down" would reverse the queued "up", so the horizontal leg wins.
    expect(directionToward(queued, { row: 9, col: 8 })).toBe("right");
  });

  it("walks the snake to the cell it is pointed at", () => {
    let state = board(row(5, [5, 4, 3]));
    const target = { row: 2, col: 9 };

    for (let i = 0; i < 12; i++) {
      const direction = directionToward(state, target);
      if (direction) state = turn(state, direction);
      state = step(state, sequence(0));
      if (state.snake[0].row === target.row && state.snake[0].col === target.col) break;
    }

    expect(state.status).toBe("playing");
    expect(state.snake[0]).toEqual(target);
  });
});

describe("snake engine — pace", () => {
  it("starts at the opening speed and tightens with every apple", () => {
    const fresh = createGame(sequence(0));
    expect(tickInterval(fresh)).toBe(START_TICK_MS);

    const longer = board(row(0, [4, 3, 2, 1, 0]));
    expect(tickInterval(longer)).toBeLessThan(START_TICK_MS);
  });

  it("never drops below the floor", () => {
    const huge = board(
      Array.from({ length: 200 }, (_, i) => ({ row: 0, col: i })),
    );

    expect(tickInterval(huge)).toBe(MIN_TICK_MS);
  });
});
