/**
 * Space Invaders — the 1978 arcade shape, rebuilt as a pure tick function.
 *
 * Same split as the other two games in this folder: the rules live here as
 * functions over plain data and can be tested without rendering anything, while
 * the component owns the clock, the keyboard and the pixels.
 *
 * Two decisions are worth knowing before editing:
 *
 * - **The fleet marches, it does not glide.** Invaders hold still between steps
 *   and jump `STEP_X` at once, which is what makes the march read as a march.
 *   So, unlike Ladder, nothing here is interpolated between ticks — the tick
 *   rate is high enough that the shots and the cannon move smoothly on their
 *   own, and interpolating the fleet would destroy the effect on purpose.
 * - **Randomness is part of the state.** Bombs choose a column at random, so the
 *   seed is carried in `InvadersState` and advanced by `step`. `step` stays a
 *   pure function of (state, input): the same state and the same keys always
 *   produce the same next state, which is what makes the bombing testable.
 */

/** The play field, in abstract units. The component scales it to the screen. */
export const FIELD_WIDTH = 240;
export const FIELD_HEIGHT = 180;

export const INVADER_COLS = 11;
export const INVADER_ROWS = 5;
export const TOTAL_INVADERS = INVADER_COLS * INVADER_ROWS;

export const INVADER_W = 12;
export const INVADER_H = 8;
export const SPACING_X = 16;
export const SPACING_Y = 12;

/** Fleet width is fixed, so the block starts centred. */
export const FLEET_START_X =
  (FIELD_WIDTH - ((INVADER_COLS - 1) * SPACING_X + INVADER_W)) / 2;
export const FLEET_START_Y = 14;
/** Each wave starts lower, up to a floor — the pressure the original applies. */
export const FLEET_WAVE_DROP = 6;
export const FLEET_MAX_WAVE_DROPS = 5;

export const STEP_X = 3;
export const STEP_Y = 6;
/** Ticks between marches: slowest with a full fleet, fastest with one left. */
export const STEP_TICKS_MAX = 22;
export const STEP_TICKS_MIN = 2;
/** How close to the wall the fleet may march before it drops and turns. */
export const FLEET_MARGIN = 4;

export const PLAYER_W = 13;
export const PLAYER_H = 8;
export const PLAYER_Y = FIELD_HEIGHT - 16;
export const PLAYER_SPEED = 2.2;
export const PLAYER_MARGIN = 6;

export const BULLET_W = 1;
export const BULLET_H = 5;
export const BULLET_SPEED = 5.5;

export const BOMB_W = 2;
export const BOMB_H = 6;
export const BOMB_SPEED = 2.2;
/** Concurrent bombs at wave 1; later waves add one each, up to a ceiling. */
export const BASE_MAX_BOMBS = 3;
export const MAX_BOMBS_EVER = 6;
export const BASE_BOMB_CHANCE = 0.012;
export const BOMB_CHANCE_PER_WAVE = 0.004;

export const SAUCER_W = 16;
export const SAUCER_H = 7;
export const SAUCER_Y = 5;
export const SAUCER_SPEED = 1.2;
/** Ticks between saucer runs — about twenty seconds at the component's rate. */
export const SAUCER_INTERVAL = 600;
export const SAUCER_POINTS = 100;

export const SHIELD_COUNT = 4;
export const SHIELD_COLS = 6;
export const SHIELD_ROWS = 4;
export const SHIELD_BLOCK = 5;
export const SHIELD_Y = 132;

export const START_LIVES = 3;
/** Top row is worth the most, as on the cabinet. */
export const ROW_POINTS = [30, 20, 20, 10, 10] as const;

export const EXPLOSION_TICKS = 6;

/**
 * The bunker outline: a solid block with the corners taken off and a notch
 * underneath, so shots that slip through the middle feel earned.
 */
const SHIELD_MASK = [
  ".XXXX.",
  "XXXXXX",
  "XXXXXX",
  "XX..XX",
] as const;

export type Direction = -1 | 1;

export type InvadersStatus =
  | "ready"
  | "playing"
  | "dead"
  | "waveCleared"
  | "gameOver";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Shot {
  id: number;
  x: number;
  y: number;
}

export interface Saucer {
  x: number;
  dir: Direction;
}

export interface Explosion {
  id: number;
  x: number;
  y: number;
  ticks: number;
}

