import * as RadixDialog from "@radix-ui/react-dialog";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "./cn";

/**
 * The arcade's own dialog, built straight on the Radix primitive.
 *
 * The host app almost certainly has a Dialog component of its own, but reaching
 * for it would tie this package to one app's design system — and the arcade
 * wants none of it anyway: it is full-bleed, always dark, and draws its own
 * close button. Going direct means no `!important` overrides fighting a centred,
 * width-capped default.
 *
 * Focus trapping, scroll locking, Esc-to-close, `aria-modal` and returning focus
 * to the logo on close all come from Radix.
 *
 * The `z-[2147483000]` below is `ARCADE_Z_INDEX` from `./layers`, spelled out as
 * a literal because the host app compiles these classes by scanning the built
 * `dist` for class names — a computed one would never be generated. Change both
 * together.
 */
export const Dialog = RadixDialog.Root;
export const DialogTitle = RadixDialog.Title;
export const DialogDescription = RadixDialog.Description;

interface FullScreenContentProps extends ComponentPropsWithoutRef<typeof RadixDialog.Content> {
  children: ReactNode;
  className?: string;
  overlayClassName?: string;
}

/**
 * A dialog that fills the viewport.
 *
 * `100dvh` rather than `100vh`: on mobile Safari and Chrome the browser toolbars
 * would otherwise push the close button and the footer off screen.
 */
export const DialogFullScreenContent = ({
  children,
  className,
  overlayClassName,
  ...props
}: FullScreenContentProps) => (
  <RadixDialog.Portal>
    <RadixDialog.Overlay
      className={cn(
        "arcade-overlay fixed inset-0 z-[2147483000] bg-black/70 backdrop-blur-md",
        overlayClassName,
      )}
    />
    <RadixDialog.Content
      // The picker has a visible description; the games do not. Opting out
      // keeps Radix from warning about the missing `aria-describedby` there.
      aria-describedby={undefined}
      className={cn(
        "arcade-content fixed inset-0 z-[2147483000] h-[100dvh] w-screen overflow-hidden",
        "bg-[#070b18] text-slate-100 outline-none",
        className,
      )}
      {...props}
    >
      {children}
    </RadixDialog.Content>
  </RadixDialog.Portal>
);
