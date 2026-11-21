/**
 * `ig-ast.lock.json` (`ig-ast-lock/v1`): the AST cache commit each IG's
 * artefact index is built from, pinned like a layer (bean fwtz, owner's
 * Q-S2-1 answer A, 2026-11-01).
 *
 * A checkout that holds this file next to its `index.lock.json` builds each
 * pinned IG's index from that commit of the IG's AST cache branch, fetched by
 * sha, and never from the branch tip. A re-pin is a reviewed change to this
 * file, with the owner's consent recorded beside the pin, the same as a layer
 * re-pin in `index.config.json`. An IG with no pin here is read as before
 * (the tip), and the build log says so.
 *
 * @module fhir-harness/schemas/ig-ast-lock
 * @graphNode schema
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

export const IG_AST_LOCK_TAG = "ig-ast-lock/v1" as const;
export const IG_AST_LOCK_FILE = "ig-ast.lock.json";

const Sha = z.string().regex(/^[0-9a-f]{40}$/);

export const IgAstPinSchema = z
  .object({
    /** The IG instance, as `index.lock.json` names it. */
    instance: z.string().min(1),
    /** The repository the cache branch lives in: the IG's own. */
    repository: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),
    /** The cache branch the commit was read from, for the reader; the commit is what is fetched. */
    branch: z.string().min(1),
    /** The pinned cache commit. */
    sha: Sha,
    /** The IG commit the AST says it was compiled from (`manifest.json` `inputs.sourceRevision`), when it says. */
    sourceRevision: Sha.optional(),
    consent: z
      .object({
        by: z.string().min(1),
        on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        /** Where the owner said yes: date, time and words. */
        evidence: z.string().min(1),
      })
      .strict(),
  })
  .strict();
export type IgAstPin = z.infer<typeof IgAstPinSchema>;

export const IgAstLockSchema = z
  .object({
    $schema: z.literal(IG_AST_LOCK_TAG),
    pins: z.array(IgAstPinSchema),
  })
  .strict()
  .refine((l) => new Set(l.pins.map((p) => p.instance)).size === l.pins.length, { message: "one pin per instance", path: ["pins"] });
export type IgAstLock = z.infer<typeof IgAstLockSchema>;

/**
 * The checkout's AST pins by layer; empty when it holds no lock. A lock
 * that does not validate is an error, never "no pins": reading it as absent
 * would build from the tip while the checkout says otherwise.
 */
export function astPinsIn(checkout: string): Map<string, IgAstPin> {
  let raw: string;
  try {
    raw = readFileSync(join(checkout, IG_AST_LOCK_FILE), "utf-8");
  } catch {
    return new Map();
  }
  const lock = IgAstLockSchema.parse(JSON.parse(raw));
  return new Map(lock.pins.map((p) => [p.instance, p]));
}
