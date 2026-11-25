#!/usr/bin/env bun
/**
 * Freeze a "Draft for Public Comment" release of a folio's site at a
 * permanent path, `PC/<version>/`, on the publish branch.
 *
 * ```sh
 * # copy a built preview, or any built site, to PC/<version>/ (write-once)
 * bun run cat-harness-tools/scripts/pc-release.ts freeze --pages <gh-pages checkout> \
 *   --version v0.9 --from branches/<slug> [--site <built dir>] \
 *   [--pdf draft.pdf] [--line-map line-map.json] [--title "…"] [--document en/<slug>/] \
 *   [--commit <sha>] [--opens 2026-11-01] [--closes 2026-12-01]
 *
 * # when the comment period ends: record it, change nothing else
 * bun run cat-harness-tools/scripts/pc-release.ts close --pages <dir> --version v0.9 [--log <url>]
 *
 * # check that nothing in a release changed since it was frozen
 * bun run cat-harness-tools/scripts/pc-release.ts verify --pages <dir> --version v0.9
 * ```
 *
 * ## Why a path of its own
 *
 * A public comment cites a page and a line of ONE draft, and
 * `branches/<slug>/` is replaced on every push and deleted when the PR closes.
 * `PC/` is written or deleted by no publish path: the main publish
 * (`publish-main-site.ts`, `build-instance-site.ts`) keeps it, and the
 * full-replace deploys carry it (`restore-staging.ts`). This script refuses to
 * write a version that already exists.
 *
 * ## What is frozen
 *
 * Every file of the release is listed in `PC/<version>/release.json` with its
 * sha256, so `verify` can show that the draft the public read is the draft
 * that is still served. The line-numbered PDF and its line map
 * (`pc-line-numbered-pdf.ts`) go in the same directory.
 *
 * Links inside the copied site that named the preview's path are rewritten to
 * the release's path, and the staging banner is replaced by the release
 * banner.
 *
 * `close` writes only `status`, `closed` and `log` into `release.json` (the
 * archive step of the review): the release's pages stay as they were.
 *
 * @module scripts/pc-release
 */
import { createHash } from "node:crypto";
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";

import { PC_PREFIX } from "./publish-main-site.ts";
import { FRAGMENT as STAGING_BANNER } from "./staging-banner.ts";

export { PC_PREFIX };

/** A version: one path segment, as `v0.9`, `2026-11` or `draft-1`. */
export const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** The release record, at `PC/<version>/release.json`. */
export interface PcRelease {
  $schema: "pc-release/v1";
  version: string;
  title: string;
  status: "open" | "closed";
  /** When it was frozen, ISO 8601. */
  released: string;
  /** The comment period, as the editor set it. */
  opens?: string;
  closes?: string;
  /** When `close` ran, and where the review's log is. */
  closed?: string;
  log?: string;
  /** The source commit the site was built from, and the path it was copied from. */
  commit?: string;
  from?: string;
  /** The build type of the copied site (`lib/build-type.ts`): `full`, or `unstated` for a copy built before the switch. Never `preview`. */
  build?: string;
  /** The document page inside the release, relative to it. */
  document?: string;
  pdf?: { file: string; sha256: string };
  lineMap?: string;
  /** Every file of the release but this record, with its sha256. */
  files: Record<string, string>;
}

/** The list of releases, at `PC/index.json`. */
export interface PcIndex {
  $schema: "pc-release-index/v1";
  releases: { version: string; title: string; status: "open" | "closed"; released: string; closes?: string; closed?: string }[];
}

const TEXT = /\.(html?|js|mjs|json|jsonld|css|xml|txt|svg|md|webmanifest)$/i;

