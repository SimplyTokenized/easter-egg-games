/**
 * Pac-Man — the rules, as pure functions over the maze in `maze.ts`.
 *
 * Same split as the other games in this folder: the component owns the clock,
 * the keyboard and every pixel; everything below is a state and a `step`, so
 * ghost behaviour can be tested without rendering a thing.
 *
 * The implementation is independent. The genre and its mechanics are free to
 * reuse; the original's maze, artwork and code are not — see the README.
 */

import {
  FRUIT_TILE,
  HOUSE_CENTER,
  HOUSE_EXIT,
  initialPellets,
  isDoor,
  isHouse,
  isWall,
  key,
  PLAYER_START,
  wrapCol,
  type Vec,
} from "./maze";

export type Dir = "up" | "down" | "left" | "right";

export const DELTA: Record<Dir, Vec> = {
  up: { row: -1, col: 0 },
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
  right: { row: 0, col: 1 },
};

export const OPPOSITE: Record<Dir, Dir> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

/**
 * Up, left, down, right — the order ties are broken in, as in the original.
 * Two routes of equal length to the target are not a coin flip: the fixed order
 * is what makes the ghosts feel like they have habits.
 */
export const DIR_ORDER: readonly Dir[] = ["up", "left", "down", "right"];

export type GhostName = "blinky" | "pinky" | "inky" | "clyde";
export type Mode = "scatter" | "chase";

export type PacmanStatus =
  | "ready"
  | "playing"
  | "dead"
  | "levelCleared"
  | "gameOver";

export interface Ghost extends Vec {
  name: GhostName;
  dir: Dir;
  /** Blue and edible. Cleared when the fright timer runs out. */
  frightened: boolean;
  /** A pair of eyes on its way home. */
  eaten: boolean;
  /** Tick this ghost is let out of the pen. */
  releaseAt: number;
}

export interface Player extends Vec {
  dir: Dir;
  /**
   * A turn that could not be taken yet. Holding it is what makes the corners
   * forgiving: press early, turn the moment the gap appears.
   */
  next: Dir | null;
}

export interface Fruit extends Vec {
  value: number;
  /** Ticks left on screen. */
  ticks: number;
}

export interface PacmanState {
  level: number;
  tick: number;
  status: PacmanStatus;
  player: Player;
  ghosts: Ghost[];
  pellets: ReadonlySet<number>;
  powers: ReadonlySet<number>;
  score: number;
  lives: number;
  /** Ticks of fright left; 0 means the ghosts are dangerous again. */
  fright: number;
  /** Ghosts eaten since the last power pellet — drives 200/400/800/1600. */
  chain: number;
  /** Counts toward the two fruit appearances; resets with the level. */
  pelletsEaten: number;
  fruit: Fruit | null;
  /** Scatter/chase clock. Stands still while the ghosts are frightened. */
  modeTick: number;
}

export const START_LIVES = 3;
export const PELLET_POINTS = 10;
export const POWER_POINTS = 50;
/** First ghost of a fright is worth this; each further one doubles. */
export const GHOST_POINTS = 200;
export const FRUIT_TICKS = 70;
/** Pellet counts that summon the fruit, as in the original's two appearances. */
export const FRUIT_AT: readonly number[] = [70, 170];

export const fruitValue = (level: number): number => 100 * Math.min(level, 5);

/** Fright gets shorter as levels go on; never less than three seconds of it. */
export const frightTicks = (level: number): number =>
  Math.max(24, 64 - (level - 1) * 8);

/**
 * Ghosts are slower than Pac-Man, and less so each level: they skip one tick in
 * every `period`. Frightened ghosts move every other tick; eyes move at double
 * speed and are handled in `step`.
 */
const speedPeriod = (level: number): number => Math.min(4 + level, 8);

const ghostMoves = (ghost: Ghost, tick: number, level: number): boolean => {
  if (ghost.frightened) return tick % 2 === 0;
  return tick % speedPeriod(level) !== 0;
};

/** Scatter sends each ghost to its own corner, which is what breaks up a pack. */
const CORNERS: Record<GhostName, Vec> = {
  blinky: { row: 1, col: 19 },
  pinky: { row: 1, col: 1 },
  inky: { row: 19, col: 19 },
  clyde: { row: 19, col: 1 },
};

