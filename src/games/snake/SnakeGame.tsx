import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Pause, RotateCcw } from "lucide-react";
import { cn } from "../../lib/cn";
import type { GameProps } from "../registry";
import {
  clampSize,
  createGame,
  directionToward,
  step,
  tickInterval,
  turn,
  type BoardSize,
  type Direction,
  type Point,
  type SnakeState,
} from "./engine";

/**
 * Most ticks the loop replays after a stall. A hidden tab hands back a large
 * time debt on its first frame; without the cap the snake would sprint through
 * a dozen cells at once and usually into a wall.
 */
const MAX_CATCHUP_TICKS = 3;

/**
 * Roughly how many cells the board's shorter side gets, and the range a cell is
 * allowed to fall in. Together these turn any slot into a grid: a phone held
 * upright gets a tall board, a laptop a wide one, and the cells stay square and
 * big enough to aim at either way.
 */
const CELLS_ACROSS_SHORT_SIDE = 16;
const MIN_CELL_PX = 16;
const MAX_CELL_PX = 44;

const CSS = `
@keyframes snake-overlay-in {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes snake-food-pulse {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(0.82); }
}
.snake-overlay { animation: snake-overlay-in 320ms cubic-bezier(0.22, 1, 0.36, 1) both; }
.snake-food    { animation: snake-food-pulse 1.1s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .snake-overlay, .snake-food { animation: none; }
  .snake-segment { transition: none !important; }
}
`;

const KEY_MAP: Record<string, Direction | "pause"> = {
  arrowup: "up",
  w: "up",
  arrowdown: "down",
  s: "down",
  arrowleft: "left",
  a: "left",
  arrowright: "right",
  d: "right",
  " ": "pause",
};

/** Which way the head faces; the eyes are drawn on its leading edge. */
const HEAD_ROTATION: Record<Direction, number> = {
  right: 0,
  down: 90,
  left: 180,
  up: 270,
};

const Readout = ({ label, value }: { label: string; value: string }) => (
  <span className="flex items-baseline gap-1.5">
    <span className="text-[11px] uppercase tracking-wider text-lime-500/70">
      {label}
    </span>
    <span className="text-sm font-semibold tabular-nums text-lime-100">
      {value}
    </span>
  </span>
);

/**
 * One board cell.
 *
 * Segments are keyed by their index in the snake, which is what makes the
 * animation free: on every tick segment `i` inherits segment `i-1`'s old cell,
 * one step away, so a plain CSS transition carries it there. Keying by a
 * segment identity instead would teleport the tail across the board.
 */
const Cell = ({ row, col, role, size, animate, children }: {
  row: number;
  col: number;
  /** Labels the cell for the tests; nothing in the game reads it. */
  role: "head" | "body" | "food";
  size: BoardSize;
  animate: boolean;
  children?: ReactNode;
}) => (
  <div
    aria-hidden
    data-cell={`${row},${col}`}
    data-role={role}
    className={cn("absolute left-0 top-0", animate && "snake-segment")}
    style={{
      width: `${100 / size.cols}%`,
      height: `${100 / size.rows}%`,
      // Percentages of the element's own size, so one cell is one step.
      transform: `translate(${col * 100}%, ${row * 100}%)`,
      transition: animate ? "transform var(--snake-tick) linear" : undefined,
      willChange: animate ? "transform" : undefined,
    }}
  >
    {children}
  </div>
);

