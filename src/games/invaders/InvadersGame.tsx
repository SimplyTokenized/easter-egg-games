import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { cn } from "../../lib/cn";
import type { GameProps } from "../registry";
import {
  advanceWave,
  BOMB_H,
  BOMB_W,
  BULLET_H,
  BULLET_W,
  createGame,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  INVADER_COLS,
  INVADER_H,
  INVADER_W,
  invaderRect,
  NO_INPUT,
  PLAYER_H,
  PLAYER_W,
  PLAYER_Y,
  respawn,
  SAUCER_H,
  SAUCER_W,
  SAUCER_Y,
  SHIELD_BLOCK,
  shieldBlockRect,
  speciesOfRow,
  step,
  type Input,
  type InvadersState,
  type Shield,
} from "./engine";
import {
  CANNON_SPRITE,
  EXPLOSION_SPRITE,
  INVADER_SPRITES,
  SAUCER_SPRITE,
  type Sprite,
} from "./sprites";

/**
 * Thirty ticks a second. The fleet marches on its own, much slower, clock — see
 * `stepInterval` — so this rate only governs the cannon and the shots, and it is
 * high enough that neither needs interpolating between ticks.
 */
const TICK_MS = 33;
/** As in Ladder: a hidden tab hands back a huge time debt on its first frame. */
const MAX_CATCHUP_TICKS = 3;
const DEATH_PAUSE_MS = 1200;
const CLEARED_PAUSE_MS = 1600;

const CSS = `
@keyframes invaders-blink { 0%, 55% { opacity: 1; } 56%, 100% { opacity: 0.2; } }
@keyframes invaders-overlay-in {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
.invaders-blink   { animation: invaders-blink 900ms steps(1, end) infinite; }
.invaders-overlay { animation: invaders-overlay-in 320ms cubic-bezier(0.22, 1, 0.36, 1) both; }
@media (prefers-reduced-motion: reduce) {
  .invaders-blink, .invaders-overlay { animation: none; }
}
`;

/** Row colours, in the spirit of the cabinet's coloured gel strips. */
const SPECIES_COLOR = ["#f9a8d4", "#67e8f9", "#86efac"] as const;

type HeldKey = "left" | "right" | "fire";

const KEY_MAP: Record<string, HeldKey> = {
  arrowleft: "left",
  a: "left",
  arrowright: "right",
  d: "right",
  " ": "fire",
  arrowup: "fire",
  w: "fire",
};

/**
 * Where a finger is, in field units.
 *
 * Returns null for a field of no width — a component that has not been measured
 * yet, which is what the very first pointer event can land on.
 */
export const pointerToField = (
  clientX: number,
  left: number,
  width: number,
): number | null =>
  width > 0 ? ((clientX - left) / width) * FIELD_WIDTH : null;

const pctX = (value: number) => `${(value / FIELD_WIDTH) * 100}%`;
const pctY = (value: number) => `${(value / FIELD_HEIGHT) * 100}%`;

/**
 * A sprite placed on the field.
 *
 * The field is one box with percentage coordinates, so the whole game scales
 * with its container and no layout constant is repeated in the CSS.
 */
const Piece = ({
  sprite,
  x,
  y,
  w,
  h,
  color,
  className,
  glow = 0.75,
}: {
  sprite: Sprite;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  className?: string;
  glow?: number;
}) => (
  <svg
    aria-hidden
    viewBox={`0 0 ${sprite.width} ${sprite.height}`}
    preserveAspectRatio="none"
    shapeRendering="crispEdges"
    className={cn("pointer-events-none absolute", className)}
    style={{
      left: pctX(x),
      top: pctY(y),
      width: pctX(w),
      height: pctY(h),
      filter: glow
        ? `drop-shadow(0 0 2px rgba(255,255,255,${glow}))`
        : undefined,
    }}
  >
    <path d={sprite.path} fill={color} />
  </svg>
);

/**
 * The fleet.
 *
 * Memoised on purpose: fifty-five sprites only change when an invader dies or
 * the fleet marches, which is a fraction of the ticks. Everything else on the
 * board re-renders thirty times a second and this must not come with it.
 */
const Fleet = memo(function Fleet({
  alive,
  fleetX,
  fleetY,
  frame,
}: {
  alive: boolean[];
  fleetX: number;
  fleetY: number;
  frame: 0 | 1;
}) {
  return (
    <>
      {alive.map((on, index) => {
        if (!on) return null;
        const rect = invaderRect(index, fleetX, fleetY);
        const species = speciesOfRow(Math.floor(index / INVADER_COLS));
        return (
          <Piece
            key={index}
            sprite={INVADER_SPRITES[species][frame]}
            x={rect.x}
            y={rect.y}
            w={INVADER_W}
            h={INVADER_H}
            color={SPECIES_COLOR[species]}
            glow={0}
          />
        );
      })}
    </>
  );
});

