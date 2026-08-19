import { describe, expect, it } from "vitest";
import {
  advanceWave,
  bombers,
  BOMB_H,
  BOMB_W,
  BULLET_H,
  createGame,
  createShields,
  createWave,
  FIELD_WIDTH,
  fleetBottom,
  INVADER_COLS,
  INVADER_H,
  INVADER_ROWS,
  invaderRect,
  maxBombs,
  NO_INPUT,
  PLAYER_MARGIN,
  PLAYER_SPEED,
  PLAYER_W,
  PLAYER_Y,
  respawn,
  ROW_POINTS,
  SHIELD_COUNT,
  START_LIVES,
  step,
  stepInterval,
  TOTAL_INVADERS,
  type Input,
  type InvadersState,
} from "@easter-egg/games/invaders/engine";

const input = (overrides: Partial<Input> = {}): Input => ({
  ...NO_INPUT,
  ...overrides,
});

const playing = (overrides: Partial<InvadersState> = {}): InvadersState => ({
  ...createGame(1234),
  status: "playing",
  ...overrides,
});

const run = (
  state: InvadersState,
  ticks: number,
  keys: Input = NO_INPUT,
): InvadersState => {
  let next = state;
  for (let i = 0; i < ticks; i++) next = step(next, keys);
  return next;
};

const aliveCount = (state: InvadersState): number =>
  state.alive.filter(Boolean).length;

describe("invaders setup", () => {
  it("deals a full fleet, three lives and four bunkers", () => {
    const game = createGame();

    expect(game.status).toBe("ready");
    expect(aliveCount(game)).toBe(TOTAL_INVADERS);
    expect(game.lives).toBe(START_LIVES);
    expect(game.shields).toHaveLength(SHIELD_COUNT);
    expect(game.score).toBe(0);
    expect(game.wave).toBe(1);
  });

  it("gives every bunker the same arch, with the corners and notch open", () => {
    const [shield] = createShields();

    // The mask's four holes: two top corners, two under the arch.
    expect(shield.cells.filter((cell) => !cell)).toHaveLength(4);
    expect(shield.cells[0]).toBe(false);
    expect(shield.cells[5]).toBe(false);
  });

  it("keeps the bunkers inside the field and apart from each other", () => {
    const shields = createShields();
    const width = 6 * 5;

    expect(shields[0].x).toBeGreaterThan(0);
    expect(shields[SHIELD_COUNT - 1].x + width).toBeLessThan(FIELD_WIDTH);
    for (let i = 1; i < shields.length; i++) {
      expect(shields[i].x).toBeGreaterThan(shields[i - 1].x + width);
    }
  });

  it("starts each wave lower than the last", () => {
    expect(createWave(3, 0, 3, 1).fleetY).toBeGreaterThan(createWave(1, 0, 3, 1).fleetY);
  });
});

describe("the clock", () => {
  it("does nothing until the game is playing", () => {
    const ready = createGame();
    expect(step(ready, input({ left: true, fire: true }))).toBe(ready);
  });

  it("marches faster as the fleet thins out", () => {
    expect(stepInterval(TOTAL_INVADERS, 1)).toBeGreaterThan(stepInterval(10, 1));
    expect(stepInterval(1, 1)).toBeGreaterThanOrEqual(2);
    // Later waves are quicker at the same strength.
    expect(stepInterval(TOTAL_INVADERS, 3)).toBeLessThan(stepInterval(TOTAL_INVADERS, 1));
  });

  it("throws more bombs at once in later waves, up to a ceiling", () => {
    expect(maxBombs(1)).toBeLessThan(maxBombs(3));
    expect(maxBombs(99)).toBe(maxBombs(100));
  });
});

describe("the cannon", () => {
  it("moves with the keys and stops at both walls", () => {
    const start = playing();

    const right = step(start, input({ right: true }));
    expect(right.playerX).toBeCloseTo(start.playerX + PLAYER_SPEED);

    const parked = run(start, 200, input({ right: true }));
    expect(parked.playerX).toBe(FIELD_WIDTH - PLAYER_MARGIN - PLAYER_W);

    expect(run(start, 200, input({ left: true })).playerX).toBe(PLAYER_MARGIN);
  });

  it("stands still when both directions are held", () => {
    const start = playing();
    expect(step(start, input({ left: true, right: true })).playerX).toBe(start.playerX);
  });

  it("keeps one shot in the air at a time", () => {
    const first = step(playing(), input({ fire: true }));
    expect(first.bullet).not.toBeNull();

    const held = step(first, input({ fire: true }));
    expect(held.bullet?.id).toBe(first.bullet?.id);
  });

  it("fires again once the shot has left the screen", () => {
    const fired = step(playing(), input({ fire: true }));
    const empty = run(fired, 40);
    expect(empty.bullet).toBeNull();

    expect(step(empty, input({ fire: true })).bullet).not.toBeNull();
  });
});

