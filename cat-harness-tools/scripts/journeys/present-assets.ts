/**
 * The files the presentation pages ship to the browser.
 *
 * A leaf module, so `render.ts` can spread them into its own `ASSETS` at load
 * time. `present.ts` and `render.ts` import each other, so a value one reads
 * at the top level from the other is still uninitialised whenever the other
 * is loaded first; read from here, the order does not matter.
 *
 * @module scripts/journeys/present-assets
 * @covers none — a constant list of asset file names
 */
export const PRESENT_ASSETS = ["present.css", "present.js", "gap-report.js", "canvas-pdf.js"] as const;
