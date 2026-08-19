import { lazy, type ComponentType, type LazyExoticComponent } from "react";

type DefaultExportModule<T extends ComponentType<any>> = { default: T };

/**
 * What to do when a code-split chunk fails to arrive.
 *
 * A single-page app that has been redeployed while a tab sat open will 404 on
 * every chunk URL it has not fetched yet, and the arcade is nothing but chunks.
 * Hosts usually already have a recovery routine for this (typically "reload
 * once, then give up"); this is where they hand it to us. Returning a promise
 * that never settles is fine and expected — the page is reloading.
 */
export type ChunkLoadErrorHandler = (error: unknown) => Promise<never> | never;

let onChunkLoadError: ChunkLoadErrorHandler | null = null;

/**
 * Register the host's stale-chunk recovery. Call once during app start-up.
 * Without it a failed chunk simply propagates to the nearest error boundary.
 */
export function setChunkLoadErrorHandler(handler: ChunkLoadErrorHandler | null): void {
  onChunkLoadError = handler;
}

/** `React.lazy`, routed through the host's chunk-failure handler when there is one. */
export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<DefaultExportModule<T>>,
): LazyExoticComponent<T> {
  return lazy(() =>
    importFn().catch((error: unknown) => {
      if (onChunkLoadError) return onChunkLoadError(error);
      throw error;
    }),
  );
}
