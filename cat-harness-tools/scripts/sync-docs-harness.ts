/**
 * Put the layer's own title, description and mark where Jekyll can read them.
 *
 * just-the-docs draws `site.title` at the top of the left sidebar. The root
 * declaration is the one source for what the layer is called; this copies
 * the reader-facing part of it into `docs/_data/harness.json`, which
 * `docs/_includes/title.html` renders, rather than a second hand-written
 * title in `docs/_config.yml`.
 *
 * Usage:  bun run cat-harness-tools/scripts/sync-docs-harness.ts [--check]
 *
 * `--check` writes nothing and exits 1 if the copy is stale, for CI.
 *
 * ## Why a copy at all
 *
 * Jekyll reads data only from `_data/`, and `harness.json` belongs at the
 * repository root where every other consumer looks for it. A symlink would
 * not survive the Pages build. So: one generated file, gated.
 *
 * ## Site-relative, not repo-relative
 *
 * `images[].src` is repo-relative (`docs/assets/…`) because that is what a
 * reader of the declaration can open. The site serves `docs/` AS its root, so
 * the same file is at `/assets/…` once published. The conversion happens here,
 * once, rather than in the Liquid template.
 *
 * @covers docs
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { detectRepoUrl } from "../pipeline/readme-toc.js";
import { instanceDeclarationFilename, layerRootsIn, readDeclaration, resolveInherited, siteDirFor } from "../schemas/kg/cat-harness.js";
import { releaseIris } from "@litlfred/bootstrap-tools/schemas/release-iri.ts";
import { imageForRole, imagesForRole } from "../schemas/kg/kg-node.js";
import { graphTiles, resolveGlassStrip, withTileCounts } from "./graph-tiles.js";
import { readTileCounts, type TileCount } from "../schemas/ui/tile-count.js";
import { checkoutTopLevelDirs } from "../schemas/sdlc/git-corpus.ts";
import { harnessTiles, instanceDirs } from "./harness-tiles.js";
import { harnessPanel, skillPageIn } from "./harness-panel.js";
import { siteLinks } from "./site-links.js";
import { siteDirectories, withViewers } from "./viewer-declarations.js";
import { harnessTitle, normaliseDestination } from "./lib/nav-label.js";
import { checkoutDirectories, resolveLandingInstance } from "../schemas/kg/harness-config.js";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { overlayDirs, overlayPath, readPathAt, writePathAt } from "./lib/layer-output.ts";


const ROOT = resolve(HARNESS_ROOT);
/**
 * The repository root — where sibling LAYERS live.
 *
 * `ROOT` is this layer (`cat-harness/`), which owns the published site.
 * Every other initiated harness is a directory beside it, so the tile scan
 * starts one level up. The two are different places and the previous version
 * of this file needed only the first.
 */
const REPO_ROOT = process.env.REPO_ROOT ?? resolve(ROOT, "..");
const OUT = join(ROOT, siteDirFor(ROOT), "_data/harness.json");
/**
 * Where the file is read and written (bean `cat-tools-sm8r`, item 4, step 4):
 * in a checkout that MOUNTS cat-harness, at the layer's output root
 * (`build/layers/cat-harness/…`, `lib/layer-output.ts`) rather than inside the
 * pinned mount; a read falls back to the pinned copy. In cat-harness's own
 * checkout both are `OUT`.
 */
const OUT_READ = readPathAt(REPO_ROOT, OUT);
const OUT_WRITE = writePathAt(REPO_ROOT, OUT);
const check = process.argv.includes("--check");

/** `docs/assets/x.svg` → `/assets/x.svg`; anything else is passed through. */
function siteRelative(src: string): string {
  return src.startsWith("docs/") ? `/${src.slice("docs/".length)}` : src;
}

/**
 * WHICH HARNESS `/` IS: asked of the resolver, never of this file's location
 * (issue #1904). This generator lives in `cat-harness/`, and until 2026-10-02
 * that was the whole reason `/` was cat-harness's page: `ROOT` above was both
 * "where the site is built" and "whose landing it shows". They are two
 * questions. `ROOT` keeps the first (where the site is built is the
 * `siteDirFor` follow-up recorded on #1904); the second is the owner's ruling,
 * which `resolveLandingInstance` is the only reader of.
 *
 * - `instance`: that harness's declaration supplies the title, the words, the
 *   marks and the landing art.
 * - `hub`: two or more are flagged, so `/` is a neutral hub listing the
 *   harnesses and the todos. The chrome (title, marks) is the checkout root's
 *   own declaration when it has one, else the site owner's, because a hub is
 *   no harness's page and a sidebar still needs a title.
 * - `ambiguous`: several harnesses, none flagged. This REFUSES rather than
 *   picking one, and `check:landing-instance` says the same thing as a gate.
 * - `none`: nothing is instantiated, so there is no landing to render.
 */
