import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SnakeGame from "@easter-egg/games/snake/SnakeGame";
import { getStrings } from "@easter-egg/strings";
import { START_TICK_MS } from "@easter-egg/games/snake/engine";

/**
 * Exercises what the pure engine tests cannot reach: the animation-frame loop,
 * the keyboard and swipe wiring, and the board that ends up on screen.
 */

const strings = getStrings("en");

interface Cell {
  row: number;
  col: number;
}

const cellsOf = (role: "head" | "body" | "food"): Cell[] =>
  [...document.querySelectorAll(`[data-role="${role}"]`)].map((node) => {
    const [row, col] = (node.getAttribute("data-cell") ?? "").split(",").map(Number);
    return { row, col };
  });

const head = (): Cell => cellsOf("head")[0];
const length = (): number => cellsOf("head").length + cellsOf("body").length;

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
 * caps catch-up on purpose, so asserting on an exact tick count would be
 * brittle — wait for the state instead.
 */
const until = (test: () => boolean, budgetTicks = 60): boolean => {
  for (let i = 0; i < budgetTicks; i++) {
    pump(START_TICK_MS);
    if (test()) return true;
  }
  return false;
};

beforeEach(() => {
  // The loop runs on animation frames, so those have to be faked as well.
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

const mount = () => render(<SnakeGame strings={strings} onExit={() => undefined} />);

/**
 * happy-dom lays nothing out, so the board reports a zero-sized box and the
 * pointer control has no geometry to work with. Give it one — 24x18 cells of
 * 10px, matching the grid the game falls back to when nothing can be measured.
 */
const CELL = 10;
const cellCentre = (index: number) => index * CELL + CELL / 2;

/** Mounts the game and hands back its board, ready to be pointed at. */
const aimableBoard = (): HTMLElement => {
  mount();
  const board = document.querySelector("[data-role]")!.parentElement as HTMLElement;
  board.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 24 * CELL, height: 18 * CELL }) as DOMRect;
  return board;
};

describe("SnakeGame", () => {
  it("draws a snake and an apple", () => {
    mount();

    expect(length()).toBe(4);
    expect(cellsOf("food")).toHaveLength(1);
  });

  it("waits for the player before running the clock", () => {
    mount();

    expect(screen.getByText(strings.readyPrompt)).toBeTruthy();

    const before = head();
    pump(START_TICK_MS * 5);
    expect(head()).toEqual(before);
  });

  it("crawls right once a key starts it", () => {
    mount();
    const start = head();

    press("ArrowRight");
    expect(until(() => head().col > start.col)).toBe(true);
    expect(head().row).toBe(start.row);
  });

  it("steers with the arrow keys", () => {
    mount();
    const start = head();

    press("ArrowUp");
    expect(until(() => head().row < start.row)).toBe(true);
  });

  it("refuses to double back on itself", () => {
    mount();
    const start = head();

    press("ArrowRight");
    expect(until(() => head().col > start.col)).toBe(true);

    // Left is a reversal from a snake heading right; it must be ignored rather
    // than folding the head into its own neck.
    const before = head();
    press("ArrowLeft");
    pump(START_TICK_MS * 3);
    expect(head().col).toBeGreaterThan(before.col);
  });

  it("holds still while paused and picks up again after", () => {
    mount();

    press("ArrowRight");
    expect(until(() => head().col > 12)).toBe(true);

    press(" ");
    expect(screen.getByText(strings.paused)).toBeTruthy();
    const parked = head();
    pump(START_TICK_MS * 5);
    expect(head()).toEqual(parked);

    press(" ");
    expect(until(() => head().col > parked.col)).toBe(true);
  });

  it("pauses itself when the window loses focus", () => {
    mount();

    press("ArrowRight");
    expect(until(() => head().col > 12)).toBe(true);

    act(() => {
      window.dispatchEvent(new Event("blur"));
    });

    expect(screen.getByText(strings.paused)).toBeTruthy();
  });

  it("ends the run at the wall and offers another go", () => {
    mount();

    press("ArrowUp");
    expect(until(() => screen.queryByText(strings.gameOver) !== null)).toBe(true);

    // Nothing moves after the crash.
    const parked = head();
    pump(START_TICK_MS * 5);
    expect(head()).toEqual(parked);

    const again = screen.getByRole("button", { name: strings.playAgain });
    act(() => {
      fireEvent.click(again);
    });
    expect(screen.queryByText(strings.gameOver)).toBeNull();
    expect(length()).toBe(4);
  });

  it("heads for wherever the pointer is", () => {
    const board = aimableBoard();
    const start = head();

    // A press well above the head, in the same column it is already in.
    act(() => {
      fireEvent.pointerDown(board, { clientX: cellCentre(start.col), clientY: cellCentre(1) });
    });

    expect(until(() => head().row < start.row)).toBe(true);
  });

  it("follows the pointer as it moves, without a press", () => {
    const board = aimableBoard();
    const start = head();

    // Start it with the keyboard, then take over with the pointer alone.
    press("ArrowRight");
    expect(until(() => head().col > start.col)).toBe(true);

    act(() => {
      fireEvent.pointerMove(board, { clientX: cellCentre(start.col), clientY: cellCentre(17) });
    });

    expect(until(() => head().row > start.row)).toBe(true);
  });

  it("hands steering back to the keyboard once a key is pressed", () => {
    const board = aimableBoard();
    const start = head();

    act(() => {
      fireEvent.pointerDown(board, { clientX: cellCentre(start.col), clientY: cellCentre(17) });
    });
    expect(until(() => head().row > start.row)).toBe(true);

    // The cursor still sits below the snake; the arrow key must win anyway.
    press("ArrowLeft");
    const turned = head();
    expect(until(() => head().col < turned.col)).toBe(true);
  });

  it("caps catch-up so a stall cannot make the snake sprint into a wall", () => {
    // Advancing fake timers models a browser that never misses a frame, so the
    // gap has to be produced by hand: drive the callbacks and choose their
    // timestamps.
    const pending: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      pending.push(callback);
      return pending.length;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);

    const frame = (timestamp: number) =>
      act(() => {
        for (const callback of pending.splice(0)) callback(timestamp);
      });

    mount();
    const start = head();

    press("ArrowRight");
    frame(0); // baseline
    frame(30_000); // half a minute of debt in one go

    // MAX_CATCHUP_TICKS is 3, and the snake covers one cell per tick.
    expect(head().col - start.col).toBe(3);
  });

  /**
   * The board's CSS lives in a template literal, so a stray comment marker or
   * an unbalanced brace is invisible to both tsc and eslint — the browser just
   * drops every rule after the mistake and the animation ships inert.
   */
  it("injects well-formed CSS", () => {
    mount();

    const css = [...document.querySelectorAll("style")]
      .map((node) => node.textContent ?? "")
      .join("\n");

    expect(css).toContain("snake-overlay");
    expect(css.split("{").length).toBe(css.split("}").length);
    expect(css).not.toContain("/*");
  });
});