describe("shooting the fleet", () => {
  /** A shot parked just inside the given invader, about to be resolved. */
  const aimedAt = (index: number, state = playing()): InvadersState => {
    const target = invaderRect(index, state.fleetX, state.fleetY);
    return {
      ...state,
      bullet: { id: 999, x: target.x + 6, y: target.y + INVADER_H - 1 },
    };
  };

  it("kills the invader it hits and takes the shot with it", () => {
    const after = step(aimedAt(0), NO_INPUT);

    expect(after.alive[0]).toBe(false);
    expect(aliveCount(after)).toBe(TOTAL_INVADERS - 1);
    expect(after.bullet).toBeNull();
    expect(after.explosions.length).toBe(1);
  });

  it("pays the top row more than the bottom", () => {
    const top = step(aimedAt(0), NO_INPUT).score;
    const bottom = step(aimedAt(TOTAL_INVADERS - 1), NO_INPUT).score;

    expect(top).toBe(ROW_POINTS[0]);
    expect(bottom).toBe(ROW_POINTS[INVADER_ROWS - 1]);
    expect(top).toBeGreaterThan(bottom);
  });

  it("clears the wave when the last invader dies", () => {
    const nearlyDone = playing({
      alive: createGame().alive.map((_, index) => index === 4),
    });
    const after = step(aimedAt(4, nearlyDone), NO_INPUT);

    expect(after.status).toBe("waveCleared");
    expect(after.bombs).toHaveLength(0);
  });

  it("starts the next wave with a fresh fleet and the score kept", () => {
    const cleared = playing({ score: 420, alive: Array(TOTAL_INVADERS).fill(false) });
    const next = advanceWave({ ...cleared, status: "waveCleared" });

    expect(next.wave).toBe(2);
    expect(next.score).toBe(420);
    expect(next.lives).toBe(cleared.lives);
    expect(aliveCount(next)).toBe(TOTAL_INVADERS);
    expect(next.status).toBe("playing");
  });
});

describe("the march", () => {
  it("steps sideways, then drops and turns at the wall", () => {
    const start = playing();
    const marched = run(start, start.stepTimer);

    expect(marched.fleetX).toBeGreaterThan(start.fleetX);
    expect(marched.fleetY).toBe(start.fleetY);
    // The two-pose animation flips on every march.
    expect(marched.fleetFrame).not.toBe(start.fleetFrame);

    const atWall = run(start, 400);
    expect(atWall.fleetY).toBeGreaterThan(start.fleetY);
  });

  it("measures the wall against the columns still alive", () => {
    // Only the leftmost column survives, so the fleet may march much further
    // right before it has to turn.
    const thin = playing({
      alive: createGame().alive.map((_, index) => index % INVADER_COLS === 0),
    });
    const wide = playing();

    expect(run(thin, 120).fleetX).toBeGreaterThan(run(wide, 120).fleetX);
  });

  it("ends the game outright when the fleet reaches the cannon", () => {
    const landing = playing({ fleetY: PLAYER_Y - 4, lives: 3 });
    const after = step(landing, NO_INPUT);

    expect(fleetBottom(landing)).toBeGreaterThanOrEqual(PLAYER_Y);
    expect(after.status).toBe("gameOver");
  });
});

describe("bombs", () => {
  it("only ever drops from the lowest invader in a column", () => {
    const state = createGame();
    expect(bombers(state.alive)).toHaveLength(INVADER_COLS);
    expect(bombers(state.alive).every((index) => index >= TOTAL_INVADERS - INVADER_COLS)).toBe(true);

    const gaps = state.alive.map(
      (_, index) => Math.floor(index / INVADER_COLS) < INVADER_ROWS - 2,
    );
    // With the bottom two rows gone, the third row does the bombing.
    expect(bombers(gaps).every((index) => Math.floor(index / INVADER_COLS) === INVADER_ROWS - 3)).toBe(true);
  });

  it("has none left to drop once the fleet is dead", () => {
    expect(bombers(Array(TOTAL_INVADERS).fill(false))).toHaveLength(0);
  });

  it("rains down over time, without exceeding the wave's limit", () => {
    let state = playing();
    let seen = 0;
    for (let i = 0; i < 1500; i++) {
      state = step(state, NO_INPUT);
      if (state.status !== "playing") break;
      seen = Math.max(seen, state.bombs.length);
      expect(state.bombs.length).toBeLessThanOrEqual(maxBombs(state.wave));
    }
    expect(seen).toBeGreaterThan(0);
  });

  it("costs a life on a hit, and the game when the lives run out", () => {
    const hit = (lives: number): InvadersState =>
      step(
        playing({
          lives,
          bombs: [{ id: 7, x: playing().playerX + PLAYER_W / 2, y: PLAYER_Y - 1 }],
        }),
        NO_INPUT,
      );

    const wounded = hit(3);
    expect(wounded.lives).toBe(2);
    expect(wounded.status).toBe("dead");
    expect(wounded.bombs).toHaveLength(0);

    const done = hit(1);
    expect(done.lives).toBe(0);
    expect(done.status).toBe("gameOver");
  });

  it("puts the cannon back in the middle after a death", () => {
    const back = respawn(playing({ playerX: 10, status: "dead", bombs: [{ id: 1, x: 0, y: 0 }] }));

    expect(back.status).toBe("playing");
    expect(back.playerX).toBe((FIELD_WIDTH - PLAYER_W) / 2);
    expect(back.bombs).toHaveLength(0);
  });
});

