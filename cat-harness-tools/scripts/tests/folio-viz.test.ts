/**
 * The tests of this file that read the whole checkout (reads the folio
 * directory a content layer above cat-harness declares) live in
 * `test/folio-viz-checkout.test.ts` (bean `7zz1`): standing alone, cat-harness
 * has none of it.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";

import { folioSubjects, readFolioGraph, projection, viewerHtml } from "../gen-folio-viz.ts";
import { folioFileList } from "@litlfred/cat-harness/folio-render/file-list.ts";
import { FolioGraphProjectionSchema } from "../../schemas/ui/site-indexes.ts";
import { MARKER } from "../folio-mount.ts";
import { unscopedSelectors } from "../lib/themed-page.ts";
import { repoRootFor, siteDirFor } from "../../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { existingPageDir, pageParts, visualiserPageDir } from "../viewer-declarations.ts";

/**
 * The folio graph has a view of its own. Bean `7ofc`.
 *
 * Owner, 2026-09-22: *"folio must be in cat-harness and visualizer owned by
 * it."* `folio` is the only `renderable` kind — its CONTENT already renders
 * as the landing board — so what was missing was a view of the GRAPH, and
 * `check:subgraph-coverage` never asked for it because `owesVisualiser`
 * exempts the kind. The obligation is `2krx`'s: a directory nobody can see
 * is one nobody checks.
 */

const ROOT = join(HARNESS_ROOT);
const REPO = repoRootFor(ROOT);
const SITE = join(ROOT, siteDirFor(ROOT));

describe("the graph is read, not guessed", () => {
  const g = readFolioGraph([ROOT, REPO]);

  test("it finds the declared folio directory and its nodes", () => {
    expect(g).not.toBeNull();
    expect(g!.directories.length).toBeGreaterThan(0);
    expect(g!.nodes.length).toBeGreaterThan(0);
  });

  test("every node carries the fields the view shows", () => {
    for (const n of g!.nodes) {
      expect(typeof n.id).toBe("string");
      expect(n.id.length).toBeGreaterThan(0);
      expect(typeof n.chars).toBe("number");
      expect(Array.isArray(n.links)).toBe(true);
    }
  });

  test("a declared directory is reported with its PRESENCE, not silently skipped", () => {
    // `dh4f`, and the author of this file re-enacted it on 2026-09-22 by
    // measuring an instance-relative path from the repo root (bean `8mbk`,
    // scrapped). A consumer that scans nothing and reports clean is worse
    // than one that says it found nothing.
    for (const d of g!.directories) expect(typeof d.present).toBe("boolean");
  });

  test("the projection declares its own count, so a wrong one is visible", () => {
    // `tis1`: a count nobody can see is a count nobody checks — and a badge
    // also makes a WRONG count visible, which is how the voices tile was
    // caught saying 5 over a graph of 6.
    const p = projection(g!) as { tile: { folio: { count: number } }; nodes: unknown[] };
    expect(p.tile.folio.count).toBe(p.nodes.length);
  });
});

describe("the page", () => {
  test("is THEMED (2026-10-07): on the default layout, which carries the folio, so no mount of its own", () => {
    const html = viewerHtml("../../assets/folio/index.json");
    expect(html.startsWith("---\nlayout: default\n")).toBe(true);
    expect(html).not.toMatch(/<!doctype|<html|<head|<body/i);
    expect(html).toContain('<h1 id="fo-title">');
    expect(html).not.toContain(MARKER);
  });

  test("styles nothing outside its own wrapper", () => {
    expect(unscopedSelectors(viewerHtml("x.json"), ".fo-page")).toEqual([]);
  });

  test("NO BACKTICK reaches the emitted page — `bmr0`, and it caught this author", () => {
    // gen-library-viz's header states the rule; the author of this file broke
    // it there on 2026-09-22 by writing a bean id in backticks inside a
    // comment, and the generator failed to parse. Asserted rather than
    // remembered.
    expect(viewerHtml("x.json")).not.toContain("`");
  });

  test("the emitted script PARSES — an escape lost in the generator's template literal broke it once", () => {
    // 2026-10-15: the list view wrote `\"muted\"` inside the generator's
    // template literal, which emits a bare `"`, so the page's only script was
    // a SyntaxError and nothing on it ran (e2e folio-three-states, themed-viewers).
    const html = viewerHtml("../../assets/folio/index.json");
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]!);
    expect(scripts.length).toBeGreaterThan(0);
    // input-site: inert #c1de1bde — evaluates browser-side or toString'd source from this tree's own modules, already in the read set; it reads no environment
    for (const s of scripts) expect(() => new Function(s)).not.toThrow();
  });

  test("both tables carry a caption, an aria-label, and a preceding h2 heading (finding 5)", () => {
    const html = viewerHtml("../../assets/folio/index.json");
    expect(html).toContain('<h2 id="fo-dirs-head">Declared folio directories</h2>');
    expect(html).toContain('aria-label="Declared folio directories"');
    expect(html).toContain('<caption>Declared folio directories</caption>');
    expect(html).toContain('<h2 id="fo-nodes-head">Folio nodes</h2>');
    expect(html).toContain('aria-label="Folio nodes"');
    expect(html).toContain('<caption>Folio nodes</caption>');
  });

  test("link cells are compact and wrap links in .links and .link-pill (finding 4)", () => {
    const html = viewerHtml("../../assets/folio/index.json");
    expect(html).toContain('<div class="links">');
    expect(html).toContain('class="link-pill"');
    expect(html).toContain(".fo-page .links { display:flex; flex-wrap:wrap;");
    expect(html).toContain(".fo-page .link-pill { display:inline-block;");
  });
});