const landingChoice = resolveLandingInstance(REPO_ROOT);
if (landingChoice.kind === "ambiguous") {
  console.error(
    `sync-docs-harness: cannot decide the site's landing page (${landingChoice.reason}) over ` +
      `${landingChoice.names.join(", ")}. Run \`bun run cat check:landing-instance\` (issue #1904).`,
  );
  process.exit(1);
}
if (landingChoice.kind === "invalid") {
  console.error(`sync-docs-harness: ${landingChoice.file} cannot decide the site's landing page: ${landingChoice.reason}. Run \`bun run cat check:landing-instance\`.`);
  process.exit(1);
}
if (landingChoice.kind === "none") {
  console.error(`sync-docs-harness: nothing is instantiated at ${REPO_ROOT} (no <name>.config.json). Nothing to sync.`);
  process.exit(2);
}
/** The landing harness's own directory: where its declaration and its directories are. */
const LANDING_DIR =
  landingChoice.kind === "instance"
    ? layerRootsIn(REPO_ROOT).find((r) => readDeclaration(r)?.name === landingChoice.name)
    : readDeclaration(REPO_ROOT) !== undefined
      ? REPO_ROOT
      : ROOT;
if (LANDING_DIR === undefined) {
  console.error(
    `sync-docs-harness: the landing harness \`${landingChoice.kind === "instance" ? landingChoice.name : ""}\` ` +
      `has no local declaration under ${REPO_ROOT}, so there is nothing to render its landing from.`,
  );
  process.exit(2);
}

const decl = readDeclaration(LANDING_DIR);
if (!decl) {
  console.error(`No declaration at ${LANDING_DIR}. Nothing to sync.`);
  process.exit(2);
}

const icon = decl.images?.find((i) => i.id === decl.icon);

// The SMALL mark, resolved by ROLE rather than by the declared `icon` id,
// because the two answer different questions and the site needs both.
//
// `icon` is what the layer calls its mark — one id, the layer's choice.
// But a mark is rendered at two sizes that want different DRAWINGS: the
// sidebar at 24 px and a browser tab at 16 px cannot carry the detail a mark
// shown large can. `role: "browser-icon"` is the declaration already saying
// which image is drawn for that, and until 2026-09-19 nothing read it.
//
// Absent is FINE and is not guessed around: a layer declaring no
// `browser-icon` gets `null` here, and the templates fall back to `icon`.
// Substituting the large mark silently is how a 24 px blob ships.
const smallIcon = imageForRole(decl.images, "browser-icon");

// THE DARK-SCHEME MARK, resolved by ROLE like the small one above.
//
// A separate image rather than a CSS filter on the light one: a filter that
// lightens an arbitrary path is a guess about the result, and the whole
// point of the dark variant is a MEASURED ratio (7.00:1 on the dark sidebar,
// against the light ink's 2.60:1, which is under the 3:1 bar for meaningful
// non-text content).
//
// ABSENT IS A REAL STATE and the templates handle it: a layer that
// declares no `mark-dark` shows its one mark in both schemes, which is what
// every layer did before this existed. `imageForRole` returns undefined
// and nothing downstream has to special-case a folio that never opted in.
const iconDark = imageForRole(decl.images, "mark-dark");
// THE MASK FORM, which replaces the light/dark PAIR when a layer declares
// it. Resolved by role like `mark-dark`, so a layer that declares no mask
// keeps the two-image path and nothing changes for it — absent is a real
// state, the same rule `mark-dark` itself follows.
const iconMask = imageForRole(decl.images, "mark-mask");

// The landing backdrop's variants, keyed by layout, so the template can pick
// by viewport rather than parse a filename. A layer with none gets `{}`,
// and the template renders its description plainly — see `landing.html`, which
// treats a missing backdrop as a reason to draw no overlay rather than as a
// reason to guess where the quiet part of an image it does not have might be.
const landing: Record<string, unknown> = {};
for (const [layout, img] of imagesForRole(decl.images, "landing")) {
  landing[layout] = {
    src: siteRelative(img.src),
    width: img.width ?? null,
    height: img.height ?? null,
    // Percentages, because that is what CSS wants and computing them in
    // Liquid is worse than computing them here.
    region: img.textRegion
      ? {
          x: +(img.textRegion.x * 100).toFixed(3),
          y: +(img.textRegion.y * 100).toFixed(3),
          w: +(img.textRegion.w * 100).toFixed(3),
          h: +(img.textRegion.h * 100).toFixed(3),
        }
      : null,
    // THE AVATAR CROP, already solved into the four values CSS wants.
    //
    // Owner, 2026-09-22: *"use theme avatar not the purply thing"* — the mark
    // in the sidebar header was the `@` glyph; the theme avatar is this art,
    // clipped to the cat, which is what `603s` measured `avatarRegion` for.
    //
    // The arithmetic is done HERE for the same reason `region` above is:
    // computing it in Liquid is worse than computing it in TypeScript. The
    // image is scaled by `1/w` and `1/h` and then offset by `-x` and `-y` OF
    // THE SCALED image, which is why the offsets divide by the same fractions.
    // `navbar.ts`'s `mark()` does the identical sum for the rail — one crop,
    // two renderers, and neither carries a second formula.
    avatar: img.avatarRegion
      ? {
          width: +(100 / img.avatarRegion.w).toFixed(4),
          height: +(100 / img.avatarRegion.h).toFixed(4),
          left: +((-100 * img.avatarRegion.x) / img.avatarRegion.w).toFixed(4),
          top: +((-100 * img.avatarRegion.y) / img.avatarRegion.h).toFixed(4),
        }
      : null,
    title: img.title ?? "",
    description: img.description ?? "",
  };
}

