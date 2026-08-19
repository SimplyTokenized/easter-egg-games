import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
} from "react";
import { getMovableRun, moveCards, type PileRef, type SolitaireState } from "./engine";

/** Movement below this is a tap, not a drag. */
const DRAG_THRESHOLD_PX = 5;
/** How far off a pile a drop may land and still count. */
const DROP_TOLERANCE_PX = 90;

/** `tableau-3` → `{ kind: "tableau", index: 3 }` */
const parsePile = (value: string | undefined): PileRef | null => {
  if (!value) return null;
  const [kind, index] = value.split("-");
  if (kind === "stock") return { kind: "stock" };
  if (kind === "waste") return { kind: "waste" };
  if (kind === "foundation") return { kind: "foundation", index: Number(index) };
  if (kind === "tableau") return { kind: "tableau", index: Number(index) };
  return null;
};

interface DragSession {
  from: PileRef;
  index: number;
  ids: string[];
  startX: number;
  startY: number;
  pointerId: number;
  moved: boolean;
}

interface UseCardDragOptions {
  boardRef: RefObject<HTMLElement | null>;
  state: SolitaireState;
  commit: (next: SolitaireState) => void;
  clearSelection: () => void;
  /** From `useFlipAnimation` — lets the drop animate from the hand. */
  markPositions: (ids: string[]) => void;
}

export interface CardDragHandlers {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLElement>) => void;
}

/**
 * Drag and drop for the cards, alongside the existing tap-tap and double-tap.
 *
 * The dragged run is moved by writing `transform` straight onto the DOM nodes
 * rather than through React state — a re-render per pointer event would make
 * the FLIP hook re-measure the whole board sixty times a second and stutter.
 * React only hears about it once, on drop.
 */
