/**
 * The `@context` a content document carries, built from the types it uses.
 *
 * `CONTENT_CONTEXT` (`jsonld.ts`) is the context cat-harness PUBLISHES, so it
 * binds only cat-harness's own prefix and the external vocabularies. A block's
 * kind class is minted in the namespace of the layer that declares the
 * kind, and cat-harness may not name the layers above it. So each document
 * binds the prefixes its own `@type`s use, in the local half of its context,
 * read from the declaring layer's declaration (`instanceNamespace`) rather
 * than from a list here.
 *
 * Node-only: it reads declarations from disk, which is why it is not in
 * `jsonld.ts`.
 *
 * @module cat-harness/schemas/content-context
 * @graphNode none — a function library: it builds a document's context and defines no schema
 */
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { layerRootsIn, readDeclaration } from "../kg/cat-harness.js";
import { checkoutRootFor, declarationChain } from "../kg/harness-config.js";
import { instanceNamespace } from "../kg/instance-repositories.js";
import { CONTENT_CONTEXT, CONTENT_CONTEXT_URL, FOLIO_BASE, instanceContextUrl, instanceKgBase, rebased } from "../kg/jsonld.js";

import { harnessRoot } from "../harness-root.ts";
/**
 * Every layer's prefix — its stub, else its name — mapped to its namespace,
 * over a checkout and, when given, a folio's dependency overlay. Throws when
 * two layers claim one prefix, since a binding would then depend on which
 * was read first.
 */
export function instancePrefixes(checkoutRoot: string, folioRoot?: string): Map<string, string> {
  const roots = new Set(layerRootsIn(checkoutRoot).map((r) => resolve(r)));
  if (folioRoot !== undefined) for (const link of declarationChain(folioRoot)) roots.add(resolve(link.root));
  const out = new Map<string, string>();
  const from = new Map<string, string>();
  for (const root of [...roots].sort()) {
    const decl = readDeclaration(root);
    if (decl === undefined) continue;
    const prefix = decl.stub ?? decl.name;
    const ns = instanceNamespace(decl);
    const seen = out.get(prefix);
    if (seen !== undefined && seen !== ns) {
      throw new Error(`content-context: prefix ${prefix} is declared by both ${from.get(prefix)} and ${root}`);
    }
    out.set(prefix, ns);
    from.set(prefix, root);
  }
  return out;
}

let checkoutPrefixes: Map<string, string> | undefined;

/**
 * {@link instancePrefixes} over the checkout this module sits in, read once —
 * plus the test fixture checkout when `FOLIO_FIXTURE_CHECKOUT` names one, the
 * same convention `declared-nodes.ts` follows: cat-harness standing alone reads
 * core's and sci's block kinds from the fixture, so it must bind their
 * prefixes from the fixture too. The real checkout wins on a shared prefix.
 */
export function defaultInstancePrefixes(): Map<string, string> {
  if (checkoutPrefixes === undefined) {
    // input-site: env-unset FOLIO_FIXTURE_CHECKOUT #eac4c68c — a test-only override naming a checkout outside the tree
    const fixture = process.env.FOLIO_FIXTURE_CHECKOUT;
    checkoutPrefixes = new Map([
      ...(fixture ? instancePrefixes(fixture) : new Map<string, string>()),
      ...instancePrefixes(checkoutRootFor(harnessRoot() ?? dirname(dirname(dirname(fileURLToPath(import.meta.url)))))),
    ]);
  }
  return checkoutPrefixes;
}

/**
 * The context for a document whose `@type`s are `types`: the published
 * context, then a local object carrying `@base` (the content base unless
 * `opts.base` names another, as the docs site's does) and a binding for every
 * layer prefix those types use that the published context does not bind.
 *
 * Throws on a prefix that is neither bound by the published context nor a
 * layer's: a document must never carry a compact IRI no processor can
 * expand.
 */
export function documentContext(
  types: readonly string[],
  opts: { base?: string; prefixes?: ReadonlyMap<string, string>; instance?: string; instances?: readonly InstanceContextDecl[] } = {},
): [string, Record<string, string>] {
  // `instance` names the document's OWN instance context (see
  // {@link instanceContext}); without it, the shared content context.
  // With `instance`, the base is that layer's release too, unless `opts.base`
  // names another (IRI fix 1A).
  const own = opts.instance === undefined ? undefined : instanceContext(opts.instance, opts.instances);
  const url = own?.url ?? CONTENT_CONTEXT_URL;
  const local: Record<string, string> = { "@base": opts.base ?? own?.base ?? FOLIO_BASE };
  // CONTENT_CONTEXT still decides what needs no LOCAL binding: a layer
  // context binds every prefix its documents' types use (it is generated from
  // them), and the ones CONTENT_CONTEXT binds are what those types draw on.
  for (const t of types) {
    const i = t.indexOf(":");
    if (i <= 0 || t.startsWith("http")) continue;
    const prefix = t.slice(0, i);
    if (prefix in CONTENT_CONTEXT || prefix in local) continue;
    const ns = (opts.prefixes ?? defaultInstancePrefixes()).get(prefix);
    if (ns === undefined) throw new Error(`content-context: ${t} uses prefix ${prefix}, which no context binds`);
    local[prefix] = ns;
  }
  return [url, local];
}

/** One layer's declaration, as {@link instanceContext} reads it. */
export interface InstanceContextDecl {
  root: string;
  name: string;
  iriBase?: string;
  /** The declared `version`, whose major the layer's `@base` is minted under (`instanceKgBase`). */
  version?: string;
}

