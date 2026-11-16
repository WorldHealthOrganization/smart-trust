#!/usr/bin/env bun
/**
 * Is every harness's LHS navbar entry themed, and does one artefact wear one
 * glyph across the two surfaces that draw it?
 *
 * @module scripts/check-navbar-consistency
 * @covers none — its subjects are the `<instance>.json` DECLARATIONS and the
 * client that renders them, neither of which is a node in a declared graph.
 * `@covers themes` would name a kind it never resolves a directory of.
 *
 * A navbar entry's picture comes from one of **two unrelated namespaces**,
 * reported as separate families because the repairs differ:
 *
 * 1. A layer's own `icon` is an **id into that layer's `images` list** —
 *    `sync-docs-harness.ts` resolves it with
 *    `decl.images?.find((i) => i.id === decl.icon)`, so it ends at an SVG file.
 * 2. A directory tile's `tile.icon` is a **name in the client's glyph
 *    registry** — `glyphFor` in `docs/assets/js/docs-ui.js` looks it up in
 *    `TILE_GLYPHS` and falls back to the net when it misses.
 *
 * The fallback itself is never graded (it covers a folio naming a glyph an
 * older platform lacks). What is graded is a tile name declared in this
 * repository that this repository's registry does not draw.
 *
 * `ROW_GLYPHS` (the navbar row, in `navbar-row.js`) and `TILE_GLYPHS` (the
 * glass tile panel, in `docs-ui.js`) are separate literals; where an id
 * appears in both, they must name the same glyph constant.
 *
 * Related gates: `navbar:geometry:check` (widths, from
 * `lib/navbar-geometry.ts`) and `check:viewer-nav` (which pages carry a rail).
 * This one checks iconography only.
 *
 * If either registry literal cannot be located, this refuses rather than
 * reporting the families clean.
 *
 * Exit codes: 0 report only, or `--check` with no blocking finding · 1
 * `--check` (or `--strict`) with one · 2 could not determine, which includes
 * a declaration that will not load.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  layerRootsIn,
  readDeclaration,
  siteFileFor,
} from "../schemas/kg/cat-harness.js";
import { THEME_KINDS, type ThemeKind } from "../schemas/ui/theme.js";
import { instanceThemes } from "../schemas/ui/theme-by-ref.js";
import { instanceThemesDataPath } from "./gen-themes-css.js";
import { KIND_TILE_ICONS } from "./graph-tiles.js";
import { readPathAt } from "./lib/layer-output.ts";

/**
 * The client that owns both glyph registries, resolved through `siteDirFor`
 * rather than spelled out.
 *
 * It was written `join("cat-harness", "docs", "assets", "js", "docs-ui.js")`,
 * which `check:site-root` rejected: **the output site root is one answer, and a
 * literal is a second one free to disagree.** The declaration owns where a
 * site is written; a script that hardcodes it keeps working right up until a
 * layer moves its `siteDir`, and then reads an absent file — which this
 * check would report as a refusal over a client that had simply relocated.
 *
 * The client belongs to the layer that ships the harness UI, so the root is
 * asked for by name rather than guessed from the scan order.
 */
const CLIENT_INSTANCE = "cat-harness";
const CLIENT_TAIL = join("assets", "js", "docs-ui.js");

/**
 * One `var NAME = { a: A_GLYPH, b: B_GLYPH };` literal, as id -> constant name.
 *
 * Deliberately a text scan and not an import: the file is a browser IIFE with
 * no exports, so there is nothing to import, and evaluating it needs a DOM.
 * The scan is narrow on purpose — a single `var <NAME> = {` through its first
 * `}` — so a shape it does not recognise reads as ABSENT and refuses, rather
 * than as an empty registry that would pass every family below.
 */
function registry(src: string, name: string): Map<string, string> | undefined {
  const open = src.indexOf(`var ${name} = {`);
  if (open < 0) return undefined;
  const close = src.indexOf("}", open);
  if (close < 0) return undefined;
  const body = src.slice(open + `var ${name} = {`.length, close);

  const out = new Map<string, string>();
  for (const m of body.matchAll(/([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z_$][\w$]*)/g)) {
    out.set(m[1], m[2]);
  }
  return out.size > 0 ? out : undefined;
}

