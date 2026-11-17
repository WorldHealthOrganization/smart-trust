#!/usr/bin/env bun
/**
 * The landing stickies, as a data file Jekyll can read.
 *
 * @module scripts/gen-landing-data
 * @covers folio, docs
 *
 * Core owns the folio graph, so this (not `sync-docs-harness.ts`, which writes
 * the layer's declaration data) writes the folio content's data file; each
 * imports only downward.
 *
 * ## Resolved HERE, not in Liquid
 *
 * A sticky names a theme by id; the theme names an image ROLE; the layer's
 * `images[]` answers what that role's three crops are. Liquid cannot report a
 * broken link in that chain — it renders empty. `resolveThemeBackdrop` returns
 * the three-state answer and refuses a partial resolution wholesale, so the
 * template gets a flat, already-decided structure.
 *
 * `--check` fails when the committed file is stale, the same contract
 * `sync-docs-harness.ts` and the CSS generators use.
 *
 * Exit codes: 0 written or up to date · 1 stale under `--check`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { isBuiltAtPublish } from "../schemas/kg/built-at-publish.ts";

import { resolveLandingInstance } from "../schemas/kg/harness-config.js";
import { layerRootNamed } from "../schemas/kg/instance-roots.js";
import { mountedInstanceRoots } from "../schemas/kg/remote-mount.js";
import {
  checkoutRootFor,
  publishedAssetPath,
  readDeclaration,
  siteDirFor,
  sourceLinks,
} from "../schemas/kg/cat-harness.js";
import { detectRepoUrl } from "../src/core/git-refs.js";
import { resolveThemeBackdrop } from "../schemas/ui/theme.js";
import { themeByRef } from "../schemas/ui/theme-by-ref.js";
import { readLandingStickies } from "./ensure-landing-sticky.js";
import { isExternalLink } from "../schemas/content/landing-sticky.js";
import { publishedHref } from "./lib/jekyll-permalink.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { landingMountedNotOwned } from "./lib/mounted-landing.ts";
import { exitNotApplicable } from "./lib/not-applicable.ts";

/**
 * The layer whose landing stickies these are: the site's LANDING layer,
 * asked of `resolveLandingInstance` (which reads `index.config.json` first),
 * not this script's own location. Until 2026-10-07 this was
 * `HARNESS_ROOT` — cat-harness, because that is where the
 * script lives — which was right only while cat-harness was the landing.
 *
 * A hub, or a checkout with nothing instantiated, has no single landing
 * harness, so the stickies stay this script's own layer's (the site owner)
 * — the same choice `sync-docs-harness` makes for a hub's sidebar. An
 * undecidable landing THROWS: `check:landing-instance` is the gate that says
 * why, and guessing here would render one harness's stickies at another's `/`.
 * Moving the stickies themselves is bean `1yd7`.
 */
function landingRoot(): string {
  const own = HARNESS_ROOT;
  const checkout = checkoutRootFor(own);
  const landing = resolveLandingInstance(checkout);
  if (landing.kind === "ambiguous" || landing.kind === "invalid") {
    throw new Error(`gen-landing-data: the site's landing is undecided (${landing.kind}) — run \`bun run cat check:landing-instance\``);
  }
  if (landing.kind !== "instance") return own;
  const root = layerRootNamed(checkout, landing.name) ?? mountedInstanceRoots(checkout).get(landing.name);
  if (root === undefined) throw new Error(`gen-landing-data: the landing instance \`${landing.name}\` has no root under ${checkout}`);
  return root;
}

const ROOT = landingRoot();

/**
 * The docs directory a sticky's links were AUTHORED against: its contributor's,
 * not the landing's. A link is written as the page's source location
 * (`/concepts/agentic-harness.html`) and `publishedHref` maps it to where
 * Jekyll publishes it (`/docs/cat-harness/…`) by reading that directory. While
 * cat-harness was the landing the two were one directory; on a site whose
 * landing is another layer (the IRIS replica's own site, 2026-10-09) the landing's
 * docs hold none of those pages, so every link was left at its source spelling
 * and 404'd. An unknown contributor keeps the old answer, the landing's.
 */
