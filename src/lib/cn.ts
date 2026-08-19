import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Conditional class names with Tailwind conflict resolution.
 *
 * Deliberately the same shape as the `cn` most Tailwind apps already have, so
 * the components read identically to their in-app ancestors. Both libraries are
 * peer dependencies, so the host's copies are reused rather than duplicated.
 */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