/** A layer's declared navbar art, as the two namespaces see it. */
interface InstanceArt {
  readonly instance: string;
  /** Root-level `icon`, an id into `images`. */
  readonly icon?: string;
  /** Ids actually present in `images`. */
  readonly imageIds: readonly string[];
  /** Every `directories[].tile.icon`, a glyph-registry name. */
  readonly tileIcons: readonly string[];
  /**
   * Directories declaring a `tile` AT ALL — the denominator `tileIcons` is a
   * numerator of. A tile with no `icon` calls `glyphFor(undefined)` and takes
   * the fallback, so this is how many could name a glyph and how many do.
   */
  readonly tilesDeclared: number;
  /** Tile ids with no `icon`, so sharing the fallback drawing. */
  readonly tilesOnFallback: readonly string[];
  /**
   * Directories this layer declares with graph typology `themes`.
   *
   * The field is **`graphTypologies`** and not `graphs`, which cost three wrong
   * measurements in the session that wrote this: a plausible key name read
   * `0 of 20` over a corpus where the answer is 1. Read the declaration, never
   * guess its spelling.
   */
  readonly themeDirs: readonly string[];
}

/**
 * `undefined` when this directory declares nothing; **throws** when it declares
 * something unreadable, which the caller turns into a refusal rather than a
 * finding. A layer whose declaration will not load is one this check cannot
 * judge, and judging the other sixteen and printing a clean verdict would be
 * the `dh4f` defect — a sweep blind on one subject has not cleared the rest.
 */
function artOf(repoRoot: string, root: string): InstanceArt | undefined {
  const decl = readDeclaration(root);
  if (decl === undefined) return undefined;

  const d = decl as unknown as {
    name?: string;
    icon?: string;
    images?: { id?: string }[];
    directories?: { id?: string; path?: string; graphTypologies?: string[]; tile?: { icon?: string } }[];
  };

  const tiles = (d.directories ?? []).filter((x) => typeof x.tile === "object" && x.tile !== null);

  return {
    instance: d.name ?? root.slice(repoRoot.length + 1),
    icon: typeof d.icon === "string" ? d.icon : undefined,
    imageIds: (d.images ?? []).flatMap((i) =>
      typeof i.id === "string" ? [i.id] : [],
    ),
    tileIcons: tiles.flatMap((x) =>
      typeof x.tile?.icon === "string" ? [x.tile.icon] : [],
    ),
    tilesDeclared: tiles.length,
    tilesOnFallback: tiles.flatMap((x) =>
      typeof x.tile?.icon === "string" ? [] : [x.id ?? "<no id>"],
    ),
    themeDirs: (d.directories ?? []).flatMap((x) =>
      (x.graphTypologies ?? []).includes("themes") ? [x.path ?? x.id ?? "?"] : [],
    ),
  };
}

interface Finding {
  readonly family: string;
  readonly blocking: boolean;
  readonly subject: string;
  readonly detail: string;
}

/**
 * What one themed layer declares, by kind — or why it could not be read.
 *
 * `unreadable` is the third state rather than an empty list: a layer whose
 * `themes.ts` will not load has not been shown to declare nothing, and judging
 * it as themeless would clear exactly the layer that may be falling back.
 */
export type DeclaredThemes =
  | { readonly instance: string; readonly themes: readonly { readonly kind: ThemeKind; readonly id: string }[] }
  | { readonly instance: string; readonly unreadable: string };

/**
 * What the platform's surfaces actually SELECT per layer, read off the
 * artefacts they render from.
 *
 * Only `webpage` has an instance-scoped consumer today: `head_custom.html`
 * matches `page.url` against `_data/instance-themes.json` (bean `7h3u`).
 * `webpageData` is `undefined` when that file could not be read, which is a
 * could-not-determine, not an empty map.
 */
export interface ThemeWiring {
  readonly webpageData: ReadonlyMap<string, string> | undefined;
  readonly headConsumesData: boolean;
}

/** One layer × kind the comparison could not judge. */
export interface ThemeUnknown {
  readonly subject: string;
  readonly reason: string;
}

