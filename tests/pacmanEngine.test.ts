import { describe, expect, it } from "vitest";
import {
  advanceLevel,
  createGame,
  frightTicks,
  GHOST_POINTS,
  modeAt,
  PELLET_POINTS,
  POWER_POINTS,
  resetRound,
  START_LIVES,
  step,
  type Dir,
  type Ghost,
  type PacmanState,
} from "@easter-egg/games/pacman/engine";
import {
  COLS,
  HOUSE_CENTER,
  initialPellets,
  isHouse,
  isWall,
  key,
  MAZE,
  PLAYER_START,
  ROWS,
  tileAt,
} from "@easter-egg/games/pacman/maze";

const playing = (): PacmanState => ({ ...createGame(), status: "playing" });

/** Run `count` ticks, steering only on the first one. */
const run = (state: PacmanState, count: number, turn: Dir | null = null): PacmanState => {
  let next = step(state, turn);
  for (let i = 1; i < count; i++) next = step(next, null);
  return next;
};

const ghost = (state: PacmanState, name: Ghost["name"]): Ghost =>
  state.ghosts.find((g) => g.name === name)!;

const withGhosts = (state: PacmanState, ghosts: Partial<Ghost>[]): PacmanState => ({
  ...state,
  ghosts: state.ghosts.map((g, i) => ({ ...g, ...(ghosts[i] ?? {}) })),
});

/** Park every ghost in the pen and keep it there, for tests about Pac-Man alone. */
const alone = (state: PacmanState): PacmanState => ({
  ...state,
  ghosts: state.ghosts.map((g) => ({
    ...g,
    row: HOUSE_CENTER.row,
    col: HOUSE_CENTER.col,
    releaseAt: Number.MAX_SAFE_INTEGER,
  })),
});

