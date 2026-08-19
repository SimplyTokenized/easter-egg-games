import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PacmanGame from "@easter-egg/games/pacman/PacmanGame";
import { getStrings } from "@easter-egg/strings";
import { PLAYER_START, initialPellets } from "@easter-egg/games/pacman/maze";

/**
 * Covers what the pure engine tests cannot reach: the animation-frame loop, the
 * keyboard wiring, and the sprites that actually end up in the document.
 */

const strings = getStrings("en");
const TICK_MS = 140;

interface Cell {
  row: number;
  col: number;
}

const cellOf = (entity: string): Cell | null => {
  const raw = document
    .querySelector(`[data-entity="${entity}"]`)
    ?.getAttribute("data-cell");
  if (!raw) return null;
  const [row, col] = raw.split(",").map(Number);
  return { row, col };
};

const press = (key: string) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });

const pump = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

/**
 * Run the loop until something is true. The loop paces itself by frames and
 * caps catch-up on purpose, so an exact tick count would be brittle.
 */
const until = (test: () => boolean, budgetTicks = 80): boolean => {
  for (let i = 0; i < budgetTicks; i++) {
    pump(TICK_MS);
    if (test()) return true;
  }
  return false;
};

beforeEach(() => {
  // The loop runs on animation frames, so those have to be faked too.
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "Date",
      "requestAnimationFrame",
      "cancelAnimationFrame",
    ],
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const mount = () => render(<PacmanGame strings={strings} onExit={() => undefined} />);

describe("PacmanGame", () => {
  it("draws the maze, the food and the whole cast", () => {
    mount();

    const { pellets, powers } = initialPellets();
    expect(document.querySelectorAll("circle[r='0.75']")).toHaveLength(pellets.size);
    expect(document.querySelectorAll("circle[r='2.1']")).toHaveLength(powers.size);
    for (const name of ["player", "blinky", "pinky", "inky", "clyde"]) {
      expect(document.querySelector(`[data-entity="${name}"]`)).toBeTruthy();
    }
  });

  it("waits for the player before running the clock", () => {
    mount();

    expect(screen.getByText(strings.readyPrompt)).toBeTruthy();
    expect(cellOf("player")).toEqual(PLAYER_START);

    pump(TICK_MS * 5);
    expect(cellOf("player")).toEqual(PLAYER_START);
  });

  it("starts on the first key and steers with it", () => {
    mount();

    press("ArrowLeft");
    expect(screen.queryByText(strings.readyPrompt)).toBeNull();
    expect(until(() => (cellOf("player")?.col ?? 99) < PLAYER_START.col)).toBe(true);
  });

  it("takes a buffered turn at the first opening", () => {
    mount();

    press("ArrowLeft");
    expect(until(() => (cellOf("player")?.col ?? 99) < PLAYER_START.col)).toBe(true);

    // Below the corridor is wall for a few tiles, so this waits for a gap.
    press("ArrowDown");
    expect(until(() => (cellOf("player")?.row ?? 0) > PLAYER_START.row)).toBe(true);
  });

  it("eats the pellets it runs over", () => {
    mount();
    const before = document.querySelectorAll("circle[r='0.75']").length;

    press("ArrowLeft");
    expect(until(() => document.querySelectorAll("circle[r='0.75']").length < before)).toBe(
      true,
    );

    const score = screen.getByText("Score").nextElementSibling;
    expect(Number(score?.textContent)).toBeGreaterThan(0);
  });

  it("lets the ghosts out of the pen", () => {
    mount();
    press("ArrowLeft");
    // Blinky is out from the start; Pinky follows a couple of seconds later.
    expect(until(() => (cellOf("pinky")?.row ?? 99) < 10, 120)).toBe(true);
  });

  it("moves every sprite with the frame loop, not with React", () => {
    mount();
    press("ArrowLeft");
    pump(TICK_MS * 3);

    const player = document.querySelector('[data-entity="player"]')!;
    // React renders the tile; the loop writes the transform. Both must be set.
    expect(player.getAttribute("transform")).toMatch(/^translate\(/);
    expect(player.getAttribute("data-cell")).toBeTruthy();
  });

  it("starts a new game from the button", () => {
    mount();
    press("ArrowLeft");
    expect(until(() => document.querySelectorAll("circle[r='0.75']").length < 200)).toBe(true);

    act(() => {
      screen.getByRole("button", { name: /new game/i }).click();
    });

    const { pellets } = initialPellets();
    expect(document.querySelectorAll("circle[r='0.75']")).toHaveLength(pellets.size);
    expect(cellOf("player")).toEqual(PLAYER_START);
  });
});
