import type { CSSProperties, PointerEvent, ReactNode } from "react";
import { cn } from "../../lib/cn";
import { isRed, rankLabel, SUIT_SYMBOLS, type PlayingCard } from "./engine";

interface PlayingCardViewProps {
  card: PlayingCard;
  selected?: boolean;
  /** Dimmed because it is being carried along with the selected card above it. */
  trailing?: boolean;
  style?: CSSProperties;
  className?: string;
  onClick?: () => void;
  onDoubleClick?: () => void;
  label?: string;
  onPointerDown?: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove?: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp?: (event: PointerEvent<HTMLElement>) => void;
  onPointerCancel?: (event: PointerEvent<HTMLElement>) => void;
}

/**
 * Card sizes come from the `--sc-*` custom properties the board sets, so the
 * whole game scales by changing one variable at one breakpoint.
 *
 * Note: nothing here may use `transform` for hover or selection. The FLIP
 * animation and the drag handler both write that property directly; a competing
 * CSS transform makes cards snap at the end of every move. Selection is drawn
 * with rings and shadows instead.
 */
export const PlayingCardView = ({
  card,
  selected,
  trailing,
  style,
  className,
  onClick,
  onDoubleClick,
  label,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: PlayingCardViewProps) => {
  const red = isRed(card.suit);

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      data-card-id={card.id}
      data-face-up={card.faceUp}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      style={{ width: "var(--sc-w)", height: "var(--sc-h)", ...style }}
      className={cn(
        "absolute left-0 touch-none select-none rounded-[calc(var(--sc-w)*0.11)] border",
        "shadow-[0_1px_2px_rgba(0,0,0,0.28),0_6px_14px_-8px_rgba(0,0,0,0.45)]",
        // No `will-change` here on purpose: it would promote all 52 cards to
        // their own composited layer for the whole session to serve the two or
        // three that are ever moving. The drag handler sets it on the cards in
        // hand and clears it on drop.
        "transition-[box-shadow,filter] duration-200 ease-out",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-1 focus-visible:ring-offset-emerald-900",
        card.faceUp
          ? "border-black/10 bg-gradient-to-b from-white to-slate-50"
          : "border-white/15 bg-[linear-gradient(135deg,#1e40af_0%,#3b82f6_45%,#4f46e5_100%)]",
        selected &&
          "z-30 shadow-[0_0_0_2px_#fbbf24,0_10px_24px_-6px_rgba(251,191,36,0.65)] brightness-105",
        trailing && "shadow-[0_0_0_2px_rgba(251,191,36,0.45)]",
        onClick ? "cursor-pointer" : "cursor-default",
        className,
      )}
    >
      {card.faceUp ? (
        <span
          className={cn(
            "pointer-events-none flex h-full w-full flex-col justify-between p-[calc(var(--sc-w)*0.07)] leading-none",
            red ? "text-rose-600" : "text-slate-900",
          )}
        >
          <span className="flex items-center gap-[0.1em] text-[calc(var(--sc-w)*0.27)] font-bold tracking-tight">
            {rankLabel(card.rank)}
            <span className="text-[0.85em]">{SUIT_SYMBOLS[card.suit]}</span>
          </span>
          <span className="self-center text-[calc(var(--sc-w)*0.44)] opacity-90">
            {SUIT_SYMBOLS[card.suit]}
          </span>
          {/* Mirrored corner, like a real card. */}
          <span className="self-end rotate-180 text-[calc(var(--sc-w)*0.27)] font-bold tracking-tight">
            {rankLabel(card.rank)}
          </span>
        </span>
      ) : (
        <span className="pointer-events-none flex h-full w-full items-center justify-center">
          <span
            className="h-[72%] w-[72%] rounded-[calc(var(--sc-w)*0.06)] border border-white/25"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, rgba(255,255,255,0.14) 0 3px, transparent 3px 6px)",
            }}
          />
        </span>
      )}
    </button>
  );
};

/** The dashed outline shown where a pile is currently empty. */
export const EmptySlot = ({
  className,
  onClick,
  label,
  children,
}: {
  className?: string;
  onClick?: () => void;
  label?: string;
  children?: ReactNode;
}) => (
  <button
    type="button"
    aria-label={label}
    onClick={onClick}
    style={{ width: "var(--sc-w)", height: "var(--sc-h)" }}
    className={cn(
      "flex touch-manipulation items-center justify-center rounded-[calc(var(--sc-w)*0.11)]",
      "border-2 border-dashed border-white/20 bg-black/15 text-white/35",
      "transition-colors duration-200",
      "focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300",
      onClick ? "cursor-pointer hover:border-white/45 hover:text-white/60" : "cursor-default",
      className,
    )}
  >
    {children}
  </button>
);