/**
 * Scatter, chase, scatter, chase … then chase for good. Lengths in ticks, which
 * at the component's tick works out at roughly 7 s of scatter to 20 s of chase.
 */
const MODE_PHASES: readonly number[] = [50, 145, 50, 155, 40];

export function modeAt(modeTick: number): Mode {
  let left = modeTick;
  for (let i = 0; i < MODE_PHASES.length; i++) {
    if (left < MODE_PHASES[i]) return i % 2 === 0 ? "scatter" : "chase";
    left -= MODE_PHASES[i];
  }
  return "chase";
}

const GHOST_SPAWNS: readonly Omit<Ghost, "frightened" | "eaten">[] = [
  // Blinky starts on the roof of the pen and comes straight at you.
  { name: "blinky", row: HOUSE_EXIT.row, col: HOUSE_EXIT.col, dir: "left", releaseAt: 0 },
  { name: "pinky", row: HOUSE_CENTER.row, col: 10, dir: "up", releaseAt: 14 },
  { name: "inky", row: HOUSE_CENTER.row, col: 9, dir: "up", releaseAt: 50 },
  { name: "clyde", row: HOUSE_CENTER.row, col: 11, dir: "up", releaseAt: 95 },
];

const spawnGhosts = (): Ghost[] =>
  GHOST_SPAWNS.map((spawn) => ({ ...spawn, frightened: false, eaten: false }));

const spawnPlayer = (): Player => ({ ...PLAYER_START, dir: "left", next: null });

export function createGame(level = 1): PacmanState {
  const { pellets, powers } = initialPellets();
  return {
    level,
    tick: 0,
    status: "ready",
    player: spawnPlayer(),
    ghosts: spawnGhosts(),
    pellets,
    powers,
    score: 0,
    lives: START_LIVES,
    fright: 0,
    chain: 0,
    pelletsEaten: 0,
    fruit: null,
    modeTick: 0,
  };
}

/** Everyone back to their corner; the maze keeps whatever has been eaten. */
export const resetRound = (state: PacmanState): PacmanState => ({
  ...state,
  tick: 0,
  modeTick: 0,
  status: "playing",
  player: spawnPlayer(),
  ghosts: spawnGhosts(),
  fright: 0,
  chain: 0,
  fruit: null,
});

/** A fresh maze, one level harder, carrying score and lives across. */
export const advanceLevel = (state: PacmanState): PacmanState => {
  const { pellets, powers } = initialPellets();
  return {
    ...resetRound(state),
    level: state.level + 1,
    pellets,
    powers,
    pelletsEaten: 0,
  };
};

const same = (a: Vec, b: Vec): boolean => a.row === b.row && a.col === b.col;

const ahead = (from: Vec, dir: Dir, distance: number): Vec => ({
  row: from.row + DELTA[dir].row * distance,
  col: from.col + DELTA[dir].col * distance,
});

/** Squared distance is enough to compare two candidate tiles — no `sqrt`. */
const distance2 = (a: Vec, b: Vec): number =>
  (a.row - b.row) ** 2 + (a.col - b.col) ** 2;

const stepFrom = (from: Vec, dir: Dir): Vec => ({
  row: from.row + DELTA[dir].row,
  col: wrapCol(from.col + DELTA[dir].col),
});

/** The pen is scenery to Pac-Man: he can neither enter it nor its door. */
const playerCanEnter = (row: number, col: number): boolean =>
  !isWall(row, col) && !isDoor(row, col) && !isHouse(row, col);

/**
 * A ghost may pass the door only on its way out of the pen or, as a pair of
 * eyes, on its way back in. Without that, a ghost whose target sits below the
 * pen would happily route through it and never come out.
 */
const ghostCanEnter = (ghost: Ghost, row: number, col: number): boolean => {
  if (isWall(row, col)) return false;
  if (isDoor(row, col) || isHouse(row, col)) {
    return ghost.eaten || isHouse(ghost.row, ghost.col) || isDoor(ghost.row, ghost.col);
  }
  return true;
};