/**
 * Where the header's action tiles point.
 *
 * Resolved through `siteLinks`, which computes from `artefactStub` and
 * `renderingPath` — so the tile agrees with what the Pages workflow actually
 * publishes. The previous answer was `'/kg/' | relative_url` written into
 * `head_custom.html`, a path composed by convention that had never resolved.
 *
 * `path` is site-ROOT-relative and the template applies `relative_url` to it,
 * which is what makes it correct under this site's `/folio-assistant/`
 * baseurl. `url` is absolute and is printed as-is.
 *
 * ## "Could not determine" keeps the previous answer
 *
 * The forge URL is read from `git remote get-url origin` rather than written
 * down a second time — `harness.config.json` already argues the case for this
 * repo's Pages address ("resolve it, do not compose it"), and the same holds
 * for its repository address. But this file is COMMITTED and gated by
 * `--check`, and a checkout with no git (a release tarball, a container that
 * copied the tree in) would otherwise drop a link that is perfectly good and
 * report the committed file as stale. So an undetectable remote KEEPS
 * whatever the file already says. Absent and unknown are different, and the
 * previous answer is the better of the two things to do with unknown.
 */
const detected = detectRepoUrl(ROOT);
let repoUrl = detected;
if (!repoUrl && existsSync(OUT_READ)) {
  try {
    const prev = JSON.parse(readFileSync(OUT_READ, "utf-8")) as { links?: { id: string; url?: string }[] };
    repoUrl = prev.links?.find((l) => l.id === "source")?.url;
    if (repoUrl) {
      console.warn(
        `sync-docs-harness: could not read git remote "origin"; keeping the ` +
          `repository URL already in docs/_data/harness.json (${repoUrl}).`,
      );
    }
  } catch {
    // An unreadable previous file is not a reason to fail: it is about to be
    // rewritten anyway, and the source link is simply absent this run.
  }
}

/**
 * Every declared tile count this site publishes, as `directory id → count`.
 *
 * ## Scanned, not mapped
 *
 * There is no table here saying which projection serves which directory, and
 * there must not be. A projection NAMES the directories it counts for, so the
 * scan reads whatever it finds and a map of guesses cannot go stale. That is
 * what makes `assets/library/index.json` able to declare for both `library`
 * and `uploads` — two tiles over one dataset, `flh4` — without this function
 * knowing anything about either.
 *
 * ## Every failure is ABSENCE, never zero
 *
 * A missing `assets/`, an unreadable file, malformed JSON, a projection that
 * declares nothing: all of them contribute no entry, so the tile renders with
 * no badge. None of them contributes `0`, which would say the graph is empty
 * — the opposite fact. `dh4f`.
 *
 * Unreadable is not reported as a finding HERE because this file's gate is a
 * staleness gate: a projection that cannot be parsed is its own generator's
 * failure and is already red there, and a second voice saying so would be a
 * second answer to whose defect it is.
 */
function scanTileCounts(assetsDir: string): Map<string, TileCount> {
  const out = new Map<string, TileCount>();
  // Over the layer overlay (bean `cat-tools-sm8r`, item 4): a mounted layer's
  // projections (`assets/beans/`, `assets/todos/`, …) are written at its
  // output root, so the directories are the union of that copy and the
  // layer's own, each name once, and each index is read where a reader sees it.
  const dirs = overlayDirs(assetsDir);
  if (dirs.length === 0) return out;
  const names = new Set<string>();
  for (const at of dirs) for (const d of readdirSync(at, { withFileTypes: true })) if (d.isDirectory()) names.add(d.name);
  for (const name of [...names].sort()) {
    const file = overlayPath(join(assetsDir, name, "index.json"));
    if (!existsSync(file)) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(file, "utf-8"));
    } catch {
      continue;
    }
    for (const [id, count] of readTileCounts(parsed)) {
      // LAST writer would be arbitrary, so the FIRST is kept and the clash is
      // simply not silent-overwritten. Two projections declaring one
      // directory's count is a defect in the declarations, not something to
      // resolve by directory-read order — which is what `readdirSync` would
      // make it.
      if (!out.has(id)) out.set(id, count);
    }
  }
  return out;
}

