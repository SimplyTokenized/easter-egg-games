import { describe, expect, it } from "vitest";
import {
  canStackOnFoundation,
  canStackOnTableau,
  createGame,
  drawFromStock,
  getMovableRun,
  isMovableRun,
  isWon,
  moveCards,
  sendToFoundation,
  type PlayingCard,
  type SolitaireState,
  type Suit,
} from "@easter-egg/games/solitaire/engine";

const card = (suit: Suit, rank: number, faceUp = true): PlayingCard => ({
  id: `${suit}-${rank}`,
  suit,
  rank,
  faceUp,
});

/** An empty board that individual tests fill in with just what they need. */
const emptyState = (overrides: Partial<SolitaireState> = {}): SolitaireState => ({
  stock: [],
  waste: [],
  foundations: [[], [], [], []],
  tableau: [[], [], [], [], [], [], []],
  moves: 0,
  ...overrides,
});

describe("solitaire engine — dealing", () => {
  it("deals 28 cards into seven columns and keeps the rest in the stock", () => {
    const state = createGame();

    expect(state.tableau).toHaveLength(7);
    state.tableau.forEach((pile, index) => expect(pile).toHaveLength(index + 1));
    expect(state.stock).toHaveLength(24);
    expect(state.waste).toEqual([]);
  });

  it("turns over exactly one card per column", () => {
    const state = createGame();

    for (const pile of state.tableau) {
      expect(pile.filter((c) => c.faceUp)).toHaveLength(1);
      expect(pile[pile.length - 1].faceUp).toBe(true);
    }
  });

  it("uses all 52 distinct cards", () => {
    const state = createGame();
    const ids = [...state.stock, ...state.tableau.flat()].map((c) => c.id);

    expect(new Set(ids).size).toBe(52);
  });
});

describe("solitaire engine — stacking rules", () => {
  it("only accepts a King on an empty column", () => {
    expect(canStackOnTableau(card("spades", 13), [])).toBe(true);
    expect(canStackOnTableau(card("spades", 12), [])).toBe(false);
  });

  it("requires descending rank and alternating colour on the tableau", () => {
    const blackNine = [card("spades", 9)];

    expect(canStackOnTableau(card("hearts", 8), blackNine)).toBe(true);
    expect(canStackOnTableau(card("clubs", 8), blackNine)).toBe(false);
    expect(canStackOnTableau(card("hearts", 7), blackNine)).toBe(false);
  });

  it("will not stack on a face-down tableau card", () => {
    expect(canStackOnTableau(card("hearts", 8), [card("spades", 9, false)])).toBe(false);
  });

  it("starts foundations at an Ace and continues by suit", () => {
    expect(canStackOnFoundation(card("hearts", 1), [])).toBe(true);
    expect(canStackOnFoundation(card("hearts", 2), [])).toBe(false);

    const heartAce = [card("hearts", 1)];
    expect(canStackOnFoundation(card("hearts", 2), heartAce)).toBe(true);
    expect(canStackOnFoundation(card("diamonds", 2), heartAce)).toBe(false);
    expect(canStackOnFoundation(card("hearts", 3), heartAce)).toBe(false);
  });
});

describe("solitaire engine — movable runs", () => {
  it("accepts a correctly sequenced face-up run", () => {
    expect(
      isMovableRun([card("spades", 9), card("hearts", 8), card("clubs", 7)]),
    ).toBe(true);
  });

  it("rejects same-colour or out-of-order runs", () => {
    expect(isMovableRun([card("spades", 9), card("clubs", 8)])).toBe(false);
    expect(isMovableRun([card("spades", 9), card("hearts", 7)])).toBe(false);
    expect(isMovableRun([card("spades", 9, false), card("hearts", 8)])).toBe(false);
  });

  it("hands over only the top card of the waste", () => {
    const state = emptyState({ waste: [card("hearts", 4), card("spades", 5)] });

    expect(getMovableRun(state, { kind: "waste" }, 1)).toHaveLength(1);
    expect(getMovableRun(state, { kind: "waste" }, 0)).toBeNull();
  });
});