function contributorSiteDir(contributor: string | undefined): string {
  if (contributor) {
    const checkout = checkoutRootFor(HARNESS_ROOT);
    const root = layerRootNamed(checkout, contributor) ?? mountedInstanceRoots(checkout).get(contributor);
    if (root !== undefined) return join(root, siteDirFor(root));
  }
  return join(ROOT, siteDirFor(ROOT));
}

/**
 * The checkout the landing layer lives in, and the only place its themes'
 * owners are looked for.
 *
 * `repoRootFor(ROOT)` until 2026-10-15, which is `dirname`: right while the
 * landing was a NESTED layer (cat-harness in the monorepo), and an escape
 * the moment it is the checkout-root layer — a folio such as smart-ra,
 * whose landing is the repository itself. There it answered the directory
 * HOLDING the clone, so `themeByRef` read every sibling clone's declaration on
 * the machine and a stranger's invalid one (`qou.json`, next to smart-ra in
 * `~/space_cats`) failed this build. `dh4f` in the other direction: not a
 * clean run over nothing, a failed run over somebody else's tree. The forge
 * URL went the same way, read off a parent with no `.git`, so every source
 * link was silently dropped.
 */
const CHECKOUT = checkoutRootFor(ROOT);

/** The forge this checkout points at, or `undefined` when it has none. */
const REPO_URL = detectRepoUrl(CHECKOUT);

/**
 * The branch the source links point at.
 *
 * `main` rather than the checked-out branch: this data file is generated into
 * a PUBLISHED site, and a link to a feature branch dies when that branch does.
 * A staging preview linking to `main` is right for the same reason — the thing
 * a reader wants to edit is what is live, not what produced this preview.
 */
const SOURCE_BRANCH = "main";

const OUT = join(ROOT, siteDirFor(ROOT), "_data/stickies.json");
const check = process.argv.includes("--check");

// cat-harness-tools#1701: a content instance whose landing is a MOUNTED layer
// (an IG instance whose landing is a base layer) cannot commit that layer's data file, so
// the committed-currency check is not applicable there. The writer still runs.
if (check) {
  const landing = resolveLandingInstance(CHECKOUT);
  const why = landingMountedNotOwned(CHECKOUT, landing.kind === "instance" ? landing.name : undefined);
  if (why !== undefined) exitNotApplicable("landing:data:check", why);
  // A layer that declares the file `builtAtPublish` (owner, 2026-11-13, "3y":
  // generated at publish, not committed) has no committed copy to judge; the
  // publish runs this writer (`derive:publish`).
  const rel = relative(ROOT, OUT).split(sep).join("/");
  if (isBuiltAtPublish(readDeclaration(ROOT)?.builtAtPublish ?? [], rel)) {
    exitNotApplicable("landing:data:check", `${rel} is declared builtAtPublish: written at publish, never committed`);
  }
}
const decl = readDeclaration(ROOT);

/**
 * `docs/assets/x.png` → `/assets/x.png`; anything else is passed through.
 *
 * A one-line wrapper, kept so the call sites below read as they did. The
 * IMPLEMENTATION moved to `publishedAssetPath` in `schemas/kg/cat-harness.ts`
 * when the todo board needed the same transform (bean `5y4b`): this copy
 * hardcoded `docs/` where the site directory has a single answer already, and
 * a second hardcoded copy is how a layer that moves its site directory
 * ends up serving one correct path and one 404.
 */
function siteRelative(src: string): string {
  return publishedAssetPath(ROOT, src);
}

/**
 * The landing stickies, each with its theme's art already resolved.
 *
 * ## Resolved HERE, not in Liquid
 *
 * A sticky names a theme by id; the theme names an image ROLE; the layer's
 * `images[]` answers what that role's three crops are. Following that chain in
 * a template would mean a Liquid `where` over two collections per sticky per
 * layout, and Liquid has no way to REPORT that a link in the chain is missing —
 * it renders empty. `resolveThemeBackdrop` returns the three-state answer
 * (`none` / `missing` / complete), and a partial resolution is refused
 * wholesale rather than serving a wide crop to a phone.
 *
 * So the template gets a flat, already-decided structure and the decisions stay
 * where they can be tested.
 *
 * An unknown theme id degrades to no art rather than failing the build: whether
 * a theme is installed is a question about the layer's theme set, which a
 * sticky cannot see, and `theme.ts` already says resolution happens at render
 * time "where a missing theme degrades rather than failing the page".
 */
