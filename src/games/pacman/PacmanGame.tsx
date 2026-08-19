import {
  type PointerEvent as ReactPointerEvent,
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
  resetRound,
  step,
  type Dir,
  type Ghost,
  type GhostName,
  type PacmanState,
} from "./engine";
import { COLS, DOOR, isWall, ROWS } from "./maze";

/**
 * A little over seven tiles a second — a full width of the maze takes about
 * three seconds. Faster than this and the corners come up quicker than a hand
 * can answer them; the engine's timings are all counted in ticks, so they are
 * sized against this number.
 */
const TICK_MS = 140;
/** Cap on replayed ticks after a stall — a hidden tab must not sprint on return. */
const MAX_CATCHUP_TICKS = 3;
const DEATH_PAUSE_MS = 1250;
const CLEARED_PAUSE_MS = 1600;

/** User units per maze tile. Everything below is expressed in these. */
const CELL = 8;
const WIDTH = COLS * CELL;
const HEIGHT = ROWS * CELL;

const PAC_RADIUS = 3.3;
const GHOST_RADIUS = 3.2;

/** Ticks of fright left when the ghosts start flashing their warning. */
const FLASH_FROM = 22;

/** Pixels a finger has to travel across the board before it counts as a turn. */
const SWIPE_MIN = 22;

const centre = (row: number, col: number): [number, number] => [
  (col + 0.5) * CELL,
  (row + 0.5) * CELL,
];

/**
 * The maze as one path: every face where a wall tile meets an open one.
 *
 * Filled wall blocks read as a slab; the arcade look comes from outlining the
 * corridors instead. The maze never changes, so this is computed once.
 */
const WALL_PATH = (() => {
  const parts: string[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (!isWall(row, col)) continue;
      const x = col * CELL;
      const y = row * CELL;
      if (!isWall(row - 1, col)) parts.push(`M${x} ${y}h${CELL}`);
      if (!isWall(row + 1, col)) parts.push(`M${x} ${y + CELL}h${CELL}`);
      if (!isWall(row, col - 1)) parts.push(`M${x} ${y}v${CELL}`);
      if (!isWall(row, col + 1)) parts.push(`M${x + CELL} ${y}v${CELL}`);
    }
  }
  return parts.join("");
})();

const ANGLE: Record<Dir, number> = { right: 0, down: 90, left: 180, up: -90 };

const GHOST_COLOUR: Record<GhostName, string> = {
  blinky: "#ef4444",
  pinky: "#f9a8d4",
  inky: "#67e8f9",
  clyde: "#fb923c",
};

/** A wedge of a disc, pointing right — Pac-Man with his mouth `degrees` open. */
const mouth = (degrees: number): string => {
  const radians = (degrees * Math.PI) / 180;
  const x = PAC_RADIUS * Math.cos(radians);
  const y = PAC_RADIUS * Math.sin(radians);
  return `M0 0L${x.toFixed(2)} ${(-y).toFixed(2)}A${PAC_RADIUS} ${PAC_RADIUS} 0 1 0 ${x.toFixed(2)} ${y.toFixed(2)}Z`;
};

const GHOST_BODY =
  `M${-GHOST_RADIUS} ${GHOST_RADIUS}V-0.2` +
  `A${GHOST_RADIUS} ${GHOST_RADIUS} 0 0 1 ${GHOST_RADIUS} -0.2` +
  `V${GHOST_RADIUS}L2.13 2.25L1.07 ${GHOST_RADIUS}L0 2.25L-1.07 ${GHOST_RADIUS}L-2.13 2.25Z`;