function sha256(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

function filesUnder(dir: string): string[] {
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

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** The banner on every page of a release. Plain HTML: it must still read in fifty years. */
export function releaseBanner(r: Pick<PcRelease, "version" | "title" | "released" | "closes">, pdfHref?: string): string {
  const day = r.released.slice(0, 10);
  const closes = r.closes ? ` Comments close ${escapeHtml(r.closes)}.` : "";
  const pdf = pdfHref ? ` <a href="${escapeHtml(pdfHref)}" style="color:inherit">Line-numbered PDF</a>.` : "";
  return (
    `<div data-pc-release-banner lang="en" dir="ltr" style="background:#fff4d6;color:#3d2b00;border-bottom:1px solid #d9b860;padding:6px 12px;font:14px/1.4 system-ui,sans-serif">` +
    `<b>${escapeHtml(r.title)}</b>, frozen ${day}. This copy does not change; cite its page and line numbers.${closes}${pdf}</div>`
  );
}

/** Put the banner right after `<body …>`, or replace the staging banner when the copy had one. */
export function bannerInto(html: string, banner: string): string {
  if (html.includes("data-pc-release-banner")) return html;
  if (html.includes(STAGING_BANNER)) return html.replace(STAGING_BANNER, banner);
  const m = /<body\b[^>]*>/i.exec(html);
  return m ? html.slice(0, m.index + m[0].length) + banner + html.slice(m.index + m[0].length) : html;
}

export interface FreezeOptions {
  pages: string;
  version: string;
  /** The copied directory: `--site`, else `<pages>/<from>`. */
  site?: string;
  /** The path the copied site was published at, e.g. `branches/<slug>`; its links are rewritten. */
  from?: string;
  title?: string;
  document?: string;
  pdf?: string;
  lineMap?: string;
  commit?: string;
  opens?: string;
  closes?: string;
  now?: Date;
}

export function releaseDir(pages: string, version: string): string {
  if (!VERSION_PATTERN.test(version) || version === "." || version === "..") throw new Error(`not a release version: ${JSON.stringify(version)}`);
  return join(pages, PC_PREFIX, version);
}

/** The `buildType` a built site's `staging.json` names (`lib/build-type.ts`), or undefined when it names none. */
export function stagedBuildType(site: string): string | undefined {
  const p = join(site, "staging.json");
  if (!existsSync(p)) return undefined;
  try {
    const t = (JSON.parse(readFileSync(p, "utf8")) as { buildType?: unknown }).buildType;
    return typeof t === "string" ? t : undefined;
  } catch {
    return undefined;
  }
}

export function freeze(o: FreezeOptions): PcRelease {
  const dest = releaseDir(o.pages, o.version);
  if (existsSync(dest)) throw new Error(`${PC_PREFIX}/${o.version}/ already exists: a release is never overwritten. Choose a new version.`);
  const from = o.from?.replace(/^\/+|\/+$/g, "");
  if (from !== undefined && (from === "" || from.split("/").some((s) => s === ".." || s === "."))) throw new Error(`--from must be a path on the publish branch: ${o.from}`);
  const site = o.site ?? (from ? join(o.pages, from) : undefined);
  if (!site || !existsSync(site) || !statSync(site).isDirectory()) throw new Error(`no built site to freeze: ${site ?? "give --site or --from"}`);
  if (resolve(site).startsWith(resolve(join(o.pages, PC_PREFIX)) + sep)) throw new Error("a release is copied from a build, not from another release");
  // A public comment release is a FULL build (owner, 2026-11-01): a preview
  // borrows main's indexes, so its search and slices describe main, not the
  // draft being frozen. A copy that names no build type predates the switch
  // and is let through, with that recorded.
  const buildType = stagedBuildType(site);
  if (buildType === "preview") {
    throw new Error(`${from ?? site} is a preview build, which borrows main's indexes. Build it full first (feature-staging dispatch with build_type: full), then freeze.`);
  }

  const title = o.title ?? `Draft for Public Comment ${o.version}`;
  const released = (o.now ?? new Date()).toISOString();
  mkdirSync(dest, { recursive: true });
  cpSync(site, dest, { recursive: true });
  // The preview's own record would describe the branch, not the release.
  rmSync(join(dest, "staging.json"), { force: true });
  rmSync(join(dest, "staging-banner.js"), { force: true });

  let pdf: PcRelease["pdf"];
  if (o.pdf) {
    const name = basename(o.pdf);
    copyFileSync(o.pdf, join(dest, name));
    pdf = { file: name, sha256: sha256(o.pdf) };
  }
  let lineMap: string | undefined;
  if (o.lineMap) {
    lineMap = "line-map.json";
    copyFileSync(o.lineMap, join(dest, lineMap));
  }

  const base: Pick<PcRelease, "version" | "title" | "released" | "closes"> = { version: o.version, title, released, ...(o.closes ? { closes: o.closes } : {}) };
  for (const rel of filesUnder(dest)) {
    if (!TEXT.test(rel)) continue;
    const p = join(dest, rel);
    let text = readFileSync(p, "utf8");
    const before = text;
    if (from) text = text.split(`/${from}/`).join(`/${PC_PREFIX}/${o.version}/`);
    if (/\.html?$/i.test(rel)) {
      const depth = rel.split("/").length - 1;
      const pdfHref = pdf ? `${"../".repeat(depth)}${pdf.file}` : undefined;
      text = bannerInto(text, releaseBanner(base, pdfHref));
    }
    if (text !== before) writeFileSync(p, text);
  }

  const files: Record<string, string> = {};
  for (const rel of filesUnder(dest)) files[rel] = sha256(join(dest, rel));
  const release: PcRelease = {
    $schema: "pc-release/v1",
    ...base,
    status: "open",
    ...(o.opens ? { opens: o.opens } : {}),
    ...(o.commit ? { commit: o.commit } : {}),
    ...(from ? { from } : {}),
    build: buildType ?? "unstated",
    ...(o.document ? { document: o.document } : {}),
    ...(pdf ? { pdf } : {}),
    ...(lineMap ? { lineMap } : {}),
    files,
  };
  writeFileSync(join(dest, "release.json"), JSON.stringify(release, null, 2) + "\n");
  writeIndex(o.pages);
  return release;
}

export function readRelease(pages: string, version: string): PcRelease {
  const p = join(releaseDir(pages, version), "release.json");
  if (!existsSync(p)) throw new Error(`${PC_PREFIX}/${version}/ is not a release (no release.json)`);
  const r = JSON.parse(readFileSync(p, "utf8")) as PcRelease;
  if (r.$schema !== "pc-release/v1") throw new Error(`${PC_PREFIX}/${version}/release.json is not pc-release/v1`);
  return r;
}

/** The archive step: the period is over. Only the record changes. */
export function close(o: { pages: string; version: string; log?: string; now?: Date }): PcRelease {
  const r = readRelease(o.pages, o.version);
  if (r.status === "closed") return r;
  const next: PcRelease = { ...r, status: "closed", closed: (o.now ?? new Date()).toISOString(), ...(o.log ? { log: o.log } : {}) };
  writeFileSync(join(releaseDir(o.pages, o.version), "release.json"), JSON.stringify(next, null, 2) + "\n");
  writeIndex(o.pages);
  return next;
}

/** Files of a release that changed, went missing, or appeared since it was frozen. */
export function verify(pages: string, version: string): { changed: string[]; missing: string[]; added: string[] } {
  const r = readRelease(pages, version);
  const dir = releaseDir(pages, version);
  const now = new Set(filesUnder(dir).filter((f) => f !== "release.json"));
  const changed: string[] = [];
  const missing: string[] = [];
  for (const [rel, sum] of Object.entries(r.files)) {
    if (!now.has(rel)) missing.push(rel);
    else if (sha256(join(dir, rel)) !== sum) changed.push(rel);
    now.delete(rel);
  }
  return { changed, missing, added: [...now].sort() };
}

/** `PC/index.json` and `PC/index.html`: every release, newest first. Rebuilt from the records, never edited. */
export function writeIndex(pages: string): PcIndex {
  const root = join(pages, PC_PREFIX);
  const releases: PcIndex["releases"] = [];
  for (const v of existsSync(root) ? readdirSync(root) : []) {
    if (!existsSync(join(root, v, "release.json"))) continue;
    const r = readRelease(pages, v);
    releases.push({ version: r.version, title: r.title, status: r.status, released: r.released, ...(r.closes ? { closes: r.closes } : {}), ...(r.closed ? { closed: r.closed } : {}) });
  }
  releases.sort((a, b) => b.released.localeCompare(a.released));
  const index: PcIndex = { $schema: "pc-release-index/v1", releases };
  writeFileSync(join(root, "index.json"), JSON.stringify(index, null, 2) + "\n");
  const rows = releases
    .map((r) => {
      const rec = readRelease(pages, r.version);
      const doc = rec.document ? `${r.version}/${rec.document}` : `${r.version}/`;
      const pdf = rec.pdf ? ` · <a href="${escapeHtml(`${r.version}/${rec.pdf.file}`)}">PDF</a>` : "";
      const state = r.status === "open" ? `open${r.closes ? ` until ${escapeHtml(r.closes)}` : ""}` : `closed ${escapeHtml((r.closed ?? "").slice(0, 10))}`;
      return `<li><a href="${escapeHtml(doc)}">${escapeHtml(r.title)}</a>${pdf} · released ${r.released.slice(0, 10)} · ${state}</li>`;
    })
    .join("\n");
  writeFileSync(
    join(root, "index.html"),
    `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>Drafts for public comment</title></head>\n<body style="font:16px/1.5 system-ui,sans-serif;max-width:48rem;margin:2rem auto;padding:0 1rem">\n<h1>Drafts for public comment</h1>\n<p>Each draft below is frozen: it never changes after release. Comments cite its version, page and line numbers.</p>\n<ul>\n${rows}\n</ul>\n</body></html>\n`,
  );
  return index;
}

function flag(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}

if (import.meta.main) {
  const [cmd, ...argv] = process.argv.slice(2);
  const pages = flag(argv, "pages");
  const version = flag(argv, "version");
  if (!pages || !version || !["freeze", "close", "verify"].includes(cmd ?? "")) {
    console.error("usage: pc-release.ts freeze|close|verify --pages <dir> --version <v> [options; see the header]");
    process.exit(64);
  }
  if (cmd === "freeze") {
    const opt = (k: string) => flag(argv, k);
    const r = freeze({
      pages,
      version,
      ...(opt("site") ? { site: opt("site")! } : {}),
      ...(opt("from") ? { from: opt("from")! } : {}),
      ...(opt("title") ? { title: opt("title")! } : {}),
      ...(opt("document") ? { document: opt("document")! } : {}),
      ...(opt("pdf") ? { pdf: opt("pdf")! } : {}),
      ...(opt("line-map") ? { lineMap: opt("line-map")! } : {}),
      ...(opt("commit") ? { commit: opt("commit")! } : {}),
      ...(opt("opens") ? { opens: opt("opens")! } : {}),
      ...(opt("closes") ? { closes: opt("closes")! } : {}),
    });
    console.log(`✓ ${PC_PREFIX}/${r.version}/ frozen: ${Object.keys(r.files).length} files${r.pdf ? `, PDF ${r.pdf.file}` : ""}`);
  } else if (cmd === "close") {
    const r = close({ pages, version, ...(flag(argv, "log") ? { log: flag(argv, "log")! } : {}) });
    console.log(`✓ ${PC_PREFIX}/${r.version}/ closed ${r.closed}`);
  } else {
    const v = verify(pages, version);
    const bad = v.changed.length + v.missing.length + v.added.length;
    for (const [k, l] of Object.entries(v)) for (const f of l) console.error(`  ✗ ${k}: ${f}`);
    console.log(bad ? `✗ ${PC_PREFIX}/${version}/ differs from what was frozen (${bad} file(s))` : `✓ ${PC_PREFIX}/${version}/ is as frozen`);
    process.exit(bad ? 1 : 0);
  }
}