const links = siteLinks(decl, repoUrl);
// ASKED OF GIT (bean `qrlc`). The hand-written filter below admitted **26**
// top-level names on this container and `_kg` was the first: a gitignored
// directory of knowledge-graph exports that a clean checkout does not have.
// Git's answer is 24 — it drops `_kg` and `test-results`, both gitignored,
// and gains nothing.
//
// Latent today, and by a DIFFERENT mechanism from `xd1g`'s eleven: the
// committed output carries 0 mentions of `_kg` because a later predicate
// drops anything without a declaration. The walk was contaminated and the
// artefact was not — which is luck a reader cannot see from the walk, and
// the argument for asking git here rather than trusting the filter behind.
const instanceNames = checkoutTopLevelDirs(REPO_ROOT).names;
const allHarnesses = harnessTiles(REPO_ROOT, ROOT, instanceNames);

/**
 * THE HARNESSES CONFIG PANEL's data (issue #1146): every declaration here, its
 * properties and their edit skills, and the associated harnesses. Same file,
 * same gate, for the reason `harnesses` gives below.
 */
const tileOrder = (n: string): number => {
  const i = allHarnesses.findIndex((t) => t.name === n);
  return i < 0 ? allHarnesses.length : i;
};
const instantiatedHere = new Set(allHarnesses.filter((t) => t.instantiated).map((t) => t.name));
const config = harnessPanel(
  instanceDirs(REPO_ROOT, instanceNames).flatMap((dir) => {
    const d = readDeclaration(dir);
    return d ? [{ dir, decl: d, instantiated: instantiatedHere.has(d.name) }] : [];
  })
    // The sidebar's order, so the panel's groups read like the dividers.
    .sort((a, b) => tileOrder(a.decl.name) - tileOrder(b.decl.name)),
  REPO_ROOT,
  repoUrl,
  "main",
  skillPageIn(join(ROOT, siteDirFor(ROOT))),
);

/**
 * The row, resolved. Separate from the payload literal because it joins THREE
 * sources -- the resolved icon list on this layer's own tile, that tile's
 * declared visualisations, and `siteLinks` -- and a join inlined in an object
 * literal is a join nobody can test.
 */
/**
 * The layer that holds this checkout's shared graphs (`beans`, `todos`):
 * the checkout root's own layer when it declares one, else the layer
 * that declares the repository-scoped directories. In the index checkout the
 * root declares nothing (owner, 2026-10-08) and cat-harness declares them
 * (decision (b)); asking only the root left the navbar's Todos and Beans
 * icons with no destination (`rail-icon-row.e2e.ts`, 2026-10-09).
 */
function checkoutGraphOwner(root: string): string | undefined {
  const own = readDeclaration(root)?.name;
  if (own !== undefined) return own;
  try {
    return checkoutDirectories(root).find((d) => d.scope === "repository" && d.own)?.declaredBy;
  } catch {
    return undefined; // an unreadable declaration is `check:harness-dirs`'s to report
  }
}

