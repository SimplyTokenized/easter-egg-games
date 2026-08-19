import { Suspense } from "react";
import { lazyWithRetry } from "./lib/lazy";

/**
 * Code-split boundary for the arcade.
 *
 * This file is the only part of the package a host application pays for up
 * front, and it is a few lines of glue: the modal, the games and the beach
 * animation all live behind this `import()` and are fetched the first time
 * someone actually reaches six clicks.
 */
const ArcadeModal = lazyWithRetry(() => import("./ArcadeModal"));

export interface EasterEggArcadeProps {
  open: boolean;
  onClose: () => void;
  /**
   * BCP-47 tag from the host, e.g. `de` or `de-AT`. Anything unrecognised
   * falls back to English. The arcade carries its own strings, so this is the
   * whole of its i18n contract.
   */
  language?: string;
}

export const EasterEggArcade = ({ open, onClose, language }: EasterEggArcadeProps) => {
  // Not mounted at all while closed — no dialog, no listeners, no work.
  if (!open) return null;

  return (
    <Suspense fallback={null}>
      <ArcadeModal open onClose={onClose} language={language} />
    </Suspense>
  );
};
