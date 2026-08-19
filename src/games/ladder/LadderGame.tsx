import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, RotateCcw } from "lucide-react";
import { cn } from "../../lib/cn";
import type { GameProps } from "../registry";
import {
  advanceLevel,
  createGame,
  GRID_HEIGHT,
  GRID_WIDTH,
  NO_INPUT,
  retryLevel,
  step,
  type Input,
  type LadderState,
} from "./engine";
import { LEVELS } from "./levels";

/** Roughly eleven frames a second — chunky on purpose, like the original. */
const TICK_MS = 95;
/**
 * Most ticks the loop will replay after a stall. Without this cap, a tab that
 * was hidden (or a slow frame) hands back a huge time debt and the game sprints
 * through a dozen ticks at once.
 */
const MAX_CATCHUP_TICKS = 3;
const DEATH_PAUSE_MS = 1300;
const CLEARED_PAUSE_MS = 1700;

/** Row height as a multiple of the font size; the board's only layout constant. */
const LINE_HEIGHT = 1.15;

const PLAYER_CHAR = "&";
const ROCK_CHAR = "o";

const CSS = `
@keyframes ladder-blink { 0%, 60% { opacity: 1; } 61%, 100% { opacity: 0.25; } }
@keyframes ladder-overlay-in {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
.ladder-blink   { animation: ladder-blink 900ms steps(1, end) infinite; }
.ladder-overlay { animation: ladder-overlay-in 320ms cubic-bezier(0.22, 1, 0.36, 1) both; }
@media (prefers-reduced-motion: reduce) {
  .ladder-blink, .ladder-overlay { animation: none; }
}
`;

type HeldKey = "left" | "right" | "up" | "down";

const KEY_MAP: Record<string, HeldKey | "jump"> = {
  arrowleft: "left",
  a: "left",
  arrowright: "right",
  d: "right",
  arrowup: "up",
  w: "up",
  arrowdown: "down",
  s: "down",
  " ": "jump",
};

/**
 * One cell of the board.
 *
 * Anything that moves is handed an `entity` id and gets **no** transform from
 * React — the frame loop writes it instead, interpolating between cells. Two
 * writers for one property is the bug that has bitten this folder twice, so the
 * split is strict: React owns which glyphs exist, the loop owns where they are.
 * Static glyphs (treasure, the exit) keep their transform here.
 */
const Glyph = ({
  row,
  col,
  children,
  className,
  entity,
}: {
  row: number;
  col: number;
  children: string;
  className?: string;
  entity?: string;
}) => (
  <span
    aria-hidden
    className={cn("pointer-events-none absolute left-0 top-0", className)}
    style={
      entity
        ? { lineHeight: LINE_HEIGHT, willChange: "transform" }
        : {
            transform: `translate(${col}ch, calc(${row} * ${LINE_HEIGHT}em))`,
            lineHeight: LINE_HEIGHT,
          }
    }
    data-entity={entity}
    data-cell={`${row},${col}`}
  >
    {children}
  </span>
);

const Readout = ({ label, value }: { label: string; value: string }) => (
  <span className="flex items-baseline gap-1.5">
    <span className="text-[11px] uppercase tracking-wider text-emerald-500/70">
      {label}
    </span>
    <span className="text-sm font-semibold tabular-nums text-emerald-200">
      {value}
    </span>
  </span>
);

const PadButton = ({
  onPress,
  onRelease,
  label,
  className,
  children,
}: {
  onPress: () => void;
  onRelease: () => void;
  label: string;
  className?: string;
  children: ReactNode;
}) => (
  <button
    type="button"
    aria-label={label}
    onPointerDown={(event) => {
      event.preventDefault();
      onPress();
    }}
    onPointerUp={onRelease}
    onPointerLeave={onRelease}
    onPointerCancel={onRelease}
    className={cn(
      "flex touch-none select-none items-center justify-center rounded-xl",
      "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
      "active:bg-emerald-500/25 active:scale-95 transition-transform duration-100",
      className,
    )}
  >
    {children}
  </button>
);

interface Motion {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
}

