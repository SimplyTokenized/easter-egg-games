import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InvadersGame, {
  pointerToField,
} from "@easter-egg/games/invaders/InvadersGame";
import { getStrings } from "@easter-egg/strings";
import {
  FIELD_WIDTH,
  TOTAL_INVADERS,
} from "@easter-egg/games/invaders/engine";
import {
  CANNON_SPRITE,
  EXPLOSION_SPRITE,
  INVADER_SPRITES,
  SAUCER_SPRITE,
  spritePath,
} from "@easter-egg/games/invaders/sprites";

/**
 * The parts the pure engine cannot reach: the animation-frame loop, the
 * keyboard wiring, and what actually ends up on the field.
 */

const strings = getStrings("en");
const TICK_MS = 33;

const mount = () =>
  render(<InvadersGame strings={strings} onExit={() => undefined} />);

const paths = (): HTMLElement[] => [
  ...document.querySelectorAll<HTMLElement>("svg path"),
];

/**
 * The cannon on the field, not the life icons in the status bar: the same
 * sprite is used for both, and only the one on the field is placed with `left`.
 */
const cannon = (): HTMLElement | undefined =>
  paths()
    .map((node) => node.parentElement as HTMLElement)
    .find(
      (svg) =>
        svg.querySelector("path")?.getAttribute("d") === CANNON_SPRITE.path &&
        svg.style.left !== "",
    );

const cannonX = (): number => Number.parseFloat(cannon()?.style.left ?? "NaN");

const fleetSize = (): number => {
  const fleet = new Set(INVADER_SPRITES.flatMap(([a, b]) => [a.path, b.path]));
  return paths().filter((node) => fleet.has(node.getAttribute("d") ?? "")).length;
};

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

/** The loop paces itself by frames, so wait for the state, not for a count. */
const until = (test: () => boolean, budgetTicks = 80): boolean => {
  for (let i = 0; i < budgetTicks; i++) {
    pump(TICK_MS);
    if (test()) return true;
  }
  return false;
};