function navbarRow(
  harnesses: readonly {
    name: string;
    title?: string;
    navbarIcons?: string[];
    href?: string;
    hrefKind?: "folio" | "section" | "viewer" | "handled";
    visualisations?: { kind: string; label?: string; sameAs?: string; within?: string; path?: string | null; note?: string; stagingOnly?: true }[];
  }[],
  self: string | undefined,
  siteLinkList: readonly { id: string; path?: string; url?: string }[],
  checkout?: string,
): {
  icons: string[];
  hrefs: Record<string, string>;
  /** WHY an icon has no href, keyed by icon id — see the `notes` note below. */
  notes: Record<string, string>;
  folders: NavFolder[];
} | null {
  const mine = harnesses.find((h) => h.name === self);
  // UNDETERMINED -> `null`, never `{icons: []}`. "Nobody decided" and "show
  // none" are different answers and the template must be able to tell them
  // apart; `[]` here would report every un-migrated layer as deliberate.
  if (!mine || mine.navbarIcons === undefined) return null;
  // This harness's own graphs FIRST, then the CHECKOUT ROOT's for a kind it
  // does not hold. An icon names a kind, and since cmsl step 2 (issue #1694)
  // the shared state — `beans`, `todos` — is declared by the root layer,
  // so cat-harness's own `navbarIcons: ["todos", "beans", …]` found no tile
  // and rendered both inert, "reason not recorded" (caught by
  // `navbar-row.e2e.ts`). Its own tile still wins for a kind it does hold.
  const root = checkout !== undefined && checkout !== self ? harnesses.find((h) => h.name === checkout) : undefined;
  // An own tile wins only when it GOES somewhere. core's own `beans`
  // directory has no viewer ("no viewer yet"), and letting that inert tile
  // shadow the checkout owner's working one left the Beans icon dead
  // (2026-10-09). The kinds with a destination are this harness's answer;
  // the rest fall through to the checkout's.
  const ownKinds = new Set((mine.visualisations ?? []).filter((v) => v.path).map((v) => v.kind));
  const vis = [
    ...(mine.visualisations ?? []).filter((v) => v.path || !(root?.visualisations ?? []).some((r) => r.kind === v.kind && r.path)),
    ...(root?.visualisations ?? []).filter((v) => !ownKinds.has(v.kind)),
  ];
  const byKind = new Map(vis.map((v) => [v.kind, v.path ?? undefined]));
  const noteByKind = new Map(vis.flatMap((v) => (v.note ? [[v.kind, v.note] as const] : [])));
  const hrefs: Record<string, string> = {};
  /**
   * WHY a declared icon has no destination, in the words a reader sees.
   *
   * SEPARATE FROM `hrefs` because they are answers to different questions and
   * an icon has exactly one of them: a slot either goes somewhere or owes an
   * explanation. Merging them into one map keyed by id would make "no entry"
   * mean both "resolved to nothing" and "was never declared".
   *
   * The wording is `harness-tiles.ts`'s, carried rather than composed — see
   * `HarnessVisualisation.note`, which computes it where the FOUR inert states
   * are already told apart. A string minted here would be the fifth wording
   * for four states, which is the defect that type's docstring already names.
   */
  const notes: Record<string, string> = {};
  for (const icon of mine.navbarIcons) {
    // `kg` is a SITE link rather than a graph of its own -- it is the viewer
    // over the whole layer, which is why `siteLinks` owns it and the
    // visualisation list does not carry it.
    const at =
      icon === "kg"
        ? siteLinkList.find((l) => l.id === "kg")?.path
        : byKind.get(icon);
    // NO NORMALISATION HERE ANY MORE. This line used to rewrite `index.md`
    // for this row alone, with a comment saying the tabs' version of the same
    // defect was "wider ... and recorded rather than fixed". The owner asked
    // for the wider one, so `publishedUrlOf` in `harness-tiles.ts` now mints
    // the URL correctly for EVERY consumer and this row inherits it.
    //
    // Deleting the local fix is the point rather than tidiness: two places
    // converting one path is two answers, and the one further from the source
    // is the one that goes stale.
    if (at) hrefs[icon] = at;
    else {
      const why = icon === "kg" ? undefined : noteByKind.get(icon);
      // `close`, `launcher`, `fsh-guts` and `qr` drive controls on the page and are MEANT to have
      // no href, so they owe no explanation. An entry for them would make the
      // client render "no viewer yet" on a working button.
      if (why && icon !== "close" && icon !== "launcher" && icon !== "fsh-guts" && icon !== "qr") notes[icon] = why;
    }
  }
  // THIS LAYER'S OWN CONTROLLED FOLDERS — owner: *"next on navbar then is
  // is library docs/ and other controlled folders"*. Resolved here beside the
  // icon row because they come from the same tile, and a client that joined
  // the harnesses array itself would be a second answer to "which instance am
  // I" — a question a staging preview's URL prefix already makes hard.
  //
  // A kind with NO path is kept, with no path. `pb04`: declared-and-unrendered
  // is a finding, and dropping it answers "where is qa" with silence.
  // Paths come through as `harness-tiles.ts` minted them -- see the note
  // above on why this no longer rewrites anything.
  //
  // AND WITH ITS NOTE. Owner ruling, recorded in #1036: a declared graph with
  // no viewer is SHOWN, inert and LABELLED, and the label says WHICH case it
  // is — `flh4` separates "declares none" from "declares one that does not
  // resolve", and `inertNote` words four states in all.
  //
  // This row carried none of that until 2026-09-23. A reader got `opacity:
  // 0.35`, a strikethrough and a `title` tooltip reading "declared, with no
  // published viewer" — one wording for four states, in a channel a keyboard
  // or screen-reader user never reaches. `gjli`: the state belongs in TEXT.
  //
  // `stagingOnly` RIDES ALONG WITH THE PATH, and it has to: a withheld page's
  // `path` resolves against the SOURCE tree, so it is present and correct and
  // the link is still dead on the canonical deploy. The client decides, since
  // only the page knows which deploy it is on.
  // `within` RIDES ALONG TOO (issue #1164): a sub-graph is drawn inside its
  // parent's row, folded, by every client — one answer to where it sits.
  // `label` RIDES ALONG as `harness-tiles.ts` set it (bean `ob3m` finding 6):
  // FOLDERS printed the bare kind word, and the glass named the same page
  // otherwise. The client renders this and composes nothing.
  const folders = foldersOf(mine.visualisations);
  return { icons: [...mine.navbarIcons], hrefs, notes, folders };
}

