/**
 * ONE footer per IG site: an artefact page's footer and an IG site page's
 * footer carry the same facts and the same links (#1901 follow-up to #2264).
 *
 * The artefact pages (`gen-ig-pages.ts`) drew a footer of their own, from the
 * package alone: no © year (that is `sushi-config.yaml`'s `copyrightYear`),
 * and "Table of Contents" sent to the site root rather than `toc.html`. They
 * now flag `ig_footer` and the IG site's include draws them, from the one
 * `site.data.fhir.footer` the site's own pages read.
 *
 * End to end over a scratch, non-WHO IG: `gen-ig-pages` writes the artefact
 * pages of an `igSite` layer, `stageIgSite` + `copyDocsInto` build them
 * into the IG's site beside its own pages, and the footer include is rendered
 * through real Liquid with each page's OWN front matter. Every href is then
 * resolved against the page's own URL, so "the same link" means the same
 * target, not the same string.
 *
 * Calibrated: restoring the JS footer (`chrome === "fixture"` without the
 * `!IG_SITE` guard) fails the first test; dropping `ig_root` from the
 * include's on-site hrefs fails the Liquid parity test on the
 * "Table of Contents" and stylesheet targets.
 *
 * @module fhir-harness/scripts/ig-footer-parity.test
 */
import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

import { IPS, artifactIndex, scratchRepo } from "../test/support/ig-fixture";
import { FOOTER_TEMPLATE_PATH, stageIgSite } from "./build-ig-site";
import { artifactsFor, copyDocsInto, footerFor } from "./stage-ig-sites";

const ROOT = resolve(import.meta.dir, "..", "..");
const SCRIPT = join(ROOT, "fhir-harness/scripts/gen-ig-pages.ts");

// An IG-site layer: its docs directory builds INTO the IG's own site.
const repo = scratchRepo({ igs: { index: artifactIndex(IPS, "igs") } });
const instance = join(repo, "igs");
const declPath = join(instance, "igs.json");
const decl = JSON.parse(readFileSync(declPath, "utf-8"));
decl.directories.push({ id: "igs-docs", path: "docs/", graphTypologies: ["docs"], igSite: true });
writeFileSync(declPath, JSON.stringify(decl));
const gen = Bun.spawnSync(["bun", "run", SCRIPT, "--instance", instance, "--label", "Scratch IG", "--chrome-owner", "chrome-owner", "--full-pages"], { cwd: ROOT });
if (gen.exitCode !== 0) throw new Error(`gen-ig-pages failed:\n${gen.stderr.toString()}`);
const docs = join(instance, "docs");
const artefactPages = readdirSync(join(docs, "artifact")).filter((f) => f.endsWith(".md"));

// The IG's source: the © year, publisher and licence live only here.
const site = mkdtempSync(join(tmpdir(), "ig-footer-parity-"));
const src = join(site, "src");
const out = join(site, "out");
mkdirSync(join(src, "input", "pagecontent"), { recursive: true });
writeFileSync(
  join(src, "sushi-config.yaml"),
  ["id: igs", "title: Scratch IG", "copyrightYear: 2023+", "license: CC0-1.0", "publisher:", "  name: Example Org", "  url: https://example.org", "pages:", "  index.md:", "    title: Home", "  concepts.md:", "    title: Concepts", ""].join("\n"),
);
for (const p of ["index", "concepts"]) writeFileSync(join(src, "input", "pagecontent", `${p}.md`), `# ${p}\n`);
stageIgSite(src, out, { menu: { groups: [{ label: "Home", items: [{ label: "Concepts", href: "concepts.html" }] }] }, artifacts: artifactsFor(instance, "artifact/", { fullPages: true }), footer: footerFor(instance, "") });
const copied = copyDocsInto(docs, out);

afterAll(() => {
  rmSync(repo, { recursive: true, force: true });
  rmSync(site, { recursive: true, force: true });
});

const frontMatter = (file: string): Record<string, unknown> => {
  const text = readFileSync(file, "utf-8");
  return parseYaml(text.slice(4, text.indexOf("\n---", 3))) as Record<string, unknown>;
};

