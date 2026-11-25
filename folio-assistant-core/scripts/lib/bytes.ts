/**
 * Where a catalogue bitstream's bytes are.
 *
 * @module folio-assistant-core/scripts/lib/bytes
 *
 * **Moved from the IRIS catalogue layer's `scripts/lib/` on 2026-09-30 (bean `eayu`).** Owner:
 * *"dspace scripts generic in folio-assistant"*. Nothing here is IRIS's: a
 * `localPath` is layer-relative for EVERY catalogue layer, so the
 * layer directory is now a parameter rather than `import.meta.dir/../..`,
 * which could only ever name that one layer.
 *
 * **This was the `yl5w` workaround, and `yl5w` is settled.** Every `localPath`
 * on an ORIGINAL bitstream pointed at `<that instance>/uploads/…` while the bytes sat
 * in `cat-harness/uploads/` — #477 moved `library/` and left the sources
 * behind — so this module resolved the declared path first and fell back to
 * the real location. Two consumers needed it: the page generator, to emit a
 * link that works, and the cover renderer, to have something to render.
 *
 * 2026-09-21 the owner ruled that a folio's sources live in the folio. The
 * three PDFs were `git mv`-ed to that layer's `uploads/<slug>/`, beside each item's
 * own `intake.json` and IRIS capture, and `check:catalogue` now verifies every
 * `localPath`. **So the fallback is gone rather than left in place**, and that
 * is what the old note promised: the declared path was already tried first, so
 * settling the bean was a deletion rather than a rewrite.
 *
 * What survives is the resolver itself, because the two consumers still need
 * one answer rather than two — and because `undefined` is a real outcome. A
 * node may name no `localPath` at all, and **that is not the same as naming one
 * that is missing**: the first is a bitstream this repository does not hold,
 * the second is a claim that failed, and `check:catalogue` is what reports the
 * second. A generator that conflated them would print "no asset" over a defect.
 */
import { existsSync } from "fs";
import { join, relative, sep } from "path";

/**
 * The declared path, resolved against `instanceDir` — and nothing else is tried.
 *
 * Layer-relative, per `MaterializationSchema.localPath`: *"where the bytes
 * landed, layer-relative"*. Searching elsewhere is what the removed
 * fallback did, and it is precisely what made the contract unenforceable —
 * a resolver that finds the file one layer over reports a false claim as
 * true, which is the defect `yl5w` was opened for.
 *
 * `instanceDir` is the catalogue layer's root, the directory holding its
 * `<name>.json`. `name` is no longer read. It stays in the signature because
 * callers pass it and it is what a future fixity check would compare against;
 * drop it only alongside them.
 */
export function bytesFor(instanceDir: string, localPath: string | undefined, _name: string): string | undefined {
  if (localPath === undefined) return undefined;
  const p = join(instanceDir, localPath);
  return existsSync(p) ? p : undefined;
}

/** A resolved path, made relative to `repoRoot` with `/` separators — what a raw or CDN URL is built from. */
export function repoRelative(repoRoot: string, abs: string): string {
  return relative(repoRoot, abs).split(sep).join("/");
}
