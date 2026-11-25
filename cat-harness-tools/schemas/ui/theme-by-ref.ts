/**
 * A theme by REFERENCE — `{instance?, themeId}` — resolved against the
 * layer that owns it, not only against the platform's own table
 * ({@link THEMES}).
 *
 * @module cat-harness/schemas/theme-by-ref
 * @graphNode none — a resolver over theme nodes declared elsewhere; it defines no schema of its own
 *
 * ## The platform finds a layer's themes; it never holds them
 *
 * A palette read off an organisation's style guide is subject matter, so it
 * lives in its layer, not in `cat-harness/schemas/`. Nothing here names a
 * layer or copies a colour. The owner is found by its declared `name`, its
 * themes by the directory it declares with graph typology `themes`, and the
 * module there by one convention: a `themes.ts` exporting `INSTANCE_THEMES`,
 * already resolved. The harness loads a layer by what its declaration says
 * rather than importing it, so it still builds alone.
 *
 * ## Absent is not the platform's
 *
 * A reference with no `instance` means the CITING layer's own
 * ({@link ThemeRefSchema}). The platform table is the answer only when the
 * owner is the platform itself or nobody is named.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

import { declaresInstance, instanceDirectoriesForGraph, layerRootsIn, readDeclaration } from "../kg/cat-harness.js";
import type { ResolvedTheme, ThemeRef } from "./theme.js";
import { themeById } from "./themes.js";

/** The layer whose themes are {@link THEMES} — the default `platform` below. */
export const PLATFORM_THEME_OWNER = "cat-harness";

/** The graph typology a layer's own themes are declared under. */
export const THEMES_GRAPH_TYPOLOGY = "themes";
/** The module a `themes` directory holds, and the export it must carry. */
export const INSTANCE_THEMES_MODULE = "themes.ts";
export const INSTANCE_THEMES_EXPORT = "INSTANCE_THEMES";

/** Why a reference did not resolve — each a different repair. */
export type ThemeRefMiss =
  | { kind: "no-such-instance"; instance: string }
  | { kind: "no-themes-directory"; instance: string }
  | { kind: "no-themes-module"; instance: string; path: string }
  | { kind: "no-such-theme"; instance: string; themeId: string };

export type ThemeRefResult = { ok: true; theme: ResolvedTheme; owner: string | undefined } | { ok: false; miss: ThemeRefMiss };

/**
 * The themes a layer declares, or why it declares none that can be read.
 *
 * **Exported so a GATE can ask the same question the runtime asks.** Bean
 * `z6xd`: three gates declared `@covers themes` while none of them resolved a
 * `themes` directory — they audit the platform's `THEMES` constants and the
 * declared theme ART, which the IRIS replica's declaration is explicit are different
 * things (*"These are NOT the platform's twelve themes"*). A gate that reached
 * the graph by re-deriving this resolution would be a second answer to
 * "which themes does this instance own", free to disagree with the one every
 * generator actually renders from — so `check:instance-themes` calls this.
 */
export function instanceThemes(repoRoot: string, instance: string): { ok: true; themes: readonly ResolvedTheme[] } | { ok: false; miss: ThemeRefMiss } {
  const root = layerRootsIn(repoRoot).find((r) => declaresInstance(readDeclaration(r), instance));
  if (root === undefined) return { ok: false, miss: { kind: "no-such-instance", instance } };
  const dirs = instanceDirectoriesForGraph(root, THEMES_GRAPH_TYPOLOGY);
  if (dirs.length === 0) return { ok: false, miss: { kind: "no-themes-directory", instance } };
  const themes: ResolvedTheme[] = [];
  let read = 0;
  for (const dir of dirs) {
    const path = join(dir, INSTANCE_THEMES_MODULE);
    if (!existsSync(path)) continue;
    // Synchronous on purpose: every consumer is a generator that resolves
    // themes inline while it builds a page, and Bun's `require` loads a `.ts`
    // module synchronously.
    // input-site: imports */themes/themes.ts #28454d5a — a layer's declared themes module; input-sites.test.ts holds every declared one to this glob
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(path) as Record<string, unknown>;
    const list = mod[INSTANCE_THEMES_EXPORT];
    if (Array.isArray(list)) {
      themes.push(...(list as ResolvedTheme[]));
      read++;
    }
  }
  if (read === 0) {
    return { ok: false, miss: { kind: "no-themes-module", instance, path: join(dirs[0]!, INSTANCE_THEMES_MODULE) } };
  }
  return { ok: true, themes };
}