/**
 * Kind for kind — the owner's ruling on `pnn5` (option 1): *a surface of kind K
 * on a layer's pages uses that layer's K-kind theme when it declares
 * one, and falls back to the default only for kinds it doesn't declare.*
 *
 * So the domain is (instance, declared kind), and for each pair the question
 * is whether the surface of that kind selects the layer's theme:
 *
 * - **`webpage`** has a consumer, so a miss is a defect in wiring that exists —
 *   the data entry is absent, names another theme, or `head_custom.html` no
 *   longer reads it. BLOCKING (`theme-fallback`).
 * - **A kind with no instance-scoped consumer** (`sticky`, `publication` today)
 *   falls back on every layer's pages by construction: `themes.css` emits
 *   a layer's sticky theme by id, but an unselected board takes the
 *   platform default under `.fa-sticky-board:not([data-fa-sticky-theme])`.
 *   That is the ruling's violation, and it is REPORTED for each layer
 *   declaring the kind — advisory (`theme-kind-unconsumed`), because the
 *   repair is a platform surface to build, not a declaration to correct, and
 *   no layer can clear it by editing its own files.
 *
 * Kinds a layer does not declare are not judged: falling back there is
 * what the ruling permits.
 */
export function judgeThemeKinds(
  declared: readonly DeclaredThemes[],
  wiring: ThemeWiring,
): { findings: Finding[]; unknowns: ThemeUnknown[]; pairs: number } {
  const findings: Finding[] = [];
  const unknowns: ThemeUnknown[] = [];
  let pairs = 0;
  for (const d of declared) {
    if ("unreadable" in d) {
      unknowns.push({ subject: d.instance, reason: `its themes module would not load: ${d.unreadable}` });
      continue;
    }
    for (const kind of THEME_KINDS) {
      const own = d.themes.filter((t) => t.kind === kind);
      if (own.length === 0) continue;
      pairs++;
      const subject = `${d.instance} · ${kind}`;
      const ids = own.map((t) => `"${t.id}"`).join(", ");
      if (kind !== "webpage") {
        findings.push({
          family: "theme-kind-unconsumed",
          blocking: false,
          subject,
          detail:
            `declares ${kind} theme ${ids}, and no ${kind} surface selects a theme by instance, ` +
            `so this instance's ${kind} surfaces wear the platform default`,
        });
        continue;
      }
      if (wiring.webpageData === undefined) {
        unknowns.push({ subject, reason: "the instance webpage-theme data could not be read" });
        continue;
      }
      const selected = wiring.webpageData.get(d.instance);
      if (!wiring.headConsumesData) {
        findings.push({
          family: "theme-fallback",
          blocking: true,
          subject,
          detail: `declares webpage theme ${ids}, but head_custom.html no longer reads site.data.instance-themes, so every page wears the default`,
        });
      } else if (selected === undefined) {
        findings.push({
          family: "theme-fallback",
          blocking: true,
          subject,
          detail: `declares webpage theme ${ids}, and the generated instance-themes data has no entry for it — its pages wear the default (bun run cat themes:css)`,
        });
      } else if (!own.some((t) => t.id === selected)) {
        findings.push({
          family: "theme-fallback",
          blocking: true,
          subject,
          detail: `declares webpage theme ${ids}, but its pages are dressed in "${selected}" — the generated data is stale (bun run cat themes:css)`,
        });
      }
    }
  }
  return { findings, unknowns, pairs };
}

/** `instance → themeId` from the generated data, or `undefined` when it cannot be read. */
function readWebpageData(path: string): ReadonlyMap<string, string> | undefined {
  try {
    const doc = JSON.parse(readFileSync(path, "utf8")) as { instances?: { instance?: unknown; themeId?: unknown }[] };
    if (!Array.isArray(doc.instances)) return undefined;
    return new Map(
      doc.instances.flatMap((e) =>
        typeof e.instance === "string" && typeof e.themeId === "string" ? [[e.instance, e.themeId] as const] : [],
      ),
    );
  } catch {
    return undefined;
  }
}

