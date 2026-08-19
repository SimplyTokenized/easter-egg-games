import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, Lock, Play, X } from "lucide-react";
import {
  Dialog,
  DialogDescription,
  DialogFullScreenContent,
  DialogTitle,
} from "./lib/Dialog";
import { cn } from "./lib/cn";
import { BeachSpinner } from "./BeachSpinner";
import { format, getStrings } from "./strings";
import { GAMES, type GameDefinition } from "./games/registry";
import { GameArt } from "./games/GameArt";

/**
 * The beach animation is the point of the easter egg, so the spinner is held
 * for a full cycle even when the chunk arrives sooner.
 */
const MIN_SPINNER_MS = 3300;

/** Fast out, gentle settle — used for every transition in the arcade. */
const CSS = `
@keyframes arcade-rise {
  from { opacity: 0; transform: translateY(18px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes arcade-fade {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes arcade-drift {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50%      { transform: translate(24px, -18px) scale(1.08); }
}
@keyframes arcade-sheen {
  from { transform: translateX(-120%) skewX(-18deg); }
  to   { transform: translateX(240%) skewX(-18deg); }
}

.arcade-rise  { animation: arcade-rise 620ms cubic-bezier(0.22, 1, 0.36, 1) both; }
.arcade-fade  { animation: arcade-fade 500ms ease-out both; }
.arcade-orb   { animation: arcade-drift 18s ease-in-out infinite; }
.arcade-orb-2 { animation-duration: 24s; animation-delay: -6s; }
.arcade-orb-3 { animation-duration: 30s; animation-delay: -12s; }

/* Radix has no animation of its own; these replace what a design-system
   Dialog wrapper would normally have supplied. */
.arcade-overlay[data-state="open"] { animation: arcade-fade 220ms ease-out both; }
.arcade-content[data-state="open"] { animation: arcade-fade 260ms ease-out both; }

/* Light sweeps across a tile on hover, the way a real cabinet catches a room. */
.arcade-tile:hover .arcade-sheen,
.arcade-tile:focus-visible .arcade-sheen {
  animation: arcade-sheen 900ms cubic-bezier(0.22, 1, 0.36, 1);
}

@media (prefers-reduced-motion: reduce) {
  .arcade-rise, .arcade-fade, .arcade-orb,
  .arcade-overlay[data-state="open"], .arcade-content[data-state="open"] {
    animation: none !important; opacity: 1; transform: none;
  }
  .arcade-tile:hover .arcade-sheen { animation: none !important; }
}
`;

interface ArcadeModalProps {
  open: boolean;
  onClose: () => void;
  /**
   * BCP-47 tag from the host, e.g. `de` or `de-AT`. Anything unrecognised
   * falls back to English; the arcade carries its own strings and never
   * touches the host's i18n runtime.
   */
  language?: string;
}