describe("an IG site's artefact pages carry the site's footer, not one of their own", () => {
  test("artefactPagesFlagSiteFooter", () => {
    expect(artefactPages.length).toBeGreaterThan(0);
    for (const f of artefactPages) {
      const text = readFileSync(join(docs, "artifact", f), "utf-8");
      expect(frontMatter(join(docs, "artifact", f))).toMatchObject({ ig_footer: true, ig_root: "../" });
      expect(text).not.toContain('<footer id="ig-footer"');
      expect(text).not.toContain("ig-footer.js");
    }
    // The package's facts are still written: they are the site footer's first source.
    expect(existsSync(join(docs, "assets", "ig-footer.json"))).toBe(true);
    expect(existsSync(join(docs, "assets", "ig-footer.js"))).toBe(false);
  });

  test("artefactPagesBuildIntoSite", () => {
    expect(copied.collisions).toEqual([]);
    const f = JSON.parse(readFileSync(join(out, "_data", "fhir.json"), "utf-8")).footer;
    // The package's facts laid over the source's: the year from the source,
    // the package id from the package, and "Table of Contents" only because
    // the site holds `toc.html`.
    expect(f).toMatchObject({ copyrightYear: "2023+", publisher: "Example Org", packageId: IPS.packageId, version: IPS.version });
    expect(f.links).toContainEqual({ label: "Table of Contents", href: "toc.html" });
    expect(existsSync(join(out, "toc.md"))).toBe(true);
    for (const f of artefactPages) expect(existsSync(join(out, "artifact", f))).toBe(true);
  });

  const ruby = spawnSync("ruby", ["-e", 'require "liquid"'], { encoding: "utf-8" }).status === 0;
  test.skipIf(!ruby)("bothFootersResolveSame", () => {
    const footer = JSON.parse(readFileSync(join(out, "_data", "fhir.json"), "utf-8")).footer;
    const script =
      'require "liquid"; require "json"; d = JSON.parse(STDIN.read.force_encoding("UTF-8")); print Liquid::Template.parse(d["t"], error_mode: :strict).render("site" => { "data" => { "fhir" => { "footer" => d["f"] } } }, "page" => d["p"])';
    const render = (page: Record<string, unknown>) => {
      const r = spawnSync("ruby", ["-e", script], { input: JSON.stringify({ t: readFileSync(FOOTER_TEMPLATE_PATH, "utf-8"), f: footer, p: page }), encoding: "utf-8" });
      expect(r.stderr).toBe("");
      return r.stdout;
    };
    // Each page's footer, with every href resolved against the page's URL.
    const drawn = (rel: string) => {
      const fm = frontMatter(join(out, rel));
      expect(fm.ig_footer).toBe(true);
      const html = render(fm);
      const base = new URL(rel.replace(/\.md$/, ".html"), "https://ig.example/site/");
      const at = (href: string) => new URL(href, base).href;
      const row = (cls: string) => html.match(new RegExp(`<p class="${cls}">([\\s\\S]*?)</p>`))?.[1] ?? "";
      const links = (s: string) => [...s.matchAll(/<a href="([^"]*)"[^>]*>([^<]*)<\/a>/g)].map((m) => `${m[2]} -> ${at(m[1]!)}`);
      return {
        tag: html.match(/<footer[^>]*>/)?.[0],
        stylesheets: [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((m) => at(m[1]!)),
        band: row("ig-footer-band"),
        bandLinks: links(row("ig-footer-band")),
        links: links(row("ig-footer-links")),
      };
    };
    const sitePage = drawn("index.md");
    const artefactPage = drawn(join("artifact", artefactPages[0]!));
    expect(artefactPage).toEqual(sitePage);
    // ...and they are the RIGHT facts and links, not merely equal ones.
    expect(sitePage.band).toContain("IG © 2023+ ");
    expect(sitePage.links).toContain("Table of Contents -> https://ig.example/site/toc.html");
    expect(sitePage.links.some((l) => l.startsWith("License -> https://spdx.org/licenses/CC0-1.0.html"))).toBe(true);
  });
});