function main(): number {
  const repoRoot = process.cwd();
  const check = process.argv.includes("--check");
  const strict = process.argv.includes("--strict");

  let client: string;
  try {
    // `siteDirFor` answers RELATIVE to the layer ("docs"), not absolute —
    // measured, after composing it as absolute first and getting the ROOT
    // layer's `docs/` instead of `cat-harness/docs/`.
    const instanceRoot = join(repoRoot, CLIENT_INSTANCE);
    client = join(instanceRoot, siteFileFor(instanceRoot, CLIENT_TAIL));
  } catch (e) {
    // The declaration would not load, so WHERE the client lives is unknown.
    // Refuse rather than fall back to a guessed path: a guess that happened to
    // exist would report the registries clean over a file this check was never
    // pointed at.
    console.error(`✗ cannot resolve ${CLIENT_INSTANCE}'s site directory:`);
    console.error(`  ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`);
    return 2;
  }

  const shown = client.startsWith(repoRoot) ? client.slice(repoRoot.length + 1) : client;

  let src: string;
  try {
    src = readFileSync(client, "utf8");
  } catch {
    console.error(`✗ could not read ${shown} — the glyph registries live there.`);
    console.error("  Could-not-determine is never green: refusing rather than");
    console.error("  reporting the glyph families clean over a file I did not read.");
    return 2;
  }

  // THE ROW'S REGISTRY IS IN `navbar-row.js`, beside the client (beans `lhvt`,
  // `9rq1`): the row is drawn on pages that never load `docs-ui.js`. Same
  // refusal when it cannot be read.
  const rowFile = join(dirname(client), "navbar-row.js");
  let rowSrc: string;
  try {
    rowSrc = readFileSync(rowFile, "utf8");
  } catch {
    console.error(`✗ could not read ${rowFile} — the row's glyph registry lives there.`);
    return 2;
  }
  const tiles = registry(src, "TILE_GLYPHS");
  const row = registry(rowSrc, "ROW_GLYPHS");
  if (tiles === undefined || row === undefined) {
    console.error(
      `✗ could not locate ${tiles === undefined ? "TILE_GLYPHS" : ""}` +
        `${tiles === undefined && row === undefined ? " and " : ""}` +
        `${row === undefined ? "ROW_GLYPHS" : ""} in ${shown}.`,
    );
    console.error("  Either the literal moved or its shape changed. A registry read");
    console.error("  as empty would pass every family below, so this refuses instead.");
    return 2;
  }

  const roots = layerRootsIn(repoRoot);
  const art: InstanceArt[] = [];
  for (const r of roots) {
    try {
      const a = artOf(repoRoot, r);
      if (a !== undefined) art.push(a);
    } catch (e) {
      // A refusal, not a finding, and not a crash: the declaration is somebody
      // else's gate to fail (schema validation names the field and the value).
      // What this check owes the reader is that it did not silently judge the
      // rest and call the repository clean.
      console.error(`✗ cannot read the declaration in ${r}:`);
      console.error(`  ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`);
      console.error("  Refusing: schema validation owns this failure, and a");
      console.error("  verdict over the remaining instances would read as clean.");
      return 2;
    }
  }
  if (art.length === 0) {
    console.error("✗ no instance declaration read — refusing (see `layerRootsIn`).");
    return 2;
  }

  const findings: Finding[] = [];

  // NO `dangling-instance-icon` FAMILY, and its absence is deliberate.
  //
  // A first draft had one: an `icon` naming no entry in `images`. It was dead
  // code. `readDeclaration` ALREADY throws on exactly that
  // (`schemas/kg/cat-harness.ts`, the `ids.includes(parsed.data.icon)` guard), and
  // its message lists every declared id, which this one did not. So the family
  // could never fire, and had the schema ever stopped checking it, the version
  // here would have been the weaker of two answers to one question — free to
  // disagree with the schema about what a valid declaration is.
  //
  // The test that found it planted the defect and got the schema's error rather
  // than the finding. Reading the code would not have shown it.

  // Family 2 — art shipped and not pointed at. NOT blocking: whether a
  // layer WANTS a navbar mark is the owner's call, and an image may exist
  // for a landing page rather than for the rail. Reported because the gap
  // between "has art" and "wears it" is invisible from either file alone.
  for (const a of art) {
    if (a.icon === undefined && a.imageIds.length > 0) {
      findings.push({
        family: "art-declared-no-icon",
        blocking: false,
        subject: a.instance,
        detail: `${a.imageIds.length} image(s) declared, none named as \`icon\``,
      });
    }
  }

  // Family 3 — a tile name with no drawing in THIS repository's registry, so
  // it takes the fallback and shares a picture with every other miss.
  for (const a of art) {
    for (const name of a.tileIcons) {
      if (!tiles.has(name)) {
        findings.push({
          family: "unregistered-tile-icon",
          blocking: true,
          subject: `${a.instance}: tile.icon=${JSON.stringify(name)}`,
          detail: `absent from TILE_GLYPHS [${[...tiles.keys()].join(", ")}] — falls back`,
        });
      }
    }
  }

  // Family 3, for the KIND fallback — `graph-tiles.ts` gives an undeclared
  // tile its graph typology's icon, so a kind mapped to an undrawn name is the
  // same miss, made for every derived tile of that kind at once.
  for (const [kind, name] of Object.entries(KIND_TILE_ICONS)) {
    if (!tiles.has(name)) {
      findings.push({
        family: "unregistered-tile-icon",
        blocking: true,
        subject: `KIND_TILE_ICONS.${kind}=${JSON.stringify(name)}`,
        detail: `absent from TILE_GLYPHS [${[...tiles.keys()].join(", ")}] — falls back`,
      });
    }
  }

  // Family 3b — a tile that names no glyph, so it takes the fallback and is
  // indistinguishable from every other tile that did the same. ADVISORY: which
  // artefacts deserve their own drawing is an editorial call, and `glyphFor`'s
  // fallback is deliberate. What is NOT editorial is that nothing said how many
  // tiles were on it — `ob3m` finding 11 had to be measured by hand on a render.
  for (const a of art) {
    if (a.tilesOnFallback.length > 0) {
      findings.push({
        family: "tile-without-icon",
        blocking: false,
        subject: a.instance,
        detail:
          `${a.tilesOnFallback.length} of ${a.tilesDeclared} declared tile(s) name no ` +
          `icon, so they share the fallback: ${a.tilesOnFallback.join(", ")}`,
      });
    }
  }

  // Family 4 — one id, two surfaces, two pictures.
  const overlap = [...row.keys()].filter((id) => tiles.has(id));
  for (const id of overlap) {
    if (row.get(id) !== tiles.get(id)) {
      findings.push({
        family: "registry-disagreement",
        blocking: true,
        subject: id,
        detail: `ROW_GLYPHS says ${row.get(id)}, TILE_GLYPHS says ${tiles.get(id)}`,
      });
    }
  }

  // ── Report ─────────────────────────────────────────────────────────────
  const withIcon = art.filter(
    (a) => a.icon !== undefined && a.imageIds.includes(a.icon),
  ).length;

  console.log("Navbar consistency — instance icons and the two glyph registries\n");
  console.log(`  instances read              ${art.length}`);
  console.log(`  ...with a resolving icon    ${withIcon} of ${art.length}`);
  console.log(`  TILE_GLYPHS entries         ${tiles.size}`);
  console.log(`  ROW_GLYPHS entries          ${row.size}`);
  console.log(`  ids drawn by both           ${overlap.length}`);
  const tilesAll = art.reduce((n, a) => n + a.tilesDeclared, 0);
  const tilesNamed = art.reduce((n, a) => n + a.tileIcons.length, 0);
  console.log(`  declared tiles              ${tilesAll}`);
  console.log(`  ...naming a glyph           ${tilesNamed} of ${tilesAll}\n`);

  // NOT the same denominator as `ob3m` finding 11's "18 of 20", and conflating
  // them would be the defect this whole change exists to end. That 20 was
  // counted on a RENDER, where the panel also holds tiles derived from pages
  // rather than from `directories[].tile`. This number is the declaration-side
  // half: of the tiles a layer DECLARES, how many name a drawing. An e2e
  // assertion is what can count the rendered panel; a static check cannot see it.

  // EVERY count above carries its denominator, and the two registry sizes are
  // printed even when no family fires — because "0 disagreements" over an
  // overlap of 0 is not the same verdict as over an overlap of 6, and a reader
  // cannot tell them apart from the finding list alone.
  if (overlap.length === 0) {
    console.log("  NOTE: no id is drawn by both registries, so `registry-disagreement`");
    console.log("        swept an empty domain. That is not a clean result for it.\n");
  }

  const themed = art.filter((a) => a.themeDirs.length > 0);
  console.log(`  declaring a themes graph    ${themed.length} of ${art.length}` +
    (themed.length > 0 ? `  (${themed.map((a) => a.instance).join(", ")})` : ""));
  // KIND FOR KIND (`pnn5`, owner's option 1) — `v8n5`'s Done-when #2, now a
  // comparison rather than a denominator. Each themed layer's themes are read
  // the way every generator reads them (`instanceThemes`), and each declared
  // kind is held to what its surface actually selects.
  const instanceRoot = join(repoRoot, CLIENT_INSTANCE);
  const headFile = join(instanceRoot, siteFileFor(instanceRoot, "_includes/head_custom.html"));
  const wiring: ThemeWiring = {
    webpageData: readWebpageData(readPathAt(repoRoot, join(instanceRoot, instanceThemesDataPath(instanceRoot)))),
    headConsumesData: existsSync(headFile) && readFileSync(headFile, "utf8").includes("site.data.instance-themes"),
  };
  const declared: DeclaredThemes[] = themed.map((a) => {
    try {
      const found = instanceThemes(repoRoot, a.instance);
      return found.ok
        ? { instance: a.instance, themes: found.themes.map((t) => ({ kind: t.kind, id: t.id })) }
        : { instance: a.instance, unreadable: found.miss.kind };
    } catch (e) {
      return { instance: a.instance, unreadable: e instanceof Error ? e.message.split("\n")[0]! : String(e) };
    }
  });
  const kinds = judgeThemeKinds(declared, wiring);
  findings.push(...kinds.findings);
  console.log(`  kind for kind               ${kinds.pairs} (instance, kind) pair(s) judged, ${kinds.unknowns.length} could not be`);
  for (const u of kinds.unknowns) console.log(`  ❔ ${u.subject}: ${u.reason}`);
  console.log();

  const blocking = findings.filter((f) => f.blocking);
  const advisory = findings.filter((f) => !f.blocking);

  for (const group of [blocking, advisory]) {
    for (const f of group) {
      console.log(`  ${f.blocking ? "✗" : "·"} ${f.family}: ${f.subject}`);
      console.log(`      ${f.detail}`);
    }
  }
  if (findings.length > 0) console.log();

  if (blocking.length === 0 && advisory.length === 0 && kinds.unknowns.length > 0) {
    console.log("no finding over what could be read — but see ❔ above: that is not a clean result.");
  } else if (blocking.length === 0 && advisory.length === 0) {
    console.log("✓ no finding — every declared icon resolves and the registries agree.");
  } else {
    console.log(
      `${blocking.length} blocking, ${advisory.length} advisory ` +
        `(advisory fails only under \`--strict\`).`,
    );
  }

  // A DEFECT FOUND is 1 even when a theme comparison was blind: what was
  // established stays established, and the planted-defect tests above rely on
  // a finding reading as a finding. Blind with nothing failing is 2, never 0 —
  // a comparison that could not read a layer has not cleared it.
  const fail = blocking.length > 0 || (strict && advisory.length > 0);
  if ((check || strict) && fail) return 1;
  if ((check || strict) && kinds.unknowns.length > 0) {
    console.log(`${kinds.unknowns.length} theme comparison(s) could not be made — not a clean result.`);
    return 2;
  }
  return 0;
}

// GUARDED so the module can be imported. Without this, a test importing an
// exported helper runs the CLI and exits the test runner — which is exactly
// what happened to `upload-names.test.ts`: the report printed and the run
// died with no tally. `if (import.meta.main)` is the idiom every other
// importable script here uses.
if (import.meta.main) process.exit(main());