export interface Shield {
  x: number;
  y: number;
  /** Row-major, `SHIELD_ROWS * SHIELD_COLS`. False is a hole. */
  cells: boolean[];
}

export interface InvadersState {
  wave: number;
  score: number;
  lives: number;
  status: InvadersStatus;
  tick: number;
  /** Left edge of the cannon. */
  playerX: number;
  /** Row-major, `TOTAL_INVADERS` long. Index 0 is the top-left invader. */
  alive: boolean[];
  fleetX: number;
  fleetY: number;
  fleetDir: Direction;
  /** Flips on every march — the two-pose animation the sprites are drawn for. */
  fleetFrame: 0 | 1;
  /** Ticks left until the next march. */
  stepTimer: number;
  /** One shot in flight at a time, as on the cabinet. */
  bullet: Shot | null;
  bombs: Shot[];
  shields: Shield[];
  saucer: Saucer | null;
  saucerTimer: number;
  explosions: Explosion[];
  rng: number;
  nextId: number;
}

export interface Input {
  left: boolean;
  right: boolean;
  fire: boolean;
}

export const NO_INPUT: Input = { left: false, right: false, fire: false };

/* ------------------------------------------------------------------ *
 * Geometry
 * ------------------------------------------------------------------ */

export const invaderRect = (
  index: number,
  fleetX: number,
  fleetY: number,
): Rect => ({
  x: fleetX + (index % INVADER_COLS) * SPACING_X,
  y: fleetY + Math.floor(index / INVADER_COLS) * SPACING_Y,
  w: INVADER_W,
  h: INVADER_H,
});

/** Which of the three species sits in a row — top, middle pair, bottom pair. */
export const speciesOfRow = (row: number): 0 | 1 | 2 =>
  row === 0 ? 0 : row <= 2 ? 1 : 2;

export const shieldBlockRect = (
  shield: Shield,
  index: number,
): Rect => ({
  x: shield.x + (index % SHIELD_COLS) * SHIELD_BLOCK,
  y: shield.y + Math.floor(index / SHIELD_COLS) * SHIELD_BLOCK,
  w: SHIELD_BLOCK,
  h: SHIELD_BLOCK,
});

/** The box a whole bunker occupies, holes included. */
export const shieldBounds = (shield: Shield): Rect => ({
  x: shield.x,
  y: shield.y,
  w: SHIELD_COLS * SHIELD_BLOCK,
  h: SHIELD_ROWS * SHIELD_BLOCK,
});

export const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/* ------------------------------------------------------------------ *
 * Randomness — a small LCG, so a seed replays exactly
 * ------------------------------------------------------------------ */

const advanceSeed = (seed: number): number =>
  (Math.imul(seed, 1664525) + 1013904223) >>> 0;

/** `[0, 1)` from a seed. */
const unit = (seed: number): number => seed / 0x1_0000_0000;

/* ------------------------------------------------------------------ *
 * Setup
 * ------------------------------------------------------------------ */

export function createShields(): Shield[] {
  const width = SHIELD_COLS * SHIELD_BLOCK;
  const gap = (FIELD_WIDTH - SHIELD_COUNT * width) / (SHIELD_COUNT + 1);
  const cells = SHIELD_MASK.join("")
    .split("")
    .map((cell) => cell === "X");

  return Array.from({ length: SHIELD_COUNT }, (_, i) => ({
    x: gap + i * (width + gap),
    y: SHIELD_Y,
    cells: [...cells],
  }));
}

/** Ticks between marches. Fewer invaders left means a faster fleet. */
export const stepInterval = (aliveCount: number, wave: number): number => {
  const ratio = aliveCount / TOTAL_INVADERS;
  const base = STEP_TICKS_MIN + (STEP_TICKS_MAX - STEP_TICKS_MIN) * ratio;
  return Math.max(STEP_TICKS_MIN, Math.round(base) - (wave - 1));
};

export const maxBombs = (wave: number): number =>
  Math.min(MAX_BOMBS_EVER, BASE_MAX_BOMBS + wave - 1);

export const bombChance = (wave: number): number =>
  BASE_BOMB_CHANCE + (wave - 1) * BOMB_CHANCE_PER_WAVE;