/**
 * Resolve a theme reference.
 *
 * @param ref            the reference as declared
 * @param repoRoot       the repository whose layers may own it
 * @param citingInstance the layer that wrote the reference — the owner when
 *                       `ref.instance` is absent
 * @param platform       the platform layer's name; its themes are {@link THEMES}
 */
export function themeByRef(ref: ThemeRef, repoRoot: string, citingInstance?: string, platform = PLATFORM_THEME_OWNER): ThemeRefResult {
  // A reference names the owner by `owner/repo` (bean `6rmv`); the platform
  // and every caller's `citingInstance` are names, so compare in names.
  const cited = ref.instance === undefined ? undefined : instanceNameIn(repoRoot, ref.instance);
  const owner = cited ?? citingInstance;
  if (owner === undefined || owner === platform) {
    const theme = themeById(ref.themeId);
    return theme ? { ok: true, theme, owner } : { ok: false, miss: { kind: "no-such-theme", instance: owner ?? platform, themeId: ref.themeId } };
  }
  const found = instanceThemes(repoRoot, owner);
  if (!found.ok) {
    // A layer that owns no themes of its own may still cite the
    // platform's by bare id — that is how every reference read before B8.
    if (ref.instance === undefined) {
      const theme = themeById(ref.themeId);
      if (theme) return { ok: true, theme, owner: platform };
    }
    return found;
  }
  const own = found.themes.find((t) => t.id === ref.themeId);
  if (own) return { ok: true, theme: own, owner };
  if (ref.instance === undefined) {
    const theme = themeById(ref.themeId);
    if (theme) return { ok: true, theme, owner: platform };
  }
  return { ok: false, miss: { kind: "no-such-theme", instance: owner, themeId: ref.themeId } };
}

/** The declared `name` of the layer `ref` identifies, or `ref` itself when none does. */
function instanceNameIn(repoRoot: string, ref: string): string {
  if (!ref.includes("/")) return ref;
  const root = layerRootsIn(repoRoot).find((r) => declaresInstance(readDeclaration(r), ref));
  return (root === undefined ? undefined : readDeclaration(root)?.name) ?? ref;
}

/** One instance-declared sticky theme, with the layer that owns it. */
export interface OwnedStickyTheme {
  instance: string;
  theme: Extract<ResolvedTheme, { kind: "sticky" }>;
}

/** One instance-declared WEBPAGE theme, with the layer that owns it. */
export interface OwnedWebpageTheme {
  instance: string;
  theme: Extract<ResolvedTheme, { kind: "webpage" }>;
}

/**
 * Every WEBPAGE-kind theme a layer declares — one per layer, at most.
 *
 * Bean `7h3u`. The sibling of {@link instanceStickyThemes}, and the difference
 * between them is the whole reason this is a second function rather than a
 * `kind` parameter:
 *
 * **A sticky theme id is ONE namespace on the page.** The board selects on
 * `[data-fa-sticky-theme="<themeId>"]` and a card writes the bare id, so two
 * layers declaring the same id collide and `instanceStickyThemes` refuses
 * one of them.
 *
 * **A webpage theme is scoped by the LAYER whose pages it dresses**, so two
 * layers may both declare `id: "web"` and never meet — their rules apply on
 * different URLs. Refusing that collision would be inventing a constraint the
 * surface does not have, so there are no `conflicts` here and none is reported.
 *
 * What IS refused is a second webpage theme inside ONE layer, because
 * nothing would say which of them dresses that layer's pages. That is
 * ambiguity in the declaration rather than a clash between declarations, so it
 * throws rather than being filtered: a silently-picked theme is the failure
 * mode, and `themes.test.ts` in the declaring layer is where it surfaces.
 */
export function instanceWebpageThemes(repoRoot: string, platform = PLATFORM_THEME_OWNER): OwnedWebpageTheme[] {
  const out: OwnedWebpageTheme[] = [];
  const names = layerRootsIn(repoRoot)
    .map((r) => readDeclaration(r)?.name)
    .filter((n): n is string => n !== undefined && n !== platform)
    .sort();
  for (const name of [...new Set(names)]) {
    const found = instanceThemes(repoRoot, name);
    if (!found.ok) continue;
    const webpage = found.themes.filter((t): t is Extract<ResolvedTheme, { kind: "webpage" }> => t.kind === "webpage");
    if (webpage.length > 1) {
      throw new Error(
        `instance ${name} declares ${webpage.length} webpage themes (${webpage.map((t) => t.id).join(", ")}) — ` +
          `nothing says which dresses its pages. Declare one, or scope them yourself.`,
      );
    }
    if (webpage[0]) out.push({ instance: name, theme: webpage[0] });
  }
  return out;
}

