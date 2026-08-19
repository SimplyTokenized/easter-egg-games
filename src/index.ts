/**
 * A hidden arcade — click the host application's logo six times.
 *
 * Two symbols do the whole job: a hook that watches the logo, and a component
 * that renders nothing until the hook says otherwise. Everything else in this
 * package sits behind a dynamic `import()` and never reaches a browser that
 * has not found the egg.
 *
 * See README.md for wiring, for the Tailwind step, and for how to add a game.
 */
export { useLogoEasterEgg, type LogoEasterEgg } from "./useLogoEasterEgg";
export { EasterEggArcade, type EasterEggArcadeProps } from "./EasterEggArcade";
export {
  setChunkLoadErrorHandler,
  type ChunkLoadErrorHandler,
} from "./lib/lazy";

// Types only. `getStrings` is deliberately not re-exported here: it carries all
// five translations, and a value export would anchor them in the host's main
// bundle — exactly the weight this package exists to keep out of it.
export type { EasterEggLanguage, EasterEggStrings } from "./strings";
