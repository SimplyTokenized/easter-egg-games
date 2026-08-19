/**
 * Klondike solitaire rules, as pure functions.
 *
 * Every mutator takes a state and returns either a brand new state or `null`
 * when the move is illegal — the component never has to know the rules, and the
 * whole thing is testable without rendering a card.
 */

export const SUITS = ["spades", "hearts", "diamonds", "clubs"] as const;
export type Suit = (typeof SUITS)[number];

export const TABLEAU_COLUMNS = 7;
export const FOUNDATION_COUNT = 4;

export interface PlayingCard {
  /** Stable across the whole game — used as the React key. */
  id: string;
  suit: Suit;
  /** 1 = Ace … 11 = Jack, 12 = Queen, 13 = King. */
  rank: number;
  faceUp: boolean;
}

export type PileRef =
  | { kind: "stock" }
  | { kind: "waste" }
  | { kind: "foundation"; index: number }
  | { kind: "tableau"; index: number };

export interface SolitaireState {
  stock: PlayingCard[];
  waste: PlayingCard[];
  foundations: PlayingCard[][];
  tableau: PlayingCard[][];
  moves: number;
}

export const isRed = (suit: Suit): boolean =>
  suit === "hearts" || suit === "diamonds";

const buildDeck = (): PlayingCard[] => {
  const deck: PlayingCard[] = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ id: `${suit}-${rank}`, suit, rank, faceUp: false });
    }
  }
  return deck;
};

/** Fisher–Yates. `random` is injectable so tests can deal a known board. */
const shuffle = (deck: PlayingCard[], random: () => number): PlayingCard[] => {
  const cards = [...deck];
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
};

export function createGame(random: () => number = Math.random): SolitaireState {
  const deck = shuffle(buildDeck(), random);
  const tableau: PlayingCard[][] = [];
  let cursor = 0;

  for (let column = 0; column < TABLEAU_COLUMNS; column++) {
    const pile: PlayingCard[] = [];
    for (let row = 0; row <= column; row++) {
      pile.push({ ...deck[cursor++], faceUp: row === column });
    }
    tableau.push(pile);
  }

  return {
    stock: deck.slice(cursor).map((card) => ({ ...card, faceUp: false })),
    waste: [],
    foundations: Array.from({ length: FOUNDATION_COUNT }, () => []),
    tableau,
    moves: 0,
  };
}

export function getPile(state: SolitaireState, ref: PileRef): PlayingCard[] {
  switch (ref.kind) {
    case "stock":
      return state.stock;
    case "waste":
      return state.waste;
    case "foundation":
      return state.foundations[ref.index] ?? [];
    case "tableau":
      return state.tableau[ref.index] ?? [];
  }
}

const topOf = (pile: PlayingCard[]): PlayingCard | undefined =>
  pile[pile.length - 1];

/** Descending rank, alternating colour — or a King onto an empty column. */
export function canStackOnTableau(
  card: PlayingCard,
  pile: PlayingCard[],
): boolean {
  const top = topOf(pile);
  if (!top) return card.rank === 13;
  return (
    top.faceUp && isRed(top.suit) !== isRed(card.suit) && top.rank === card.rank + 1
  );
}

/** Ace first, then same suit ascending. Foundations take one card at a time. */
export function canStackOnFoundation(
  card: PlayingCard,
  pile: PlayingCard[],
): boolean {
  const top = topOf(pile);
  if (!top) return card.rank === 1;
  return top.suit === card.suit && top.rank === card.rank - 1;
}

/** A run is movable when it is face up and already correctly sequenced. */
export function isMovableRun(cards: PlayingCard[]): boolean {
  if (cards.length === 0) return false;
  return cards.every((card, i) => {
    if (!card.faceUp) return false;
    if (i === 0) return true;
    const above = cards[i - 1];
    return above.rank === card.rank + 1 && isRed(above.suit) !== isRed(card.suit);
  });
}

/**
 * The cards that would travel if the player grabbed `index` of `from`.
 * Only the tableau hands over more than one card.
 */
export function getMovableRun(
  state: SolitaireState,
  from: PileRef,
  index: number,
): PlayingCard[] | null {
  const pile = getPile(state, from);
  if (index < 0 || index >= pile.length) return null;

  if (from.kind === "stock") return null;
  if (from.kind === "waste" || from.kind === "foundation") {
    return index === pile.length - 1 ? [pile[index]] : null;
  }

  const run = pile.slice(index);
  return isMovableRun(run) ? run : null;
}