/**
 * Which crop a sticky's art should be, chosen from the shape of its CONTENT.
 *
 * The owner: *"auto chose layout based on content shape."* The three crops are
 * genuinely different shapes — landscape, portrait, square — and until now the
 * choice was made by viewport alone, which meant a two-line sticky and a
 * twelve-line one got the same wide crop on a laptop and neither fitted.
 *
 * Weight, not character count: a link costs far more vertical space than its
 * own text, because it is a block with a note under it. The constant is a
 * rough line-height's worth, which is what makes four links weigh more than the
 * paragraph above them — as they should, since they are what makes that card
 * tall.
 *
 * Thresholds are chosen against the three stickies that exist, which is honest
 * rather than universal: a short note is square, a paragraph is wide, and
 * anything that will run down the page takes the tall crop. They will need
 * revisiting when a sticky lands between two of them, and a sticky can always
 * override by declaring its own.
 */
function shapeFor(comment: string, links: readonly { label: string; note?: string }[]): string {
  const weight =
    comment.length +
    links.reduce((n, l) => n + l.label.length + (l.note?.length ?? 0) + 40, 0);
  // SQUARE IS THE DEFAULT, and the other two are deviations a content shape has
  // to earn. The owner: *"stickc notes ddefault to squares unless content shape
  // indicates otherwise (then stack)."*
  //
  // The old thresholds made `laptop` the middle band, so a card of ordinary
  // length became landscape by default and the board was three different shapes
  // for no reason a reader could see. Now: square until the words will not fit
  // one, and then the PORTRAIT crop — which is what "stack" means here, a
  // taller card in the same column rather than a wider one.
  //
  // `laptop` is still reachable, by a sticky declaring `shape: "laptop"`. It is
  // no longer something a paragraph falls into.
  return weight < 450 ? "card" : "mobile";
}

/**
 * The role whose clouds are the DEFAULT, per layout.
 *
 * The owner, 2026-09-20: *"default is centered in the various clouds positions
 * of the **default grump cloud** (across three layouts)."*
 *
 * `grumpy-cat`'s backdrop is the `landing` image role, and its three images are
 * the only ones in this layer that declare a `textRegion` — 0.33/0.25 on the
 * laptop crop, 0.13/0.225 on the mobile, 0.30/0.255 on the card. Every other
 * backdrop role (engineer, library, analyst) declares none, so without a
 * fallback their words sit in a generic inset box and the cloud above them is
 * left empty, which is what the first render of this showed.
 */
const DEFAULT_CLOUD_ROLE = "landing";

/**
 * The default cloud for a layout, or `undefined` when even that is unmeasured.
 *
 * **`undefined` rather than a guessed box.** A role nobody measured has no
 * quiet interior to aim at, and inventing one puts the words over the cat's
 * face. The stylesheet's generic inset box is the honest answer in that case,
 * and it is one place rather than one per role.
 *
 * Worth knowing why the borrow is sound HERE and might not be elsewhere: the
 * engineer crops are the same composition as the default one, 1672x941 against
 * 1671x941 and 1254x1254 against 1254x1254 — the same cat in a different
 * costume, so the cloud is in the same place. `library` and `analyst` are
 * different compositions (1669x942, 1024x1536, 1536x1024) and borrow the
 * default only until somebody measures them. That is a fallback, not a claim
 * about those images, and it degrades toward a readable box rather than toward
 * a wrong one.
 */
function defaultCloud(layout: string): unknown {
  return (decl?.images ?? []).find(
    (i) => i.role === DEFAULT_CLOUD_ROLE && i.layout === layout && i.textRegion,
  )?.textRegion;
}