const CSS = `
@keyframes pac-frame { 0%, 32.9% { opacity: 1; } 33%, 100% { opacity: 0; } }
@keyframes pac-power { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
@keyframes pac-overlay-in {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes pac-float { from { transform: translateY(0); } to { transform: translateY(-6px); } }

/* Three frames on a 270 ms loop: shut, half open, wide. */
.pac-chomp > * { animation: pac-frame 270ms linear infinite; }
.pac-chomp > *:nth-child(2) { animation-delay: 90ms; }
.pac-chomp > *:nth-child(3) { animation-delay: 180ms; }
.pac-power   { animation: pac-power 420ms steps(2, end) infinite; }
.pac-overlay { animation: pac-overlay-in 320ms cubic-bezier(0.22, 1, 0.36, 1) both; }

/* A landscape phone is all width and no height, so the readouts move into a
   column beside the board rather than stacking on top of it — which roughly
   doubles the size of the maze there. A wrapper set to display:contents keeps
   itself out of the way everywhere else, and order puts the board back in the
   middle of the column. */
.pac-side  { display: contents; }
.pac-board { order: 1; }
.pac-pad   { order: 2; }
.pac-hint  { order: 3; }

@media (max-height: 560px) and (min-width: 620px) {
  .pac-root   { flex-direction: row; }
  .pac-side   { display: flex; flex-direction: column; gap: 0.5rem; width: 10.5rem; flex-shrink: 0; }
  .pac-status { flex-direction: column; align-items: flex-start; gap: 0.75rem; }
  .pac-status-group { flex-direction: column; align-items: flex-start; gap: 0.5rem; }
  .pac-board  { min-width: 0; }
  .pac-hint   { white-space: normal; }
}

/* The pad is for touch only — and a landscape phone has no height to spare for
   both a pad and a board, so there swiping the maze is the whole control. */
.pac-pad { display: none; }
@media (pointer: coarse) { .pac-pad { display: flex; } }
@media (pointer: coarse) and (max-height: 560px) { .pac-pad { display: none; } }

.pac-hint-touch { display: none; }
@media (pointer: coarse) {
  .pac-hint-keys { display: none; }
  .pac-hint-touch { display: block; }
}

@media (prefers-reduced-motion: reduce) {
  .pac-chomp > *, .pac-power, .pac-overlay { animation: none; }
  .pac-chomp > *:not(:nth-child(2)) { opacity: 0; }
  .pac-chomp > *:nth-child(2) { opacity: 1; }
}
`;

const KEY_MAP: Record<string, Dir> = {
  arrowup: "up",
  w: "up",
  arrowdown: "down",
  s: "down",
  arrowleft: "left",
  a: "left",
  arrowright: "right",
  d: "right",
};

const PUPIL: Record<Dir, [number, number]> = {
  up: [0, -0.5],
  down: [0, 0.5],
  left: [-0.5, 0],
  right: [0.5, 0],
};

const GhostSprite = ({ ghost, flashing }: { ghost: Ghost; flashing: boolean }) => {
  const [px, py] = PUPIL[ghost.dir];
  const scared = ghost.frightened;
  const body = scared ? (flashing ? "#f8fafc" : "#2563eb") : GHOST_COLOUR[ghost.name];

  return (
    <>
      {/* Eyes only, on the way home — the body is what got eaten. */}
      {ghost.eaten ? null : (
        <path
          d={GHOST_BODY}
          fill={body}
          className={scared && flashing ? "pac-power" : undefined}
        />
      )}
      {scared && !ghost.eaten ? (
        <g fill={flashing ? "#dc2626" : "#f8fafc"}>
          <rect x="-1.6" y="-1" width="1" height="1" />
          <rect x="0.6" y="-1" width="1" height="1" />
          <path
            d="M-2 1.4l0.8-0.8 0.8 0.8 0.8-0.8 0.8 0.8 0.8-0.8 0.8 0.8"
            fill="none"
            stroke={flashing ? "#dc2626" : "#f8fafc"}
            strokeWidth="0.5"
          />
        </g>
      ) : (
        <g>
          <ellipse cx="-1.25" cy="-0.6" rx="1" ry="1.25" fill="#f8fafc" />
          <ellipse cx="1.25" cy="-0.6" rx="1" ry="1.25" fill="#f8fafc" />
          <circle cx={-1.25 + px} cy={-0.6 + py} r="0.55" fill="#1e3a8a" />
          <circle cx={1.25 + px} cy={-0.6 + py} r="0.55" fill="#1e3a8a" />
        </g>
      )}
    </>
  );
};

const LifeIcon = ({ className }: { className?: string }) => (
  <svg viewBox="-4 -4 8 8" className={className} aria-hidden>
    <path d={mouth(32)} fill="currentColor" />
  </svg>
);

const Readout = ({ label, value }: { label: string; value: string }) => (
  <span className="flex items-baseline gap-1.5">
    <span className="text-[11px] uppercase tracking-wider text-amber-500/70">{label}</span>
    <span className="text-sm font-semibold tabular-nums text-amber-100">{value}</span>
  </span>
);