export const SnakeGame = ({ strings }: GameProps) => {
  const [state, setState] = useState<SnakeState>(() => createGame());
  const [best, setBest] = useState(0);

  /**
   * The authoritative state, kept alongside React's copy: the loop needs the
   * result of a tick to compute the next one, and `setState` cannot hand that
   * back synchronously.
   */
  const live = useRef(state);
  const apply = useCallback((next: SnakeState) => {
    live.current = next;
    setState(next);
  }, []);

  const { status } = state;
  const tickMs = tickInterval(state);

  /**
   * Where the player is pointing, in cells.
   *
   * This is the whole of the touch control: no pad, no swipe vocabulary — the
   * snake heads for wherever the finger or cursor is. `null` means the pointer
   * has not been used yet, or that the keyboard has taken over.
   */
  const aim = useRef<Point | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  /** Measure the slot the board has to live in. */
  const slotRef = useRef<HTMLDivElement>(null);
  const [slot, setSlot] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const node = slotRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSlot({ width, height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /** The grid the *next* game will be played on, derived from that slot. */
  const nextSize = useMemo((): BoardSize | null => {
    if (slot.width < 1 || slot.height < 1) return null;
    const shortSide = Math.min(slot.width, slot.height);
    const cell = Math.max(
      MIN_CELL_PX,
      Math.min(MAX_CELL_PX, Math.round(shortSide / CELLS_ACROSS_SHORT_SIDE)),
    );
    return clampSize({
      cols: Math.floor(slot.width / cell),
      rows: Math.floor(slot.height / cell),
    });
  }, [slot.height, slot.width]);
  const sizeRef = useRef(state.size);
  if (nextSize) sizeRef.current = nextSize;

  const newGame = useCallback(
    () => apply(createGame(Math.random, sizeRef.current)),
    [apply],
  );

  /**
   * Take on a newly measured grid, but only between runs.
   *
   * Resizing the board mid-run would move the walls while the snake is running
   * at them, so a rotation part-way through a game is left to letterbox and the
   * new shape waits for the next one.
   */
  useEffect(() => {
    if (!nextSize || live.current.status !== "ready") return;
    const { size } = live.current;
    if (size.cols === nextSize.cols && size.rows === nextSize.rows) return;
    apply(createGame(Math.random, nextSize));
  }, [apply, nextSize]);

  /** Any control wakes a waiting board and lifts a pause. */
  const beginPlay = useCallback(() => {
    const current = live.current;
    if (current.status === "ready" || current.status === "paused") {
      apply({ ...current, status: "playing" });
    }
  }, [apply]);

  const togglePause = useCallback(() => {
    const current = live.current;
    if (current.status === "playing") apply({ ...current, status: "paused" });
    else beginPlay();
  }, [apply, beginPlay]);

  /**
   * The clock: a fixed timestep driven by animation frames.
   *
   * `setInterval` is the wrong tool here — the browser lets missed callbacks
   * pile up and then runs them back to back, which reads as a stall followed by
   * a sprint. Frames pace evenly, stop by themselves when the tab is hidden,
   * and the accumulator below is capped so a long gap costs a few ticks at most.
   * The interval is re-read every tick because each apple shortens it.
   */
  useEffect(() => {
    if (status !== "playing") return;

    let frameId = 0;
    let previous: number | null = null;
    let debt = 0;

    const advance = () => {
      let next = live.current;
      // The pointer is read once per tick rather than on every move event: a
      // finger produces far more events than there are ticks, and only the
      // position at the moment of the step can matter.
      const target = aim.current;
      if (target) {
        const direction = directionToward(next, target);
        if (direction) next = turn(next, direction);
      }
      apply(step(next));
    };

    const frame = (now: number) => {
      frameId = requestAnimationFrame(frame);

      // The first frame only establishes a baseline; its timestamp origin is
      // not comparable to anything recorded before the loop started.
      if (previous === null) {
        previous = now;
        return;
      }

      debt = Math.min(
        debt + (now - previous),
        tickInterval(live.current) * MAX_CATCHUP_TICKS,
      );
      previous = now;

      while (live.current.status === "playing") {
        const ms = tickInterval(live.current);
        if (debt < ms) break;
        debt -= ms;
        advance();
      }
    };

    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  }, [apply, status]);

  // A run is over: remember how far it got.
  useEffect(() => {
    if (status === "dead" || status === "won") {
      setBest((previous) => Math.max(previous, state.score));
    }
  }, [state.score, status]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = KEY_MAP[event.key.toLowerCase()];
      if (!action) return;
      // Arrows and space would otherwise scroll the arcade behind the board.
      event.preventDefault();
      if (action === "pause") {
        togglePause();
        return;
      }
      // Whichever input was used last is the one steering; a cursor left lying
      // on the board must not fight the arrow keys.
      aim.current = null;
      apply(turn(live.current, action));
      beginPlay();
    };
    // Walking away mid-run should not cost a run's worth of progress.
    const onBlur = () => {
      if (live.current.status === "playing") {
        apply({ ...live.current, status: "paused" });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onBlur);
    };
  }, [apply, beginPlay, togglePause]);

  const trackPointer = useCallback((event: ReactPointerEvent) => {
    const node = boardRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const { size } = live.current;
    const col = Math.floor(((event.clientX - rect.left) / rect.width) * size.cols);
    const row = Math.floor(((event.clientY - rect.top) / rect.height) * size.rows);
    aim.current = {
      row: Math.max(0, Math.min(size.rows - 1, row)),
      col: Math.max(0, Math.min(size.cols - 1, col)),
    };
  }, []);

  // A press aims and starts; a bare move only aims, so a cursor drifting across
  // the board cannot set a waiting game running.
  const onPointerDown = useCallback(
    (event: ReactPointerEvent) => {
      trackPointer(event);
      beginPlay();
    },
    [beginPlay, trackPointer],
  );

  /**
   * Fit the run's grid to the slot, keeping cells square.
   *
   * CSS alone cannot do this: `aspect-ratio` with a full-width box ignores the
   * height it has to live in, and the stretched grid that follows makes the
   * snake look wrong. Measuring the slot is a dozen lines and always correct.
   */
  const cellPx = Math.min(
    slot.width / state.size.cols,
    slot.height / state.size.rows,
  );
  const boardWidth = cellPx > 0 ? cellPx * state.size.cols : 0;
  const boardHeight = cellPx > 0 ? cellPx * state.size.rows : 0;

  const overlay = (() => {
    if (status === "ready") return { title: strings.readyPrompt, tone: "calm" as const };
    if (status === "paused") return { title: strings.paused, tone: "calm" as const };
    if (status === "dead") return { title: strings.gameOver, tone: "bad" as const };
    if (status === "won") return { title: strings.boardFull, tone: "good" as const };
    return null;
  })();

  const finished = status === "dead" || status === "won";
  // A fresh board teleports every segment; animating into it would drag the
  // snake across the screen from wherever the last run ended.
  const animate = state.tick > 0;

  return (
    <div className="flex h-full flex-col gap-2 sm:gap-3">
      <style>{CSS}</style>

      <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl border border-lime-500/20 bg-lime-950/40 px-3 py-2 backdrop-blur-xl sm:px-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Readout label={strings.scoreLabel} value={String(state.score)} />
          <Readout label={strings.lengthLabel} value={String(state.snake.length)} />
          <Readout label={strings.bestLabel} value={String(Math.max(best, state.score))} />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePause}
            disabled={finished}
            aria-label={strings.paused}
            className="inline-flex min-h-[34px] touch-manipulation items-center justify-center gap-1.5 rounded-full border border-lime-500/30 bg-lime-500/10 px-3 py-1 text-sm text-lime-200 transition hover:bg-lime-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 disabled:opacity-40 [@media(pointer:coarse)]:min-h-[44px] [@media(pointer:coarse)]:min-w-[44px]"
          >
            <Pause className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={newGame}
            className="inline-flex min-h-[34px] touch-manipulation items-center justify-center gap-1.5 rounded-full border border-lime-500/30 bg-lime-500/10 px-3 py-1 text-sm text-lime-200 transition hover:bg-lime-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 [@media(pointer:coarse)]:min-h-[44px] [@media(pointer:coarse)]:min-w-[44px]"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="hidden sm:inline">{strings.newGame}</span>
          </button>
        </div>
      </div>

      {/* The board takes every pixel that is left */}
      <div
        ref={slotRef}
        className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center"
      >
        <div
          ref={boardRef}
          className="relative touch-none overflow-hidden rounded-2xl border border-lime-500/25 bg-[#04140a] shadow-[inset_0_0_60px_rgba(132,204,22,0.14)]"
          style={{
            ["--snake-tick" as string]: `${tickMs}ms`,
            // The overlay sizes itself in `em`, so this one number keeps its
            // text in proportion to the board rather than to the viewport.
            fontSize: Math.min(20, Math.max(11, boardWidth * 0.035)),
            width: boardWidth > 0 ? boardWidth : "100%",
            height: boardHeight > 0 ? boardHeight : "100%",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={trackPointer}
        >
          {/* Grid, faint enough to read the snake against */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(132,204,22,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(132,204,22,0.07) 1px, transparent 1px)",
              backgroundSize: `${100 / state.size.cols}% ${100 / state.size.rows}%`,
            }}
          />

          {state.food ? (
            <Cell
              row={state.food.row}
              col={state.food.col}
              role="food"
              size={state.size}
              animate={false}
            >
              <div className="snake-food absolute inset-[14%] rounded-full bg-gradient-to-br from-rose-400 to-red-600 shadow-[0_0_12px_rgba(248,113,113,0.8)]" />
            </Cell>
          ) : null}

          {state.snake.map((segment, index) => {
            const head = index === 0;
            return (
              <Cell
                key={index}
                row={segment.row}
                col={segment.col}
                role={head ? "head" : "body"}
                size={state.size}
                animate={animate}
              >
                {/*
                  Inset rather than padded: a percentage padding would resolve
                  against the board's width, not the cell's, and blow every
                  segment far outside the board.
                */}
                <div
                  className={cn(
                    "absolute inset-[7%]",
                    head
                      ? "rounded-[35%] bg-lime-300 shadow-[0_0_14px_rgba(163,230,53,0.85)]"
                      : "rounded-[30%] bg-lime-500",
                    status === "dead" && "bg-rose-400",
                  )}
                  style={
                    head
                      ? { transform: `rotate(${HEAD_ROTATION[state.direction]}deg)` }
                      : {
                          // The tail fades out, so the snake reads head-first.
                          opacity:
                            0.55 +
                            0.45 *
                              (1 - index / Math.max(state.snake.length - 1, 1)),
                        }
                  }
                >
                  {head ? (
                    <>
                      <span className="absolute right-[18%] top-[16%] h-[16%] w-[16%] rounded-full bg-[#04140a]" />
                      <span className="absolute bottom-[16%] right-[18%] h-[16%] w-[16%] rounded-full bg-[#04140a]" />
                    </>
                  ) : null}
                </div>
              </Cell>
            );
          })}

          {overlay ? (
            <div
              className="absolute inset-0 flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]"
              onPointerDown={finished ? undefined : onPointerDown}
            >
              <div className="snake-overlay flex flex-col items-center gap-3 text-center">
                <p
                  className={cn(
                    "font-mono text-[1.6em] font-bold leading-tight tracking-wide",
                    overlay.tone === "good" && "text-lime-300",
                    overlay.tone === "bad" && "text-rose-300",
                    overlay.tone === "calm" && "text-lime-200",
                  )}
                >
                  {overlay.title}
                </p>
                {finished ? (
                  <>
                    <p className="font-mono text-[0.8em] text-lime-400/80">
                      {strings.scoreLabel} {state.score} · {strings.lengthLabel}{" "}
                      {state.snake.length}
                    </p>
                    <button
                      type="button"
                      onClick={newGame}
                      className="mt-1 inline-flex min-h-[34px] touch-manipulation items-center gap-1.5 rounded-full bg-gradient-to-r from-lime-300 to-green-400 px-[0.9em] py-[0.45em] text-[0.85em] font-semibold text-slate-950 shadow-lg transition hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-300 [@media(pointer:coarse)]:min-h-[44px]"
                    >
                      <RotateCcw className="h-4 w-4" />
                      {strings.playAgain}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <p className="flex-shrink-0 truncate text-center text-[11px] text-lime-500/60">
        {strings.snakeControls}
      </p>
    </div>
  );
};

export default SnakeGame;
