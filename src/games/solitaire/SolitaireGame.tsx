import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Clock, RotateCcw, Sparkles, Trophy, Undo2 } from "lucide-react";
import { cn } from "../../lib/cn";
import type { GameProps } from "../registry";
import {
  autoCompleteStep,
  canAutoComplete,
  createGame,
  drawFromStock,
  getMovableRun,
  isWon,
  moveCards,
  rankLabel,
  sendToFoundation,
  SUIT_SYMBOLS,
  SUITS,
  type PileRef,
  type PlayingCard,
  type SolitaireState,
} from "./engine";
import { EmptySlot, PlayingCardView } from "./PlayingCardView";
import { useFlipAnimation } from "./useFlipAnimation";
import { useCardDrag } from "./useCardDrag";

/** How far each card peeks out from the one below it, in board units. */
const OFFSET_FACE_DOWN = "var(--sc-down)";
const OFFSET_FACE_UP = "var(--sc-up)";

const UNDO_LIMIT = 60;

const CSS = `
@keyframes solitaire-win-in {
  from { opacity: 0; transform: translateY(28px) scale(0.94); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.solitaire-win  { animation: solitaire-win-in 560ms cubic-bezier(0.22, 1, 0.36, 1) both; }
@media (prefers-reduced-motion: reduce) {
  .solitaire-win { animation: none; }
}
`;

interface Selection {
  from: PileRef;
  index: number;
}

const formatClock = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
};

/**
 * Cumulative `top` offsets for a tableau column, expressed as a calc() so the
 * spacing follows the responsive card size instead of hard-coded pixels.
 */
const columnOffsets = (pile: PlayingCard[]): string[] => {
  const offsets: string[] = [];
  let faceDown = 0;
  let faceUp = 0;
  for (const card of pile) {
    offsets.push(
      `calc(${faceDown} * ${OFFSET_FACE_DOWN} + ${faceUp} * ${OFFSET_FACE_UP})`,
    );
    if (card.faceUp) faceUp++;
    else faceDown++;
  }
  return offsets;
};

const pileIndex = (ref: PileRef): number => ("index" in ref ? ref.index : -1);
const sameRef = (a: PileRef, b: PileRef): boolean =>
  a.kind === b.kind && pileIndex(a) === pileIndex(b);

/** One frosted readout in the toolbar. */
const Stat = ({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) => (
  <div className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1.5 sm:gap-2 sm:px-3">
    <span className="text-slate-400">{icon}</span>
    <span className="hidden text-xs text-slate-400 sm:inline">{label}</span>
    <span className="text-sm font-semibold tabular-nums text-white">{value}</span>
  </div>
);

/**
 * The running clock, deliberately its own component.
 *
 * A second is a long time to a board of 52 absolutely-positioned cards. If the
 * tick lived in `SolitaireGame` it would re-render every one of them and, worse,
 * re-run the FLIP layout effect — which measures each card with
 * `getBoundingClientRect()` and `getComputedStyle()`, around a hundred forced
 * synchronous layout reads, once a second, for as long as the arcade is open.
 * Keeping `seconds` down here means the tick repaints eight characters.
 *
 * `onTick` reports upwards into a ref so the win screen can show the final time
 * without the parent subscribing to every second.
 */
const ClockStat = ({
  running,
  stopped,
  resetToken,
  label,
  onTick,
}: {
  running: boolean;
  stopped: boolean;
  resetToken: number;
  label: string;
  onTick: (seconds: number) => void;
}) => {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => setSeconds(0), [resetToken]);

  useEffect(() => {
    if (!running || stopped) return;
    const id = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [running, stopped]);

  // Reporting from an effect rather than the interval keeps the state updater
  // free of side effects, which StrictMode would otherwise run twice.
  useEffect(() => onTick(seconds), [onTick, seconds]);

  return <Stat icon={<Clock className="h-3.5 w-3.5" />} label={label} value={formatClock(seconds)} />;
};

const ToolbarButton = ({
  onClick,
  disabled,
  primary,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  children: ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "inline-flex min-h-[38px] items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium",
      "touch-manipulation transition-all duration-200 arcade-ease active:scale-[0.96]",
      "focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400",
      "disabled:cursor-not-allowed disabled:opacity-35",
      primary
        ? "bg-gradient-to-r from-amber-300 to-orange-400 text-slate-950 shadow-lg shadow-amber-500/25 hover:brightness-105"
        : "border border-white/10 bg-white/[0.06] text-slate-200 hover:bg-white/[0.12]",
    )}
  >
    {children}
  </button>
);

