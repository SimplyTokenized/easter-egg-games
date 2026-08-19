import { describe, expect, it } from "vitest";
import {
  advanceLevel,
  buildGrid,
  createGame,
  createLevel,
  GRID_HEIGHT,
  GRID_WIDTH,
  isLadder,
  isSolid,
  isSupported,
  NO_INPUT,
  retryLevel,
  START_BONUS,
  START_LIVES,
  step,
  type Input,
  type LadderState,
  type LevelSpec,
} from "@easter-egg/games/ladder/engine";
import { LEVELS } from "@easter-egg/games/ladder/levels";

const input = (overrides: Partial<Input> = {}): Input => ({
  ...NO_INPUT,
  ...overrides,
});

/** A tiny two-storey level, so behaviour tests do not depend on the real ones. */
const testLevel: LevelSpec = {
  name: "Test",
  floors: [
    { row: 5, from: 0, to: 20 },
    { row: 9, from: 0, to: 20 },
  ],
  ladders: [{ col: 10, top: 5, bottom: 8 }],
  treasures: [{ row: 8, col: 3 }],
  start: { row: 8, col: 1 },
  goal: { row: 4, col: 15 },
  spawns: [{ row: 4, col: 18, dir: -1 }],
  rockInterval: 1000,
  rockMoveEvery: 1,
};

const LEVEL_SET = [testLevel];

const start = (levels = LEVEL_SET): LadderState => ({
  ...createLevel(levels, 0, 0, START_LIVES),
  status: "playing",
});

const run = (state: LadderState, ticks: number, held: Input, levels = LEVEL_SET) => {
  let current = state;
  for (let i = 0; i < ticks; i++) current = step(current, held, levels);
  return current;
};

describe("ladder engine — grid building", () => {
  it("draws floors, ladders and items at the right size", () => {
    const grid = buildGrid(testLevel);

    expect(grid).toHaveLength(GRID_HEIGHT);
    expect(grid[0]).toHaveLength(GRID_WIDTH);
    expect(isSolid(grid, 5, 0)).toBe(true);
    expect(isSolid(grid, 5, 21)).toBe(false);
    expect(grid[8][3]).toBe("*");
    expect(grid[4][15]).toBe("$");
  });

  it("cuts the ladder through the floor it reaches", () => {
    const grid = buildGrid(testLevel);

    // Row 5 is a floor, but the ladder's column must be climbable, not solid.
    expect(isLadder(grid, 5, 10)).toBe(true);
    expect(isSolid(grid, 5, 10)).toBe(false);
    expect(isSolid(grid, 5, 11)).toBe(true);
  });

  it("treats a ladder top as standable so you can step off it", () => {
    const grid = buildGrid(testLevel);

    expect(isSupported(grid, 4, 10)).toBe(true);
  });
});

describe("ladder engine — player movement", () => {
  it("walks along a floor", () => {
    const next = step(start(), input({ right: true }), LEVEL_SET);

    expect(next.player).toMatchObject({ row: 8, col: 2 });
  });

  it("falls when it walks off the end of a floor", () => {
    const state = start();
    const onTheEdge = { ...state, player: { row: 8, col: 20, jumpTicks: 0 } };

    const next = step(onTheEdge, input({ right: true }), LEVEL_SET);

    expect(next.player.row).toBeGreaterThan(8);
  });

  it("climbs a ladder and steps off at the top", () => {
    const state = { ...start(), player: { row: 8, col: 10, jumpTicks: 0 } };

    const climbed = run(state, 4, input({ up: true }));

    expect(climbed.player).toMatchObject({ row: 4, col: 10 });
    // Standing on the upper floor now, so it can walk away from the ladder.
    const walked = step(climbed, input({ right: true }), LEVEL_SET);
    expect(walked.player).toMatchObject({ row: 4, col: 11 });
  });

  it("does not climb where there is no ladder", () => {
    const next = run(start(), 3, input({ up: true }));

    expect(next.player.row).toBe(8);
  });

  it("jumps up and comes back down", () => {
    const risen = run(start(), 2, input({ jump: true }));
    expect(risen.player.row).toBe(6);

    const landed = run(risen, 4, input());
    expect(landed.player.row).toBe(8);
  });

  it("refuses to jump off a ladder", () => {
    const state = { ...start(), player: { row: 7, col: 10, jumpTicks: 0 } };

    const next = step(state, input({ jump: true }), LEVEL_SET);

    expect(next.player.row).toBe(7);
  });
});

describe("ladder engine — treasure, goal and death", () => {
  it("collects treasure and clears it from the grid", () => {
    const next = run(start(), 2, input({ right: true }));

    expect(next.score).toBe(100);
    expect(next.grid[8][3]).toBe(" ");
  });

  it("banks the remaining bonus when it reaches the goal", () => {
    // Two levels, so finishing the first one is a clear rather than a win.
    const two = [testLevel, { ...testLevel, name: "Second" }];
    const state = {
      ...start(two),
      player: { row: 4, col: 14, jumpTicks: 0 },
    };

    const next = step(state, input({ right: true }), two);

    expect(next.status).toBe("levelCleared");
    expect(next.score).toBe(START_BONUS);
  });

  it("reports victory on the last level", () => {
    const state = { ...start(), player: { row: 4, col: 14, jumpTicks: 0 } };

    expect(step(state, input({ right: true }), LEVEL_SET).status).toBe("victory");
  });

  it("loses a lad when a rock catches the player", () => {
    const state: LadderState = {
      ...start(),
      rocks: [{ id: 1, row: 8, col: 2, dir: -1, falling: false }],
    };

    const next = step(state, input({ right: true }), LEVEL_SET);

    expect(next.lives).toBe(START_LIVES - 1);
    expect(next.status).toBe("dead");
  });

  it("ends the game when the last lad is gone", () => {
    const state: LadderState = {
      ...start(),
      lives: 1,
      rocks: [{ id: 1, row: 8, col: 2, dir: -1, falling: false }],
    };

    expect(step(state, input({ right: true }), LEVEL_SET).status).toBe("gameOver");
  });

  it("kills the player when the bonus runs out", () => {
    const state = { ...start(), bonus: 4 };

    const next = step(state, input(), LEVEL_SET);

    expect(next.bonus).toBe(0);
    expect(next.lives).toBe(START_LIVES - 1);
  });

  it("ignores input once the level is over", () => {
    const finished: LadderState = { ...start(), status: "gameOver" };

    expect(step(finished, input({ right: true }), LEVEL_SET)).toBe(finished);
  });
});

