import type { LevelSpec } from "./engine";

/**
 * The five stages, written as geometry rather than ASCII art.
 *
 * Hand-drawn character rows read nicely but a single misplaced space makes a
 * ladder that goes nowhere or a floor a rock falls straight through, and you
 * only find out by playing. Describing floors and ladders as ranges keeps the
 * invariants checkable — see the unit tests, which assert that every ladder
 * actually joins two floors.
 *
 * Floors sit on rows 1, 5, 9, 13 and 17. A ladder from the floor at row L up to
 * the floor at row U spans rows U..L-1: it pokes through the upper floor so you
 * can climb out onto it. Where a floor stops short of the edge is where rocks
 * drop to the next one, turning around as they land — that is what produces the
 * zigzag down the screen.
 */

const easyStreet: LevelSpec = {
  name: "Easy Street",
  floors: [
    { row: 1, from: 0, to: 49 },
    { row: 5, from: 5, to: 55 },
    { row: 9, from: 0, to: 49 },
    { row: 13, from: 6, to: 55 },
    { row: 17, from: 0, to: 55 },
  ],
  ladders: [
    { col: 30, top: 1, bottom: 4 },
    { col: 44, top: 1, bottom: 4 },
    { col: 12, top: 5, bottom: 8 },
    { col: 34, top: 5, bottom: 8 },
    { col: 20, top: 9, bottom: 12 },
    { col: 40, top: 9, bottom: 12 },
    { col: 16, top: 13, bottom: 16 },
    { col: 46, top: 13, bottom: 16 },
  ],
  treasures: [
    { row: 4, col: 10 },
    { row: 8, col: 46 },
    { row: 12, col: 8 },
    { row: 16, col: 40 },
  ],
  start: { row: 16, col: 2 },
  goal: { row: 0, col: 46 },
  spawns: [{ row: 0, col: 2, dir: 1 }],
  rockInterval: 30,
  rockMoveEvery: 2,
};

const longIsland: LevelSpec = {
  name: "Long Island",
  floors: [
    { row: 1, from: 0, to: 52 },
    { row: 5, from: 3, to: 55 },
    { row: 9, from: 0, to: 52 },
    { row: 13, from: 3, to: 55 },
    { row: 17, from: 0, to: 55 },
  ],
  ladders: [
    { col: 24, top: 1, bottom: 4 },
    { col: 48, top: 1, bottom: 4 },
    { col: 10, top: 5, bottom: 8 },
    { col: 38, top: 5, bottom: 8 },
    { col: 18, top: 9, bottom: 12 },
    { col: 44, top: 9, bottom: 12 },
    { col: 8, top: 13, bottom: 16 },
    { col: 34, top: 13, bottom: 16 },
  ],
  treasures: [
    { row: 4, col: 50 },
    { row: 8, col: 6 },
    { row: 12, col: 50 },
    { row: 16, col: 20 },
  ],
  start: { row: 16, col: 2 },
  goal: { row: 0, col: 50 },
  spawns: [
    { row: 0, col: 2, dir: 1 },
    { row: 0, col: 20, dir: 1 },
  ],
  rockInterval: 24,
  rockMoveEvery: 2,
};

const supplyTrail: LevelSpec = {
  name: "Supply Trail",
  floors: [
    { row: 1, from: 2, to: 55 },
    { row: 5, from: 0, to: 50 },
    { row: 9, from: 4, to: 55 },
    { row: 13, from: 0, to: 48 },
    { row: 17, from: 0, to: 55 },
  ],
  ladders: [
    { col: 14, top: 1, bottom: 4 },
    { col: 40, top: 1, bottom: 4 },
    { col: 22, top: 5, bottom: 8 },
    { col: 46, top: 5, bottom: 8 },
    { col: 10, top: 9, bottom: 12 },
    { col: 36, top: 9, bottom: 12 },
    { col: 18, top: 13, bottom: 16 },
    { col: 44, top: 13, bottom: 16 },
  ],
  treasures: [
    { row: 4, col: 4 },
    { row: 8, col: 50 },
    { row: 12, col: 6 },
    { row: 16, col: 48 },
  ],
  start: { row: 16, col: 4 },
  goal: { row: 0, col: 6 },
  // Rocks come from the right here, so the climb runs against the traffic.
  spawns: [
    { row: 0, col: 52, dir: -1 },
    { row: 0, col: 30, dir: -1 },
  ],
  rockInterval: 22,
  rockMoveEvery: 1,
};

const snakePit: LevelSpec = {
  name: "Snake Pit",
  floors: [
    { row: 1, from: 0, to: 48 },
    { row: 5, from: 0, to: 44 },
    { row: 9, from: 10, to: 55 },
    { row: 13, from: 0, to: 44 },
    { row: 17, from: 0, to: 55 },
  ],
  ladders: [
    { col: 6, top: 1, bottom: 4 },
    { col: 38, top: 1, bottom: 4 },
    { col: 16, top: 5, bottom: 8 },
    { col: 42, top: 5, bottom: 8 },
    { col: 14, top: 9, bottom: 12 },
    { col: 40, top: 9, bottom: 12 },
    { col: 6, top: 13, bottom: 16 },
    { col: 36, top: 13, bottom: 16 },
  ],
  treasures: [
    { row: 4, col: 42 },
    { row: 8, col: 12 },
    { row: 12, col: 42 },
    { row: 16, col: 50 },
  ],
  start: { row: 16, col: 2 },
  goal: { row: 0, col: 44 },
  spawns: [
    { row: 0, col: 2, dir: 1 },
    { row: 0, col: 28, dir: 1 },
  ],
  rockInterval: 20,
  rockMoveEvery: 1,
};

const theGauntlet: LevelSpec = {
  name: "The Gauntlet",
  floors: [
    { row: 1, from: 0, to: 46 },
    { row: 5, from: 8, to: 55 },
    { row: 9, from: 0, to: 46 },
    { row: 13, from: 8, to: 55 },
    { row: 17, from: 0, to: 55 },
  ],
  ladders: [
    { col: 20, top: 1, bottom: 4 },
    { col: 40, top: 1, bottom: 4 },
    { col: 14, top: 5, bottom: 8 },
    { col: 30, top: 5, bottom: 8 },
    { col: 22, top: 9, bottom: 12 },
    { col: 42, top: 9, bottom: 12 },
    { col: 12, top: 13, bottom: 16 },
    { col: 32, top: 13, bottom: 16 },
  ],
  treasures: [
    { row: 4, col: 50 },
    { row: 8, col: 4 },
    { row: 12, col: 50 },
    { row: 16, col: 24 },
  ],
  start: { row: 16, col: 2 },
  goal: { row: 0, col: 42 },
  spawns: [
    { row: 0, col: 2, dir: 1 },
    { row: 0, col: 22, dir: 1 },
    { row: 0, col: 38, dir: 1 },
  ],
  rockInterval: 18,
  rockMoveEvery: 1,
};

export const LEVELS: LevelSpec[] = [
  easyStreet,
  longIsland,
  supplyTrail,
  snakePit,
  theGauntlet,
];
