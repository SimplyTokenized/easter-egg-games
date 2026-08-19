/**
 * The arcade's catalogue. Adding a game means adding an entry here plus a
 * component under `games/<id>/` — nothing outside this folder changes.
 */

import type { ComponentType, LazyExoticComponent } from "react";
import { lazyWithRetry } from "../lib/lazy";
import type { EasterEggStrings } from "../strings";

export interface GameProps {
  strings: EasterEggStrings;
  /** Return to the game picker. */
  onExit: () => void;
}

export interface GameDefinition {
  id: string;
  nameKey: keyof EasterEggStrings;
  descriptionKey: keyof EasterEggStrings;
  /** Tailwind gradient stops for the tile's glow and badge. */
  accent: string;
  /** Absent means "announced, not built yet" — the tile renders disabled. */
  component?: LazyExoticComponent<ComponentType<GameProps>>;
}

export const GAMES: GameDefinition[] = [
  {
    id: "solitaire",
    nameKey: "solitaireName",
    descriptionKey: "solitaireDescription",
    accent: "from-emerald-400 to-teal-500",
    component: lazyWithRetry(() => import("./solitaire/SolitaireGame")),
  },
  {
    id: "ladder",
    nameKey: "ladderName",
    descriptionKey: "ladderDescription",
    accent: "from-emerald-300 to-green-500",
    component: lazyWithRetry(() => import("./ladder/LadderGame")),
  },
  {
    id: "snake",
    nameKey: "snakeName",
    descriptionKey: "snakeDescription",
    accent: "from-lime-400 to-green-500",
  },
  {
    id: "memory",
    nameKey: "memoryName",
    descriptionKey: "memoryDescription",
    accent: "from-violet-400 to-purple-500",
  },
  {
    id: "2048",
    nameKey: "puzzleName",
    descriptionKey: "puzzleDescription",
    accent: "from-amber-400 to-orange-500",
  },
];
