/**
 * The navbar tiles point where this layer actually publishes.
 *
 * Bean `udx8`. The knowledge-graph tile's href was `'/kg/' | relative_url`,
 * written into a Liquid template by convention, and nothing has ever been
 * published at `<base>/kg/`. It is the composed-link defect AGENTS.md records
 * against the README's twenty-three dead chapter PDFs, repeated in a second
 * generator.
 *
 * **So the assertions here are not about the string.** A dead link passes any
 * test that only checks the attribute — the old e2e spec asserted the tile
 * matched `/folio-assistant/kg/` and passed for as long as the tile was
 * broken. What is checked is that a target is `ok` because a FILE IS THERE,
 * `dead` because it is not, and `unknown` when there is nothing to check
 * against.
 *
 * @module scripts/tests/site-links
 *
 * The tests here that read the aggregate repository's own root
 * (`.github/workflows/docs-site.yml`) live in
 * `test/site-links-workflows.test.ts` (bean
 * `ho66`): standing alone, cat-harness has no such root to read.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { readFileSync } from "../../../test/support/site-fs.ts";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { exitCodeFor, siteLinks, verifySiteLinks } from "../../site-links.js";
import { siteDirFor, siteFileFor } from "../../../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../../lib/roots.ts";
import { siteNotBuilt } from "../../../test/support/checkout.ts";

const DECL = { name: "folio-assistant", stub: "folio-assistant" };

/** A built site tree, with whichever of the two artefacts the case wants. */
function build(opts: { viewer?: boolean; graph?: boolean }): string {
  const dir = mkdtempSync(join(tmpdir(), "site-links-"));
  if (opts.viewer) {
    mkdirSync(join(dir, "folio-assistant"), { recursive: true });
    writeFileSync(join(dir, "folio-assistant", "index.html"), "<!doctype html>");
  }
  if (opts.graph) {
    mkdirSync(join(dir, "folio-assistant"), { recursive: true });
    writeFileSync(join(dir, "folio-assistant", "folio-assistant.jsonld"), "{}");
  }
  return dir;
}

describe("siteLinks", () => {
  test("resolves the viewer and the graph through the published layout", () => {
    const byId = Object.fromEntries(siteLinks(DECL, "https://github.com/o/r").map((l) => [l.id, l]));
    // `<base>/<stub>/` and `<base>/<name>/<stub>.jsonld` — what the Pages
    // workflow builds. The graph sits under the layer's own directory, the
    // host's included, since #603 decision 1b (owner, 2026-10-23).
    expect(byId.kg.path).toBe("/folio-assistant/");
    expect(byId.jsonld.path).toBe("/folio-assistant/folio-assistant.jsonld");
    expect(byId.source.url).toBe("https://github.com/o/r");
  });

  test("never emits the `/kg/` segment the renderings moved off", () => {
    // Named, not counted: this is the exact defect, and it must not come back
    // through some other path being reintroduced.
    for (const l of siteLinks(DECL, "https://github.com/o/r")) {
      expect(l.path ?? "").not.toContain("/kg/");
    }
  });

  test("a directory URL is checked against its INDEX, not the directory", () => {
    // An empty `<stub>/` directory serves a 404 on Pages just as a missing
    // one does, so checking the directory would pass for a broken build.
    const kg = siteLinks(DECL).find((l) => l.id === "kg");
    expect(kg!.target).toBe(join("folio-assistant", "index.html"));
  });

  test("a stub that is not the repo name still resolves", () => {
    // WHO's `smart-base` publishes as `base`. A tile hardcoded to the repo
    // name would 404 there, which is the genericity half of the same defect.
    const byId = Object.fromEntries(
      siteLinks({ name: "smart-base", stub: "base" }).map((l) => [l.id, l]),
    );
    expect(byId.kg.path).toBe("/base/");
    // The directory is the NAME, the file the stub (`instanceDocPath`).
    expect(byId.jsonld.path).toBe("/smart-base/base.jsonld");
  });

  test("no detectable forge means no source link, not a guessed one", () => {
    expect(siteLinks(DECL, undefined).some((l) => l.id === "source")).toBe(false);
  });

  test("paths are site-ROOT-relative, so `relative_url` can prepend the baseurl", () => {
    // Without the leading slash Liquid resolves against the current page and
    // the tile breaks on every page but the site root. With the baseurl
    // baked in as well, it doubles. Exactly one of the two, here.
    for (const l of siteLinks(DECL)) {
      if (!l.path) continue;
      expect(l.path.startsWith("/")).toBe(true);
      // The baseurl twice would be `/folio-assistant/folio-assistant/…`; the
      // document's own `<name>/<stub>.jsonld` is one segment, not that.
      expect(l.path.startsWith("/folio-assistant/folio-assistant/")).toBe(false);
    }
  });
});