let checkoutInstances: InstanceContextDecl[] | undefined;

/** Every layer in the checkout this module sits in, read once. */
function defaultCheckoutInstances(): InstanceContextDecl[] {
  if (checkoutInstances === undefined) {
    const checkout = checkoutRootFor(harnessRoot() ?? dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
    checkoutInstances = layerRootsIn(checkout).flatMap((root) => {
      const decl = readDeclaration(root);
      if (decl === undefined) return [];
      // `iriBase` is declared (`CatHarnessSchema`), read structurally as
      // `releaseIris` does: the declaration type does not name it.
      const { iriBase, version } = decl as { iriBase?: unknown; version?: unknown };
      return [{
        root: resolve(root),
        name: decl.name,
        ...(typeof iriBase === "string" ? { iriBase } : {}),
        ...(typeof version === "string" ? { version } : {}),
      }];
    });
  }
  return checkoutInstances;
}

/**
 * A layer's published `@context` URL, `<iriBase>ns/context/v1.jsonld`
 * (bean `folio-assistant-63q4`, owner 2026-10-15), and the layer it
 * belongs to.
 *
 * `instance` is a layer NAME, or a PATH — an output file or directory —
 * in which case the innermost layer containing it is meant. A path is the
 * form an emitter has: the context a document names must be the context of
 * the layer its file sits in, since that is the layer whose generated
 * context (`jsonld:contexts`) is computed from it. A context of any other
 * layer would not define the document's terms.
 *
 * Throws when the layer is unknown or declares no `iriBase`: a document
 * must never name a context URL nobody publishes.
 */
export function instanceContext(
  instance: string,
  instances: readonly InstanceContextDecl[] = defaultCheckoutInstances(),
): { name: string; url: string; base: string } {
  let found = instances.find((d) => d.name === instance);
  if (found === undefined && (instance.includes("/") || instance.includes(sep))) {
    const abs = resolve(instance);
    for (const d of instances) {
      if ((abs === d.root || abs.startsWith(d.root + sep)) && (found === undefined || d.root.length > found.root.length)) found = d;
    }
  }
  if (found === undefined) throw new Error(`content-context: no instance in the checkout is ${instance}, or contains it`);
  if (found.iriBase === undefined) {
    throw new Error(`content-context: ${found.name} declares no iriBase, so it has no context URL (<iriBase>ns/context/v1.jsonld) — declare one in ${found.name}.json`);
  }
  let base: string;
  try {
    base = instanceKgBase(found.iriBase, found.version);
  } catch (e) {
    throw new Error(`content-context: ${found.name} has no release to base its documents under: ${(e as Error).message}`);
  }
  return { name: found.name, url: instanceContextUrl(found.iriBase), base };
}

/**
 * The `@context` a document emitted into `instance` carries: that layer's
 * published context by URL, then `@base` in the document's own context —
 * the same two-part shape as {@link CONTENT_DOCUMENT_CONTEXT}, with the
 * shared content context replaced by the layer's own. See
 * {@link instanceContext} for what `instance` may be, and why it throws.
 */
export function instanceDocumentContext(
  instance: string,
  instances?: readonly InstanceContextDecl[],
): [string, { "@base": string }] {
  const ctx = instanceContext(instance, instances);
  return [ctx.url, { "@base": ctx.base }];
}

/**
 * `doc` as it should be WRITTEN at `outputPath`: a document naming the shared
 * content context by URL names its own layer's context instead — the
 * layer whose directory holds `outputPath` (bean `folio-assistant-63q4`).
 * Everything else about the context, its local `@base` and bindings, is kept.
 *
 * This is the one place an emitter switches, applied at the write boundary
 * because that is where the output path is known; the document builders stay
 * path-free and testable on their own.
 *
 * - A document naming any other context is returned unchanged.
 * - A path inside NO layer (a staged entry before promotion) is returned
 *   unchanged: no layer publishes it yet, and promotion regenerates it.
 * - A path inside a layer that declares no `iriBase` THROWS (see
 *   {@link instanceContext}): its document would otherwise name a context
 *   nobody publishes, or silently keep the shared one.
 */
export function atInstanceContext<T extends Record<string, unknown>>(
  doc: T,
  outputPath: string,
  instances: readonly InstanceContextDecl[] = defaultCheckoutInstances(),
): T {
  const ctx = doc["@context"];
  const names = Array.isArray(ctx) ? ctx[0] === CONTENT_CONTEXT_URL : ctx === CONTENT_CONTEXT_URL;
  if (!names) return doc;
  const abs = resolve(outputPath);
  if (!instances.some((d) => abs === d.root || abs.startsWith(d.root + sep))) return doc;
  const { url, base } = instanceContext(abs, instances);
  // Rebuilt key by key so `@context` keeps its place: emitted bytes are
  // compared by `--check`, and key order is part of them.
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc)) out[k] = k === "@context" ? (Array.isArray(v) ? [url, ...v.slice(1).map((c) => rebased(c, base))] : url) : v;
  return out as T;
}

/** {@link atInstanceContext} over a serialised document (`JSON.stringify(doc, null, 2) + "\n"`, the emitters' one format). */
export function serialisedAtInstanceContext(content: string, outputPath: string, instances?: readonly InstanceContextDecl[]): string {
  if (!content.includes(CONTENT_CONTEXT_URL)) return content;
  const doc = JSON.parse(content) as Record<string, unknown>;
  const next = atInstanceContext(doc, outputPath, instances);
  return next === doc ? content : `${JSON.stringify(next, null, 2)}\n`;
}