const stickies = readLandingStickies(ROOT).map((st) => {
  // By REFERENCE, owner first (bean `v8n5`): a card citing another
  // layer's theme resolves against that layer's declared themes, and a
  // bare id against the contributing layer's own, then the platform's.
  const found = themeByRef(st.theme, CHECKOUT, st.contributedBy);
  const theme = found.ok ? found.theme : undefined;
  const resolved = theme ? resolveThemeBackdrop(theme, decl?.images) : undefined;
  const art: Record<string, unknown> = {};
  if (resolved && resolved.art.size > 0) {
    for (const [layout, img] of resolved.art) {
      art[layout] = {
        src: siteRelative(img.src),
        width: img.width ?? null,
        height: img.height ?? null,
        // The crop's own aspect, so the card can BE that shape rather than
        // letterbox the art inside a shape its text happened to produce. The
        // owner: *"i want stickys to be the same fixd size ... dispalyed
        // content matches layout ratios."*
        aspect: img.width && img.height ? Number((img.width / img.height).toFixed(4)) : null,
        // The cloud, per layout. `null` rather than a guessed box: a role whose
        // art declares no region has no cloud to centre in, and inventing one
        // would put the words over the cat's face on art nobody measured.
        textRegion: img.textRegion ?? defaultCloud(layout) ?? null,
      };
    }
  }
  return {
    id: st.id,
    summary: st.summary,
    comment: st.comment,
    // The ID, not the reference: `stickies.json` is read by the browser.
    theme: st.theme.themeId,
    // WHICH LAYER contributed this card. Carried through to the data file rather
    // than left in the node, because the board is composed and "which layer put
    // this here" is the first question anyone debugging it asks — and the answer
    // has to be available where the page is, not only where the schema is.
    contributedBy: st.contributedBy,
    // Split so the template never has to ask whether to apply `relative_url`:
    // doing so to an absolute URL breaks it, and omitting it on a site path
    // drops the baseurl. `isExternalLink` reads it off the URL scheme, which
    // cannot disagree with the value the way a hand-set flag can.
    links: st.links.map((l) => ({
      label: l.label,
      // A link authored as the page's SOURCE location, rewritten to where
      // Jekyll publishes it (bean `kc7k`: docs-folder pages live under
      // `/docs/cat-harness/`). Not a page here → unchanged.
      href: isExternalLink(l) ? l.href : publishedHref(contributorSiteDir(st.contributedBy), l.href),
      note: l.note ?? "",
      external: isExternalLink(l),
    })),
    art,
    // The crop this sticky's CONTENT wants, as opposed to the one its viewport
    // wants. The template uses it as the default and still lets a narrow screen
    // override — a tall phone should not be handed a landscape crop just
    // because the text is short.
    // The sticky's own choice wins over the derivation. The derivation guessed
    // `card` for a note the owner wanted landscape, which is what a heuristic
    // over three examples is worth: a starting point, not an answer.
    shape: st.shape ?? shapeFor(st.comment, st.links),
    // Emitted so the template can place the words without re-deriving anything.
    // Absent fields stay absent rather than becoming defaults here — the
    // stylesheet holds the defaults, in one place.
    text: st.text ?? null,
    // Emitted even when there is no art: the stylesheet composites it over
    // whatever is behind, and a sticky whose theme did not load still wants a
    // readable ground. Degrade toward legible.
    scrim: theme?.backdrop?.scrim ?? null,
    // Absent when there is no github.com `origin`, which is what makes the
    // control absent rather than dead. Spread so the key does not appear at
    // all rather than appearing as `null` — a consumer testing truthiness and
    // one testing presence should agree.
    ...(sourceLinks(REPO_URL, st.declaredIn, SOURCE_BRANCH) ?? {}),
  };
});

const payload = {
  _generated: "scripts/gen-landing-data.ts — do not hand-edit; edit the sticky nodes under folio/",
  stickies,
};

const next = `${JSON.stringify(payload, null, 2)}\n`;
const current = existsSync(OUT) ? readFileSync(OUT, "utf-8") : undefined;

if (check) {
  if (current === next) {
    console.log(`stickies.json is up to date (${stickies.length} sticky/ies)`);
    process.exit(0);
  }
  console.error("docs/_data/stickies.json is stale — run `bun run cat landing:data` and commit");
  process.exit(1);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, next);
console.log(`wrote ${OUT.replace(ROOT + "/", "")} (${stickies.length} sticky/ies)`);