describe("the bunkers", () => {
  /** A rect sitting on the first solid block of the first bunker. */
  const onFirstBlock = (state: InvadersState) => {
    const shield = state.shields[0];
    const index = shield.cells.findIndex(Boolean);
    return {
      x: shield.x + (index % 6) * 5 + 1,
      y: shield.y + Math.floor(index / 6) * 5 + 1,
    };
  };

  it("stops a bomb and loses a block", () => {
    const start = playing();
    const spot = onFirstBlock(start);
    const after = step(
      { ...start, bombs: [{ id: 3, x: spot.x, y: spot.y - BOMB_H }] },
      NO_INPUT,
    );

    expect(after.bombs).toHaveLength(0);
    expect(after.shields[0].cells.filter(Boolean).length).toBeLessThan(
      start.shields[0].cells.filter(Boolean).length,
    );
  });

  it("stops the player's shot too", () => {
    const start = playing();
    const spot = onFirstBlock(start);
    const after = step(
      { ...start, bullet: { id: 4, x: spot.x, y: spot.y + BOMB_W } },
      NO_INPUT,
    );

    expect(after.bullet).toBeNull();
    expect(after.shields[0].cells.filter(Boolean).length).toBeLessThan(
      start.shields[0].cells.filter(Boolean).length,
    );
  });

  it("leaves untouched bunkers identical, so they need no repaint", () => {
    const start = playing();
    const spot = onFirstBlock(start);
    const after = step(
      { ...start, bombs: [{ id: 3, x: spot.x, y: spot.y - BOMB_H }] },
      NO_INPUT,
    );

    expect(after.shields[0]).not.toBe(start.shields[0]);
    expect(after.shields[1]).toBe(start.shields[1]);
  });

  it("is ground away by the fleet marching over it", () => {
    const start = playing({ fleetY: start_fleet_y() });
    const after = step(start, NO_INPUT);
    const before = start.shields.reduce(
      (total, shield) => total + shield.cells.filter(Boolean).length,
      0,
    );
    const left = after.shields.reduce(
      (total, shield) => total + shield.cells.filter(Boolean).length,
      0,
    );
    expect(left).toBeLessThan(before);
  });
});

/** Deep enough that the bottom row overlaps the bunkers. */
function start_fleet_y(): number {
  return 132 - (INVADER_ROWS - 1) * 12 + 4;
}

describe("a shot meeting a bomb", () => {
  it("cancels both", () => {
    const start = playing();
    const x = start.playerX + PLAYER_W / 2;
    const after = step(
      {
        ...start,
        // Below the fleet and above the bunkers, so nothing else can claim
        // either of them first.
        bullet: { id: 5, x, y: 100 },
        bombs: [{ id: 6, x, y: 100 - BOMB_H + 1 }],
      },
      NO_INPUT,
    );

    expect(after.bullet).toBeNull();
    expect(after.bombs).toHaveLength(0);
  });
});

describe("the mystery saucer", () => {
  it("flies in, and is worth points when shot", () => {
    let state = playing({ saucerTimer: 1 });
    state = step(state, NO_INPUT);
    expect(state.saucer).not.toBeNull();

    const saucer = state.saucer!;
    const hit = step(
      { ...state, bullet: { id: 8, x: saucer.x + 8, y: 5 + BULLET_H } },
      NO_INPUT,
    );

    expect(hit.saucer).toBeNull();
    expect(hit.score).toBe(100);
  });

  it("leaves the screen on its own", () => {
    const flying = run(playing({ saucerTimer: 1 }), 400);
    expect(flying.saucer).toBeNull();
  });
});

describe("determinism", () => {
  it("replays identically from the same seed", () => {
    const keys = input({ right: true, fire: true });
    const a = run(playing(), 600, keys);
    const b = run(playing(), 600, keys);

    expect(a.score).toBe(b.score);
    expect(a.bombs).toEqual(b.bombs);
    expect(a.playerX).toBe(b.playerX);
    expect(a.rng).toBe(b.rng);
  });

  it("diverges when the seed does", () => {
    const keys = input({ fire: true });
    const a = run({ ...createGame(1), status: "playing" }, 800, keys);
    const b = run({ ...createGame(99), status: "playing" }, 800, keys);

    expect(a.rng).not.toBe(b.rng);
  });
});