type NavFolder = { kind: string; label?: string; within?: string; path?: string; note?: string; stagingOnly?: true };

/** One layer's visualisations as folder rows — see the note in `navbarRow`. */
function foldersOf(
  vis: readonly { kind: string; label?: string; sameAs?: string; within?: string; path?: string | null; note?: string; stagingOnly?: true }[] | undefined,
): NavFolder[] {
  return (vis ?? []).filter((v) => v.sameAs === undefined).map((v) => {
    const within = v.within ? { within: v.within } : {};
    const label = v.label ? { label: v.label } : {};
    return v.path
      ? { kind: v.kind, ...label, ...within, path: v.path, ...(v.stagingOnly ? { stagingOnly: true as const } : {}) }
      : { kind: v.kind, ...label, ...within, ...(v.note ? { note: v.note } : {}) };
  });
}

/**
 * THE LAYERS A PAGE CAN BE INSIDE, for the rail's PAGES and FOLDERS
 * (issue #1902). Owner, viewing a DAK IG's root (paraphrased): 101 pages were
 * listed under that IG's path where only the IG's TOC was expected — the rail
 * was showing all the folio's pages rather than the harnessed IG's own, and
 * the same for 'folders'.
 *
 * A scope is a layer whose tile goes to its OWN THEMED ROOT
 * (`hrefKind: "folio"`) at a path of its own. Two kinds of href are not a
 * scope and are left out, each for a reason a reader could check:
 *
 * - `section` — an anchor on the landing page (bean `ob3m` 6), not a root.
 * - `viewer` / `handled` — the href is a page some OTHER thing publishes
 *   (`/processes/` is bootstrap's tile and the whole site's process viewer),
 *   so "every page under it belongs to this instance" would be false.
 * - an anchor (`/#harness-…`) or `/` — the layer's root IS the site's
 *   landing, so every page would be inside it, which is the unscoped answer
 *   the client already gives.
 *
 * SORTED LONGEST HREF FIRST, so `head_custom.html` can take the first prefix
 * of `page.url` that matches and stop: a nested layer wins over the one
 * that holds it. Nothing here names a layer.
 *
 * NOT IN `navbar`, and that is a byte budget rather than tidiness: `navbar` is
 * inlined into every page's head, and the whole list is ~1.8 KB that only the
 * pages inside one layer need ~250 B of. Liquid resolves `page.url` --
 * which carries no baseurl, so a staging prefix cannot make it miss -- and
 * emits the ONE matching scope as `#fa-rail-scope`, or nothing.
 */
type RailScope = { name: string; title: string; href: string; folders: NavFolder[] };
function railScopes(
  harnesses: readonly {
    name: string;
    title?: string;
    href?: string;
    hrefKind?: "folio" | "section" | "viewer" | "handled";
    visualisations?: { kind: string; label?: string; sameAs?: string; within?: string; path?: string | null; note?: string; stagingOnly?: true }[];
  }[],
): RailScope[] {
  return harnesses
    .filter((h) => h.hrefKind === "folio" && typeof h.href === "string" && h.href.startsWith("/") && h.href !== "/" && !h.href.includes("#"))
    .map((h) => ({ name: h.name, title: h.title ?? h.name, href: h.href!, folders: foldersOf(h.visualisations) }))
    .sort((a, b) => b.href.length - a.href.length || a.name.localeCompare(b.name));
}

/* The tiles, computed once: the payload carries them and the glass strip's
 * pins are resolved against them.
 *
 * THE QUALIFIER is the declaring harness's title (bean `ob3m` finding 6):
 * a `repository`-scoped entry is the checkout root's, every other one this
 * layer's own. Two "Docs" tiles are then "Docs · C@T Harness" and
 * "Docs · Folio Assistant", one base name each. */