const withPile = (
  state: SolitaireState,
  ref: PileRef,
  cards: PlayingCard[],
): SolitaireState => {
  switch (ref.kind) {
    case "stock":
      return { ...state, stock: cards };
    case "waste":
      return { ...state, waste: cards };
    case "foundation":
      return {
        ...state,
        foundations: state.foundations.map((pile, i) =>
          i === ref.index ? cards : pile,
        ),
      };
    case "tableau":
      return {
        ...state,
        tableau: state.tableau.map((pile, i) => (i === ref.index ? cards : pile)),
      };
  }
};

const samePile = (a: PileRef, b: PileRef): boolean =>
  a.kind === b.kind &&
  ("index" in a ? a.index : -1) === ("index" in b ? b.index : -1);

/** Turning over whatever the departing run was resting on. */
const revealTop = (pile: PlayingCard[]): PlayingCard[] => {
  const top = topOf(pile);
  if (!top || top.faceUp) return pile;
  return [...pile.slice(0, -1), { ...top, faceUp: true }];
};

export function moveCards(
  state: SolitaireState,
  from: PileRef,
  index: number,
  to: PileRef,
): SolitaireState | null {
  if (samePile(from, to)) return null;
  if (to.kind === "stock") return null;
  if (to.kind === "waste") return null;

  const run = getMovableRun(state, from, index);
  if (!run) return null;

  const target = getPile(state, to);
  if (to.kind === "foundation") {
    if (run.length !== 1 || !canStackOnFoundation(run[0], target)) return null;
  } else if (!canStackOnTableau(run[0], target)) {
    return null;
  }

  const sourceRemainder = getPile(state, from).slice(0, index);
  let next = withPile(
    state,
    from,
    from.kind === "tableau" ? revealTop(sourceRemainder) : sourceRemainder,
  );
  next = withPile(next, to, [...target, ...run]);
  return { ...next, moves: state.moves + 1 };
}

/** Double-click shortcut: send a single card to whichever foundation takes it. */
export function sendToFoundation(
  state: SolitaireState,
  from: PileRef,
  index: number,
): SolitaireState | null {
  const pile = getPile(state, from);
  if (index !== pile.length - 1) return null;

  const card = pile[index];
  if (!card?.faceUp) return null;

  for (let i = 0; i < state.foundations.length; i++) {
    if (canStackOnFoundation(card, state.foundations[i])) {
      const moved = moveCards(state, from, index, { kind: "foundation", index: i });
      if (moved) return moved;
    }
  }
  return null;
}

/** Deal one card to the waste, or flip the waste back when the stock runs dry. */
export function drawFromStock(state: SolitaireState): SolitaireState | null {
  if (state.stock.length > 0) {
    const card = state.stock[state.stock.length - 1];
    return {
      ...state,
      stock: state.stock.slice(0, -1),
      waste: [...state.waste, { ...card, faceUp: true }],
      moves: state.moves + 1,
    };
  }

  if (state.waste.length === 0) return null;
  return {
    ...state,
    stock: [...state.waste].reverse().map((card) => ({ ...card, faceUp: false })),
    waste: [],
    moves: state.moves + 1,
  };
}

/** True once nothing is face down — from here the board plays itself out. */
export function canAutoComplete(state: SolitaireState): boolean {
  if (isWon(state)) return false;
  if (state.stock.length > 0 || state.waste.length > 0) return false;
  return state.tableau.every((pile) => pile.every((card) => card.faceUp));
}

/** One step of the auto-finish, so the caller can animate it card by card. */
export function autoCompleteStep(state: SolitaireState): SolitaireState | null {
  for (let column = 0; column < state.tableau.length; column++) {
    const pile = state.tableau[column];
    if (pile.length === 0) continue;
    const moved = sendToFoundation(state, { kind: "tableau", index: column }, pile.length - 1);
    if (moved) return moved;
  }
  return null;
}

export function isWon(state: SolitaireState): boolean {
  return state.foundations.every((pile) => pile.length === 13);
}

const RANK_LABELS: Record<number, string> = {
  1: "A",
  11: "J",
  12: "Q",
  13: "K",
};

export const rankLabel = (rank: number): string =>
  RANK_LABELS[rank] ?? String(rank);

export const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};
