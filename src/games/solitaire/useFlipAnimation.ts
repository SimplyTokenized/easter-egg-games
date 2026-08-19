import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type RefObject,
} from "react";

/** Apple's standard "arrive softly" curve — fast out, gentle settle. */
const EASING = "cubic-bezier(0.22, 1, 0.36, 1)";
const MOVE_MS = 280;
const FLIP_MS = 320;

interface Snapshot {
  left: number;
  top: number;
  faceUp: boolean;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Where the element sits according to layout, with any `transform` backed out.
 *
 * `getBoundingClientRect()` includes the transform, so measuring a card that is
 * mid-animation (or mid-drag) records a position that is not its resting place.
 * Without this correction, any re-render landing mid-flight would read a card's
 * own animation as movement and start another one on top of it.
 */
/** Marks our own animations so we never cancel a CSS transition by accident. */
const FLIP_ID = "solitaire-flip";

/**
 * Everything one mounted board has in flight, so unmounting can stop all of it.
 * Closing the arcade mid-move otherwise leaves a timer per moved card holding a
 * detached node alive, and leaves the animations themselves running on elements
 * nobody will ever see again.
 */
interface InFlight {
  timers: Set<number>;
  animations: Set<Animation>;
}

/**
 * Replace any FLIP animation still running on this card, then clean up after
 * ourselves. Without the cancel, finished animations pile up on the element and
 * a fast sequence of moves leaves several fighting over `transform`.
 */
const play = (
  node: HTMLElement,
  frames: Keyframe[],
  duration: number,
  inFlight: InFlight,
): void => {
  for (const existing of node.getAnimations()) {
    if (existing.id === FLIP_ID) existing.cancel();
  }
  const animation = node.animate(frames, { duration, easing: EASING, id: FLIP_ID });
  inFlight.animations.add(animation);

  const done = () => {
    animation.cancel();
    inFlight.animations.delete(animation);
  };
  animation.onfinish = done;

  // Hard stop. An animation only advances while the page is compositing, so a
  // backgrounded tab can leave one sitting at its first keyframe indefinitely —
  // and that keyframe is the card's *old* position, so it parks mid-flight on
  // top of the board. Timers keep running there, and because these animations
  // do not fill, cancelling always snaps the card back to its real place.
  const timer = window.setTimeout(() => {
    inFlight.timers.delete(timer);
    if (animation.playState !== "idle") done();
  }, duration + 400);
  inFlight.timers.add(timer);
};

const layoutPosition = (node: HTMLElement): { left: number; top: number } => {
  const rect = node.getBoundingClientRect();
  const transform = window.getComputedStyle(node).transform;
  if (!transform || transform === "none") return { left: rect.left, top: rect.top };
  try {
    const matrix = new DOMMatrixReadOnly(transform);
    return { left: rect.left - matrix.m41, top: rect.top - matrix.m42 };
  } catch {
    return { left: rect.left, top: rect.top };
  }
};

/**
 * FLIP animation for the cards.
 *
 * React re-renders each card straight into its new home; without this the whole
 * board teleports. We measure every `[data-card-id]` after each render, compare
 * against the previous frame and play the difference backwards, so a card
 * appears to glide from where it was to where it now is. Cards that turned over
 * get a flip instead.
 *
 * Runs on every render by design — that is what makes it see each move.
 *
 * Returns `markPositions`, which re-records the given cards where they are
 * right now. Dragging needs it: the card is under the finger, not on the pile
 * React last rendered it to, and without this the drop would animate from the
 * old pile instead of from the hand.
 */
export function useFlipAnimation(containerRef: RefObject<HTMLElement | null>): {
  markPositions: (ids: string[]) => void;
} {
  const previous = useRef(new Map<string, Snapshot>());
  const isFirstRender = useRef(true);
  const inFlight = useRef<InFlight>({ timers: new Set(), animations: new Set() });

  // Leaving the board — closing the arcade, or stepping back to the picker —
  // stops every animation and drops every watchdog timer we started.
  useEffect(() => {
    const pending = inFlight.current;
    return () => {
      for (const timer of pending.timers) window.clearTimeout(timer);
      pending.timers.clear();
      for (const animation of pending.animations) animation.cancel();
      pending.animations.clear();
    };
  }, []);

  const markPositions = useCallback(
    (ids: string[]) => {
      const root = containerRef.current;
      if (!root) return;
      for (const id of ids) {
        const node = root.querySelector<HTMLElement>(`[data-card-id="${id}"]`);
        if (!node) continue;
        // Deliberately the *visual* rect here, transform included: that is
        // where the finger left the card, and where the drop should start.
        const rect = node.getBoundingClientRect();
        previous.current.set(id, {
          left: rect.left,
          top: rect.top,
          faceUp: node.dataset.faceUp === "true",
        });
      }
    },
    [containerRef],
  );

  useLayoutEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const nodes = root.querySelectorAll<HTMLElement>("[data-card-id]");
    const next = new Map<string, Snapshot>();
    const skipAnimation = isFirstRender.current || prefersReducedMotion();

    for (const node of nodes) {
      const id = node.dataset.cardId;
      if (!id) continue;

      const position = layoutPosition(node);
      const faceUp = node.dataset.faceUp === "true";
      next.set(id, { left: position.left, top: position.top, faceUp });

      if (skipAnimation) continue;
      const before = previous.current.get(id);
      if (!before) continue;

      const dx = before.left - position.left;
      const dy = before.top - position.top;
      const moved = Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5;
      const turnedOver = !before.faceUp && faceUp;

      if (moved) {
        // Travelling cards ride above the pile they are leaving.
        play(
          node,
          [
            { transform: `translate(${dx}px, ${dy}px)`, zIndex: 60 },
            { transform: "translate(0, 0)", zIndex: 60 },
          ],
          MOVE_MS,
          inFlight.current,
        );
      } else if (turnedOver) {
        play(
          node,
          [
            { transform: "rotateY(-90deg) scale(0.94)" },
            { transform: "rotateY(0deg) scale(1)" },
          ],
          FLIP_MS,
          inFlight.current,
        );
      }
    }

    previous.current = next;
    isFirstRender.current = false;
  });

  return { markPositions };
}
