import { useCallback, useRef, useState } from "react";

/** Clicks on the logo needed to open the arcade. */
const CLICKS_TO_UNLOCK = 6;
/** Consecutive clicks must land within this gap, so stray clicks never add up. */
const CLICK_WINDOW_MS = 1200;
/** Halfway there — start fetching the chunk so the modal opens instantly. */
const WARM_UP_AT = 3;

export interface LogoEasterEgg {
  arcadeOpen: boolean;
  closeArcade: () => void;
  /** Call from the logo's existing onClick; it does nothing until the 6th click. */
  registerLogoClick: () => void;
}

/**
 * Counts rapid clicks on the app logo and opens the hidden arcade on the sixth.
 *
 * The counter lives in refs, so ordinary logo clicks cause no re-render and the
 * header behaves exactly as before until the egg actually fires.
 */
export function useLogoEasterEgg(): LogoEasterEgg {
  const [arcadeOpen, setArcadeOpen] = useState(false);
  const clicks = useRef(0);
  const lastClickAt = useRef(0);

  const registerLogoClick = useCallback(() => {
    const now = Date.now();
    clicks.current =
      now - lastClickAt.current > CLICK_WINDOW_MS ? 1 : clicks.current + 1;
    lastClickAt.current = now;

    if (clicks.current === WARM_UP_AT) {
      // Same module the lazy boundary imports, so this only warms the cache.
      void import("./ArcadeModal").catch(() => {
        /* Prefetch is best effort; the Suspense boundary retries on open. */
      });
    }

    if (clicks.current >= CLICKS_TO_UNLOCK) {
      clicks.current = 0;
      setArcadeOpen(true);
    }
  }, []);

  const closeArcade = useCallback(() => setArcadeOpen(false), []);

  return { arcadeOpen, closeArcade, registerLogoClick };
}