describe("ladder engine — rocks", () => {
  it("rolls along a floor in its direction", () => {
    const state: LadderState = {
      ...start(),
      rocks: [{ id: 1, row: 4, col: 18, dir: -1, falling: false }],
    };

    expect(step(state, input(), LEVEL_SET).rocks[0]).toMatchObject({
      row: 4,
      col: 17,
    });
  });

  it("falls where the floor stops", () => {
    const state: LadderState = {
      ...start(),
      // Column 21 is past the end of the upper floor.
      rocks: [{ id: 1, row: 4, col: 21, dir: 1, falling: false }],
    };

    expect(step(state, input(), LEVEL_SET).rocks[0]).toMatchObject({
      row: 5,
      falling: true,
    });
  });

  it("turns around when it lands, which is what makes rocks zigzag", () => {
    const state: LadderState = {
      ...start(),
      rocks: [{ id: 1, row: 7, col: 5, dir: 1, falling: true }],
    };

    const landed = step(state, input(), LEVEL_SET).rocks[0];

    expect(landed).toMatchObject({ row: 8, dir: -1, falling: false });
  });

  it("drops rocks off the bottom of the screen", () => {
    const state: LadderState = {
      ...start(),
      rocks: [{ id: 1, row: GRID_HEIGHT - 1, col: 30, dir: 1, falling: true }],
    };

    expect(step(state, input(), LEVEL_SET).rocks).toHaveLength(0);
  });

  it("releases rocks on the level's interval", () => {
    const fast = [{ ...testLevel, rockInterval: 3 }];
    const state = { ...start(fast) };

    expect(run(state, 2, input(), fast).rocks).toHaveLength(0);
    expect(run(state, 3, input(), fast).rocks).toHaveLength(1);
  });
});

describe("ladder engine — level flow", () => {
  it("keeps score and lives when retrying after a death", () => {
    const state: LadderState = { ...start(), score: 700, lives: 3, tick: 40 };

    const retried = retryLevel(state, LEVEL_SET);

    expect(retried).toMatchObject({ score: 700, lives: 3, levelIndex: 0 });
    expect(retried.bonus).toBe(START_BONUS);
    expect(retried.player).toMatchObject(testLevel.start);
    expect(retried.rocks).toEqual([]);
  });

  it("carries score forward to the next level", () => {
    const two = [testLevel, { ...testLevel, name: "Second" }];
    const state: LadderState = { ...start(two), score: 1200, lives: 2 };

    const next = advanceLevel(state, two);

    expect(next).toMatchObject({ levelIndex: 1, score: 1200, lives: 2 });
  });

  it("starts a fresh game with full lives and no score", () => {
    expect(createGame(LEVELS)).toMatchObject({
      levelIndex: 0,
      score: 0,
      lives: START_LIVES,
      status: "ready",
    });
  });
});

/**
 * These guard the hand-authored level geometry. A ladder that misses a floor,
 * or a goal hanging in mid-air, is otherwise only discoverable by playing.
 */
describe("ladder levels — geometry", () => {
  const covers = (level: LevelSpec, row: number, col: number): boolean =>
    level.floors.some((f) => f.row === row && col >= f.from && col <= f.to);

  it.each(LEVELS.map((level) => [level.name, level] as const))(
    "%s: every ladder joins two floors",
    (_name, level) => {
      for (const ladder of level.ladders) {
        expect(covers(level, ladder.top, ladder.col)).toBe(true);
        expect(covers(level, ladder.bottom + 1, ladder.col)).toBe(true);
      }
    },
  );

  it.each(LEVELS.map((level) => [level.name, level] as const))(
    "%s: start, goal, treasures and spawns all stand on something",
    (_name, level) => {
      const grid = buildGrid(level);
      for (const spot of [
        level.start,
        level.goal,
        ...level.treasures,
        ...level.spawns,
      ]) {
        expect(isSupported(grid, spot.row, spot.col)).toBe(true);
      }
    },
  );

  it.each(LEVELS.map((level) => [level.name, level] as const))(
    "%s: no treasure or goal covers up a ladder rung",
    (_name, level) => {
      for (const item of [...level.treasures, level.goal]) {
        const onLadder = level.ladders.some(
          (l) => l.col === item.col && item.row >= l.top && item.row <= l.bottom,
        );
        expect(onLadder).toBe(false);
      }
    },
  );

  it("gives every level a distinct name", () => {
    expect(new Set(LEVELS.map((l) => l.name)).size).toBe(LEVELS.length);
  });
});
