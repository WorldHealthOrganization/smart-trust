/**
 * Which content adapter a declared content type gets — discovered from the
 * layers that ship one, resolved at startup.
 *
 * ## Why this is not a `switch`
 *
 * `src/index.ts` is the composition root, and it read:
 *
 * ```ts
 * import { PaperContentAdapter } from "../adapters/paper/index.js";
 * import { DocumentContentAdapter } from "../adapters/document/index.js";
 * // ...
 * switch (adapterType) { case "document": ... default: new PaperContentAdapter(...) }
 * ```
 *
 * The paper adapter is the science layer's — it registers Lean and LaTeX tools
 * — so the generic entry point imported it unconditionally. After the split
 * that import does not resolve in a core-only checkout, and the module fails
 * to load before any of its own error handling runs.
 *
 * ## Why it is not a TABLE either, since 2026-09-30
 *
 * The switch became a table here of the formal-math layer's `adapters/paper/index.ts`
 * and the content core's `adapters/document/index.ts`, loaded by variable
 * path. That fixed the load failure and kept the edge: the harness still named
 * two layers built on top of it, so it could not be lifted into its own
 * repository, and — being a variable import — no static gate could see it.
 * The table's own comment said so.
 *
 * So the dependency is inverted. Each layer that ships an adapter declares
 * it in its own `<instance>.json` under `contentAdapters`
 * ({@link ContentAdapterDeclaration}), and this file reads the declarations of
 * the layers in the checkout. It names none of them. `check:import-direction`
 * is the gate that now sees the shape it replaced (bean `p11x`).
 *
 * **Where it looks is unchanged**: the checkout directory `cat-harness/` sits
 * in, one level deep — exactly where the `../<instance>/` paths resolved. The
 * `module` each entry carries is still relative to `cat-harness/`, so
 * `init-folio.ts`, which writes it into a new folio's config, needs no change.
 *
 * ## An absent adapter is reported, and the fallback is honest
 *
 * The old default was `paper` for a good reason: every folio predating the
 * document type declares `contentType: "paper"` or nothing, and the paper
 * adapter is a superset that registers the document tools too. Defaulting the
 * other way would silently drop `lean_build` from a folio whose config omits
 * `contentType`.
 *
 * That order is now DERIVED rather than positional: an adapter that `extends`
 * another sorts ahead of it, because the specialisation is the superset. And
 * when the requested type is not installed, falling back silently would hand
 * a paper folio an adapter with no `lean_build` — so the fallback is taken, and
 * SAID, naming what is not registered.
 *
 * @module src/builtin-adapters
 */

import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import {
  ContentAdapterDeclarationSchema,
  findDeclarationFile,
  layerRootsIn,
  repoRootFor,
  type ContentAdapterDeclaration,
} from "../schemas/kg/cat-harness.js";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";

const ROOT = resolve(HARNESS_ROOT);

export interface BuiltinAdapterDeclaration {
  /** The `contentType` this answers, as declared in `harness.config.json`. */
  contentType: string;
  /**
   * Module path relative to `cat-harness/` — composed from the declaring
   * layer's root and its instance-relative `module`. Resolved by VARIABLE
   * path; this file imports none.
   */
  module: string;
  /** The exported class. */
  className: string;
  /** The layer whose declaration this came from — for the boot log. */
  instance: string;
  /** That layer's absolute root, so a caller can walk its `needs` without rescanning. */
  root: string;
  /** The `contentType` this one specialises, if declared. */
  extends?: string;
}

/** Two layers declaring one `contentType`. Not resolved by order — see `schemas/content/contributions.ts`. */
export class AdapterDeclarationCollisionError extends Error {}

/** How many `extends` hops lie beneath this entry — deeper sorts first. */
function depth(d: BuiltinAdapterDeclaration, byType: ReadonlyMap<string, BuiltinAdapterDeclaration>): number {
  let n = 0;
  const seen = new Set<string>([d.contentType]);
  for (let cur = d.extends; cur !== undefined && byType.has(cur) && !seen.has(cur); cur = byType.get(cur)!.extends) {
    seen.add(cur);
    n++;
  }
  return n;
}

/**
 * Every content adapter declared by a layer in `checkoutRoot`, in fallback
 * preference order: most specialised first, then declaration order.
 *
 * A declaration that cannot be read contributes nothing and is RECORDED in
 * `problems` — "could not read" is not "declares none", and a boot that falls
 * back must be able to say which it was.
 */
export function discoverBuiltinAdapters(
  checkoutRoot: string = repoRootFor(ROOT),
  harnessRoot: string = ROOT,
): { adapters: BuiltinAdapterDeclaration[]; problems: string[] } {
  const found: BuiltinAdapterDeclaration[] = [];
  const problems: string[] = [];
  for (const root of layerRootsIn(checkoutRoot)) {
    const file = findDeclarationFile(root);
    if (file === undefined) continue;
    let raw: { name?: unknown; contentAdapters?: unknown };
    try {
      raw = JSON.parse(readFileSync(join(root, file), "utf-8"));
    } catch (e) {
      problems.push(`${relative(checkoutRoot, join(root, file))}: could not be read (${e instanceof Error ? e.message : String(e)})`);
      continue;
    }
    if (raw.contentAdapters === undefined) continue;
    const name = typeof raw.name === "string" ? raw.name : relative(checkoutRoot, root);
    const parsed = ContentAdapterDeclarationSchema.array().safeParse(raw.contentAdapters);
    if (!parsed.success) {
      problems.push(`${name}: \`contentAdapters\` is malformed (${parsed.error.issues.map((i) => i.message).join("; ")})`);
      continue;
    }
    for (const a of parsed.data as ContentAdapterDeclaration[]) {
      found.push({
        contentType: a.contentType,
        module: relative(harnessRoot, join(root, a.module)).split("\\").join("/"),
        className: a.className,
        instance: name,
        root,
        ...(a.extends !== undefined ? { extends: a.extends } : {}),
      });
    }
  }

  const byType = new Map<string, BuiltinAdapterDeclaration>();
  for (const d of found) {
    const prior = byType.get(d.contentType);
    if (prior) {
      throw new AdapterDeclarationCollisionError(
        `contentType "${d.contentType}" is declared by both "${prior.instance}" and "${d.instance}". ` +
          `Adapters do not resolve by load order — one of the two declarations has to go.`,
      );
    }
    byType.set(d.contentType, d);
  }

  const order = new Map(found.map((d, i) => [d, i]));
  const adapters = [...found].sort((a, b) => depth(b, byType) - depth(a, byType) || order.get(a)! - order.get(b)!);
  return { adapters, problems };
}

