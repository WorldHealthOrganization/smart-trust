/**
 * A public comment release is frozen at `PC/<version>/` and never rewritten,
 * and no publish path deletes it.
 *
 * @module scripts/tests/sdlc/pc-release
 */
import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { pagesOfLines } from "../../pc-line-numbered-pdf.ts";
import { PC_PREFIX, bannerInto, close, freeze, readRelease, verify } from "../../pc-release.ts";
import { MANIFEST, publish as publishMainSite } from "../../publish-main-site.ts";
import { restoreStaging } from "../../restore-staging.ts";
import { FRAGMENT as STAGING_BANNER } from "../../staging-banner.ts";

const NOW = new Date("2026-11-01T09:00:00Z");

/** A publish branch with one preview, as `stage-local.ts` leaves it. */
function pagesWithPreview(): string {
  const pages = mkdtempSync(join(tmpdir(), "pc-release-"));
  const prev = join(pages, "STAGING", "claude-draft", "en", "doc");
  mkdirSync(prev, { recursive: true });
  writeFileSync(
    join(prev, "index.html"),
    `<!doctype html><html><head><link rel="canonical" href="https://o.github.io/r/STAGING/claude-draft/en/doc/"></head><body>${STAGING_BANNER}<p>Text</p></body></html>`,
  );
  writeFileSync(join(pages, "STAGING", "claude-draft", "staging.json"), "{}");
  return pages;
}

describe("freeze", () => {
  test("copies the preview to PC/<version>/, rewrites its own links, swaps the banner, records every file", () => {
    const pages = pagesWithPreview();
    const pdf = join(pages, "..", `draft-${Date.now()}.pdf`);
    writeFileSync(pdf, "%PDF-1.7 fake");
    const r = freeze({ pages, version: "v0.9", from: "STAGING/claude-draft/", pdf, document: "en/doc/", closes: "2026-12-01", now: NOW });

    const html = readFileSync(join(pages, PC_PREFIX, "v0.9", "en", "doc", "index.html"), "utf8");
    expect(html).toContain("https://o.github.io/r/PC/v0.9/en/doc/");
    expect(html).not.toContain("STAGING/claude-draft");
    expect(html).not.toContain("data-fa-staging-banner");
    expect(html).toContain("data-pc-release-banner");
    expect(html).toContain(`href="../../${r.pdf!.file}"`);
    expect(existsSync(join(pages, PC_PREFIX, "v0.9", "staging.json"))).toBe(false);

    expect(r.status).toBe("open");
    expect(Object.keys(r.files).sort()).toEqual([r.pdf!.file, "en/doc/index.html"].sort());
    expect(verify(pages, "v0.9")).toEqual({ changed: [], missing: [], added: [] });

    const index = JSON.parse(readFileSync(join(pages, PC_PREFIX, "index.json"), "utf8"));
    expect(index.releases.map((x: { version: string }) => x.version)).toEqual(["v0.9"]);
  });

  test("refuses a preview build: a public comment release is a full build (owner, 2026-11-01)", () => {
    const pages = pagesWithPreview();
    writeFileSync(join(pages, "STAGING", "claude-draft", "staging.json"), JSON.stringify({ buildType: "preview" }));
    expect(() => freeze({ pages, version: "v1", from: "STAGING/claude-draft", now: NOW })).toThrow(/preview build/);
    expect(existsSync(join(pages, PC_PREFIX, "v1"))).toBe(false);
  });

  test("records the build type it froze: full, or unstated for a copy built before the switch", () => {
    const pages = pagesWithPreview();
    expect(freeze({ pages, version: "v1", from: "STAGING/claude-draft", now: NOW }).build).toBe("unstated");
    writeFileSync(join(pages, "STAGING", "claude-draft", "staging.json"), JSON.stringify({ buildType: "full" }));
    expect(freeze({ pages, version: "v2", from: "STAGING/claude-draft", now: NOW }).build).toBe("full");
  });

  test("refuses a version that already exists: a release is never overwritten", () => {
    const pages = pagesWithPreview();
    freeze({ pages, version: "v1", from: "STAGING/claude-draft", now: NOW });
    expect(() => freeze({ pages, version: "v1", from: "STAGING/claude-draft", now: NOW })).toThrow(/never overwritten/);
  });

  test("refuses a version that is not one path segment", () => {
    const pages = pagesWithPreview();
    for (const v of ["../x", "a/b", "..", ""]) expect(() => freeze({ pages, version: v, from: "STAGING/claude-draft" })).toThrow();
  });

  test("verify names a file changed after the release", () => {
    const pages = pagesWithPreview();
    freeze({ pages, version: "v2", from: "STAGING/claude-draft", now: NOW });
    writeFileSync(join(pages, PC_PREFIX, "v2", "en", "doc", "index.html"), "<p>edited</p>");
    expect(verify(pages, "v2").changed).toEqual(["en/doc/index.html"]);
  });
});