export function useCardDrag({
  boardRef,
  state,
  commit,
  clearSelection,
  markPositions,
}: UseCardDragOptions): {
  getHandlers: (pile: PileRef, index: number) => CardDragHandlers;
  isDragging: boolean;
  /** Ids of the cards in hand, so the board can lift them above the rest. */
  heldIds: string[];
  /** True right after a drag, so the trailing click does not also fire. */
  consumeDragClick: () => boolean;
} {
  const session = useRef<DragSession | null>(null);
  const suppressClick = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  /**
   * Cards currently in hand. This is state rather than a direct style write
   * because React owns `zIndex` on the cards: setting it on the node behind
   * React's back leaves the DOM without a z-index once the drag ends, and the
   * card drops behind the pile it came from.
   */
  const [heldIds, setHeldIds] = useState<string[]>([]);
  // Forces the one re-render a rejected drop needs, so FLIP can snap it back.
  const [, setTick] = useState(0);

  const nodesFor = useCallback(
    (ids: string[]): HTMLElement[] => {
      const root = boardRef.current;
      if (!root) return [];
      return ids
        .map((id) => root.querySelector<HTMLElement>(`[data-card-id="${id}"]`))
        .filter((node): node is HTMLElement => !!node);
    },
    [boardRef],
  );

  const clearDragStyles = useCallback(
    (ids: string[]) => {
      for (const node of nodesFor(ids)) {
        // Only properties React does not set in the style prop may be cleared
        // here. `zIndex` is React's — see `heldIds` below.
        node.style.transform = "";
        node.style.pointerEvents = "";
        node.style.willChange = "";
      }
    },
    [nodesFor],
  );

  /** Nearest pile to the drop point, within tolerance. */
  const findDropTarget = useCallback(
    (x: number, y: number): PileRef | null => {
      const root = boardRef.current;
      if (!root) return null;

      let best: string | undefined;
      let bestDistance = Number.POSITIVE_INFINITY;

      for (const node of root.querySelectorAll<HTMLElement>("[data-pile]")) {
        const rect = node.getBoundingClientRect();
        const nearestX = Math.max(rect.left, Math.min(x, rect.right));
        const nearestY = Math.max(rect.top, Math.min(y, rect.bottom));
        const distance = Math.hypot(x - nearestX, y - nearestY);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = node.dataset.pile;
        }
      }

      return bestDistance <= DROP_TOLERANCE_PX ? parsePile(best) : null;
    },
    [boardRef],
  );

  /**
   * Put a half-finished drag back. Reachable from the cancel handler and from
   * the window-level safety net below: if a drag is ever left hanging, its
   * cards keep `pointerEvents: none` and become unclickable, which looks like
   * the board has locked up.
   */
  const abortDrag = useCallback(() => {
    const drag = session.current;
    if (!drag) return;
    session.current = null;
    setIsDragging(false);
    setHeldIds([]);
    clearDragStyles(drag.ids);
    if (drag.moved) {
      suppressClick.current = true;
      setTick((tick) => tick + 1);
    }
  }, [clearDragStyles]);

  // Pointer capture normally guarantees pointerup, but a cancelled gesture, a
  // context menu or a card unmounting mid-drag can all swallow it.
  useEffect(() => {
    const onWindowEnd = () => {
      if (session.current) abortDrag();
    };
    // `pointerup` belongs here too. The card's own handler runs first (React
    // listens on the root, which is inside window's bubble path), so a normal
    // drop has already cleared the session by the time this fires and it does
    // nothing. It only bites when the card unmounted mid-gesture and no handler
    // ran at all — the case the comment above describes.
    window.addEventListener("pointerup", onWindowEnd);
    window.addEventListener("pointercancel", onWindowEnd);
    window.addEventListener("blur", onWindowEnd);
    return () => {
      window.removeEventListener("pointerup", onWindowEnd);
      window.removeEventListener("pointercancel", onWindowEnd);
      window.removeEventListener("blur", onWindowEnd);
    };
  }, [abortDrag]);

  const onPointerDown = useCallback(
    (pile: PileRef, index: number) => (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const run = getMovableRun(state, pile, index);
      if (!run) return;

      // Keeps the browser from focusing the card (which would leave a focus
      // ring stuck on it after the drag) and from starting a text selection.
      event.preventDefault();

      session.current = {
        from: pile,
        index,
        ids: run.map((card) => card.id),
        startX: event.clientX,
        startY: event.clientY,
        pointerId: event.pointerId,
        moved: false,
      };

      // Synthetic or already-released pointers make this throw; a failed
      // capture only costs us events outside the card, never correctness.
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* keep going without capture */
      }
    },
    [state],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const drag = session.current;
      if (!drag || drag.pointerId !== event.pointerId) return;

      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;

      if (!drag.moved) {
        drag.moved = true;
        setIsDragging(true);
        setHeldIds(drag.ids);
        clearSelection();
      }

      for (const node of nodesFor(drag.ids)) {
        node.style.transform = `translate(${dx}px, ${dy}px)`;
        // So the drop test hits the pile underneath, not the card in hand.
        node.style.pointerEvents = "none";
        // Promoted only while it is actually moving; cleared in clearDragStyles.
        node.style.willChange = "transform";
      }
    },
    [clearSelection, nodesFor],
  );

  const onPointerUp = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const drag = session.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      session.current = null;

      if (!drag.moved) return; // A tap — the click handler deals with it.

      setIsDragging(false);
      setHeldIds([]);
      suppressClick.current = true;

      // Record where the cards actually are (under the finger) before the
      // transforms come off, so the drop animates from there.
      markPositions(drag.ids);
      clearDragStyles(drag.ids);

      const target = findDropTarget(event.clientX, event.clientY);
      const next = target
        ? moveCards(state, drag.from, drag.index, target)
        : null;

      if (next) {
        commit(next);
      } else {
        // Rejected: one render is enough for FLIP to glide it home.
        setTick((tick) => tick + 1);
      }
    },
    [clearDragStyles, commit, findDropTarget, markPositions, state],
  );

  const getHandlers = useCallback(
    (pile: PileRef, index: number): CardDragHandlers => ({
      onPointerDown: onPointerDown(pile, index),
      onPointerMove,
      onPointerUp,
      onPointerCancel: abortDrag,
    }),
    [abortDrag, onPointerDown, onPointerMove, onPointerUp],
  );

  const consumeDragClick = useCallback(() => {
    if (!suppressClick.current) return false;
    suppressClick.current = false;
    return true;
  }, []);

  return { getHandlers, isDragging, heldIds, consumeDragClick };
}