beforeEach(() => {
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

describe("InvadersGame", () => {
  it("puts the whole fleet, the bunkers and the cannon on the field", () => {
    mount();

    expect(fleetSize()).toBe(TOTAL_INVADERS);
    expect(cannon()).toBeTruthy();
    // Four bunkers, each a grid of blocks with four holes punched out.
    expect(document.querySelectorAll(".bg-emerald-400\\/90")).toHaveLength(4 * 20);
  });

  it("waits for the player before running the clock", () => {
    mount();

    expect(screen.getByText(strings.readyPrompt)).toBeTruthy();

    const before = cannonX();
    pump(TICK_MS * 5);
    expect(cannonX()).toBe(before);
  });

  it("moves while a direction is held, and stops when it is let go", () => {
    mount();
    const start = cannonX();

    press("ArrowRight");
    expect(until(() => cannonX() > start)).toBe(true);

    release("ArrowRight");
    const parked = cannonX();
    pump(TICK_MS * 4);
    expect(cannonX()).toBe(parked);
  });

  it("fires one shot, and only one at a time", () => {
    mount();

    press(" ");
    expect(until(() => !!document.querySelector("[data-testid='invaders-bullet']"))).toBe(
      true,
    );
    pump(TICK_MS * 3);
    expect(document.querySelectorAll("[data-testid='invaders-bullet']")).toHaveLength(1);
  });

  it("kills an invader when a shot reaches the fleet", () => {
    mount();

    press(" ");
    expect(until(() => fleetSize() < TOTAL_INVADERS, 60)).toBe(true);
    const score = Number(
      screen
        .getByText(strings.scoreLabel)
        .parentElement?.textContent?.replace(strings.scoreLabel, ""),
    );
    expect(score).toBeGreaterThan(0);
  });

  it("marches the fleet sideways on its own, slower clock", () => {
    mount();

    const fleetLeft = () => {
      const fleet = new Set(INVADER_SPRITES.flatMap(([a, b]) => [a.path, b.path]));
      return Math.min(
        ...paths()
          .filter((node) => fleet.has(node.getAttribute("d") ?? ""))
          .map((node) =>
            Number.parseFloat((node.parentElement as HTMLElement).style.left),
          ),
      );
    };

    press("ArrowRight");
    const start = fleetLeft();
    // The cannon moves every tick; the fleet holds still for twenty-odd of
    // them and then jumps, which is what makes a march look like a march.
    expect(until(() => cannonX() > 0, 3)).toBe(true);
    expect(fleetLeft()).toBe(start);
    expect(until(() => fleetLeft() !== start, 40)).toBe(true);
  });

  it("shows the score, the wave and one icon per life", () => {
    mount();

    expect(screen.getByText(strings.waveLabel).parentElement?.textContent).toContain("1");
    const lives = paths().filter(
      (node) =>
        node.getAttribute("d") === CANNON_SPRITE.path &&
        !(node.parentElement as HTMLElement).style.left,
    );
    expect(lives).toHaveLength(3);
  });

  it("starts over on the new-game button", () => {
    mount();

    const start = cannonX();
    press("ArrowLeft");
    expect(until(() => cannonX() < start - 5)).toBe(true);
    release("ArrowLeft");

    act(() => {
      screen.getByRole("button", { name: strings.newGame }).click();
    });
    expect(fleetSize()).toBe(TOTAL_INVADERS);
    // A restart drops straight into play, so the ready prompt is gone.
    expect(screen.queryByText(strings.readyPrompt)).toBeNull();
  });

  /**
   * The board's CSS lives in a template literal, where a stray comment marker or
   * an unbalanced brace is invisible to tsc and eslint and silently kills every
   * rule after it. That has already shipped once in this folder.
   */
  it("injects well-formed CSS", () => {
    mount();

    const css =
      [...document.querySelectorAll("style")]
        .map((node) => node.textContent ?? "")
        .find((text) => text.includes(".invaders-blink")) ?? "";

    expect(css).toContain(".invaders-overlay");
    expect((css.match(/\/\*/g) ?? []).length).toBe((css.match(/\*\//g) ?? []).length);
    expect((css.match(/{/g) ?? []).length).toBe((css.match(/}/g) ?? []).length);
  });
});

describe("sprites", () => {
  it("keeps every bitmap rectangular", () => {
    const all = [
      ...INVADER_SPRITES.flat(),
      CANNON_SPRITE,
      SAUCER_SPRITE,
      EXPLOSION_SPRITE,
    ];
    for (const sprite of all) {
      expect(sprite.width).toBeGreaterThan(0);
      expect(sprite.height).toBeGreaterThan(0);
      expect(sprite.path).toContain("M");
    }
  });

  it("merges each row's lit pixels into one sub-path per run", () => {
    expect(spritePath(["XX.X"])).toBe("M0 0h2v1h-2zM3 0h1v1h-1z");
    expect(spritePath(["....", "...."])).toBe("");
  });

  it("gives every invader two distinct poses to animate between", () => {
    for (const [a, b] of INVADER_SPRITES) {
      expect(a.path).not.toBe(b.path);
      expect(a.width).toBe(b.width);
    }
  });
});

describe("touch steering", () => {
  it("maps a finger to the column it is over", () => {
    expect(pointerToField(40, 40, 300)).toBe(0);
    expect(pointerToField(190, 40, 300)).toBe(FIELD_WIDTH / 2);
    expect(pointerToField(340, 40, 300)).toBe(FIELD_WIDTH);
  });

  it("gives up on a field that has not been measured yet", () => {
    // The first pointer event can arrive before the screen has a size, and a
    // division by that width would park the cannon at NaN.
    expect(pointerToField(120, 0, 0)).toBeNull();
  });
});
