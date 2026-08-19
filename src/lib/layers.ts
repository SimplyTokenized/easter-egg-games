/**
 * The arcade sits above everything the host app draws.
 *
 * Host apps stack their own modals, drawers and toasts well past `z-50` — the
 * asset manager alone goes to `z-[100001]` — so the arcade claims the very top
 * of the stack instead of guessing a number that stays ahead of them. The
 * dialog itself hard-codes the matching Tailwind class (`z-[2147483000]`)
 * because the host compiles this package's classes by scanning `dist` for
 * literal class names; keep the two in step.
 */
export const ARCADE_Z_INDEX = 2147483000;

/** Confetti is appended to `<body>` by canvas-confetti, so it needs its own
 *  bump to land in front of the arcade rather than behind it. */
export const ARCADE_OVERLAY_Z_INDEX = ARCADE_Z_INDEX + 1;