/** Memoised for the same reason: a bunker only changes when it is hit. */
const Bunkers = memo(function Bunkers({ shields }: { shields: Shield[] }) {
  return (
    <>
      {shields.map((shield, shieldIndex) =>
        shield.cells.map((filled, index) => {
          if (!filled) return null;
          const rect = shieldBlockRect(shield, index);
          return (
            <span
              key={`${shieldIndex}-${index}`}
              aria-hidden
              className="pointer-events-none absolute bg-emerald-400/90"
              style={{
                left: pctX(rect.x),
                top: pctY(rect.y),
                width: pctX(SHIELD_BLOCK),
                height: pctY(SHIELD_BLOCK),
              }}
            />
          );
        }),
      )}
    </>
  );
});

const Readout = ({ label, value }: { label: string; value: string }) => (
  <span className="flex items-baseline gap-1.5">
    <span className="text-[11px] uppercase tracking-wider text-cyan-500/70">
      {label}
    </span>
    <span className="text-sm font-semibold tabular-nums text-cyan-100">
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
      "border border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
      "active:bg-cyan-500/25 active:scale-95 transition-transform duration-100",
      className,
    )}
  >
    {children}
  </button>
);

export const InvadersGame = ({ strings }: GameProps) => {
  const [state, setState] = useState<InvadersState>(() => createGame());

  const held = useRef<Set<HeldKey>>(new Set());
  /**
   * Where a finger is holding the cannon, in field units, or null for none.
   *
   * Touch steering is absolute where the keys are relative: on a phone, chasing
   * an invader with two arrow buttons is the worst part of every port of this
   * game, so a finger anywhere on the screen drags the cannon to it and fires.
   */
  const touchX = useRef<number | null>(null);
  const fieldRef = useRef<HTMLDivElement>(null);

  /**
   * The authoritative state, alongside React's copy: the loop needs the result
   * of a tick immediately and `setState` cannot hand it back synchronously.
   */
  const live = useRef(state);
  const apply = useCallback((next: InvadersState) => {
    live.current = next;
    setState(next);
  }, []);

  /**
   * The field is letterboxed to its own 4:3 rather than stretched to the panel:
   * every sprite is pixel art, and a field that is not the shape the units
   * describe makes the invaders tall on a phone and squat on a desktop.
   *
   * Measured rather than left to CSS on purpose. `aspect-ratio` only carries a
   * size from one axis to the other while the other is `auto`, and inside a
   * flex row a `width: auto` item takes the line's width instead — which is
   * exactly the stretch this is meant to prevent.
   */
  const sizerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const sizer = sizerRef.current;
    if (!sizer) return;

    // The sizer carries no padding of its own on purpose: `clientWidth` counts
    // padding as room, so measuring a padded box hands back more space than the
    // field has, the flex line shrinks it back, and the screen ends up a shape
    // it was not sized for.
    const measure = () => {
      const scale = Math.min(
        sizer.clientWidth / FIELD_WIDTH,
        sizer.clientHeight / FIELD_HEIGHT,
      );
      setBox({ width: FIELD_WIDTH * scale, height: FIELD_HEIGHT * scale });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(sizer);
    return () => observer.disconnect();
  }, []);

  const { status } = state;

  const beginPlay = useCallback(() => {
    if (live.current.status !== "ready") return;
    apply({ ...live.current, status: "playing" });
  }, [apply]);

  const restart = useCallback(() => {
    held.current.clear();
    apply({ ...createGame(live.current.rng), status: "playing" });
  }, [apply]);

  const readInput = useCallback((): Input => {
    const keys = held.current;
    const input: Input = {
      ...NO_INPUT,
      left: keys.has("left"),
      right: keys.has("right"),
      // Held fire keeps shooting, but only ever one shot is in the air, so this
      // is the cabinet's cadence without asking for a key press per shot.
      fire: keys.has("fire"),
    };

    const target = touchX.current;
    if (target !== null) {
      // Half a unit of slack, or the cannon jitters either side of the finger.
      const delta = target - (live.current.playerX + PLAYER_W / 2);
      input.left = input.left || delta < -0.5;
      input.right = input.right || delta > 0.5;
      input.fire = true;
    }
    return input;
  }, []);

  /**
   * A fixed timestep driven by animation frames, capped so a stall costs a few
   * ticks rather than a burst — the same clock Ladder uses, and for the same
   * reason: `setInterval` lets missed callbacks pile up and then run back to
   * back, which reads as the game freezing and then sprinting.
   */
  useEffect(() => {
    if (status !== "playing") return;

    let frameId = 0;
    let previous: number | null = null;
    let debt = 0;

    const frame = (now: number) => {
      frameId = requestAnimationFrame(frame);

      if (previous === null) {
        previous = now;
        return;
      }

      debt = Math.min(debt + (now - previous), TICK_MS * MAX_CATCHUP_TICKS);
      previous = now;

      while (debt >= TICK_MS) {
        debt -= TICK_MS;
        apply(step(live.current, readInput()));
      }
    };

    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  }, [apply, readInput, status]);

  // Death and a cleared wave both pause, then move things along.
  useEffect(() => {
    if (status === "dead") {
      const id = window.setTimeout(
        () => apply(respawn(live.current)),
        DEATH_PAUSE_MS,
      );
      return () => window.clearTimeout(id);
    }
    if (status === "waveCleared") {
      const id = window.setTimeout(
        () => apply(advanceWave(live.current)),
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
      held.current.add(action);
      beginPlay();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const action = KEY_MAP[event.key.toLowerCase()];
      if (action) held.current.delete(action);
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

  const steer = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const field = fieldRef.current;
    if (!field) return;
    const rect = field.getBoundingClientRect();
    const x = pointerToField(event.clientX, rect.left, rect.width);
    if (x !== null) touchX.current = x;
  }, []);

  const grab = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      steer(event);
      beginPlay();
    },
    [beginPlay, steer],
  );

  const letGo = useCallback(() => {
    touchX.current = null;
  }, []);

  const press = useCallback(
    (key: HeldKey) => {
      held.current.add(key);
      beginPlay();
    },
    [beginPlay],
  );
  const release = useCallback((key: HeldKey) => held.current.delete(key), []);

  const overlay = useMemo(() => {
    if (status === "ready")
      return { title: strings.readyPrompt, tone: "calm" as const };
    if (status === "waveCleared")
      return { title: strings.waveCleared, tone: "good" as const };
    if (status === "gameOver")
      return { title: strings.gameOver, tone: "bad" as const };
    return null;
  }, [status, strings]);

  const dying = status === "dead";

  return (
    <div className="flex h-full flex-col gap-2 sm:gap-4">
      <style>{CSS}</style>

      {/* Status line, in the spirit of the cabinet's top row */}
      <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl border border-cyan-500/20 bg-slate-950/60 px-3 py-2 backdrop-blur-xl sm:px-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Readout label={strings.scoreLabel} value={String(state.score)} />
          <Readout label={strings.waveLabel} value={String(state.wave)} />
          <span className="flex items-center gap-1.5">
            <span className="text-[11px] uppercase tracking-wider text-cyan-500/70">
              {strings.livesLabel}
            </span>
            <span className="flex items-center gap-1">
              {Array.from({ length: state.lives }, (_, i) => (
                <svg
                  key={i}
                  aria-hidden
                  viewBox={`0 0 ${CANNON_SPRITE.width} ${CANNON_SPRITE.height}`}
                  shapeRendering="crispEdges"
                  className="h-3 w-5"
                >
                  <path d={CANNON_SPRITE.path} fill="#67e8f9" />
                </svg>
              ))}
              <span className="sr-only">{state.lives}</span>
            </span>
          </span>
        </div>
        <button
          type="button"
          onClick={restart}
          className="inline-flex min-h-[34px] touch-manipulation items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-sm text-cyan-100 transition hover:bg-cyan-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          <RotateCcw className="h-4 w-4" />
          <span className="hidden sm:inline">{strings.newGame}</span>
        </button>
      </div>

      {/* The screen */}
      {/*
        The sizer takes whatever space is going; the screen inside it is exactly
        the field, so on a tall phone the game is a centred screen rather than a
        small picture floating in a large black slab.
      */}
      <div
        ref={sizerRef}
        className="flex min-h-0 flex-1 items-center justify-center"
      >
        <div
          ref={fieldRef}
          data-testid="invaders-field"
          onPointerDown={grab}
          onPointerMove={(event) => {
            if (touchX.current !== null) steer(event);
          }}
          onPointerUp={letGo}
          onPointerLeave={letGo}
          onPointerCancel={letGo}
          className="relative touch-none overflow-hidden rounded-2xl border border-cyan-500/25 bg-black shadow-[inset_0_0_60px_rgba(34,211,238,0.12)] sm:rounded-3xl"
          style={{ width: box.width, height: box.height }}
        >
          <Fleet
            alive={state.alive}
            fleetX={state.fleetX}
            fleetY={state.fleetY}
            frame={state.fleetFrame}
          />

          <Bunkers shields={state.shields} />

          {state.saucer ? (
            <Piece
              sprite={SAUCER_SPRITE}
              x={state.saucer.x}
              y={SAUCER_Y}
              w={SAUCER_W}
              h={SAUCER_H}
              color="#f0abfc"
              glow={0.9}
            />
          ) : null}

          {state.bullet ? (
            <span
              aria-hidden
              data-testid="invaders-bullet"
              className="pointer-events-none absolute bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)]"
              style={{
                left: pctX(state.bullet.x),
                top: pctY(state.bullet.y),
                width: pctX(BULLET_W),
                height: pctY(BULLET_H),
              }}
            />
          ) : null}

          {state.bombs.map((bomb) => (
            <span
              key={bomb.id}
              aria-hidden
              className="pointer-events-none absolute bg-amber-300 shadow-[0_0_6px_rgba(252,211,77,0.9)]"
              style={{
                left: pctX(bomb.x),
                top: pctY(bomb.y),
                width: pctX(BOMB_W),
                height: pctY(BOMB_H),
              }}
            />
          ))}

          {state.explosions.map((boom) => (
            <Piece
              key={boom.id}
              sprite={EXPLOSION_SPRITE}
              x={boom.x - 6}
              y={boom.y - 6}
              w={12}
              h={12}
              color="#fde68a"
              glow={0.9}
            />
          ))}

          {/* The cannon blinks away while the wreck burns. */}
          {!dying ? (
            <Piece
              sprite={CANNON_SPRITE}
              x={state.playerX}
              y={PLAYER_Y}
              w={PLAYER_W}
              h={PLAYER_H}
              color="#e2e8f0"
              glow={0.8}
            />
          ) : null}

          {/* The floor the fleet is marching towards. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bg-cyan-400/40"
            style={{ top: pctY(PLAYER_Y + PLAYER_H + 3), height: pctY(1) }}
          />

          {/* Scanlines, kept faint enough to stay readable */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0 2px, rgba(0,0,0,0.5) 2px 3px)",
            }}
          />
          {overlay ? (
            <div
              className="absolute inset-0 flex items-center justify-center bg-black/70 p-6 backdrop-blur-[2px]"
              onPointerDown={status === "ready" ? beginPlay : undefined}
            >
              <div className="invaders-overlay flex flex-col items-center gap-3 text-center">
                <p
                  className={cn(
                    "font-mono text-xl font-bold tracking-wide sm:text-3xl",
                    status === "ready" && "invaders-blink",
                    overlay.tone === "good" && "text-emerald-300",
                    overlay.tone === "bad" && "text-rose-300",
                    overlay.tone === "calm" && "text-cyan-200",
                  )}
                >
                  {overlay.title}
                </p>
                {status === "gameOver" ? (
                  <>
                    <p className="font-mono text-sm text-cyan-400/80">
                      {strings.scoreLabel} {state.score}
                    </p>
                    <button
                      type="button"
                      onClick={restart}
                      className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-cyan-300 to-blue-400 px-4 py-1.5 text-sm font-semibold text-slate-950 shadow-lg transition hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                    >
                      <RotateCcw className="h-4 w-4" />
                      {strings.playAgain}
                    </button>
                  </>
                ) : null}
                {status === "waveCleared" ? (
                  <p className="font-mono text-sm text-cyan-400/80">
                    {strings.waveLabel} {state.wave + 1}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Touch pad — only where there is no keyboard to speak of */}
      <div className="hidden flex-shrink-0 items-center justify-between gap-4 px-2 [@media(pointer:coarse)]:flex">
        <div className="flex gap-1.5">
          <PadButton
            label="left"
            onPress={() => press("left")}
            onRelease={() => release("left")}
            className="h-12 w-14"
          >
            <ArrowLeft className="h-5 w-5" />
          </PadButton>
          <PadButton
            label="right"
            onPress={() => press("right")}
            onRelease={() => release("right")}
            className="h-12 w-14"
          >
            <ArrowRight className="h-5 w-5" />
          </PadButton>
        </div>

        <PadButton
          label="fire"
          onPress={() => press("fire")}
          onRelease={() => release("fire")}
          className="h-16 w-24 text-sm font-semibold uppercase tracking-wide"
        >
          {strings.fire}
        </PadButton>
      </div>

      <p className="flex-shrink-0 truncate text-center text-[11px] text-cyan-500/60 [@media(pointer:coarse)]:hidden">
        {strings.invadersControls}
      </p>
      <p className="hidden flex-shrink-0 truncate text-center text-[11px] text-cyan-500/60 [@media(pointer:coarse)]:block">
        {strings.invadersTouch}
      </p>
    </div>
  );
};

export default InvadersGame;
