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
import { CONTENT_CONTEXT_URL, FOLIO_BASE, instanceKgBase, rebased } from "../schemas/kg/jsonld.js";

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
  /** The declared `version`, whose major the layer's `@base` is minted under ({@link instanceKgBase}). */
  version?: string;
}

/** Every layer under `checkoutRoot`, with its declared `iriBase`. */
export function instancesIn(checkoutRoot: string): InstanceContextDecl[] {
  return layerRootsIn(checkoutRoot).flatMap((root) => {
    const decl = readDeclaration(root);
    if (decl === undefined) return [];
    // `iriBase` is declared (`CatHarnessSchema`) but not named by the
    // declaration TYPE; read structurally, as `releaseIris` does.
    const { iriBase, version } = decl as { iriBase?: unknown; version?: unknown };
    return [{
      root: resolve(root),
      name: decl.name,
      ...(typeof iriBase === "string" ? { iriBase } : {}),
      ...(typeof version === "string" ? { version } : {}),
    }];
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
 * else about the context — its other local bindings, and the key order — is
 * kept, since `--check` compares bytes.
 *
 * The local `@base` moves too when it is the shared {@link FOLIO_BASE},
 * which no site serves: to the layer's own release, `<iriBase>v<major>/`
 * ({@link instanceKgBase}; IRI fix 1A, owner 2026-11-18). Any other `@base`,
 * the docs site's for one, is the emitter's choice and is kept.
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
  let base: string;
  try {
    base = instanceKgBase(owner.iriBase, owner.version);
  } catch (e) {
    throw new Error(`instance-document-context: ${owner.name} has no release to base ${outputPath} under: ${(e as Error).message}`);
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc)) out[k] = k === "@context" ? (Array.isArray(v) ? [url, ...v.slice(1).map((c) => rebased(c, base))] : url) : v;
  return out as T;
}

/**
 * The transition to a layer's own `@base` (IRI fix 1A, owner 2026-11-18):
 * whether `committed` is `regenerated` but for still carrying the shared
 * {@link FOLIO_BASE} where `regenerated` carries the layer's release base.
 *
 * The base move rewrites every emitted file in every layer, and the layers
 * regenerate when they re-pin, not when this layer merges. Until then a
 * `--check` that called each such file stale would be red over thousands of
 * files no PR here can change. So a generator's `--check` counts these as
 * AWAITING REGENERATION and passes; any other difference is stale as before,
 * and a write (no `--check`) always writes the new base.
 *
 * REMOVE once every layer's committed output carries its own base.
 */
export function awaitingRebase(committed: string | undefined, regenerated: string): boolean {
  if (committed === undefined || committed === regenerated) return false;
  const old = `"@base": ${JSON.stringify(FOLIO_BASE)}`;
  if (!committed.includes(old)) return false;
  const m = /"@base": ("https?:\/\/[^"]+\/v(?:0|[1-9]\d*)\/")/.exec(regenerated);
  if (m === null) return false;
  return committed.split(old).join(`"@base": ${m[1]}`) === regenerated;
}

/** The line a `--check` prints for the files {@link awaitingRebase} let through, or nothing. */
export function awaitingRebaseNote(tool: string, count: number): string | undefined {
  if (count === 0) return undefined;
  return `${tool} --check: ${count} file(s) differ only by the old shared @base (${FOLIO_BASE}) and await regeneration under the layer's own release (IRI fix 1A); run ${tool} to write them`;
}

/** {@link atInstanceContext} over a serialised document (`JSON.stringify(doc, null, 2) + "\n"`, the emitters' one format). */
export function serialisedAtInstanceContext(content: string, outputPath: string, instances?: readonly InstanceContextDecl[]): string {
  if (!content.includes(CONTENT_CONTEXT_URL)) return content;
  const doc = JSON.parse(content) as Record<string, unknown>;
  const next = atInstanceContext(doc, outputPath, instances);
  return next === doc ? content : `${JSON.stringify(next, null, 2)}\n`;
}