const tileDirs = siteDirectories(decl?.directories ?? [], LANDING_DIR, REPO_ROOT);
const tiles = withTileCounts(
  graphTiles(
    withViewers(tileDirs, LANDING_DIR),
    relative(REPO_ROOT, join(ROOT, siteDirFor(ROOT))),
    (d) => {
      const owner = d.scope === "repository" ? readDeclaration(REPO_ROOT) : decl;
      return owner ? harnessTitle(owner) : undefined;
    },
    allHarnesses.map((h) => h.name),
    // One name per destination (cat-harness-tools#1701): an undeclared tile
    // takes the name the harness rows give its page, so the glass cannot
    // disagree with FOLDERS, the sidebar and the landing viewers.
    (() => {
      const byDest = new Map<string, string>();
      for (const h of allHarnesses) {
        for (const r of h.visualisations ?? []) {
          const at = r.path ? normaliseDestination(r.path) : undefined;
          if (at !== undefined && r.label && !byDest.has(at)) byDest.set(at, r.label);
        }
      }
      return (href: string) => {
        const at = normaliseDestination(href);
        return at === undefined ? undefined : byDest.get(at);
      };
    })(),
  ),
  scanTileCounts(join(ROOT, siteDirFor(ROOT), "assets")),
);
const glassStrip = (() => {
  const decls = layerRootsIn(REPO_ROOT).flatMap((root) => {
    const d = readDeclaration(root);
    return d ? [d] : [];
  });
  if (decl && !decls.some((d) => d.name === decl.name)) decls.push(decl);
  const pins = decl
    ? resolveInherited(
        decl.name,
        new Map(decls.map((d) => [d.name, d.glassStrip])),
        new Map(decls.map((d) => [d.name, d.needs])),
      )
    : undefined;
  if (pins === undefined) return undefined;
  const resolved = resolveGlassStrip(pins, tiles, new Map(tileDirs.map((d) => [d.id, d.graphTypologies])));
  for (const k of resolved.unmatched) {
    console.warn(`glassStrip pins the kind "${k}", and no glass tile on this site holds it.`);
  }
  return resolved;
})();

const payload = {
  // The SOURCE is the declaration, not `_data/harness.json` -- which is
  // Jekyll's own file, keeps that name, and is what this writes.
  _generated: `scripts/sync-docs-harness.ts — do not hand-edit; edit ${instanceDeclarationFilename(decl.name)}`,
  name: decl.name,
  title: decl.title ?? decl.name,
  description: decl.description ?? "",
  icon: icon ? { src: siteRelative(icon.src), title: icon.title ?? "", description: icon.description ?? "" } : null,
  iconMask: iconMask
    ? { src: siteRelative(iconMask.src), title: iconMask.title ?? "", description: iconMask.description ?? "" }
    : null,
  iconDark: iconDark
    ? { src: siteRelative(iconDark.src), title: iconDark.title ?? "", description: iconDark.description ?? "" }
    : null,
  smallIcon: smallIcon
    ? { src: siteRelative(smallIcon.src), title: smallIcon.title ?? "", description: smallIcon.description ?? "" }
    : null,
  landing,
  /**
   * WHAT `/` IS (issue #1904): `instance` with the landing harness's `name`,
   * or `hub` with every instantiated harness. `landing.html` branches on
   * `kind` and nothing else, so the hub marker and the list it renders are one
   * field rather than a flag and a second list free to disagree.
   */
  landingInstance:
    landingChoice.kind === "hub"
      ? { kind: "hub", names: landingChoice.names, flagged: landingChoice.flagged }
      : { kind: "instance", name: landingChoice.name, by: landingChoice.by },
  // THE KINDS THIS LAYER DECLARES — for the avatar fan (bean `4kj4`).
  //
  // Owner: *"shows the DECLared kinds for that instance, not inheritance."*
  // That is a real distinction and not a shade of one: `resolveDirectories`
  // overlays a dependency's directories onto a layer's, so the EFFECTIVE
  // set is strictly larger than the declared set. Reading the resolved set
  // here would show a reader kinds this repository never claimed, which is
  // the opposite of what the panel is for.
  //
  // So: `decl.directories` as authored, before any resolution. Sorted and
  // de-duplicated, because a directory may hold several graphs and two
  // directories may hold the same one — `schemas/` declares both `schemas`
  // and `cat-harness`.
  declaredKinds: [...new Set(siteDirectories(decl.directories ?? [], LANDING_DIR, REPO_ROOT).flatMap((d) => d.graphTypologies ?? []))].sort(),
  links,
  // ONE FAT TILE PER INITIATED HARNESS, for the left sidebar.
  //
  // Owner, 2026-09-20: *"I still want to see for every initiated harness a
  // themed fat navbar tile, boot strap at bottom, that user can click on. And
  // basic stats/info via icon + bafges. Use existing harness vaiyalizaiin(s)."*
  //
  // It rides THIS file rather than arriving as a second generator, for the
  // reason this file exists at all: Jekyll reads data only from `_data/`, and
  // a second generated file there would want a second staleness gate free to
  // disagree with `docs:harness:check`. One file, one gate, one answer to
  // "what does the site know about this repository's instances".
  //
  // The directory list is read HERE and passed in, so `harness-tiles.ts` takes
  // its candidates from an argument and can be tested against a fixture
  // without a filesystem walk.
  /* THE GRAPH TILES, derived from the visualiser obligation rather than from a
   * second list. One array for BOTH surfaces — Q11: a tile is declared once
   * and says where it shows, never two registries free to disagree about what
   * a tile is. The navbar and the board filter this by `surfaces`. */
  tiles,
  /**
   * THE GLASS STRIP'S PINS, resolved to tile ids — owner, 2026-10-01, bean
   * `ob3m` finding 10: *"Pinned tiles first, plus '+N more'"*. Declared as
   * `glassStrip` on the layer and inherited along `needs`, like
   * `navbarIcons`; resolved HERE so the page reads ids and never re-derives
   * which tile a kind means. Absent when nothing in the stack declared one —
   * the page then pins only its own chrome, which is not the same as a
   * layer that declared `[]`.
   */
  ...(glassStrip === undefined ? {} : { glassStrip }),
  harnesses: allHarnesses,
  /**
   * THE NAVBAR ICON ROW for THIS layer — which icons, and where each goes.
   *
   * Owner, 2026-09-22: *"max is 6 and one for todos one for beans one for
   * processes viewer/ (the factory flow) one for KG viewer"*, and on where the
   * list lives: *"should be in each harness config which are shown (so some
   * could show none, but make this default in cat-harness that is
   * inherited)."*
   *
   * THE LIST IS RESOLVED, the DESTINATIONS ARE LOOKED UP, and neither is
   * written down here. `resolveNavbarIcons` walks `needs`; the hrefs come from
   * the layer's own declared visualisations and from `siteLinks`. So an
   * icon whose graph this layer does not publish gets NO href and the
   * template renders it as a non-link rather than a dead one -- `pb04`, the
   * same rule the harness tabs and the rail already follow.
   *
   * `close` and `launcher` carry no href ON PURPOSE: they drive controls on
   * the page rather than going anywhere, and giving them one would make them
   * look like navigation.
   */
  navbar: navbarRow(allHarnesses, decl?.name, links, checkoutGraphOwner(REPO_ROOT)),
  /** The layers a page can be inside, for the rail's PAGES and FOLDERS (#1902). See {@link railScopes}. */
  railScopes: railScopes(allHarnesses),
  /**
   * EVERY LAYER'S VERSION, and its release addresses where it declares an
   * `iriBase` — so a page writes `{{ site.data.harness.releases.bootstrap.version }}`
   * and never a number that goes stale on the next bump (owner, 2026-09-29:
   * "make variables of version available to minimize drift"). `agent`, for
   * identifiers, and `human`, for pages, are both `<iriBase>v<major>/` (owner,
   * 2026-10-23: the major, not the full version, is in every address). Read
   * from the declarations, so a bump is one edit.
   */
  releases: Object.fromEntries(
    layerRootsIn(REPO_ROOT).flatMap((root) => {
      const d = readDeclaration(root);
      if (!d) return [];
      const r = releaseIris(d);
      return [[d.name, { version: d.version ?? "", major: r?.major ?? null, agent: r?.agent ?? "", human: r?.human ?? "" }]];
    }).sort(([a], [b]) => String(a).localeCompare(String(b))),
  ),
  config,
};
const next = `${JSON.stringify(payload, null, 2)}\n`;
const current = existsSync(OUT_READ) ? readFileSync(OUT_READ, "utf-8") : "";