const PadButton = ({
  onPress,
  label,
  className,
  children,
}: {
  onPress: () => void;
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
    className={cn(
      "flex touch-none select-none items-center justify-center rounded-xl",
      "border border-amber-400/30 bg-amber-400/10 text-amber-200",
      "transition-transform duration-100 active:scale-95 active:bg-amber-400/25",
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

export const PacmanGame = ({ strings }: GameProps) => {
  const [state, setState] = useState<PacmanState>(() => createGame());

  const turn = useRef<Dir | null>(null);
  const boardRef = useRef<SVGSVGElement>(null);

  /**
   * Where each moving sprite came from and where it is heading, plus how far
   * through the current tick we are. Same split as Ladder: React owns which
   * sprites exist, the frame loop owns the `transform` of anything carrying
   * `data-entity`, and neither writes the other's property.
   */
  const motion = useRef(new Map<string, Motion>());
  const alpha = useRef(0);

  /** The authoritative state — the loop needs a tick's result synchronously. */
  const live = useRef(state);
  const apply = useCallback((next: PacmanState) => {
    // A fresh round teleports everyone; interpolating into it would drag
    // Pac-Man across the maze from wherever he was caught.
    if (next.tick === 0) motion.current.clear();
    live.current = next;
    setState(next);
  }, []);

  const recordMotion = useCallback((next: PacmanState) => {
    const updated = new Map<string, Motion>();
    const carry = (id: string, row: number, col: number) => {
      const previous = motion.current.get(id);
      // A tunnel crossing is a jump from one edge to the other; interpolating
      // it would send the sprite skating back across the whole maze.
      const teleported =
        !previous ||
        Math.abs(previous.toRow - row) > 1 ||
        Math.abs(previous.toCol - col) > 1;
      updated.set(id, {
        fromRow: teleported ? row : previous.toRow,
        fromCol: teleported ? col : previous.toCol,
        toRow: row,
        toCol: col,
      });
    };
    carry("player", next.player.row, next.player.col);
    for (const ghost of next.ghosts) carry(ghost.name, ghost.row, ghost.col);
    motion.current = updated;
  }, []);

  /** Place every sprite at its interpolated position for this frame. */
  const paint = useCallback((progress: number) => {
    const root = boardRef.current;
    if (!root) return;
    const t = Math.max(0, Math.min(1, progress));
    for (const node of root.querySelectorAll<SVGGElement>("[data-entity]")) {
      const m = motion.current.get(node.dataset.entity ?? "");
      let row: number;
      let col: number;
      if (m) {
        row = m.fromRow + (m.toRow - m.fromRow) * t;
        col = m.fromCol + (m.toCol - m.fromCol) * t;
      } else {
        // Before the first tick, and right after a reset: sit exactly on the
        // tile React rendered this sprite into.
        [row, col] = (node.dataset.cell ?? "0,0").split(",").map(Number);
      }
      const [x, y] = centre(row, col);
      node.setAttribute("transform", `translate(${x} ${y})`);
    }
  }, []);

  // Newly rendered sprites would sit at the origin for one frame otherwise.
  useLayoutEffect(() => paint(alpha.current), [paint, state]);

  const { status } = state;

  const beginPlay = useCallback(() => {
    if (live.current.status !== "ready") return;
    apply({ ...live.current, status: "playing" });
  }, [apply]);

  const restart = useCallback(() => {
    turn.current = null;
    apply({ ...createGame(), status: "playing" });
  }, [apply]);

  const steer = useCallback(
    (dir: Dir) => {
      turn.current = dir;
      beginPlay();
    },
    [beginPlay],
  );

  /**
   * Swiping the board steers it, which is how a maze game wants to be played on
   * a phone: the pad is a fallback, and on a landscape screen there is no room
   * for one at all. The origin resets after every turn, so a finger can stay
   * down and keep steering instead of having to lift between corners.
   */
  const swipe = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent) => {
      swipe.current = { x: event.clientX, y: event.clientY };
      beginPlay();
    },
    [beginPlay],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent) => {
      const from = swipe.current;
      if (!from) return;
      const dx = event.clientX - from.x;
      const dy = event.clientY - from.y;
      if (Math.abs(dx) < SWIPE_MIN && Math.abs(dy) < SWIPE_MIN) return;
      steer(
        Math.abs(dx) > Math.abs(dy)
          ? dx > 0
            ? "right"
            : "left"
          : dy > 0
            ? "down"
            : "up",
      );
      swipe.current = { x: event.clientX, y: event.clientY };
    },
    [steer],
  );

  const endSwipe = useCallback(() => {
    swipe.current = null;
  }, []);

  /**
   * The clock: a fixed timestep on animation frames.
   *
   * `setInterval` lets missed callbacks pile up and then fire back to back,
   * which reads as a stall followed by a sprint. Frames pace evenly, stop by
   * themselves in a hidden tab, and the accumulator is capped so a long gap
   * costs a few ticks rather than a burst.
   */
  useEffect(() => {
    if (status !== "playing") return;

    let frameId = 0;
    let previous: number | null = null;
    let debt = 0;

    const frame = (now: number) => {
      frameId = requestAnimationFrame(frame);

      // The first frame only establishes a baseline.
      if (previous === null) {
        previous = now;
        return;
      }

      debt = Math.min(debt + (now - previous), TICK_MS * MAX_CATCHUP_TICKS);
      previous = now;

      while (debt >= TICK_MS) {
        debt -= TICK_MS;
        const next = step(live.current, turn.current);
        turn.current = null;
        recordMotion(next);
        apply(next);
      }

      alpha.current = debt / TICK_MS;
      paint(alpha.current);
    };

    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  }, [apply, paint, recordMotion, status]);

  // Being caught and clearing a level both pause, then move things along.
  useEffect(() => {
    if (status === "dead") {
      const id = window.setTimeout(() => apply(resetRound(live.current)), DEATH_PAUSE_MS);
      return () => window.clearTimeout(id);
    }
    if (status === "levelCleared") {
      const id = window.setTimeout(() => apply(advanceLevel(live.current)), CLEARED_PAUSE_MS);
      return () => window.clearTimeout(id);
    }
  }, [apply, status]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const dir = KEY_MAP[event.key.toLowerCase()];
      if (!dir) return;
      // Arrows would otherwise scroll the arcade behind the board.
      event.preventDefault();
      steer(dir);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [steer]);

  const pellets = useMemo(
    () =>
      [...state.pellets].map((id) => {
        const [x, y] = centre(Math.floor(id / COLS), id % COLS);
        return <circle key={id} cx={x} cy={y} r="0.75" fill="#fde68a" />;
      }),
    [state.pellets],
  );

  const powers = useMemo(
    () =>
      [...state.powers].map((id) => {
        const [x, y] = centre(Math.floor(id / COLS), id % COLS);
        return (
          <circle key={id} className="pac-power" cx={x} cy={y} r="2.1" fill="#fbbf24" />
        );
      }),
    [state.powers],
  );

  const flashing = state.fright > 0 && state.fright < FLASH_FROM && state.fright % 8 < 4;
  const finished = status === "gameOver";

  const overlay = (() => {
    if (status === "ready") return { title: strings.readyPrompt, tone: "calm" as const };
    if (status === "dead") return { title: strings.livesLabel, tone: "bad" as const };
    if (status === "levelCleared") return { title: strings.levelCleared, tone: "good" as const };
    if (status === "gameOver") return { title: strings.gameOver, tone: "bad" as const };
    return null;
  })();

  const [doorX, doorY] = centre(DOOR.row, DOOR.col);

  return (
    <div className="pac-root flex h-full flex-col gap-2 sm:gap-4">
      <style>{CSS}</style>

      {/* Readouts: a bar above the board, a column beside it in landscape. */}
      <div className="pac-side">
      <div className="pac-status flex flex-shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl border border-amber-400/20 bg-amber-950/30 px-3 py-2 backdrop-blur-xl sm:px-4">
        <div className="pac-status-group flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="flex items-center gap-1.5">
            <span className="text-[11px] uppercase tracking-wider text-amber-500/70">
              {strings.livesLabel}
            </span>
            <span className="flex items-center gap-1 text-amber-300">
              {Array.from({ length: Math.max(0, state.lives) }, (_, i) => (
                <LifeIcon key={i} className="h-3.5 w-3.5" />
              ))}
            </span>
          </span>
          <Readout label={strings.levelLabel} value={String(state.level)} />
          <Readout label={strings.scoreLabel} value={String(state.score)} />
        </div>
        <button
          type="button"
          onClick={restart}
          className="inline-flex min-h-[34px] touch-manipulation items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-sm text-amber-100 transition hover:bg-amber-400/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
        >
          <RotateCcw className="h-4 w-4" />
          <span className="hidden sm:inline">{strings.newGame}</span>
        </button>
      </div>

      <div className="pac-hint flex-shrink-0 truncate text-center text-[11px] text-amber-500/60">
        <p className="pac-hint-keys">{strings.pacmanControls}</p>
        <p className="pac-hint-touch">{strings.pacmanTouchControls}</p>
      </div>
      </div>

      {/* The board */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endSwipe}
        onPointerCancel={endSwipe}
        onPointerLeave={endSwipe}
        className="pac-board relative flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden rounded-2xl border border-amber-400/20 bg-black p-2 shadow-[inset_0_0_60px_rgba(251,191,36,0.10)] sm:rounded-3xl sm:p-4"
      >
        <svg
          ref={boardRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          className="h-full w-full"
          role="img"
          aria-label={strings.pacmanName}
        >
          <path
            d={WALL_PATH}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="0.7"
            strokeLinecap="round"
            style={{ filter: "drop-shadow(0 0 1.2px rgba(59,130,246,0.9))" }}
          />
          {/* The pen's door, which only ghosts may cross. */}
          <line
            x1={doorX - CELL / 2 + 0.6}
            y1={doorY - CELL / 2}
            x2={doorX + CELL / 2 - 0.6}
            y2={doorY - CELL / 2}
            stroke="#f9a8d4"
            strokeWidth="0.8"
            strokeLinecap="round"
          />

          {pellets}
          {powers}

          {state.fruit ? (
            <g
              transform={`translate(${centre(state.fruit.row, state.fruit.col).join(" ")})`}
            >
              <circle cx="-1" cy="1.2" r="1.7" fill="#ef4444" />
              <circle cx="1.4" cy="1.6" r="1.4" fill="#dc2626" />
              <path
                d="M-1 -0.4Q0.4 -2.6 2.2 -2.8"
                fill="none"
                stroke="#4ade80"
                strokeWidth="0.5"
              />
            </g>
          ) : null}

          {state.ghosts.map((ghost) => (
            <g key={ghost.name} data-entity={ghost.name} data-cell={`${ghost.row},${ghost.col}`}>
              <GhostSprite ghost={ghost} flashing={flashing} />
            </g>
          ))}

          <g
            data-entity="player"
            data-cell={`${state.player.row},${state.player.col}`}
            className={status === "dead" ? "opacity-60" : undefined}
          >
            {/* React turns him; the frame loop moves him. One writer each. */}
            <g transform={`rotate(${ANGLE[state.player.dir]})`}>
              <g className="pac-chomp" fill="#fde047">
                <circle r={PAC_RADIUS} />
                <path d={mouth(22)} />
                <path d={mouth(42)} />
              </g>
            </g>
          </g>
        </svg>

        {overlay ? (
          <div
            className="absolute inset-0 flex items-center justify-center bg-black/70 p-6 backdrop-blur-[2px]"
            onPointerDown={status === "ready" ? beginPlay : undefined}
          >
            <div className="pac-overlay flex flex-col items-center gap-3 text-center">
              <p
                className={cn(
                  "font-mono text-xl font-bold tracking-wide sm:text-3xl",
                  overlay.tone === "good" && "text-emerald-300",
                  overlay.tone === "bad" && "text-rose-300",
                  overlay.tone === "calm" && "text-amber-200",
                )}
              >
                {status === "dead" ? `${state.lives} × ${strings.livesLabel}` : overlay.title}
              </p>
              {finished ? (
                <>
                  <p className="font-mono text-sm text-amber-300/80">
                    {strings.scoreLabel} {state.score}
                  </p>
                  <button
                    type="button"
                    onClick={restart}
                    className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-yellow-300 to-amber-400 px-4 py-1.5 text-sm font-semibold text-slate-950 shadow-lg transition hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
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
      <div className="pac-pad flex-shrink-0 items-center justify-center gap-4 px-2">
        <div className="grid grid-cols-3 grid-rows-3 gap-1.5">
          <PadButton label="up" onPress={() => steer("up")} className="col-start-2 h-12 w-12">
            <ArrowUp className="h-5 w-5" />
          </PadButton>
          <PadButton
            label="left"
            onPress={() => steer("left")}
            className="col-start-1 row-start-2 h-12 w-12"
          >
            <ArrowLeft className="h-5 w-5" />
          </PadButton>
          <PadButton
            label="right"
            onPress={() => steer("right")}
            className="col-start-3 row-start-2 h-12 w-12"
          >
            <ArrowRight className="h-5 w-5" />
          </PadButton>
          <PadButton
            label="down"
            onPress={() => steer("down")}
            className="col-start-2 row-start-3 h-12 w-12"
          >
            <ArrowDown className="h-5 w-5" />
          </PadButton>
        </div>
      </div>

    </div>
  );
};

export default PacmanGame;