describe("the generated artefacts are the ones declared", () => {
  // Under the page locale, or at the old address on a site not yet regenerated.
  const parts = { harness: "cat-harness", visualiser: "folio" };
  const page = join(existingPageDir(SITE, parts) ?? visualiserPageDir(SITE, pageParts(parts)), "index.html");
  const data = join(SITE, "assets", "folio", "index.json");

  test("both exist — run `bun run cat folio:viz` if not", () => {
    expect(existsSync(page), `${page} missing`).toBe(true);
    expect(existsSync(data), `${data} missing`).toBe(true);
  });

  test("the committed page is the themed one, and says which directories it draws", () => {
    const text = readFileSync(page, "utf-8");
    expect(text).toMatch(/^---\nlayout: default\n/);
    expect(text).toMatch(/^rendered-by: folio-viewer$/m);
  });
});

describe("the committed projection is MACHINE-INDEPENDENT", () => {
  /**
   * Caught by this change's own gate, on its first CI run: the projection
   * embedded `/home/user/folio-assistant/cat-harness/folio/...`, so
   * `folio:viz:check` went red on a file that was correct for the machine
   * that wrote it and could never be correct anywhere else. It also
   * published the author's directory layout into a JSON anyone can read.
   *
   * The gate found it only because CI's checkout path differs. These
   * assertions find it without needing a second machine.
   */
  const data = join(SITE, "assets", "folio", "index.json");

  test("no FILESYSTEM path in the committed artefact is absolute", () => {
    // The fields that carry paths, named rather than sniffed. The first
    // draft of this spec flagged every string beginning with "/" and failed
    // on nine LINK HREFS — `/skills.html`, `/architecture.html` — which are
    // site-root-relative URLs and exactly what a sticky is supposed to
    // carry. A test that cannot tell a URL from a path would have to be
    // switched off the first time a sticky linked to a page.
    const p = JSON.parse(readFileSync(data, "utf-8")) as {
      directories: Array<{ dir: string }>;
      nodes: Array<{ file: string }>;
    };
    const abs = [
      ...p.directories.map((d) => d.dir),
      ...p.nodes.map((n) => n.file),
    ].filter((v) => v.startsWith("/") || /^[A-Za-z]:[\\/]/.test(v));
    expect(abs.join("\n")).toBe("");
    // The premise: there ARE paths here, so the filter is not vacuous.
    expect(p.nodes.length + p.directories.length).toBeGreaterThan(0);
  });

  test("...and the graph it is built from carries none either", () => {
    // Asserting only on the file would pass if somebody stripped paths at
    // write time while the reader still returned them — the projection is
    // not the only consumer of `readFolioGraph`.
    const g = readFolioGraph([ROOT, REPO], REPO)!;
    for (const d of g.directories) expect(d.dir.startsWith("/")).toBe(false);
    for (const n of g.nodes) expect(n.file.startsWith("/")).toBe(false);
  });

  test("the SAME tree read from a different base gives the same paths", () => {
    // The property that actually matters, and the one a single-machine test
    // can still check: relativised against the repo root, the answer does
    // not depend on where the repo happens to sit.
    // The other base is the same checkout reached through a link from a
    // scratch directory: another path to the identical tree.
    const scratch = mkdtempSync(join(tmpdir(), "folio-viz-base-"));
    try {
      const alt = join(scratch, "elsewhere");
      symlinkSync(REPO, alt, "dir");
      const a = readFolioGraph([ROOT, REPO], REPO)!;
      const b = readFolioGraph([join(alt, relative(REPO, ROOT)), alt], alt)!;
      expect(a.nodes.length).toBeGreaterThan(0);
      expect(b.nodes.map((n) => n.file)).toEqual(a.nodes.map((n) => n.file));
      expect(b.directories.map((d) => d.dir)).toEqual(a.directories.map((d) => d.dir));
      expect(a.nodes.every((n) => n.file.includes(`${basename(ROOT)}/folio/`))).toBe(true);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });
});

/**
 * Bean `qgjh`: a node's links are links. The page's own link resolver, run as
 * the page runs it: absolute http(s) passes, a site-rooted href is resolved
 * against the site root found from the data href, anything else is text.
 */
describe("node links resolve on the page (qgjh)", () => {
  const html = viewerHtml("../../assets/folio/index.json");
  const script = html.match(/<script>([\s\S]*?)<\/script>/g)!.map((s) => s.replace(/<\/?script>/g, "")).join("\n");
  const start = script.indexOf("var SITE_ROOT");
  const end = script.indexOf("\n}\n", script.indexOf("function linkHref")) + 3;
  // input-site: inert #0994ee00 — evaluates browser-side or toString'd source from this tree's own modules, already in the read set; it reads no environment
  const linkHref = new Function(
    `var DATA_HREF = "../../assets/folio/index.json";\n${script.slice(start, end)}\nreturn linkHref;`,
  )() as (h: string) => string;

  test("an absolute http(s) link is used as it is", () => {
    expect(linkHref("https://github.com/x")).toBe("https://github.com/x");
  });
  test("a site-rooted link resolves against the site root", () => {
    expect(linkHref("/agentic-harness.html")).toBe("../../agentic-harness.html");
  });
  test("a protocol-relative or unknown href stays text", () => {
    expect(linkHref("//evil.example/x")).toBe("");
    expect(linkHref("javascript:alert(1)")).toBe("");
  });
});

describe("the 'list' view is the harness's own file list (bean ohx6)", () => {
  const g = readFolioGraph([ROOT, REPO]);

  test("each present directory's files are EXACTLY folioFileList's answer, not a second listing", () => {
    for (const d of g!.directories.filter((x) => x.present)) {
      expect(d.files).toEqual(folioFileList(join(REPO, d.dir)));
    }
  });

  test("the projection carries a formatted size for every file, and an absent directory lists none", () => {
    const p = projection(g!) as { directories: Array<{ present: boolean; files: Array<{ path: string; bytes: number; size: string }> }> };
    for (const d of p.directories) {
      if (!d.present) expect(d.files).toEqual([]);
      for (const f of d.files) expect(f.size).toMatch(/^\d+(\.\d)? (B|KB|MB|GB)$/);
    }
  });

  // The writer and the schema check:kind-validators parses its output with
  // are two files in two layers; they disagreed once ("directories.0:
  // Unrecognized key: files", after the list view added the field), and only
  // the gate over the committed artefact said so. This states the contract
  // where the writer is: what projection() emits, the schema accepts.
  test("the projection parses with FolioGraphProjectionSchema, files included", () => {
    const r = FolioGraphProjectionSchema.safeParse(projection(g!));
    expect(r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)).toEqual([]);
    const withFiles = projection({
      directories: [
        { dir: "folio", present: true, nodes: 0, files: [{ path: "README.md", bytes: 1131 }] },
        { dir: "gone", present: false, nodes: 0, files: [] },
      ],
      nodes: [],
    });
    expect(FolioGraphProjectionSchema.safeParse(withFiles).success).toBe(true);
  });

  test("the schema is still strict: a file row with a key the writer never emits is refused", () => {
    const p = projection({ directories: [{ dir: "folio", present: true, nodes: 0, files: [{ path: "a", bytes: 1 }] }], nodes: [] }) as {
      directories: Array<{ files: Array<Record<string, unknown>> }>;
    };
    p.directories[0]!.files[0]!.mtime = "2026-10-15";
    expect(FolioGraphProjectionSchema.safeParse(p).success).toBe(false);
  });

  test("the page has a place for the list view, drawn before the node table", () => {
    const html = viewerHtml("../assets/folio/index.json");
    expect(html).toContain('<div id="files"></div>');
    expect(html.indexOf('id="files"')).toBeLessThan(html.indexOf('id="nodes"'));
    expect(html).toContain("List view: files");
  });
});

describe("per-instance folio pages (bean folio-assistant-1nu0)", () => {
  const d = (id: string, absPath: string, declaredBy: string, kinds = ["folio"]) => ({ id, absPath, declaredBy, graphTypologies: kinds });

  test("one subject per instance holding a folio directory, the declarer's by-id directory excluded", () => {
    const subjects = folioSubjects(
      [
        d("folio", "/x/cat-harness/folio", "cat-harness"),
        d("folios", "/x/core/folios", "folio-assistant-core"),
        d("folio", "/x/who-iris/folio", "who-iris"),
        d("beans", "/x/who-iris/beans", "who-iris", ["beans"]),
      ],
      "cat-harness",
      ["folio"],
    );
    expect(subjects.map((s) => s.name)).toEqual(["folio-assistant-core", "who-iris"]);
    expect(subjects[0]!.dirs).toEqual(["/x/core/folios"]);
  });

  test("an instance page names its instance and links back to the full view", () => {
    const html = viewerHtml("../../../../assets/folio/who-iris/index.json", "who-iris");
    expect(html).toContain("folio — who-iris");
    expect(html).toContain('<a href="../">the full view</a>');
    expect(html).not.toContain("`");
  });
});