describe("the maze", () => {
  it("is rectangular", () => {
    expect(MAZE.every((row) => row.length === COLS)).toBe(true);
    expect(ROWS).toBeGreaterThan(0);
  });

  it("is symmetric left to right", () => {
    for (const row of MAZE) {
      expect([...row].reverse().join("")).toBe(row);
    }
  });

  it("is walled in except for the tunnel row", () => {
    const openRows = MAZE.filter((row) => row[0] !== "#").length;
    expect(openRows).toBe(1);
    expect(MAZE[0]).toMatch(/^#+$/);
    expect(MAZE[ROWS - 1]).toMatch(/^#+$/);
    // Both ends of the tunnel line up, or walking through it would hit a wall.
    const tunnel = MAZE.findIndex((row) => row[0] !== "#");
    expect(isWall(tunnel, COLS - 1)).toBe(false);
  });

  it("has four power pellets and no unreachable food", () => {
    const { pellets, powers } = initialPellets();
    expect(powers.size).toBe(4);
    expect(pellets.size).toBeGreaterThan(100);

    // Flood fill from Pac-Man's start, on the tiles he is allowed to use.
    const seen = new Set([key(PLAYER_START.row, PLAYER_START.col)]);
    const queue = [PLAYER_START];
    while (queue.length > 0) {
      const { row, col } = queue.pop()!;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const next = { row: row + dr, col: (col + dc + COLS) % COLS };
        if (next.row < 0 || next.row >= ROWS) continue;
        if (isWall(next.row, next.col) || isHouse(next.row, next.col)) continue;
        if (tileAt(next.row, next.col) === "-") continue;
        const id = key(next.row, next.col);
        if (seen.has(id)) continue;
        seen.add(id);
        queue.push(next);
      }
    }
    for (const food of [...pellets, ...powers]) expect(seen.has(food)).toBe(true);
  });
});

describe("Pac-Man", () => {
  it("starts ready, and a ready game ignores ticks", () => {
    const fresh = createGame();
    expect(fresh.status).toBe("ready");
    expect(step(fresh, "left")).toBe(fresh);
    expect(fresh.lives).toBe(START_LIVES);
  });

  it("walks in the direction it is given", () => {
    const state = step(alone(playing()), "left");
    expect(state.player.col).toBe(PLAYER_START.col - 1);
    expect(state.player.row).toBe(PLAYER_START.row);
  });

  it("keeps going rather than walking into a wall", () => {
    // Below the start is wall: the turn is banked, and he carries straight on.
    const state = step(alone(playing()), "down");
    expect(state.player.dir).toBe("left");
    expect(state.player.col).toBe(PLAYER_START.col - 1);
    expect(state.player.next).toBe("down");
  });

  it("holds a turn until the corner arrives", () => {
    let state = alone(playing());
    state = step(state, "left");
    // Ask for down while the corridor still has walls below; it is banked.
    state = step(state, "down");
    expect(state.player.next).toBe("down");
    expect(state.player.dir).toBe("left");

    let turned = state;
    for (let i = 0; i < 8 && turned.player.next !== null; i++) {
      turned = step(turned, null);
    }
    expect(turned.player.next).toBe(null);
    expect(turned.player.dir).toBe("down");
    expect(turned.player.row).toBeGreaterThan(PLAYER_START.row);
  });

  it("wraps through the tunnel", () => {
    const tunnel = MAZE.findIndex((row) => row[0] !== "#");
    const state: PacmanState = {
      ...alone(playing()),
      player: { row: tunnel, col: 0, dir: "left", next: null },
    };
    expect(step(state, "left").player.col).toBe(COLS - 1);
  });

  it("scores pellets and counts them toward the fruit", () => {
    const before = alone(playing());
    const after = step(before, "left");
    expect(after.score).toBe(PELLET_POINTS);
    expect(after.pelletsEaten).toBe(1);
    expect(after.pellets.size).toBe(before.pellets.size - 1);
    // The maze the previous state saw is untouched.
    expect(before.pellets.size).toBeGreaterThan(after.pellets.size);
  });

  it("clears the level once the last pellet is gone", () => {
    const state: PacmanState = {
      ...alone(playing()),
      pellets: new Set([key(PLAYER_START.row, PLAYER_START.col - 1)]),
      powers: new Set(),
    };
    const cleared = step(state, "left");
    expect(cleared.status).toBe("levelCleared");
    expect(cleared.score).toBe(PELLET_POINTS);
  });

  it("keeps score and lives across a level, and starts a new maze", () => {
    const cleared: PacmanState = { ...playing(), score: 1234, pellets: new Set() };
    const next = advanceLevel(cleared);
    expect(next.level).toBe(2);
    expect(next.score).toBe(1234);
    expect(next.pellets.size).toBeGreaterThan(100);
    expect(next.player).toMatchObject(PLAYER_START);
  });
});

describe("power pellets", () => {
  /** Put Pac-Man one step short of a power pellet, ghosts out of the way. */
  const nearPower = (): PacmanState => {
    const { powers } = initialPellets();
    const first = [...powers][0];
    const row = Math.floor(first / COLS);
    const col = first % COLS;
    return {
      ...alone(playing()),
      player: { row, col: col + 1, dir: "left", next: null },
    };
  };

  it("frighten the pack and turn it around", () => {
    const before = nearPower();
    const dirs = before.ghosts.map((g) => g.dir);
    const after = step(before, "left");

    expect(after.score).toBe(POWER_POINTS);
    expect(after.fright).toBeGreaterThan(0);
    expect(after.ghosts.every((g) => g.frightened)).toBe(true);
    expect(after.ghosts.map((g) => g.dir)).not.toEqual(dirs);
  });

  it("wear off, and the fright gets shorter each level", () => {
    let state = step(nearPower(), "left");
    const duration = state.fright;
    for (let i = 0; i < duration + 2; i++) state = step(state, null);
    expect(state.fright).toBe(0);
    expect(state.ghosts.some((g) => g.frightened)).toBe(false);
    expect(frightTicks(5)).toBeLessThan(frightTicks(1));
  });

  it("pay 200, 400, 800, 1600 for the four ghosts", () => {
    // Row 13 is one long corridor, so four ghosts can be lined up on it and
    // walked into one after the other, all within a single fright.
    let state: PacmanState = {
      ...playing(),
      fright: 200,
      ghosts: playing().ghosts.map((g) => ({ ...g, frightened: true })),
    };

    const scores: number[] = [];
    for (let i = 0; i < 4; i++) {
      const victim = state.ghosts[i];
      const tile = { row: state.player.row, col: state.player.col - 1 };
      state = {
        ...state,
        ghosts: state.ghosts.map((g) =>
          g.name === victim.name ? { ...g, ...tile, dir: "right" as Dir } : g,
        ),
      };
      const before = state.score;
      state = step(state, "left");
      scores.push(state.score - before - PELLET_POINTS);
    }

    expect(scores).toEqual([
      GHOST_POINTS,
      GHOST_POINTS * 2,
      GHOST_POINTS * 4,
      GHOST_POINTS * 8,
    ]);
    expect(state.ghosts.every((g) => g.eaten)).toBe(true);
    expect(state.status).toBe("playing");
  });

  it("send eaten ghosts home as eyes, where they come back to life", () => {
    let state = withGhosts(playing(), [
      { row: 4, col: 10, eaten: true, dir: "down", frightened: false },
    ]);
    for (let i = 0; i < 40 && ghost(state, "blinky").eaten; i++) {
      state = step(state, null);
    }
    expect(ghost(state, "blinky").eaten).toBe(false);
  });
});

describe("the ghosts", () => {
  it("leave the pen when their turn comes", () => {
    const state = run(playing(), 40);
    const pinky = ghost(state, "pinky");
    expect(isHouse(pinky.row, pinky.col)).toBe(false);

    // Clyde is still waiting his turn at that point.
    const clyde = ghost(state, "clyde");
    expect(isHouse(clyde.row, clyde.col)).toBe(true);
  });

  it("never reverse mid-corridor of their own accord", () => {
    let state = run(playing(), 30);
    for (let i = 0; i < 60; i++) {
      const before = state.ghosts.map((g) => ({ ...g }));
      state = step(state, null);
      state.ghosts.forEach((after, index) => {
        const prior = before[index];
        // A reversal is only legal at a dead end or on a mode switch, and the
        // schedule holds steady across this stretch.
        if (after.dir !== prior.dir && !after.eaten) {
          const reversed =
            after.dir === "up" ? prior.dir === "down"
            : after.dir === "down" ? prior.dir === "up"
            : after.dir === "left" ? prior.dir === "right"
            : prior.dir === "left";
          if (reversed) expect(isHouse(prior.row, prior.col)).toBe(false);
        }
      });
    }
    expect(state.status).not.toBe("gameOver");
  });

  it("hunt Pac-Man once the mode turns to chase", () => {
    expect(modeAt(0)).toBe("scatter");
    expect(modeAt(60)).toBe("chase");
    expect(modeAt(200)).toBe("scatter");
    // The schedule runs out and the ghosts hunt from then on.
    expect(modeAt(10_000)).toBe("chase");

    // Blinky's target is Pac-Man himself, so chasing closes the gap.
    let state: PacmanState = { ...playing(), modeTick: 100 };
    state = withGhosts(state, [{ row: 4, col: 4, dir: "right" }]);
    const start = { ...ghost(state, "blinky") };
    const startGap = Math.abs(start.row - state.player.row) + Math.abs(start.col - state.player.col);
    for (let i = 0; i < 12; i++) state = step(state, null);
    const now = ghost(state, "blinky");
    const gap = Math.abs(now.row - state.player.row) + Math.abs(now.col - state.player.col);
    expect(gap).toBeLessThan(startGap);
  });

  it("stay on legal tiles for a long run", () => {
    let state = playing();
    const turns: Dir[] = ["left", "up", "right", "down"];
    for (let i = 0; i < 400; i++) {
      state = step(state, turns[i % turns.length]);
      if (state.status === "dead") state = resetRound(state);
      if (state.status === "gameOver" || state.status === "levelCleared") break;
      expect(isWall(state.player.row, state.player.col)).toBe(false);
      for (const g of state.ghosts) expect(isWall(g.row, g.col)).toBe(false);
    }
  });

  it("cost a life on contact, and the last life ends the game", () => {
    const collide = (lives: number): PacmanState => {
      const state = withGhosts({ ...playing(), lives }, [
        { row: PLAYER_START.row, col: PLAYER_START.col - 1, dir: "right" },
      ]);
      return step(state, "left");
    };
    expect(collide(3).status).toBe("dead");
    expect(collide(3).lives).toBe(2);
    expect(collide(1).status).toBe("gameOver");
    expect(collide(1).lives).toBe(0);
  });

  it("catch Pac-Man even when the two swap tiles", () => {
    const state = withGhosts(playing(), [
      { row: PLAYER_START.row, col: PLAYER_START.col - 1, dir: "right" },
    ]);
    // Blinky walks right as Pac-Man walks left: on a tile grid they would
    // otherwise pass straight through one another.
    expect(step(state, "left").status).toBe("dead");
  });

  it("are harmless as eyes", () => {
    const state = withGhosts(playing(), [
      { row: PLAYER_START.row, col: PLAYER_START.col - 1, dir: "right", eaten: true },
    ]);
    expect(step(state, "left").status).toBe("playing");
  });
});

describe("a lost round", () => {
  it("puts everyone back but keeps the maze as it was", () => {
    let state = run(playing(), 60);
    const eaten = state.pellets.size;
    const dead: PacmanState = { ...state, status: "dead", lives: 2 };
    const next = resetRound(dead);

    expect(next.player).toMatchObject(PLAYER_START);
    expect(next.status).toBe("playing");
    expect(next.pellets.size).toBe(eaten);
    expect(next.lives).toBe(2);
    expect(next.tick).toBe(0);
    expect(next.ghosts.filter((g) => isHouse(g.row, g.col)).length).toBe(3);
  });
});