export const ArcadeModal = ({ open, onClose, language }: ArcadeModalProps) => {
  const strings = useMemo(() => getStrings(language), [language]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [warmingId, setWarmingId] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  // Closing the arcade resets it, so the next visit starts at the game picker.
  useEffect(() => {
    if (open) return;
    clearTimer();
    setActiveId(null);
    setWarmingId(null);
  }, [clearTimer, open]);

  const launch = useCallback(
    (game: GameDefinition) => {
      if (!game.component) return;
      clearTimer();
      setWarmingId(game.id);
      timer.current = window.setTimeout(() => {
        timer.current = null;
        setActiveId(game.id);
        setWarmingId(null);
      }, MIN_SPINNER_MS);
    },
    [clearTimer],
  );

  const exitGame = useCallback(() => {
    clearTimer();
    setActiveId(null);
    setWarmingId(null);
  }, [clearTimer]);

  const pending = GAMES.find((game) => game.id === warmingId);
  const active = GAMES.find((game) => game.id === activeId);
  const ActiveComponent = active?.component;
  const inGame = !!(pending || active);

  const loadingLabel = (game: GameDefinition | undefined) =>
    game ? format(strings.loadingGame, { game: strings[game.nameKey] }) : undefined;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogFullScreenContent>
        <style>{CSS}</style>

        {/* Backdrop: layered light, a faint grid, and slow drifting colour. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(1100px 620px at 50% -12%, rgba(56,189,248,0.20), transparent 62%)," +
                "radial-gradient(820px 520px at 8% 108%, rgba(168,85,247,0.18), transparent 60%)," +
                "radial-gradient(760px 520px at 96% 92%, rgba(244,114,182,0.14), transparent 60%)",
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.55]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px)," +
                "linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
              maskImage: "radial-gradient(circle at 50% 35%, black, transparent 78%)",
              WebkitMaskImage: "radial-gradient(circle at 50% 35%, black, transparent 78%)",
            }}
          />
          {/* Only on the picker. Scaling a 64px-blurred layer forces the
              compositor to re-rasterise a large surface every frame, and a
              running game needs those frames more than the wallpaper does. */}
          {!inGame && (
            <>
              <div className="arcade-orb absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-sky-500/20 blur-3xl" />
              <div className="arcade-orb arcade-orb-2 absolute right-0 top-0 h-80 w-80 rounded-full bg-fuchsia-500/15 blur-3xl" />
              <div className="arcade-orb arcade-orb-3 absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />
            </>
          )}
        </div>

        <div className="relative flex h-full flex-col">
          {/* Frosted top bar */}
          <header
            className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur-xl sm:px-6"
            style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
          >
            <div className="flex min-w-0 items-center gap-3">
              {inGame ? (
                <button
                  type="button"
                  onClick={exitGame}
                  className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 py-1.5 pl-2 pr-3.5 text-sm text-slate-200 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">{strings.backToArcade}</span>
                </button>
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-fuchsia-500 text-[13px] font-black text-white shadow-lg shadow-sky-500/25">
                  ▶
                </span>
              )}
              <DialogTitle className="truncate text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">
                {active ? strings[active.nameKey] : strings.arcadeTitle}
              </DialogTitle>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label={strings.close}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </header>

          {/* Body */}
          <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
            {pending ? (
              <div className="arcade-fade flex h-full items-center justify-center p-6">
                <BeachSpinner
                  label={loadingLabel(pending)}
                  className="w-full max-w-md text-slate-300"
                />
              </div>
            ) : ActiveComponent ? (
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center p-6">
                    <BeachSpinner
                      label={loadingLabel(active)}
                      className="w-full max-w-md text-slate-300"
                    />
                  </div>
                }
              >
                <div className="mx-auto h-full w-full max-w-[1500px] px-3 py-3 sm:px-6 sm:py-5">
                  <ActiveComponent strings={strings} onExit={exitGame} />
                </div>
              </Suspense>
            ) : (
              <div
                className="mx-auto w-full max-w-[1200px] px-4 py-7 sm:px-8 sm:py-16"
                style={{ paddingBottom: "max(1.75rem, env(safe-area-inset-bottom))" }}
              >
                {/* Hero */}
                <div className="arcade-rise mb-6 text-center sm:mb-14">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-sky-300/80 sm:mb-3 sm:text-xs sm:tracking-[0.32em]">
                    {strings.chooseGame}
                  </p>
                  <h2 className="bg-gradient-to-br from-white via-sky-100 to-fuchsia-200 bg-clip-text text-[1.75rem] font-black leading-[1.08] tracking-tight text-transparent sm:text-6xl">
                    {strings.arcadeTitle}
                  </h2>
                  <DialogDescription className="mx-auto mt-2.5 max-w-md text-balance text-[13px] text-slate-400 sm:mt-4 sm:text-base">
                    {strings.arcadeSubtitle}
                  </DialogDescription>
                </div>

                {/* Tiles. One row per game on phones (art beside the text, so
                    four games fit on screen), cards from `sm` up. */}
                <div className="grid grid-cols-1 gap-3 sm:gap-5 md:grid-cols-2 lg:grid-cols-4">
                  {GAMES.map((game, index) => {
                    const available = !!game.component;
                    return (
                      <button
                        key={game.id}
                        type="button"
                        disabled={!available}
                        onClick={() => launch(game)}
                        style={{ animationDelay: `${120 + index * 70}ms` }}
                        className={cn(
                          // flex column + mt-auto on the CTA keeps every button on
                          // one line no matter how long a description runs.
                          "arcade-tile arcade-rise group relative flex flex-row overflow-hidden rounded-2xl border text-left sm:flex-col sm:rounded-3xl",
                          "border-white/10 bg-white/[0.04] backdrop-blur-xl",
                          "touch-manipulation transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                          "focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070b18]",
                          available
                            ? "cursor-pointer active:scale-[0.985] sm:hover:-translate-y-1.5 sm:hover:border-white/25 sm:hover:bg-white/[0.07] sm:hover:shadow-2xl sm:hover:shadow-black/50 sm:active:translate-y-0"
                            : "cursor-not-allowed",
                        )}
                      >
                        {/* Cover art — a square thumbnail in the phone row, a
                            full-width panel once the tiles become cards. */}
                        <div className="relative w-28 flex-shrink-0 self-stretch overflow-hidden sm:aspect-[4/3] sm:w-full sm:self-auto">
                          <div
                            className={cn(
                              "h-full w-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                              available
                                ? "group-hover:scale-[1.06]"
                                : "scale-100 opacity-40 grayscale",
                            )}
                          >
                            <GameArt gameId={game.id} />
                          </div>

                          {/* Sheen */}
                          <span className="pointer-events-none absolute inset-0 overflow-hidden">
                            <span className="arcade-sheen absolute inset-y-0 -left-1/3 w-1/3 -translate-x-[120%] skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                          </span>

                          <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-16 bg-gradient-to-t from-black/60 to-transparent sm:block" />
                        </div>

                        {/* Caption */}
                        <div className="flex min-w-0 flex-1 flex-col p-3.5 sm:p-5">
                          <h3
                            className={cn(
                              "text-base font-semibold tracking-tight sm:text-lg",
                              available ? "text-white" : "text-slate-400",
                            )}
                          >
                            {strings[game.nameKey]}
                          </h3>
                          <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-slate-400 sm:mt-1 sm:text-sm">
                            {strings[game.descriptionKey]}
                          </p>

                          {/* mt-auto pins every CTA to the same baseline. */}
                          <span className="mt-auto pt-2.5 sm:pt-4">
                            {available ? (
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r px-3.5 py-1.5 text-sm font-semibold text-slate-950 shadow-lg",
                                  "transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:gap-2.5",
                                  game.accent,
                                )}
                              >
                                <Play className="h-3.5 w-3.5 fill-current" />
                                {strings.play}
                                <ChevronRight className="h-3.5 w-3.5 opacity-70" />
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3.5 py-1.5 text-sm text-slate-500">
                                <Lock className="h-3.5 w-3.5" />
                                {strings.comingSoon}
                              </span>
                            )}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Only Esc applies here — the game shortcuts live in the game. */}
                <p className="arcade-fade mt-10 text-center text-xs text-slate-600">
                  <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-sans">
                    Esc
                  </kbd>{" "}
                  {strings.close}
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogFullScreenContent>
    </Dialog>
  );
};

export default ArcadeModal;
