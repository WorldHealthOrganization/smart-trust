/**
 * The emitters' write boundary for per-instance JSON-LD contexts — bean
 * `folio-assistant-63q4`, owner 2026-10-15: an emitted document names
 * `<iriBase>ns/context/v1.jsonld`, the context of the layer its file sits
 * in, in place of the shared `ns/content/v1.jsonld`.
 *
 * ## Why this is here and not only in cat-harness
 *
 * cat-harness#257 adds the same rule to `schemas/content/content-context.ts`
 * (`instanceContext`, `instanceDocumentContext`, `atInstanceContext`). This
 * layer's checks run against cat-harness `main`, which does not have it yet,
 * so the emitters importing it could not typecheck until that merged. The
 * rule is three lines, and the duplicate is deliberate and temporary: once
 * cat-harness#257 is on the pin, the emitters import from there and this
 * module goes. `instance-document-context.test.ts` pins the two to the same
 * answers in the meantime by testing the same cases.
 *
 * @module pipeline/instance-document-context
 * @covers schemas
 */
import { dirname, resolve, sep } from "node:path";

import { layerRootsIn, readDeclaration } from "../schemas/kg/cat-harness.js";
import { CONTENT_CONTEXT_URL } from "../schemas/kg/jsonld.js";

import { HARNESS_ROOT } from "../scripts/lib/roots.ts";

/** Where a layer's own context lives, relative to its `iriBase`. */
export const INSTANCE_CONTEXT_PATH = "ns/context/v1.jsonld";

/** A layer's context URL from its declared `iriBase` (with or without the trailing `/`). */
export function instanceContextUrl(iriBase: string): string {
  return `${iriBase.endsWith("/") ? iriBase : `${iriBase}/`}${INSTANCE_CONTEXT_PATH}`;
}

/** One layer, as the write boundary reads it. */
export interface InstanceContextDecl {
  root: string;
  name: string;
  iriBase?: string;
}

/** Every layer under `checkoutRoot`, with its declared `iriBase`. */
export function instancesIn(checkoutRoot: string): InstanceContextDecl[] {
  return layerRootsIn(checkoutRoot).flatMap((root) => {
    const decl = readDeclaration(root);
    if (decl === undefined) return [];
    // `iriBase` is declared (`CatHarnessSchema`) but not named by the
    // declaration TYPE; read structurally, as `releaseIris` does.
    const iriBase = (decl as { iriBase?: unknown }).iriBase;
    return [{ root: resolve(root), name: decl.name, ...(typeof iriBase === "string" ? { iriBase } : {}) }];
  });
}

let checkoutInstances: InstanceContextDecl[] | undefined;

/**
 * The layers of the checkout this layer sits in, read once — the same
 * checkout cat-harness's `content-context` reads from its own location.
 */
function defaultInstances(): InstanceContextDecl[] {
  if (checkoutInstances === undefined) checkoutInstances = instancesIn(resolve(dirname(HARNESS_ROOT)));
  return checkoutInstances;
}

/**
 * `doc` as it should be WRITTEN at `outputPath`: a document naming the shared
 * content context by URL names its own layer's context instead. Everything
 * else about the context — its local `@base` and bindings — and the key order
 * are kept, since `--check` compares bytes.
 *
 * - A document naming any other context is returned unchanged.
 * - A path inside NO layer (a staged entry) is returned unchanged: no
 *   layer publishes it yet, and promotion regenerates it.
 * - A path inside a layer that declares no `iriBase` THROWS: its document
 *   would otherwise name a context nobody publishes, or silently keep the
 *   shared one.
 */
export function atInstanceContext<T extends Record<string, unknown>>(
  doc: T,
  outputPath: string,
  instances: readonly InstanceContextDecl[] = defaultInstances(),
): T {
  const ctx = doc["@context"];
  const names = Array.isArray(ctx) ? ctx[0] === CONTENT_CONTEXT_URL : ctx === CONTENT_CONTEXT_URL;
  if (!names) return doc;
  const abs = resolve(outputPath);
  let owner: InstanceContextDecl | undefined;
  for (const d of instances) {
    if ((abs === d.root || abs.startsWith(d.root + sep)) && (owner === undefined || d.root.length > owner.root.length)) owner = d;
  }
  if (owner === undefined) return doc;
  if (owner.iriBase === undefined) {
    throw new Error(`instance-document-context: ${owner.name} declares no iriBase, so ${outputPath} has no context URL (<iriBase>${INSTANCE_CONTEXT_PATH}) — declare one in ${owner.name}.json`);
  }
  const url = instanceContextUrl(owner.iriBase);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc)) out[k] = k === "@context" ? (Array.isArray(v) ? [url, ...v.slice(1)] : url) : v;
  return out as T;
}

/** {@link atInstanceContext} over a serialised document (`JSON.stringify(doc, null, 2) + "\n"`, the emitters' one format). */
export function serialisedAtInstanceContext(content: string, outputPath: string, instances?: readonly InstanceContextDecl[]): string {
  if (!content.includes(CONTENT_CONTEXT_URL)) return content;
  const doc = JSON.parse(content) as Record<string, unknown>;
  const next = atInstanceContext(doc, outputPath, instances);
  return next === doc ? content : `${JSON.stringify(next, null, 2)}\n`;
}