describe("solitaire engine — moving cards", () => {
  it("moves a run and turns over the card it uncovers", () => {
    const state = emptyState({
      tableau: [
        [card("diamonds", 4, false), card("spades", 9), card("hearts", 8)],
        [card("hearts", 10)],
        [],
        [],
        [],
        [],
        [],
      ],
    });

    const next = moveCards(state, { kind: "tableau", index: 0 }, 1, {
      kind: "tableau",
      index: 1,
    });

    expect(next).not.toBeNull();
    expect(next!.tableau[1].map((c) => c.id)).toEqual([
      "hearts-10",
      "spades-9",
      "hearts-8",
    ]);
    expect(next!.tableau[0]).toHaveLength(1);
    expect(next!.tableau[0][0].faceUp).toBe(true);
    expect(next!.moves).toBe(1);
  });

  it("leaves the original state untouched", () => {
    const state = emptyState({
      tableau: [[card("spades", 13)], [], [], [], [], [], []],
    });

    moveCards(state, { kind: "tableau", index: 0 }, 0, { kind: "tableau", index: 1 });

    expect(state.tableau[0]).toHaveLength(1);
    expect(state.tableau[1]).toHaveLength(0);
    expect(state.moves).toBe(0);
  });

  it("refuses illegal destinations", () => {
    const state = emptyState({
      tableau: [[card("spades", 9)], [card("clubs", 10)], [], [], [], [], []],
    });

    expect(
      moveCards(state, { kind: "tableau", index: 0 }, 0, { kind: "tableau", index: 1 }),
    ).toBeNull();
  });

  it("never moves a multi-card run onto a foundation", () => {
    const state = emptyState({
      foundations: [[card("hearts", 1)], [], [], []],
      tableau: [[card("spades", 3), card("hearts", 2)], [], [], [], [], [], []],
    });

    expect(
      moveCards(state, { kind: "tableau", index: 0 }, 0, { kind: "foundation", index: 0 }),
    ).toBeNull();
  });
});

describe("solitaire engine — stock", () => {
  it("deals one card face up to the waste", () => {
    const state = emptyState({
      stock: [card("hearts", 5, false), card("spades", 6, false)],
    });

    const next = drawFromStock(state)!;

    expect(next.stock).toHaveLength(1);
    expect(next.waste).toHaveLength(1);
    expect(next.waste[0]).toMatchObject({ id: "spades-6", faceUp: true });
  });

  it("recycles the waste face down once the stock is empty", () => {
    const state = emptyState({
      waste: [card("hearts", 5), card("spades", 6)],
    });

    const next = drawFromStock(state)!;

    expect(next.waste).toEqual([]);
    expect(next.stock.map((c) => c.id)).toEqual(["spades-6", "hearts-5"]);
    expect(next.stock.every((c) => !c.faceUp)).toBe(true);
  });

  it("does nothing when stock and waste are both empty", () => {
    expect(drawFromStock(emptyState())).toBeNull();
  });
});

describe("solitaire engine — foundation shortcut and winning", () => {
  it("sends a card to whichever foundation accepts it", () => {
    const state = emptyState({
      foundations: [[], [card("hearts", 1)], [], []],
      tableau: [[card("hearts", 2)], [], [], [], [], [], []],
    });

    const next = sendToFoundation(state, { kind: "tableau", index: 0 }, 0)!;

    expect(next.foundations[1].map((c) => c.id)).toEqual(["hearts-1", "hearts-2"]);
    expect(next.tableau[0]).toEqual([]);
  });

  it("only takes the top card of a pile", () => {
    const state = emptyState({
      tableau: [[card("hearts", 1), card("spades", 5)], [], [], [], [], [], []],
    });

    expect(sendToFoundation(state, { kind: "tableau", index: 0 }, 0)).toBeNull();
  });

  it("reports a win only when all four foundations are complete", () => {
    const full = (suit: Suit) =>
      Array.from({ length: 13 }, (_, i) => card(suit, i + 1));

    expect(isWon(emptyState())).toBe(false);
    expect(
      isWon(
        emptyState({
          foundations: [
            full("spades"),
            full("hearts"),
            full("diamonds"),
            full("clubs"),
          ],
        }),
      ),
    ).toBe(true);
  });
});