/**
 * The file with every tile's live COUNT removed: what a commit determines.
 *
 * A tile's `count` and `unit` are read from the projections under `assets/`
 * (`scanTileCounts`), and some of those are LIVE: the beans tile counts open
 * beans on the work-plan tip, which moves whenever anyone files or closes a
 * bean. A committed copy therefore went stale between the commit and its CI
 * run (188 at the commit, 189 in CI: folio-assistant#2526), and the check
 * failed on whichever PR happened to be running. The count is BUILD-TIME data:
 * the site build re-runs this generator after `gen-docs-pages` refreshes the
 * projections, so a published page shows the live number. The check compares
 * everything else. Owner, 2026-10-10: "regenerate at build".
 */
function withoutTileCounts(text: string): string {
  if (!text) return text;
  try {
    const d = JSON.parse(text) as { tiles?: Array<Record<string, unknown>> };
    for (const t of d.tiles ?? []) {
      delete t.count;
      delete t.unit;
    }
    return JSON.stringify(d);
  } catch {
    return text; // unreadable: compared as-is, and so reported stale
  }
}

if (check) {
  if (withoutTileCounts(current) === withoutTileCounts(next)) {
    console.log(`${relative(ROOT, OUT)} is up to date (tile counts are build-time data and not compared)`);
    process.exit(0);
  }
  console.error(
    `docs/_data/harness.json is stale.\n` +
      `Run \`bun run cat docs:harness\` and commit the result.`,
  );
  process.exit(1);
}

mkdirSync(dirname(OUT_WRITE), { recursive: true });
writeFileSync(OUT_WRITE, next);
console.log(`Wrote ${relative(REPO_ROOT, OUT_WRITE)} — title "${payload.title}"`);