describe("close", () => {
  test("changes only the record, never the pages", () => {
    const pages = pagesWithPreview();
    freeze({ pages, version: "v3", from: "STAGING/claude-draft", now: NOW });
    const r = close({ pages, version: "v3", log: "https://example.org/log", now: new Date("2026-12-02T00:00:00Z") });
    expect(r.status).toBe("closed");
    expect(readRelease(pages, "v3").log).toBe("https://example.org/log");
    expect(verify(pages, "v3")).toEqual({ changed: [], missing: [], added: [] });
  });
});

describe("no publish path removes a release", () => {
  test("the main publish never writes or deletes PC/", () => {
    // A frozen release on the publish branch, beside a main site the next publish drops a page of.
    const pages = pagesWithPreview();
    freeze({ pages, version: "v0.9", from: "STAGING/claude-draft", now: NOW });
    const frozen = readFileSync(join(pages, PC_PREFIX, "v0.9", "en", "doc", "index.html"), "utf8");
    const site = mkdtempSync(join(tmpdir(), "pc-release-site-"));
    writeFileSync(join(site, "index.html"), "<p>home</p>");
    writeFileSync(join(site, "gone.html"), "<p>dropped next time</p>");
    publishMainSite({ site, pages });
    rmSync(join(site, "gone.html"));
    const r = publishMainSite({ site, pages });

    expect(r.removed).toBe(2);
    expect(existsSync(join(pages, "gone.html"))).toBe(false);
    expect(readFileSync(join(pages, PC_PREFIX, "v0.9", "en", "doc", "index.html"), "utf8")).toBe(frozen);
    expect(verify(pages, "v0.9")).toEqual({ changed: [], missing: [], added: [] });

    // Nor can it be steered into PC/: a site writing there, or a manifest naming it, is refused.
    const intoPc = mkdtempSync(join(tmpdir(), "pc-release-site-"));
    mkdirSync(join(intoPc, PC_PREFIX, "v0.9"), { recursive: true });
    writeFileSync(join(intoPc, PC_PREFIX, "v0.9", "index.html"), "<p>overwrite</p>");
    expect(() => publishMainSite({ site: intoPc, pages })).toThrow(/reserved paths/);
    writeFileSync(join(pages, MANIFEST), JSON.stringify({ $schema: "folio-main-site/v1", commit: null, files: ["PC/v0.9/en/doc/index.html"] }));
    expect(() => publishMainSite({ site, pages })).toThrow(/not the main site's to delete/);
    expect(verify(pages, "v0.9")).toEqual({ changed: [], missing: [], added: [] });
  });
  test("a full-replace deploy carries PC/", () => {
    // A publish branch holding a frozen release, and a fresh site that knows nothing of it.
    const base = mkdtempSync(join(tmpdir(), "pc-release-deploy-"));
    const sh = (cwd: string, ...a: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...a], { cwd, stdio: "pipe" });
    const seed = join(base, "seed");
    mkdirSync(seed);
    sh(seed, "init", "-q", "-b", "gh-pages");
    mkdirSync(join(seed, PC_PREFIX, "v0.9"), { recursive: true });
    writeFileSync(join(seed, PC_PREFIX, "v0.9", "index.html"), "<p>frozen</p>");
    writeFileSync(join(seed, "index.html"), "<p>old home</p>");
    sh(seed, "add", "-A");
    sh(seed, "commit", "-qm", "seed");
    const repo = join(base, "repo");
    mkdirSync(repo);
    sh(repo, "init", "-q", "-b", "main");
    const site = join(base, "site");
    mkdirSync(site);
    writeFileSync(join(site, "index.html"), "<p>new home</p>");

    const r = restoreStaging({ repo, remote: seed, branch: "gh-pages", prefix: "STAGING", site });

    expect(r.carried).toContainEqual({ prefix: PC_PREFIX, state: "carried" });
    expect(readFileSync(join(site, PC_PREFIX, "v0.9", "index.html"), "utf8")).toBe("<p>frozen</p>");
    expect(readFileSync(join(site, "index.html"), "utf8")).toBe("<p>new home</p>");
  });
});

describe("bannerInto", () => {
  test("puts the banner after <body> once", () => {
    const once = bannerInto("<html><body class=x><p>a</p></body></html>", "<div data-pc-release-banner>B</div>");
    expect(once).toBe("<html><body class=x><div data-pc-release-banner>B</div><p>a</p></body></html>");
    expect(bannerInto(once, "<div data-pc-release-banner>C</div>")).toBe(once);
  });
});

describe("pagesOfLines reads the gutter numbers back from pdftotext", () => {
  test("every number in order, with its page", () => {
    const text = "  Title\n 1 First line\n 2 second\f 3 third line\n 4 4 apples on a line\n";
    const r = pagesOfLines(text, 4);
    expect(r.missing).toEqual([]);
    expect(r.pageOf.slice(1)).toEqual([1, 1, 2, 2]);
  });
  test("one unread number is reported, and the rest are still found", () => {
    const r = pagesOfLines(" 1 a\n b\n 3 c\n 4 d\n", 4);
    expect(r.missing).toEqual([2]);
    expect(r.pageOf[4]).toBe(1);
  });
  test("a number in the text that is not the next line is not taken for one", () => {
    const r = pagesOfLines(" 1 a\n 2024 was a year\n 2 b\n", 2);
    expect(r.missing).toEqual([]);
  });
});