export const LadderGame = ({ strings }: GameProps) => {
  const [state, setState] = useState<LadderState>(() => createGame(LEVELS));

  const held = useRef<Set<HeldKey>>(new Set());
  const jumpQueued = useRef(false);
  const boardRef = useRef<HTMLDivElement>(null);

  /**
   * Where each moving glyph came from and where it is heading, plus how far
   * through the current tick we are. The loop reads these every frame; React
   * never touches the transform of an entity.
   */
  const motion = useRef(new Map<string, Motion>());
  const alpha = useRef(0);

  /**
   * The authoritative state, kept alongside React's copy.
   *
   * The loop needs the result of a tick immediately — to work out what moved
   * from where — and `setState` cannot give it that synchronously.
   */
  const live = useRef(state);
  const apply = useCallback((next: LadderState) => {
    // A fresh level teleports everything; interpolating into it would drag the
    // player across the board from wherever the last one died.
    if (next.tick === 0) motion.current.clear();
    live.current = next;
    setState(next);
  }, []);

  const recordMotion = useCallback((next: LadderState) => {
    const updated = new Map<string, Motion>();
    const carry = (key: string, row: number, col: number) => {
      const previous = motion.current.get(key);
      updated.set(key, {
        fromRow: previous ? previous.toRow : row,
        fromCol: previous ? previous.toCol : col,
        toRow: row,
        toCol: col,
      });
    };
    carry("player", next.player.row, next.player.col);
    for (const rock of next.rocks) carry(`rock-${rock.id}`, rock.row, rock.col);
    motion.current = updated;
  }, []);

  /** Place every moving glyph at its interpolated position for this frame. */
  const paint = useCallback((progress: number) => {
    const root = boardRef.current;
    if (!root) return;
    const t = Math.max(0, Math.min(1, progress));
    for (const node of root.querySelectorAll<HTMLElement>("[data-entity]")) {
      const m = motion.current.get(node.dataset.entity ?? "");
      let row: number;
      let col: number;

      if (m) {
        row = m.fromRow + (m.toRow - m.fromRow) * t;
        col = m.fromCol + (m.toCol - m.fromCol) * t;
      } else {
        // Nothing to interpolate yet: before the first tick, on a rock that has
        // only just appeared, or right after a level reset. Sit exactly on the
        // cell React rendered this glyph into — skipping it would leave the
        // element with no transform at all, parked in the top-left corner.
        const [cellRow, cellCol] = (node.dataset.cell ?? "0,0").split(",").map(Number);
        row = cellRow;
        col = cellCol;
      }

      node.style.transform = `translate(${col}ch, calc(${row} * ${LINE_HEIGHT}em))`;
    }
  }, []);

  // Newly rendered glyphs (a rock that just appeared, a fresh level) would sit
  // at the origin for a frame otherwise.
  useLayoutEffect(() => paint(alpha.current), [paint, state]);

  const spec = LEVELS[state.levelIndex];
  const { status } = state;

  const beginPlay = useCallback(() => {
    if (live.current.status !== "ready") return;
    apply({ ...live.current, status: "playing" });
  }, [apply]);

  const restart = useCallback(() => {
    held.current.clear();
    jumpQueued.current = false;
    apply({ ...createGame(LEVELS), status: "playing" });
  }, [apply]);

  /** Read the pad once per tick; jump is edge-triggered, so it is consumed. */
  const consumeInput = useCallback((): Input => {
    const keys = held.current;
    const input: Input = {
      ...NO_INPUT,
      left: keys.has("left"),
      right: keys.has("right"),
      up: keys.has("up"),
      down: keys.has("down"),
      jump: jumpQueued.current,
    };
    jumpQueued.current = false;
    return input;
  }, []);

  /**
   * The clock: a fixed timestep driven by animation frames.
   *
   * `setInterval` was wrong here — the browser lets missed callbacks pile up and
   * then runs them back to back, which reads as the game stalling and suddenly
   * sprinting. Frames give even pacing, stop by themselves when the tab is
   * hidden, and the accumulator below is capped so a long gap costs at most a
   * few ticks instead of a burst.
   *
   * Reading input happens outside the updater: StrictMode may call an updater
   * twice, and consuming the jump flag in there would swallow jumps.
   */
  useEffect(() => {
    if (status !== "playing") return;

    let frameId = 0;
    let previous: number | null = null;
    let debt = 0;

    const frame = (now: number) => {
      frameId = requestAnimationFrame(frame);

      // First frame only establishes the baseline; its timestamp origin is not
      // comparable to anything we could have recorded beforehand.
      if (previous === null) {
        previous = now;
        return;
      }

      debt = Math.min(debt + (now - previous), TICK_MS * MAX_CATCHUP_TICKS);
      previous = now;

      while (debt >= TICK_MS) {
        debt -= TICK_MS;
        const input = consumeInput();
        const next = step(live.current, input, LEVELS);
        recordMotion(next);
        apply(next);
      }

      // The remainder of the tick is how far between cells everything is now.
      alpha.current = debt / TICK_MS;
      paint(alpha.current);
    };

    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  }, [apply, consumeInput, paint, recordMotion, status]);

  // Death and level-clear both pause, then move things along.
  useEffect(() => {
    if (status === "dead") {
      const id = window.setTimeout(
        () => apply(retryLevel(live.current, LEVELS)),
        DEATH_PAUSE_MS,
      );
      return () => window.clearTimeout(id);
    }
    if (status === "levelCleared") {
      const id = window.setTimeout(
        () => apply(advanceLevel(live.current, LEVELS)),
        CLEARED_PAUSE_MS,
      );
      return () => window.clearTimeout(id);
    }
  }, [apply, status]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = KEY_MAP[event.key.toLowerCase()];
      if (!action) return;
      // Arrows and space would otherwise scroll the arcade behind the board.
      event.preventDefault();
      if (action === "jump") jumpQueued.current = true;
      else held.current.add(action);
      beginPlay();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const action = KEY_MAP[event.key.toLowerCase()];
      if (action && action !== "jump") held.current.delete(action);
    };
    // A lost focus must not leave a key stuck down.
    const onBlur = () => held.current.clear();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [beginPlay]);

  // Terrain is one block of text; treasure and the exit are drawn on top so
  // they can carry their own colour.
  const { terrain, items } = useMemo(() => {
    const rows: string[] = [];
    const found: { row: number; col: number; char: string }[] = [];
    state.grid.forEach((cells, row) => {
      let line = "";
      cells.forEach((cell, col) => {
        if (cell === "*" || cell === "$") {
          found.push({ row, col, char: cell });
          line += " ";
        } else {
          line += cell;
        }
      });
      rows.push(line);
    });
    return { terrain: rows.join("\n"), items: found };
  }, [state.grid]);

  const press = useCallback((key: HeldKey) => {
    held.current.add(key);
    beginPlay();
  }, [beginPlay]);
  const release = useCallback((key: HeldKey) => held.current.delete(key), []);
  const pressJump = useCallback(() => {
    jumpQueued.current = true;
    beginPlay();
  }, [beginPlay]);

  const overlay = (() => {
    if (status === "ready") return { title: strings.readyPrompt, tone: "calm" as const };
    if (status === "dead") return { title: strings.lads, tone: "bad" as const };
    if (status === "levelCleared")
      return { title: strings.levelCleared, tone: "good" as const };
    if (status === "gameOver") return { title: strings.gameOver, tone: "bad" as const };
    if (status === "victory") return { title: strings.allCleared, tone: "good" as const };
    return null;
  })();

  const finished = status === "gameOver" || status === "victory";

  return (
    <div className="flex h-full flex-col gap-2 sm:gap-4">
      <style>{CSS}</style>

      {/* Status line, in the spirit of the original's bottom row */}
      <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl border border-emerald-500/20 bg-emerald-950/40 px-3 py-2 backdrop-blur-xl sm:px-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Readout label={strings.lads} value={String(state.lives)} />
          <Readout
            label={strings.levelLabel}
            value={`${state.levelIndex + 1} · ${spec.name}`}
          />
          <Readout label={strings.scoreLabel} value={String(state.score)} />
          <Readout label={strings.bonusLabel} value={String(state.bonus)} />
        </div>
        <button
          type="button"
          onClick={restart}
          className="inline-flex min-h-[34px] touch-manipulation items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-200 transition hover:bg-emerald-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <RotateCcw className="h-4 w-4" />
          <span className="hidden sm:inline">{strings.newGame}</span>
        </button>
      </div>

      {/* The screen */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-2xl border border-emerald-500/25 bg-black p-2 shadow-[inset_0_0_60px_rgba(16,185,129,0.12)] sm:rounded-3xl sm:p-5">
        <div
          ref={boardRef}
          className={cn(
            "relative font-mono text-emerald-400 [text-shadow:0_0_6px_rgba(52,211,153,0.55)]",
            "text-[9px] sm:text-[13px] md:text-[15px] lg:text-[18px] xl:text-[20px]",
          )}
          style={{
            ["--ladder-tick" as string]: `${TICK_MS}ms`,
            width: `${GRID_WIDTH}ch`,
            height: `calc(${GRID_HEIGHT} * ${LINE_HEIGHT}em)`,
            lineHeight: LINE_HEIGHT,
          }}
        >
          <pre className="m-0 whitespace-pre" style={{ lineHeight: LINE_HEIGHT }}>
            {terrain}
          </pre>

          {items.map((item) => (
            <Glyph
              key={`${item.row}-${item.col}`}
              row={item.row}
              col={item.col}
              className={
                item.char === "$"
                  ? "ladder-blink font-bold text-cyan-200 [text-shadow:0_0_10px_rgba(103,232,249,0.9)]"
                  : "text-amber-300 [text-shadow:0_0_8px_rgba(252,211,77,0.8)]"
              }
            >
              {item.char}
            </Glyph>
          ))}

          {state.rocks.map((rock) => (
            <Glyph
              key={rock.id}
              entity={`rock-${rock.id}`}
              row={rock.row}
              col={rock.col}
              className="font-bold text-orange-400 [text-shadow:0_0_8px_rgba(251,146,60,0.85)]"
            >
              {ROCK_CHAR}
            </Glyph>
          ))}

          <Glyph
            entity="player"
            row={state.player.row}
            col={state.player.col}
            className={cn(
              "font-bold [text-shadow:0_0_10px_rgba(255,255,255,0.9)]",
              status === "dead" ? "ladder-blink text-rose-400" : "text-white",
            )}
          >
            {PLAYER_CHAR}
          </Glyph>

          {/* Scanlines, kept faint enough to stay readable */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0 2px, rgba(0,0,0,0.5) 2px 3px)",
            }}
          />
        </div>

        {overlay ? (
          <div
            className="absolute inset-0 flex items-center justify-center bg-black/70 p-6 backdrop-blur-[2px]"
            onPointerDown={status === "ready" ? beginPlay : undefined}
          >
            <div className="ladder-overlay flex flex-col items-center gap-3 text-center">
              <p
                className={cn(
                  "font-mono text-xl font-bold tracking-wide sm:text-3xl",
                  overlay.tone === "good" && "text-emerald-300",
                  overlay.tone === "bad" && "text-rose-300",
                  overlay.tone === "calm" && "text-emerald-200",
                )}
              >
                {overlay.title}
              </p>
              {status === "dead" ? (
                <p className="font-mono text-sm text-emerald-400/80">
                  {state.lives} {strings.lads}
                </p>
              ) : null}
              {finished ? (
                <>
                  <p className="font-mono text-sm text-emerald-400/80">
                    {strings.scoreLabel} {state.score}
                  </p>
                  <button
                    type="button"
                    onClick={restart}
                    className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-300 to-green-400 px-4 py-1.5 text-sm font-semibold text-slate-950 shadow-lg transition hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
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

      {/* Touch pad — only where there is no keyboard to speak of */}
      <div className="hidden flex-shrink-0 items-center justify-between gap-4 px-2 [@media(pointer:coarse)]:flex">
        <div className="grid grid-cols-3 grid-rows-2 gap-1.5">
          <PadButton
            label="up"
            onPress={() => press("up")}
            onRelease={() => release("up")}
            className="col-start-2 h-12 w-12"
          >
            <ArrowUp className="h-5 w-5" />
          </PadButton>
          <PadButton
            label="left"
            onPress={() => press("left")}
            onRelease={() => release("left")}
            className="col-start-1 row-start-2 h-12 w-12"
          >
            <ArrowLeft className="h-5 w-5" />
          </PadButton>
          <PadButton
            label="down"
            onPress={() => press("down")}
            onRelease={() => release("down")}
            className="col-start-2 row-start-2 h-12 w-12"
          >
            <ArrowDown className="h-5 w-5" />
          </PadButton>
          <PadButton
            label="right"
            onPress={() => press("right")}
            onRelease={() => release("right")}
            className="col-start-3 row-start-2 h-12 w-12"
          >
            <ArrowRight className="h-5 w-5" />
          </PadButton>
        </div>

        <PadButton
          label="jump"
          onPress={pressJump}
          onRelease={() => undefined}
          className="h-16 w-24 text-sm font-semibold uppercase tracking-wide"
        >
          {strings.jump}
        </PadButton>
      </div>

      <p className="flex-shrink-0 truncate text-center text-[11px] text-emerald-500/60">
        {strings.ladderControls}
      </p>
    </div>
  );
};

export default LadderGame;