describe("verifySiteLinks", () => {
  test("a published target is ok because the file is there", () => {
    const v = verifySiteLinks(build({ viewer: true, graph: true }), siteLinks(DECL));
    expect(v.find((x) => x.id === "kg")!.verdict).toBe("ok");
    expect(v.find((x) => x.id === "jsonld")!.verdict).toBe("ok");
    expect(exitCodeFor(v)).toBe(0);
  });

  test("the `/kg/` build catches the original defect", () => {
    // A tree where only the graph shipped and the viewer did not: precisely
    // what a tile pointing at a path nothing writes looks like from here.
    const v = verifySiteLinks(build({ graph: true }), siteLinks(DECL));
    const kg = v.find((x) => x.id === "kg")!;
    expect(kg.verdict).toBe("dead");
    expect(kg.detail).toContain("folio-assistant/index.html");
    expect(exitCodeFor(v)).toBe(1);
  });

  test("an absent build is UNKNOWN and exits 2 — never ok, never dead", () => {
    // The third state. This repository is checked out far more often than it
    // is built; a report that cried dead on every fresh clone would be
    // ignored by the time it mattered, and one that reported ok would be a
    // watchdog gone blind reading as good news.
    const v = verifySiteLinks(join(tmpdir(), "site-links-no-such-build"),
                              siteLinks(DECL, "https://github.com/o/r"));
    // Named, not counted.
    for (const id of ["kg", "jsonld", "source"]) {
      expect(v.find((x) => x.id === id)!.verdict).toBe("unknown");
    }
    expect(v.some((x) => x.verdict === "ok")).toBe(false);
    expect(v.some((x) => x.verdict === "dead")).toBe(false);
    expect(exitCodeFor(v)).toBe(2);
  });

  test("the forge link is unknown, and does not hold the build open", () => {
    // Nothing here fetches the network. Reporting a URL as live because it is
    // well-formed is the composed-link claim this module exists to retire —
    // but an off-site link that can never be checked must not exit 2 for ever
    // either, or the gate is unsatisfiable.
    const v = verifySiteLinks(build({ viewer: true, graph: true }),
                              siteLinks(DECL, "https://github.com/o/r"));
    expect(v.find((x) => x.id === "source")!.verdict).toBe("unknown");
    expect(exitCodeFor(v)).toBe(0);
  });
});

describe("the template and the data agree", () => {
  const ROOT = join(HARNESS_ROOT);
  /** Standing alone, `_data/harness.json` is not built: `docs:harness` writes it at publish, and it is gitignored. */
  const NOT_BUILT = (): boolean =>
    siteNotBuilt("the harness data `docs:harness` writes at publish (gitignored)", join(ROOT, siteDirFor(ROOT), "_data/harness.json"));

  test.skipIf(NOT_BUILT())("harness.json carries links, each with exactly one destination", () => {
    const h = JSON.parse(readFileSync(join(ROOT, siteDirFor(ROOT), "_data/harness.json"), "utf8")) as {
      links?: { id: string; path?: string; url?: string }[];
    };
    expect(h.links).toBeDefined();
    for (const id of ["kg", "jsonld", "source"]) {
      const l = h.links!.find((x) => x.id === id);
      expect(l).toBeDefined();
      // One or the other, never both: `path` gets `relative_url` and `url`
      // does not, so an entry carrying both would render one of them wrongly.
      expect(Boolean(l!.path) !== Boolean(l!.url)).toBe(true);
    }
  });

  test.skipIf(NOT_BUILT())("no published link has the `/kg/` segment", () => {
    const h = JSON.parse(readFileSync(join(ROOT, siteDirFor(ROOT), "_data/harness.json"), "utf8")) as {
      links: { path?: string }[];
    };
    for (const l of h.links) expect(l.path ?? "").not.toContain("/kg/");
  });

  test("head_custom.html READS the resolved links and composes no path of its own", () => {
    // The structural half of the fix. The Liquid block is verified end to end
    // by rendering it through the real Liquid engine (see the PR); what is
    // guarded here is the regression that put the defect there in the first
    // place — somebody writing a path into the template by hand.
    const html = readFileSync(join(ROOT, siteFileFor(ROOT, "_includes/head_custom.html")), "utf8");
    const block = html.match(
      /<script type="application\/json" id="fa-site-links">[\s\S]*?<\/script>/,
    );
    expect(block).not.toBeNull();
    const src = block![0];
    expect(src).toContain("site.data.harness.links");
    // `path` is site-root-relative and MUST get the baseurl; `url` must not.
    expect(src).toContain("l.path | relative_url");
    // No literal path anywhere in the block. `'/kg/' | relative_url` is
    // exactly what it used to say.
    expect(src).not.toMatch(/'\/[^']*'\s*\|\s*relative_url/);
  });

  test("the site config no longer draws the forge link as header text", () => {
    // "remove the github.com from the top of the display". just-the-docs
    // renders `aux_links` as text at the top right of the MAIN panel; the
    // forge is reachable as a tile instead. A commented-out mention is fine,
    // an active key is not.
    const cfg = readFileSync(join(ROOT, siteDirFor(ROOT), "_config.yml"), "utf8");
    const active = cfg.split("\n").filter((l) => /^\s*aux_links/.test(l));
    expect(active).toEqual([]);
  });
});
