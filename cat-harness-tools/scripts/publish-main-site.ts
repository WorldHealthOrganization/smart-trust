#!/usr/bin/env bun
/**
 * Publish a folio's `main` site at the root of its publish branch, so a
 * preview has a "before" side. Bean `5uuf`, epic `q4jm`.
 *
 * @module scripts/publish-main-site
 *
 * The visual diff pictures each changed block on the published main site, and
 * the review page links "view on main" to it. Until this script, nothing
 * published a folio's `main` at all: every before picture read "its page is
 * not in the published site" and every such link 404'd (found by `ojcx`'s real
 * run on litlfred/folio-test#6).
 *
 * ## It deletes only what it wrote
 *
 * The root of the publish branch is shared: `branches/` holds every open PR's
 * preview, `PC/` the frozen public comment releases, `_render-log/` the render history, and a folio may keep files there
 * by hand (a `CNAME`, a verification file). Replacing the root wholesale would
 * delete all of it, which is the `plj1` failure. Overlaying without deleting
 * keeps pages `main` stopped producing, so a reviewer checking a removal is
 * told it did not happen (`85im`).
 *
 * So every publish writes a manifest, `_main-site.json`, listing the files it
 * put there, and the next publish removes exactly those before copying. A
 * file the manifest does not name is never touched. The first publish has no
 * manifest, so it removes nothing, and says how many files it found and left.
 *
 * It refuses a site that would write into a reserved path, before touching
 * anything.
 *
 * Usage: bun run cat-harness-tools/scripts/publish-main-site.ts --site _site --pages pages
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

import { PREVIEW_PREFIXES } from "./lib/preview-prefix.ts";

/** The manifest of files the last main publish wrote, at the publish root. */
export const MANIFEST = "_main-site.json";

/**
 * Where the frozen "Draft for Public Comment" releases live (`pc-release.ts`).
 * Unlike a preview, a release is never removed: the public cited its lines.
 */
export const PC_PREFIX = "PC";

/**
 * Top-level names the main site never writes and never deletes: the previews,
 * the public comment releases, the render history, the manifest itself, and
 * git's own directory.
 */
export const RESERVED: readonly string[] = [...PREVIEW_PREFIXES, PC_PREFIX, "_render-log", MANIFEST, ".git"];

export interface MainSiteManifest {
  $schema: "folio-main-site/v1";
  commit: string | null;
  files: string[];
}

/** Every file under `dir`, as `/`-separated paths relative to it, sorted. */
export function filesUnder(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(relative(dir, p).split(sep).join("/"));
    }
  };
  walk(dir);
  return out.sort();
}

/** True for a relative path this script may write or delete: inside the root and not reserved. */
export function isOwnPath(rel: string): boolean {
  if (rel === "" || rel.startsWith("/") || rel.split("/").some((s) => s === ".." || s === "." || s === "")) return false;
  return !(RESERVED as readonly string[]).includes(rel.split("/")[0]!);
}

/** The manifest's files, or `null` when there is none. A manifest that does not parse is an error, never "none". */
export function readManifest(pages: string): string[] | null {
  const p = join(pages, MANIFEST);
  if (!existsSync(p)) return null;
  const m = JSON.parse(readFileSync(p, "utf8")) as Partial<MainSiteManifest>;
  if (m.$schema !== "folio-main-site/v1" || !Array.isArray(m.files)) {
    throw new Error(`${MANIFEST} is not a folio-main-site/v1 manifest; refusing to guess which files are the main site's`);
  }
  return m.files;
}

export interface PublishResult {
  written: number;
  removed: number;
  /** Files at the root that no manifest named and this publish did not overwrite: left alone. */
  leftAlone: number;
  firstPublish: boolean;
}

export function publish(o: { site: string; pages: string; commit?: string | null }): PublishResult {
  const files = filesUnder(o.site);
  if (files.length === 0) throw new Error(`the site at ${o.site} is empty; refusing to publish, so main keeps its last site`);
  const bad = files.filter((f) => !isOwnPath(f));
  if (bad.length) throw new Error(`the site writes into reserved paths (${bad.slice(0, 5).join(", ")}); refusing to publish`);

  const previous = readManifest(o.pages);
  let removed = 0;
  for (const rel of previous ?? []) {
    // A manifest entry is checked by value too: the manifest sits on a branch anyone with push access can edit.
    if (!isOwnPath(rel)) throw new Error(`${MANIFEST} names '${rel}', which is not the main site's to delete; refusing`);
    const p = join(o.pages, rel);
    if (existsSync(p) && statSync(p).isFile()) {
      rmSync(p);
      removed++;
    }
  }

  const written = new Set(files);
  const leftAlone = filesUnder(o.pages).filter((f) => isOwnPath(f) && !written.has(f)).length;
  for (const rel of files) {
    const to = join(o.pages, rel);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(join(o.site, rel), to);
  }
  const manifest: MainSiteManifest = { $schema: "folio-main-site/v1", commit: o.commit ?? null, files };
  writeFileSync(join(o.pages, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);
  return { written: files.length, removed, leftAlone, firstPublish: previous === null };
}

if (import.meta.main) {
  const opt = (name: string): string | undefined => {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 ? process.argv[i + 1] : undefined;
  };
  const [site, pages] = [opt("site"), opt("pages")];
  if (process.argv.includes("--help") || !site || !pages) {
    console.log("usage: publish-main-site.ts --site <built site dir> --pages <publish branch checkout> [--commit <sha>]");
    process.exit(site && pages ? 0 : 2);
  }
  try {
    const r = publish({ site, pages, commit: opt("commit") ?? null });
    console.log(`published main's site: ${r.written} file(s) written, ${r.removed} removed from the last publish`);
    if (r.leftAlone) {
      console.log(
        `${r.leftAlone} file(s) at the root were not written by this publish` +
          (r.firstPublish ? " and no earlier manifest names them" : " and are not in the last manifest") +
          ": left alone. Remove them by hand if they are stale.",
      );
    }
  } catch (e) {
    console.error(`::error::${(e as Error).message}`);
    process.exit(1);
  }
}
