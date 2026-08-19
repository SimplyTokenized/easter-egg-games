import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LadderGame from "@easter-egg/games/ladder/LadderGame";
import { getStrings } from "@easter-egg/strings";
import { LEVELS } from "@easter-egg/games/ladder/levels";

/**
 * Exercises the parts the pure engine tests cannot reach: the animation-frame
 * loop, the keyboard wiring and the character grid that ends up on screen.
 */

const strings = getStrings("en");
const TICK_MS = 95;

interface Cell {
  row: number;
  col: number;
}

/** The board is one <pre>; its rows are what the player actually sees. */
const boardRows = (): string[] => {
  const pre = document.querySelector("pre");
  return (pre?.textContent ?? "").split("\n");
};

const cellOf = (glyph: string): Cell | null => {
  const el = [...document.querySelectorAll("span[data-cell]")].find(
    (node) => node.textContent === glyph,
  );
  const raw = el?.getAttribute("data-cell");
  if (!raw) return null;
  const [row, col] = raw.split(",").map(Number);
  return { row, col };
};

const playerCell = (): Cell | null => cellOf("&");

const press = (key: string) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });

const release = (key: string) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true }));
  });

const pump = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

/**
 * Run the loop until something is true. The loop paces itself by frames and
 * deliberately caps catch-up, so asserting on an exact tick count would be
 * brittle — wait for the state instead.
 */
const until = (test: () => boolean, budgetTicks = 80): boolean => {
  for (let i = 0; i < budgetTicks; i++) {
    pump(TICK_MS);
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

const mount = () => render(<LadderGame strings={strings} onExit={() => undefined} />);

describe("LadderGame", () => {
  it("draws the level as characters, with floors and ladders", () => {
    mount();

    const rows = boardRows();
    expect(rows).toHaveLength(18);
    // Row 17 is the ground floor and spans the full width in every level.
    expect(rows[17]).toMatch(/^={56}$/);
    expect(rows.join("\n")).toContain("H");
  });

  it("waits for the player before running the clock", () => {
    mount();

    expect(screen.getByText(strings.readyPrompt)).toBeTruthy();

    const before = playerCell();
    pump(TICK_MS * 5);
    expect(playerCell()).toEqual(before);
  });

  it("walks right while the key is held, and stops when it is let go", () => {
    mount();
    const start = playerCell()!;

    press("ArrowRight");
    expect(until(() => (playerCell()?.col ?? 0) > start.col)).toBe(true);

    release("ArrowRight");
    const parked = playerCell()!;
    pump(TICK_MS * 4);
    expect(playerCell()!.col).toBe(parked.col);
  });

  it("climbs a ladder to the floor above", () => {
    mount();

    const ladderCol = LEVELS[0].ladders.find((l) => l.bottom === 16)!.col;

    press("ArrowRight");
    expect(until(() => playerCell()?.col === ladderCol)).toBe(true);
    release("ArrowRight");

    press("ArrowUp");
    // Row 12 is standing height for the floor at row 13.
    expect(until(() => (playerCell()?.row ?? 99) <= 12)).toBe(true);
    release("ArrowUp");
  });

  it("counts the bonus down once play starts", () => {
    mount();

    const readBonus = () =>
      Number(
        screen
          .getByText(strings.bonusLabel)
          .parentElement?.textContent?.replace(strings.bonusLabel, ""),
      );

    press("ArrowRight");
    expect(until(() => readBonus() < 5000)).toBe(true);
    expect(readBonus()).toBeGreaterThan(0);
  });

  it("releases rocks and moves them across the board", () => {
    mount();

    press("ArrowRight");
    expect(until(() => cellOf("o") !== null)).toBe(true);

    const first = cellOf("o")!;
    expect(until(() => {
      const now = cellOf("o");
      return !!now && (now.col !== first.col || now.row !== first.row);
    })).toBe(true);
  });

  it("caps catch-up so a stall cannot make the game sprint", () => {
    // Advancing fake timers models a browser that never misses a frame, so the
    // gap has to be produced by hand: drive the callbacks and choose their
    // timestamps. This is the case the player reported — the game stuttering
    // and then suddenly running fast.
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
    const start = playerCell()!;

    press("ArrowRight");
    frame(0); // baseline
    frame(30_000); // half a minute of debt in one go

    // MAX_CATCHUP_TICKS is 3, and the player walks one column per tick.
    expect(playerCell()!.col - start.col).toBe(3);
  });

  /**
   * The board's CSS lives in a template literal, so a stray comment marker or an
   * unbalanced brace is invisible to both tsc and eslint — the browser just
   * drops every rule after the mistake, and a whole feature ships inert. That
   * has already happened once here.
   */
  it("injects well-formed CSS", () => {
    mount();

    const css =
      [...document.querySelectorAll("style")]
        .map((node) => node.textContent ?? "")
        .find((text) => text.includes(".ladder-blink")) ?? "";

    expect(css).toContain(".ladder-blink");
    expect((css.match(/\/\*/g) ?? []).length).toBe((css.match(/\*\//g) ?? []).length);
    expect((css.match(/{/g) ?? []).length).toBe((css.match(/}/g) ?? []).length);
  });

  /**
   * Movement is interpolated by the frame loop, not by React and not by a CSS
   * transition. If React ever starts writing `transform` on an entity again the
   * two writers fight and the board judders — which is what the transition
   * approach did before this.
   */
  it("leaves entity positioning to the loop, not to React", () => {
    mount();

    const player = [...document.querySelectorAll("[data-entity]")].find(
      (node) => node.textContent === "&",
    ) as HTMLElement;

    expect(player).toBeTruthy();
    expect(player.dataset.entity).toBe("player");
    // React renders it bare; the loop supplies the transform.
    expect(player.style.willChange).toBe("transform");

    // And it must actually supply one before the first tick, or the glyph has
    // no transform at all and sits in the top-left corner of the board.
    const [row, col] = (player.dataset.cell ?? "").split(",").map(Number);
    expect(row).toBe(LEVELS[0].start.row);
    expect(col).toBe(LEVELS[0].start.col);
    expect(player.style.transform).toBe(
      `translate(${col}ch, calc(${row} * 1.15em))`,
    );

    // Static glyphs are the opposite: React places them and nothing moves them.
    const exit = [...document.querySelectorAll("span[data-cell]")].find(
      (node) => node.textContent === "$",
    ) as HTMLElement;
    expect(exit.dataset.entity).toBeUndefined();
    expect(exit.style.transform).toContain("translate");
  });

  it("shows the level name and starting lads", () => {
    mount();

    expect(screen.getByText(/Easy Street/)).toBeTruthy();
    expect(screen.getByText(strings.lads).parentElement?.textContent).toContain("5");
  });
});