export function createWave(
  wave: number,
  score: number,
  lives: number,
  seed: number,
): InvadersState {
  const alive = Array<boolean>(TOTAL_INVADERS).fill(true);
  return {
    wave,
    score,
    lives,
    status: "ready",
    tick: 0,
    playerX: (FIELD_WIDTH - PLAYER_W) / 2,
    alive,
    fleetX: FLEET_START_X,
    fleetY:
      FLEET_START_Y +
      Math.min(wave - 1, FLEET_MAX_WAVE_DROPS) * FLEET_WAVE_DROP,
    fleetDir: 1,
    fleetFrame: 0,
    stepTimer: stepInterval(TOTAL_INVADERS, wave),
    bullet: null,
    bombs: [],
    shields: createShields(),
    saucer: null,
    saucerTimer: SAUCER_INTERVAL,
    explosions: [],
    rng: seed >>> 0,
    nextId: 1,
  };
}

export const createGame = (seed = 0x2f6e2b1): InvadersState =>
  createWave(1, 0, START_LIVES, seed);

/** Next wave: fresh fleet and bunkers, keeping score and lives. */
export const advanceWave = (state: InvadersState): InvadersState => ({
  ...createWave(state.wave + 1, state.score, state.lives, state.rng),
  status: "playing",
});

/** Back into the current wave after a death — the fleet stays where it is. */
export const respawn = (state: InvadersState): InvadersState => ({
  ...state,
  status: "playing",
  playerX: (FIELD_WIDTH - PLAYER_W) / 2,
  bullet: null,
  bombs: [],
  explosions: [],
});

/* ------------------------------------------------------------------ *
 * The tick
 * ------------------------------------------------------------------ */

const playerRect = (playerX: number): Rect => ({
  x: playerX,
  y: PLAYER_Y,
  w: PLAYER_W,
  h: PLAYER_H,
});

const bulletRect = (shot: Shot): Rect => ({
  x: shot.x,
  y: shot.y,
  w: BULLET_W,
  h: BULLET_H,
});

const bombRect = (shot: Shot): Rect => ({
  x: shot.x,
  y: shot.y,
  w: BOMB_W,
  h: BOMB_H,
});

const saucerRect = (saucer: Saucer): Rect => ({
  x: saucer.x,
  y: SAUCER_Y,
  w: SAUCER_W,
  h: SAUCER_H,
});

/** Index of the first block a rect hits, or -1. */
const blockHit = (shield: Shield, rect: Rect): number =>
  shield.cells.findIndex(
    (filled, index) => filled && overlaps(rect, shieldBlockRect(shield, index)),
  );

/**
 * Punch a hole wherever `rect` touches a bunker.
 *
 * Returns the same array when nothing was hit, so an untouched shield keeps its
 * identity and the memoised bunker component does not re-render.
 */
function damageShields(
  shields: Shield[],
  rect: Rect,
  /** Erasing (an invader walking through) clears every block it covers. */
  erase = false,
): { shields: Shield[]; hit: boolean } {
  let hit = false;
  const next = shields.map((shield) => {
    // Cheap reject first: three quarters of the bunkers are nowhere near any
    // given shot, and this runs for every bomb on every tick.
    if (!overlaps(rect, shieldBounds(shield))) return shield;

    if (erase) {
      let touched = false;
      const cells = shield.cells.map((filled, index) => {
        if (!filled || !overlaps(rect, shieldBlockRect(shield, index))) {
          return filled;
        }
        touched = true;
        return false;
      });
      if (!touched) return shield;
      hit = true;
      return { ...shield, cells };
    }

    const index = blockHit(shield, rect);
    if (index === -1) return shield;
    hit = true;
    const cells = [...shield.cells];
    cells[index] = false;
    return { ...shield, cells };
  });

  return { shields: hit ? next : shields, hit };
}

/** Lowest living invader in each column, as fleet indices. */
export function bombers(alive: boolean[]): number[] {
  const lowest: number[] = [];
  for (let col = 0; col < INVADER_COLS; col++) {
    for (let row = INVADER_ROWS - 1; row >= 0; row--) {
      const index = row * INVADER_COLS + col;
      if (alive[index]) {
        lowest.push(index);
        break;
      }
    }
  }
  return lowest;
}

/** Bottom edge of the lowest living invader. */
export function fleetBottom(state: InvadersState): number {
  for (let row = INVADER_ROWS - 1; row >= 0; row--) {
    for (let col = 0; col < INVADER_COLS; col++) {
      if (state.alive[row * INVADER_COLS + col]) {
        return state.fleetY + row * SPACING_Y + INVADER_H;
      }
    }
  }
  return state.fleetY;
}

