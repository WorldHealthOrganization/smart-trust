#!/usr/bin/env bun
/**
 * Where the docs site's action tiles point — RESOLVED, never composed.
 *
 * `renderingPath` in `schemas/kg/cat-harness.ts` says where a layer's
 * renderings land:
 *
 * ```
 * <base>/<stub>.jsonld   the knowledge graph
 * <base>/<stub>/         the viewer
 * ```
 *
 * This module does two things, deliberately separate:
 *
 * 1. **`siteLinks()` computes the targets from the declaration** through
 *    `artefactStub` and `renderingPath` — the same functions the exporter and
 *    the workflow use, so the tile cannot disagree with what is published.
 * 2. **`verifySiteLinks()` checks each one against a BUILT TREE.** A path is
 *    `ok` because a file is there, not because the arithmetic looked right.
 *
 * ## "Could not determine" is a third state
 *
 * An absent or unreadable site directory yields `unknown`, never `ok` and
 * never `dead`. The CLI exits **2** for it, distinct from the **1** it exits
 * for a link it has positively established is broken, so a checkout with no
 * build does not report a wall of dead links.
 *
 * An **external** link (the forge) is `unknown` too, always: nothing here
 * fetches the network.
 *
 * Usage:
 * ```sh
 * bun run cat-harness-tools/scripts/site-links.ts                 # print the resolved targets
 * bun run cat-harness-tools/scripts/site-links.ts --site _site    # ...and verify them against a build
 * bun run cat-harness-tools/scripts/site-links.ts --json
 * ```
 *
 * @module scripts/site-links
 */
import { existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { artefactStub, readDeclaration, renderingPath } from "../schemas/kg/cat-harness.js";
import type { CatHarnessDeclaration } from "../schemas/kg/cat-harness.js";
import { instanceDocPath } from "./instance-exports.js";

/**
 * Anything whose destination can be checked against a built tree.
 *
 * **Split out of `SiteLink` so the CHECKER is not tied to the three navbar
 * tiles.** `verifySiteLinks` never reads anything tile-specific — it takes an
 * id, a target and a site directory, and answers `ok` / `dead` / `unknown`.
 * That is the general machinery this module exists to provide, and the
 * argument in the header ("a link built by convention is a claim; only a link
 * checked against the tree that ships is evidence") is not about tiles.
 *
 * The second caller proved the point and the type refused it: the QA
 * badges' `data-qa-index` and `data-qa-src` URLs are composed by the page
 * generator and were checked against nothing, and `scripts/tests/qa-results.test.ts`
 * could not verify them without inventing tile ids. `id` is a free-form label
 * here and stays a closed union on `SiteLink`, where it is a KEY that
 * `docs-ui.js` looks a tile up by.
 */
export interface CheckableLink {
  /** What to call this link in a verdict. */
  id: string;
  /** Absolute URL, for a target that is not on this site. */
  url?: string;
  /**
   * The file that must exist under the built site for the link to resolve.
   *
   * Separate from a URL path because they differ: a directory URL resolves to
   * that directory's `index.html`, and checking the directory alone would pass
   * for an empty one.
   */
  target?: string;
}

/** A tile's destination, as the site data file records it. */
export interface SiteLink extends CheckableLink {
  /** Stable key; `docs-ui.js` looks the tile up by this. */
  id: "kg" | "jsonld" | "source";
  /**
   * Site-root-relative path, for a target this build publishes. Liquid's
   * `relative_url` prepends the site's `baseurl`, so this must NOT carry it —
   * writing the baseurl in here and applying `relative_url` too would double
   * it, which is its own 404.
   */
  path?: string;
}

/** What a verification run established about one link. */
export interface LinkVerdict {
  id: CheckableLink["id"];
  /** `ok` — the target is there. `dead` — it is not. `unknown` — not checkable here. */
  verdict: "ok" | "dead" | "unknown";
  /** What was looked for, or why nothing was. */
  detail: string;
}

/**
 * The targets, computed from the declaration.
 *
 * `repoUrl` is passed in rather than detected here so the caller owns the
 * "could not determine" case: a checkout with no `origin` gets no source link
 * at all, which is better than a plausible-looking guess at one.
 */
export function siteLinks(
  decl: Pick<CatHarnessDeclaration, "name" | "stub">,
  repoUrl?: string,
): SiteLink[] {
  const stub = artefactStub(decl);
  // `renderingPath("", …)` yields a DOCUMENT-relative path on purpose — a
  // leading slash in a minted `@id` would retarget it at the domain root,
  // which is a different site. A Liquid `relative_url` wants the opposite: it
  // prepends the site's `baseurl` to a site-ROOT-relative path. So the slash
  // is added here, once, where the difference between an identity and a link
  // is the whole point, rather than being smuggled into the shared helper.
  const sitePath = (...segments: string[]): string => `/${renderingPath("", ...segments)}`;
  const out: SiteLink[] = [
    // The viewer. A DIRECTORY, because Pages resolves an extensionless
    // `<base>/<stub>` only to a directory index — so the file that has to be
    // there is the index, not the directory.
    { id: "kg", path: sitePath(`${stub}/`), target: join(stub, "index.html") },
    // The graph document itself. `.jsonld` is canonical — it is what every
    // `@id` in the document names — so that is what is linked, even though the
    // build also publishes a `.json` alias for hosts with no `.jsonld` media
    // type. Linking the alias would advertise a URL no `@id` claims.
    // Under the layer's own directory, the host's included, since #603
    // decision 1b (owner, 2026-10-23): `exportIdentity`'s `docPath`, through
    // the same resolver. The old root `<stub>.jsonld` is a tombstone now.
    { id: "jsonld", path: sitePath(instanceDocPath({ name: decl.name, stub })), target: instanceDocPath({ name: decl.name, stub }) },
  ];
  if (repoUrl) out.push({ id: "source", url: repoUrl });
  return out;
}

/**
 * Check each link against a built site tree.
 *
 * `siteDir` is the directory the site is served FROM — `_site` in the Pages
 * workflow. An absent one is `unknown` for every link, not `dead`: this
 * repository is checked out far more often than it is built, and a report that
 * cried dead on every fresh clone would be ignored by the time it mattered.
 */
export function verifySiteLinks(siteDir: string, links: CheckableLink[]): LinkVerdict[] {
  const built = existsSync(siteDir) && statSync(siteDir).isDirectory();
  return links.map((l) => {
    if (l.target === undefined) {
      return {
        id: l.id,
        verdict: "unknown" as const,
        detail: `${l.url ?? "(no target)"} — off-site, not fetched`,
      };
    }
    if (!built) {
      return {
        id: l.id,
        verdict: "unknown" as const,
        detail: `${siteDir} is not a built site directory; ${l.target} was not checked`,
      };
    }
    const abs = join(siteDir, l.target);
    return existsSync(abs)
      ? { id: l.id, verdict: "ok" as const, detail: `${l.target} is present` }
      : { id: l.id, verdict: "dead" as const, detail: `${l.target} is MISSING under ${siteDir}` };
  });
}

/** Exit code for a set of verdicts: 0 ok, 1 a dead link, 2 could not determine. */
export function exitCodeFor(verdicts: LinkVerdict[]): 0 | 1 | 2 {
  if (verdicts.some((v) => v.verdict === "dead")) return 1;
  // A link that could not be checked is only "could not determine" when it was
  // meant to be checkable. The forge link is `unknown` by construction and
  // must not hold the build open for ever.
  if (verdicts.some((v) => v.verdict === "unknown" && v.detail.includes("not a built site")))
    return 2;
  return 0;
}

// ── CLI ─────────────────────────────────────────────────────────

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const at = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
  };
  const root = resolve(at("--root") ?? ".");
  const decl = readDeclaration(root);
  if (!decl) {
    // Names the file it actually looked for. This said "cat-harness.json",
    // which is the GRAPH TYPOLOGY, not the filename — so the message sent a
    // reader looking for a file that has never existed under that name.
    console.error(`site-links: no declaration at ${root}; nothing to resolve.`);
    process.exit(2);
  }
  // Detected here, at the edge, so the library half stays pure and testable.
  const { detectRepoUrl } = await import("../pipeline/readme-toc.js");
  const links = siteLinks(decl, detectRepoUrl(root));
  const siteDir = at("--site");

  if (argv.includes("--json")) {
    console.log(JSON.stringify({ links, verdicts: siteDir ? verifySiteLinks(siteDir, links) : [] }, null, 2));
  } else {
    for (const l of links) console.log(`  ${l.id.padEnd(8)} ${l.path ?? l.url}`);
  }

  if (!siteDir) process.exit(0);

  const verdicts = verifySiteLinks(resolve(siteDir), links);
  if (!argv.includes("--json")) {
    console.log("");
    for (const v of verdicts) console.log(`  ${v.verdict.padEnd(8)} ${v.id.padEnd(8)} ${v.detail}`);
  }
  const code = exitCodeFor(verdicts);
  if (code === 1) console.error("\nsite-links: a navbar tile points at a file this build does not publish.");
  if (code === 2) console.error("\nsite-links: COULD NOT DETERMINE — no build to check against. Not a pass.");
  process.exit(code);
}