/** Why a layer's sticky theme was NOT emitted — each a finding, never a silent drop. */
export type StickyThemeConflict =
  | { kind: "shadows-platform"; instance: string; themeId: string }
  | { kind: "duplicate-across-instances"; themeId: string; instances: string[] };

/**
 * Every STICKY-kind theme a layer in this repository declares, found the
 * same way {@link themeByRef} finds one — by declaration, never by import.
 *
 * Bean `v8n5`. The note board's stylesheet (`gen-themes-css.ts`) selects on
 * `[data-fa-sticky-theme="<themeId>"]` and a card writes the bare `themeId`
 * there, so an id is ONE namespace on the page even though it is two in the
 * graph. Two answers were possible — scope the selector by layer, or refuse
 * a collision — and this refuses: scoping would change what every card writes
 * and every e2e test asserts, for a collision no layer has. A colliding
 * theme is REPORTED in `conflicts` and left out of `themes`, so the platform's
 * own theme keeps its CSS and nothing is overwritten by declaration order.
 *
 * Layers that declare no themes, or whose module is unreadable, contribute
 * nothing — that is `themeByRef`'s miss to report when something cites them.
 */
export function instanceStickyThemes(
  repoRoot: string,
  platform = PLATFORM_THEME_OWNER,
  platformIds: ReadonlySet<string> = new Set(),
): { themes: OwnedStickyTheme[]; conflicts: StickyThemeConflict[] } {
  const byId = new Map<string, OwnedStickyTheme[]>();
  const names = layerRootsIn(repoRoot)
    .map((r) => readDeclaration(r)?.name)
    .filter((n): n is string => n !== undefined && n !== platform)
    .sort();
  for (const name of [...new Set(names)]) {
    const found = instanceThemes(repoRoot, name);
    if (!found.ok) continue;
    for (const t of found.themes) {
      if (t.kind !== "sticky") continue;
      byId.set(t.id, [...(byId.get(t.id) ?? []), { instance: name, theme: t }]);
    }
  }
  const themes: OwnedStickyTheme[] = [];
  const conflicts: StickyThemeConflict[] = [];
  for (const [id, owners] of [...byId].sort(([a], [b]) => a.localeCompare(b))) {
    if (platformIds.has(id)) {
      for (const o of owners) conflicts.push({ kind: "shadows-platform", instance: o.instance, themeId: id });
      continue;
    }
    if (owners.length > 1) {
      conflicts.push({ kind: "duplicate-across-instances", themeId: id, instances: owners.map((o) => o.instance) });
      continue;
    }
    themes.push(owners[0]!);
  }
  return { themes, conflicts };
}

/** A sentence for a {@link StickyThemeConflict}. */
export function explainStickyThemeConflict(c: StickyThemeConflict): string {
  switch (c.kind) {
    case "shadows-platform":
      return `"${c.instance}" declares sticky theme "${c.themeId}", which is also a platform theme id — a card writes the bare id, so one selector cannot serve both. Rename the instance's theme.`;
    case "duplicate-across-instances":
      return `sticky theme "${c.themeId}" is declared by ${c.instances.join(" and ")} — a card writes the bare id, so one selector cannot serve both. Rename one.`;
  }
}

/** A sentence for a finding. */
export function explainThemeRefMiss(m: ThemeRefMiss): string {
  switch (m.kind) {
    case "no-such-instance":
      return `no instance named "${m.instance}" is declared in this repository`;
    case "no-themes-directory":
      return `"${m.instance}" declares no directory with graph typology "${THEMES_GRAPH_TYPOLOGY}"`;
    case "no-themes-module":
      return `"${m.instance}"'s themes directory has no ${INSTANCE_THEMES_MODULE} exporting ${INSTANCE_THEMES_EXPORT} (looked at ${m.path})`;
    case "no-such-theme":
      return `"${m.instance}" declares no theme "${m.themeId}"`;
  }
}