/** March one step, dropping and turning at the walls. */
function marchFleet(
  state: Pick<InvadersState, "alive" | "fleetX" | "fleetY" | "fleetDir">,
): Pick<InvadersState, "fleetX" | "fleetY" | "fleetDir"> {
  let minCol = INVADER_COLS;
  let maxCol = -1;
  for (let index = 0; index < TOTAL_INVADERS; index++) {
    if (!state.alive[index]) continue;
    const col = index % INVADER_COLS;
    if (col < minCol) minCol = col;
    if (col > maxCol) maxCol = col;
  }
  if (maxCol === -1) {
    return { fleetX: state.fleetX, fleetY: state.fleetY, fleetDir: state.fleetDir };
  }

  const left = state.fleetX + minCol * SPACING_X + state.fleetDir * STEP_X;
  const right =
    state.fleetX + maxCol * SPACING_X + INVADER_W + state.fleetDir * STEP_X;

  if (left < FLEET_MARGIN || right > FIELD_WIDTH - FLEET_MARGIN) {
    return {
      fleetX: state.fleetX,
      fleetY: state.fleetY + STEP_Y,
      fleetDir: (state.fleetDir * -1) as Direction,
    };
  }
  return {
    fleetX: state.fleetX + state.fleetDir * STEP_X,
    fleetY: state.fleetY,
    fleetDir: state.fleetDir,
  };
}

/**
 * Advance the world one tick.
 *
 * Order matters: everything moves first, then collisions are resolved against
 * the positions they moved into, so a shot can never pass through an invader in
 * the gap between two ticks.
 */