export function ghostTarget(state: PacmanState, ghost: Ghost): Vec {
  if (ghost.eaten) return HOUSE_CENTER;
  if (isHouse(ghost.row, ghost.col) || isDoor(ghost.row, ghost.col)) return HOUSE_EXIT;
  if (modeAt(state.modeTick) === "scatter") return CORNERS[ghost.name];

  const { player } = state;
  switch (ghost.name) {
    case "blinky":
      return player;
    case "pinky":
      // Four tiles in front, so it cuts you off rather than following you.
      return ahead(player, player.dir, 4);
    case "inky": {
      // Blinky's position, mirrored through the tile two ahead of Pac-Man:
      // Inky is only dangerous when Blinky is already close.
      const pivot = ahead(player, player.dir, 2);
      const blinky = state.ghosts.find((g) => g.name === "blinky") ?? ghost;
      return { row: 2 * pivot.row - blinky.row, col: 2 * pivot.col - blinky.col };
    }
    case "clyde":
      // Bold at a distance, shy up close — he peels off for his corner.
      return distance2(ghost, player) > 64 ? player : CORNERS.clyde;
  }
}

/**
 * Deterministic wobble for frightened ghosts.
 *
 * `Math.random` would make a tick unreproducible, and the tests lean on being
 * able to replay one. This is a cheap integer hash of the tick and the ghost.
 */
const wobble = (tick: number, seed: number): number => {
  let hash = (tick + 1) * 2654435761 + seed * 40503;
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 1274126177);
  return Math.abs(hash ^ (hash >>> 16));
};

const GHOST_SEED: Record<GhostName, number> = {
  blinky: 1,
  pinky: 2,
  inky: 3,
  clyde: 4,
};

function moveGhost(state: PacmanState, ghost: Ghost): Ghost {
  // Still in the pen and not due out yet: it just bobs about.
  if (
    !ghost.eaten &&
    isHouse(ghost.row, ghost.col) &&
    state.tick < ghost.releaseAt
  ) {
    return ghost;
  }

  const target = ghostTarget(state, ghost);
  const options = DIR_ORDER.filter((dir) => {
    if (dir === OPPOSITE[ghost.dir]) return false;
    const next = stepFrom(ghost, dir);
    return ghostCanEnter(ghost, next.row, next.col);
  });

  // A dead end is the one place a ghost turns around of its own accord.
  const choices = options.length > 0 ? options : [OPPOSITE[ghost.dir]];

  const dir = ghost.frightened
    ? choices[wobble(state.tick, GHOST_SEED[ghost.name]) % choices.length]
    : choices.reduce((best, candidate) =>
        distance2(stepFrom(ghost, candidate), target) <
        distance2(stepFrom(ghost, best), target)
          ? candidate
          : best,
      );

  const next = stepFrom(ghost, dir);
  if (!ghostCanEnter(ghost, next.row, next.col)) return { ...ghost, dir };
  return { ...ghost, dir, row: next.row, col: next.col };
}

function movePlayer(player: Player, turn: Dir | null): Player {
  let { dir, next } = player;
  if (turn) next = turn;

  // Take the buffered turn as soon as there is a gap to take it into.
  if (next) {
    const candidate = stepFrom(player, next);
    if (playerCanEnter(candidate.row, candidate.col)) {
      dir = next;
      next = null;
    }
  }

  const ahead = stepFrom(player, dir);
  if (!playerCanEnter(ahead.row, ahead.col)) return { ...player, dir, next };
  return { row: ahead.row, col: ahead.col, dir, next };
}

/**
 * Did this ghost just meet Pac-Man? Landing on him counts, and so does walking
 * through him — on a tile grid a straight swap would otherwise look like the
 * ghost passed clean through.
 */
const meets = (ghost: Ghost, before: Vec, player: Vec, playerBefore: Vec): boolean =>
  same(ghost, player) || (same(before, player) && same(ghost, playerBefore));

interface Contact {
  ghosts: Ghost[];
  score: number;
  chain: number;
  died: boolean;
}

function resolveContact(
  ghosts: Ghost[],
  previous: Vec[],
  player: Vec,
  playerBefore: Vec,
  score: number,
  chain: number,
): Contact {
  let died = false;
  const next = ghosts.map((ghost, i) => {
    if (ghost.eaten || !meets(ghost, previous[i], player, playerBefore)) return ghost;
    if (ghost.frightened) {
      score += GHOST_POINTS * 2 ** chain;
      chain += 1;
      return { ...ghost, frightened: false, eaten: true };
    }
    died = true;
    return ghost;
  });
  return { ghosts: next, score, chain, died };
}