const DISCOVERED = discoverBuiltinAdapters();

/**
 * Ordered by preference for the fallback: the first INSTALLED entry is what an
 * unresolvable content type falls back to. A specialisation leads its base
 * because it is the superset — `paper` registers the document tools as well —
 * so falling back to it loses nothing, while falling back from it loses Lean
 * and TeX.
 */
export const BUILTIN_ADAPTERS: BuiltinAdapterDeclaration[] = DISCOVERED.adapters;

export interface AdapterResolution {
  /** The constructor, ready to `new`. */
  ctor: new (...args: never[]) => unknown;
  /** Which declaration answered — may differ from what was asked for. */
  used: BuiltinAdapterDeclaration;
  /**
   * Set when `used` is not what was requested. Never empty on a fallback: a
   * paper folio running on the document adapter has no `lean_build`, and the
   * operator must learn that here rather than from a failing tool call.
   */
  fallbackReason?: string;
}

/**
 * Resolve a declared content type to its built-in adapter class.
 *
 * Throws only when NO declared adapter is installed — at that point the
 * process genuinely cannot serve content, and starting anyway would present an
 * empty server as a working one.
 */
export async function resolveBuiltinAdapter(
  contentType: string,
  adapters: readonly BuiltinAdapterDeclaration[] = BUILTIN_ADAPTERS,
  problems: readonly string[] = DISCOVERED.problems,
): Promise<AdapterResolution> {
  const asked = adapters.find((a) => a.contentType === contentType);
  const tried: string[] = [];

  const load = async (d: BuiltinAdapterDeclaration): Promise<(new (...args: never[]) => unknown) | undefined> => {
    const abs = resolve(ROOT, d.module);
    if (!existsSync(abs)) {
      tried.push(`${d.contentType}: ${d.module} is not installed (declared by ${d.instance})`);
      return undefined;
    }
    try {
      // VARIABLE specifier — the module comes from the layer's declaration.
      const mod = (await import(abs)) as Record<string, unknown>;
      const ctor = mod[d.className];
      if (typeof ctor !== "function") {
        tried.push(`${d.contentType}: ${d.module} exports no ${d.className}`);
        return undefined;
      }
      return ctor as new (...args: never[]) => unknown;
    } catch (e) {
      tried.push(`${d.contentType}: ${d.module} failed to load: ${e instanceof Error ? e.message : String(e)}`);
      return undefined;
    }
  };

  if (asked) {
    const ctor = await load(asked);
    if (ctor) return { ctor, used: asked };
  }

  for (const d of adapters) {
    if (asked && d.contentType === asked.contentType) continue;
    const ctor = await load(d);
    if (ctor) {
      return {
        ctor,
        used: d,
        fallbackReason: asked
          ? `contentType "${contentType}" declares the ${asked.contentType} adapter, which is unavailable ` +
            `(${tried[0]}); using ${d.contentType} instead — tools specific to ${asked.contentType} are NOT registered`
          : `contentType "${contentType}" matches no built-in adapter declared by an installed instance; ` +
            `using ${d.contentType} instead — tools specific to ${contentType} are NOT registered` +
            (problems.length > 0 ? ` (and ${problems.length} declaration(s) could not be read: ${problems.join("; ")})` : ""),
      };
    }
  }

  throw new Error(
    `no built-in content adapter is installed. Tried:\n  ${tried.join("\n  ") || "(no instance in the checkout declares `contentAdapters`)"}\n` +
      (problems.length > 0 ? `Could not read:\n  ${problems.join("\n  ")}\n` : "") +
      `A server with no adapter can serve no content, so it does not start.`,
  );
}

/**
 * Resolve the print preamble template path supplied by the built-in adapter for
 * `contentType` (default `"paper"`).
 *
 * Returns `undefined` when the requested adapter is not installed (even if
 * {@link resolveBuiltinAdapter} would fall back to its base) or declares no
 * `preamblePath`, so a fallback adapter is never mistaken for a paper preamble.
 */
export async function resolveAdapterPreamble(
  contentType: string = "paper",
  adapters: readonly BuiltinAdapterDeclaration[] = BUILTIN_ADAPTERS,
  problems: readonly string[] = DISCOVERED.problems,
): Promise<string | undefined> {
  try {
    const r = await resolveBuiltinAdapter(contentType, adapters, problems);
    if (r.used.contentType !== contentType) return undefined;
    const preamblePath = (r.ctor as { preamblePath?: unknown }).preamblePath;
    return typeof preamblePath === "string" ? preamblePath : undefined;
  } catch {
    return undefined;
  }
}