export function step(state: InvadersState, input: Input): InvadersState {
  if (state.status !== "playing") return state;

  const tick = state.tick + 1;
  let {
    score,
    rng,
    alive,
    fleetX,
    fleetY,
    fleetDir,
    fleetFrame,
    stepTimer,
    bullet,
    shields,
    saucer,
    saucerTimer,
    nextId,
  } = state;

  const roll = (): number => {
    rng = advanceSeed(rng);
    return unit(rng);
  };

  /* --- the cannon ------------------------------------------------- */

  let playerX = state.playerX;
  if (input.left !== input.right) {
    playerX += input.left ? -PLAYER_SPEED : PLAYER_SPEED;
    playerX = Math.max(
      PLAYER_MARGIN,
      Math.min(FIELD_WIDTH - PLAYER_MARGIN - PLAYER_W, playerX),
    );
  }

  if (input.fire && !bullet) {
    bullet = {
      id: nextId++,
      x: playerX + PLAYER_W / 2 - BULLET_W / 2,
      y: PLAYER_Y - BULLET_H,
    };
  }

  /* --- shots ------------------------------------------------------ */

  if (bullet) {
    const flown = { ...bullet, y: bullet.y - BULLET_SPEED };
    bullet = flown.y + BULLET_H <= 0 ? null : flown;
  }

  let bombs = state.bombs
    .map((bomb) => ({ ...bomb, y: bomb.y + BOMB_SPEED }))
    .filter((bomb) => bomb.y < FIELD_HEIGHT);

  /* --- the fleet -------------------------------------------------- */

  const aliveCount = alive.reduce((total, on) => total + (on ? 1 : 0), 0);
  stepTimer -= 1;
  if (stepTimer <= 0) {
    const marched = marchFleet({ alive, fleetX, fleetY, fleetDir });
    fleetX = marched.fleetX;
    fleetY = marched.fleetY;
    fleetDir = marched.fleetDir;
    fleetFrame = fleetFrame === 0 ? 1 : 0;
    stepTimer = stepInterval(aliveCount, state.wave);
  }

  /* --- bombs away ------------------------------------------------- */

  const droppers = bombers(alive);
  if (bombs.length < maxBombs(state.wave) && droppers.length > 0) {
    if (roll() < bombChance(state.wave)) {
      const index = droppers[Math.floor(roll() * droppers.length)];
      const from = invaderRect(index, fleetX, fleetY);
      bombs = [
        ...bombs,
        {
          id: nextId++,
          x: from.x + INVADER_W / 2 - BOMB_W / 2,
          y: from.y + INVADER_H,
        },
      ];
    }
  }

  /* --- the mystery saucer ----------------------------------------- */

  if (saucer) {
    const x = saucer.x + saucer.dir * SAUCER_SPEED;
    saucer = x < -SAUCER_W || x > FIELD_WIDTH ? null : { ...saucer, x };
  } else {
    saucerTimer -= 1;
    if (saucerTimer <= 0) {
      saucerTimer = SAUCER_INTERVAL;
      // Only while there is still a fleet to fly over.
      if (aliveCount > 0) {
        const dir: Direction = roll() < 0.5 ? 1 : -1;
        saucer = { x: dir === 1 ? -SAUCER_W : FIELD_WIDTH, dir };
      }
    }
  }

  /* --- collisions ------------------------------------------------- */

  let explosions = state.explosions
    .map((boom) => ({ ...boom, ticks: boom.ticks - 1 }))
    .filter((boom) => boom.ticks > 0);

  const boom = (x: number, y: number) => {
    explosions = [...explosions, { id: nextId++, x, y, ticks: EXPLOSION_TICKS }];
  };

  if (bullet) {
    const shot = bulletRect(bullet);

    if (saucer && overlaps(shot, saucerRect(saucer))) {
      score += SAUCER_POINTS;
      boom(saucer.x + SAUCER_W / 2, SAUCER_Y + SAUCER_H / 2);
      saucer = null;
      bullet = null;
    }
  }

  if (bullet) {
    const shot = bulletRect(bullet);
    const hit = alive.findIndex(
      (on, index) => on && overlaps(shot, invaderRect(index, fleetX, fleetY)),
    );
    if (hit !== -1) {
      const target = invaderRect(hit, fleetX, fleetY);
      alive = alive.map((on, index) => (index === hit ? false : on));
      score += ROW_POINTS[Math.floor(hit / INVADER_COLS)];
      boom(target.x + INVADER_W / 2, target.y + INVADER_H / 2);
      bullet = null;
    }
  }

  if (bullet) {
    const damage = damageShields(shields, bulletRect(bullet));
    shields = damage.shields;
    if (damage.hit) bullet = null;
  }

  // A bomb and a bullet meeting cancel both — the shot the player never sees
  // land, which is half of what makes the bunkers matter.
  if (bullet) {
    const shot = bulletRect(bullet);
    const struck = bombs.find((bomb) => overlaps(shot, bombRect(bomb)));
    if (struck) {
      bombs = bombs.filter((bomb) => bomb.id !== struck.id);
      boom(struck.x, struck.y);
      bullet = null;
    }
  }

  const survivingBombs: Shot[] = [];
  for (const bomb of bombs) {
    const damage = damageShields(shields, bombRect(bomb));
    shields = damage.shields;
    if (!damage.hit) survivingBombs.push(bomb);
  }
  bombs = survivingBombs;

  // The fleet grinds the bunkers away as it descends onto them.
  for (let index = 0; index < TOTAL_INVADERS; index++) {
    if (!alive[index]) continue;
    const rect = invaderRect(index, fleetX, fleetY);
    if (rect.y + INVADER_H < SHIELD_Y) continue;
    shields = damageShields(shields, rect, true).shields;
  }

  const base: InvadersState = {
    ...state,
    tick,
    playerX,
    alive,
    fleetX,
    fleetY,
    fleetDir,
    fleetFrame,
    stepTimer,
    bullet,
    bombs,
    shields,
    saucer,
    saucerTimer,
    explosions,
    score,
    rng,
    nextId,
  };

  /* --- what the tick means ---------------------------------------- */

  if (base.alive.every((on) => !on)) {
    return { ...base, bombs: [], status: "waveCleared" };
  }

  const cannon = playerRect(playerX);
  const bombHit = bombs.find((bomb) => overlaps(cannon, bombRect(bomb)));
  const landed = fleetBottom(base) >= PLAYER_Y;

  if (bombHit || landed) {
    const lives = Math.max(0, state.lives - 1);
    return {
      ...base,
      bombs: bombHit ? bombs.filter((bomb) => bomb.id !== bombHit.id) : bombs,
      explosions: [
        ...explosions,
        {
          id: nextId,
          x: playerX + PLAYER_W / 2,
          y: PLAYER_Y + PLAYER_H / 2,
          ticks: EXPLOSION_TICKS * 3,
        },
      ],
      nextId: nextId + 1,
      lives,
      // Letting the fleet land ends the game outright, as on the cabinet.
      status: landed || lives === 0 ? "gameOver" : "dead",
    };
  }

  return base;
}