/** Advance the world one tick. Returns a new state; nothing is mutated. */
export function step(state: PacmanState, turn: Dir | null): PacmanState {
  if (state.status !== "playing") return state;

  const tick = state.tick + 1;
  const { level } = state;
  let { score, fright, chain, pelletsEaten, fruit } = state;
  let pellets = state.pellets;
  let powers = state.powers;
  let ghosts = state.ghosts;

  const playerBefore: Vec = { row: state.player.row, col: state.player.col };
  const player = movePlayer(state.player, turn);
  const here = key(player.row, player.col);

  if (pellets.has(here)) {
    const rest = new Set(pellets);
    rest.delete(here);
    pellets = rest;
    score += PELLET_POINTS;
    pelletsEaten += 1;
  } else if (powers.has(here)) {
    const rest = new Set(powers);
    rest.delete(here);
    powers = rest;
    score += POWER_POINTS;
    pelletsEaten += 1;
    fright = frightTicks(level);
    chain = 0;
    // The whole pack turns on the spot — the tell that the tables have turned.
    ghosts = ghosts.map((ghost) =>
      ghost.eaten ? ghost : { ...ghost, frightened: true, dir: OPPOSITE[ghost.dir] },
    );
  }

  if (fruit && same(player, fruit)) {
    score += fruit.value;
    fruit = null;
  } else if (fruit) {
    fruit = fruit.ticks > 1 ? { ...fruit, ticks: fruit.ticks - 1 } : null;
  } else if (FRUIT_AT.includes(pelletsEaten) && pelletsEaten !== state.pelletsEaten) {
    fruit = { ...FRUIT_TILE, value: fruitValue(level), ticks: FRUIT_TICKS };
  }

  if (pellets.size === 0 && powers.size === 0) {
    return {
      ...state,
      tick,
      player,
      ghosts,
      pellets,
      powers,
      score,
      fright: 0,
      chain,
      pelletsEaten,
      fruit: null,
      status: "levelCleared",
    };
  }

  const die = (state2: PacmanState): PacmanState => ({
    ...state2,
    lives: state.lives - 1,
    status: state.lives - 1 > 0 ? "dead" : "gameOver",
  });

  // Pac-Man has moved but the ghosts have not: catching one mid-stride counts.
  const first = resolveContact(
    ghosts,
    ghosts,
    player,
    playerBefore,
    score,
    chain,
  );
  ghosts = first.ghosts;
  score = first.score;
  chain = first.chain;

  const base: PacmanState = {
    ...state,
    tick,
    player,
    ghosts,
    pellets,
    powers,
    score,
    fright,
    chain,
    pelletsEaten,
    fruit,
  };

  if (first.died) return die(base);

  const before = ghosts.map((ghost): Vec => ({ row: ghost.row, col: ghost.col }));
  ghosts = ghosts.map((ghost) => {
    if (!ghost.eaten) {
      return ghostMoves(ghost, tick, level) ? moveGhost(base, ghost) : ghost;
    }
    // Eyes travel home at double speed, then the ghost is reborn in the pen.
    let eyes = moveGhost(base, ghost);
    if (!same(eyes, HOUSE_CENTER)) eyes = moveGhost(base, eyes);
    return same(eyes, HOUSE_CENTER)
      ? { ...eyes, eaten: false, frightened: false, dir: "up" as Dir, releaseAt: tick }
      : eyes;
  });

  const second = resolveContact(ghosts, before, player, playerBefore, score, chain);
  ghosts = second.ghosts;
  score = second.score;
  chain = second.chain;

  if (fright > 0) {
    fright -= 1;
    if (fright === 0) {
      ghosts = ghosts.map((ghost) => (ghost.frightened ? { ...ghost, frightened: false } : ghost));
      chain = 0;
    }
  }

  // Scatter and chase alternate on their own clock, which fright pauses. A
  // switch turns every ghost around — the classic tell that the mood changed.
  let modeTick = state.modeTick;
  if (fright === 0) {
    const wasMode = modeAt(modeTick);
    modeTick += 1;
    if (modeAt(modeTick) !== wasMode) {
      ghosts = ghosts.map((ghost) =>
        ghost.eaten || isHouse(ghost.row, ghost.col)
          ? ghost
          : { ...ghost, dir: OPPOSITE[ghost.dir] },
      );
    }
  }

  const next: PacmanState = {
    ...base,
    ghosts,
    score,
    fright,
    chain,
    modeTick,
  };

  return second.died ? die(next) : next;
}