export const SolitaireGame = ({ strings }: GameProps) => {
  const [state, setState] = useState<SolitaireState>(() => createGame());
  const [history, setHistory] = useState<SolitaireState[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [running, setRunning] = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);
  // Bumped to restart the clock; the seconds themselves live in <ClockStat/>.
  const [clockResetToken, setClockResetToken] = useState(0);
  const elapsed = useRef(0);
  const recordElapsed = useCallback((value: number) => {
    elapsed.current = value;
  }, []);

  const boardRef = useRef<HTMLDivElement>(null);
  const { markPositions } = useFlipAnimation(boardRef);

  const won = useMemo(() => isWon(state), [state]);
  const autoAvailable = useMemo(() => canAutoComplete(state), [state]);

  // Updaters stay side-effect free: React may call them twice in StrictMode,
  // which would push the same position onto the undo stack twice.
  const commit = useCallback(
    (next: SolitaireState) => {
      setHistory((past) => [...past, state].slice(-UNDO_LIMIT));
      setState(next);
      setRunning(true);
    },
    [state],
  );

  const clearSelection = useCallback(() => setSelection(null), []);
  const { getHandlers, isDragging, heldIds, consumeDragClick } = useCardDrag({
    boardRef,
    state,
    commit,
    clearSelection,
    markPositions,
  });

  // Cards in hand ride above the board. Kept in the style prop so React owns
  // the value and restores it when the drag ends.
  const held = useMemo(() => new Set(heldIds), [heldIds]);
  const cardZIndex = useCallback(
    (id: string, stackIndex: number) => (held.has(id) ? 400 + stackIndex : stackIndex),
    [held],
  );

  const startNewGame = useCallback(() => {
    setState(createGame());
    setHistory([]);
    setSelection(null);
    setClockResetToken((token) => token + 1);
    setRunning(false);
    setAutoRunning(false);
  }, []);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    setState(history[history.length - 1]);
    setHistory(history.slice(0, -1));
    setSelection(null);
  }, [history]);

  // Keyboard: undo and new game, the two things worth reaching for.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === "z") {
        event.preventDefault();
        undo();
      } else if (key === "n" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        startNewGame();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [startNewGame, undo]);

  // A small celebration, loaded on demand so the bundle stays untouched.
  const celebrated = useRef(false);
  useEffect(() => {
    if (!won) {
      celebrated.current = false;
      return;
    }
    if (celebrated.current) return;
    celebrated.current = true;

    // The chunk may still be in flight when the player closes the arcade, and
    // the second burst is scheduled later still. Without this guard confetti
    // lands on whatever page the app has moved on to.
    let cancelled = false;
    let secondBurst: number | undefined;

    void import("canvas-confetti")
      .then(({ default: confetti }) => {
        if (cancelled) return;
        confetti({ particleCount: 140, spread: 78, origin: { y: 0.62 } });
        secondBurst = window.setTimeout(() => {
          if (cancelled) return;
          confetti({ particleCount: 90, spread: 110, origin: { y: 0.5 } });
        }, 340);
      })
      .catch(() => {
        /* The game is won either way. */
      });

    return () => {
      cancelled = true;
      if (secondBurst !== undefined) window.clearTimeout(secondBurst);
    };
  }, [won]);

  const handleStockClick = useCallback(() => {
    setSelection(null);
    const next = drawFromStock(state);
    if (next) commit(next);
  }, [commit, state]);

  /** Clicking a pile with a card in hand is always an attempt to drop it. */
  const tryDrop = useCallback(
    (target: PileRef): boolean => {
      if (!selection) return false;
      const next = moveCards(state, selection.from, selection.index, target);
      if (!next) return false;
      commit(next);
      setSelection(null);
      return true;
    },
    [commit, selection, state],
  );

  const handleCardClick = useCallback(
    (pile: PileRef, index: number, card: PlayingCard) => {
      if (consumeDragClick()) return;
      if (selection && tryDrop(pile)) return;
      if (!card.faceUp) {
        setSelection(null);
        return;
      }
      // Tapping the card you already hold puts it back down.
      if (selection && selection.index === index && sameRef(selection.from, pile)) {
        setSelection(null);
        return;
      }
      setSelection(getMovableRun(state, pile, index) ? { from: pile, index } : null);
    },
    [consumeDragClick, selection, state, tryDrop],
  );

  const handleCardDoubleClick = useCallback(
    (pile: PileRef, index: number) => {
      const next = sendToFoundation(state, pile, index);
      if (next) {
        commit(next);
        setSelection(null);
      }
    },
    [commit, state],
  );

  const handleEmptyClick = useCallback(
    (target: PileRef) => {
      if (!tryDrop(target)) setSelection(null);
    },
    [tryDrop],
  );

  // Auto-finish deals the remaining cards home one at a time, so it reads as a
  // flourish rather than an instant jump to the win screen.
  useEffect(() => {
    if (!autoRunning) return;
    const id = window.setInterval(() => {
      setState((current) => autoCompleteStep(current) ?? current);
    }, 130);
    return () => window.clearInterval(id);
  }, [autoRunning]);

  // Stop once no card can go home — normally the moment the board is won.
  useEffect(() => {
    if (autoRunning && !autoCompleteStep(state)) setAutoRunning(false);
  }, [autoRunning, state]);

  const startAutoFinish = useCallback(() => {
    setSelection(null);
    setHistory([]);
    setAutoRunning(true);
  }, []);

  const isSelected = (pile: PileRef, index: number): boolean =>
    !!selection && sameRef(selection.from, pile) && index === selection.index;

  const isTrailing = (pile: PileRef, index: number): boolean =>
    !!selection &&
    pile.kind === "tableau" &&
    selection.from.kind === "tableau" &&
    pileIndex(selection.from) === pileIndex(pile) &&
    index > selection.index;

  const wasteTop = state.waste.length - 1;

  return (
    <div className="flex h-full flex-col gap-2 sm:gap-4">
      <style>{CSS}</style>

      {/* Frosted toolbar */}
      <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-2.5 py-2 backdrop-blur-xl sm:gap-3 sm:px-4 sm:py-2.5">
        <div className="flex items-center gap-2">
          <Stat
            icon={<Sparkles className="h-3.5 w-3.5" />}
            label={strings.moves}
            value={String(state.moves)}
          />
          <ClockStat
            running={running}
            stopped={won}
            resetToken={clockResetToken}
            label={strings.time}
            onTick={recordElapsed}
          />
        </div>

        <div className="flex items-center gap-2">
          {autoAvailable && !autoRunning ? (
            <ToolbarButton onClick={startAutoFinish} primary>
              <Sparkles className="h-4 w-4" />
              {strings.autoFinish}
            </ToolbarButton>
          ) : null}
          <ToolbarButton onClick={undo} disabled={history.length === 0 || autoRunning}>
            <Undo2 className="h-4 w-4" />
            <span className="hidden sm:inline">{strings.undo}</span>
          </ToolbarButton>
          <ToolbarButton onClick={startNewGame}>
            <RotateCcw className="h-4 w-4" />
            <span className="hidden sm:inline">{strings.newGame}</span>
          </ToolbarButton>
        </div>
      </div>

      {/* Board. `dir=ltr` keeps the classic layout intact under RTL locales. */}
      <div
        dir="ltr"
        className={cn(
          "relative min-h-0 flex-1 touch-manipulation overflow-auto overscroll-contain rounded-2xl border border-white/10 p-2 shadow-2xl shadow-black/40 sm:rounded-3xl sm:p-6",
          isDragging && "cursor-grabbing select-none",
          "bg-[radial-gradient(ellipse_at_50%_-10%,#12836f_0%,#07694f_42%,#04412f_100%)]",
          "[--sc-w:38px] [--sc-h:calc(var(--sc-w)*1.4)] [--sc-gap:5px] [--sc-down:calc(var(--sc-w)*0.16)] [--sc-up:calc(var(--sc-w)*0.32)]",
          "sm:[--sc-w:62px] sm:[--sc-gap:10px]",
          "md:[--sc-w:76px] md:[--sc-gap:12px]",
          "lg:[--sc-w:88px] lg:[--sc-gap:14px]",
          "xl:[--sc-w:96px] xl:[--sc-gap:16px]",
        )}
      >
        {/* Inner highlight, so the felt reads as a surface rather than a fill. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/10"
        />

        {/* Auto margins (not `items-center`) position the board and still scroll
            correctly once a column outgrows the felt. Phones pin it to the top —
            there the felt is far taller than the deal, and centring left a big
            gap above the cards. From `sm` up it sits centred.
            The reserved min-height is deliberate: without it the board would
            drift every time a column grew, twitching on every move. */}
        <div className="flex min-h-full">
        <div
          ref={boardRef}
          className="mx-auto mb-auto w-fit [perspective:1200px] sm:my-auto"
          style={{
            minHeight:
              "calc(var(--sc-h) * 2 + var(--sc-gap) * 2 + 9 * var(--sc-up))",
          }}
        >
          {/* Stock, waste, foundations */}
          <div className="grid grid-cols-7 gap-[var(--sc-gap)]">
            <div data-pile="stock" className="relative" style={{ height: "var(--sc-h)" }}>
              {state.stock.length > 0 ? (
                <PlayingCardView
                  card={state.stock[state.stock.length - 1]}
                  onClick={handleStockClick}
                  label={strings.stock}
                />
              ) : (
                <EmptySlot onClick={handleStockClick} label={strings.stock}>
                  <RotateCcw className="h-4 w-4" />
                </EmptySlot>
              )}
            </div>

            <div data-pile="waste" className="relative" style={{ height: "var(--sc-h)" }}>
              {state.waste.length > 0 ? (
                <PlayingCardView
                  card={state.waste[wasteTop]}
                  style={{ zIndex: cardZIndex(state.waste[wasteTop].id, 0) }}
                  selected={isSelected({ kind: "waste" }, wasteTop)}
                  onClick={() =>
                    handleCardClick({ kind: "waste" }, wasteTop, state.waste[wasteTop])
                  }
                  onDoubleClick={() => handleCardDoubleClick({ kind: "waste" }, wasteTop)}
                  {...getHandlers({ kind: "waste" }, wasteTop)}
                  label={`${strings.waste}: ${rankLabel(state.waste[wasteTop].rank)}`}
                />
              ) : (
                <EmptySlot label={strings.waste} />
              )}
            </div>

            <div aria-hidden />

            {state.foundations.map((pile, index) => {
              const ref: PileRef = { kind: "foundation", index };
              const top = pile[pile.length - 1];
              return (
                <div
                  key={index}
                  data-pile={`foundation-${index}`}
                  className="relative"
                  style={{ height: "var(--sc-h)" }}
                >
                  {top ? (
                    <PlayingCardView
                      card={top}
                      style={{ zIndex: cardZIndex(top.id, 0) }}
                      selected={isSelected(ref, pile.length - 1)}
                      onClick={() => handleCardClick(ref, pile.length - 1, top)}
                      {...getHandlers(ref, pile.length - 1)}
                      label={`${strings.foundation} ${index + 1}`}
                    />
                  ) : (
                    <EmptySlot
                      onClick={() => handleEmptyClick(ref)}
                      label={`${strings.foundation} ${index + 1}`}
                    >
                      <span className="text-[calc(var(--sc-w)*0.4)] leading-none">
                        {SUIT_SYMBOLS[SUITS[index]]}
                      </span>
                    </EmptySlot>
                  )}
                </div>
              );
            })}
          </div>

          {/* Tableau */}
          <div className="mt-[calc(var(--sc-gap)*2)] grid grid-cols-7 items-start gap-[var(--sc-gap)]">
            {state.tableau.map((pile, column) => {
              const ref: PileRef = { kind: "tableau", index: column };
              const offsets = columnOffsets(pile);
              const lastOffset = offsets[offsets.length - 1] ?? "0px";

              return (
                <div
                  key={column}
                  data-pile={`tableau-${column}`}
                  className="relative"
                  style={{
                    height:
                      pile.length > 0 ? `calc(var(--sc-h) + ${lastOffset})` : "var(--sc-h)",
                    minHeight: "var(--sc-h)",
                  }}
                >
                  {pile.length === 0 ? (
                    <EmptySlot
                      onClick={() => handleEmptyClick(ref)}
                      label={`${strings.column} ${column + 1}`}
                    />
                  ) : (
                    pile.map((card, index) => (
                      <PlayingCardView
                        key={card.id}
                        card={card}
                        style={{ top: offsets[index], zIndex: cardZIndex(card.id, index) }}
                        selected={isSelected(ref, index)}
                        trailing={isTrailing(ref, index)}
                        onClick={() => handleCardClick(ref, index, card)}
                        onDoubleClick={() => handleCardDoubleClick(ref, index)}
                        {...getHandlers(ref, index)}
                        label={
                          card.faceUp
                            ? `${rankLabel(card.rank)} ${SUIT_SYMBOLS[card.suit]}`
                            : `${strings.column} ${column + 1}`
                        }
                      />
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </div>
        </div>

        {won ? (
          <div className="absolute inset-0 z-40 flex items-center justify-center rounded-3xl bg-emerald-950/70 p-6 backdrop-blur-md">
            <div className="solitaire-win flex max-w-sm flex-col items-center gap-4 rounded-3xl border border-white/15 bg-white/[0.07] px-8 py-10 text-center shadow-2xl backdrop-blur-2xl">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-orange-500 shadow-lg shadow-amber-500/30">
                <Trophy className="h-8 w-8 text-slate-950" />
              </span>
              <div>
                <p className="text-3xl font-black tracking-tight text-white">
                  {strings.wonTitle}
                </p>
                <p className="mt-2 text-sm text-emerald-100/80">{strings.wonSubtitle}</p>
              </div>
              <div className="flex items-center gap-2">
                <Stat
                  icon={<Sparkles className="h-3.5 w-3.5" />}
                  label={strings.moves}
                  value={String(state.moves)}
                />
                <Stat
                  icon={<Clock className="h-3.5 w-3.5" />}
                  label={strings.time}
                  value={formatClock(elapsed.current)}
                />
              </div>
              <ToolbarButton onClick={startNewGame} primary>
                <RotateCcw className="h-4 w-4" />
                {strings.playAgain}
              </ToolbarButton>
            </div>
          </div>
        ) : null}
      </div>

      <p className="flex-shrink-0 truncate text-center text-[11px] text-slate-500">
        {strings.howToPlay}
        <span className="mx-2 hidden text-slate-700 sm:inline">·</span>
        <span className="hidden text-slate-600 sm:inline">{strings.shortcutHint}</span>
      </p>
    </div>
  );
};

export default SolitaireGame;
