/**
 * A viewer page that answers to no declaration is pruned; anything else is not.
 *
 * @module scripts/tests/viewer-orphans.test
 *
 * **Bean `ankg`, found live.** #604 renamed `folio-assist-sci/` to
 * `folio-assistant-sci/`. The subject slug comes from the entry's path, so
 * regeneration produced the new page correctly and left the old one behind —
 * a page serving a subject the declaration no longer describes, at a URL
 * nothing links to, removed by hand in #603.
 *
 * `--check` was structurally blind to it: it compares only the files it is
 * about to write, so a file the generator no longer writes is outside what it
 * looks at. It can find a page that is WRONG; it could never find a page that
 * SHOULD NOT EXIST.
 *
 * These assert the pair the bean asks for — a planted orphan is found, a
 * hand-authored sibling survives — and they assert it against the COMMITTED
 * tree as well as against temp dirs, because that is what made the same fix in
 * `gen-iris-pages` catch a real orphan rather than a hypothetical one.
 */
import { describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { readdirSync, readFileSync } from "../../../test/support/site-fs.ts";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { isSubjectShell } from "../../gen-library-viz.ts";
import { orphanSubjectPages, viewerHtml } from "../../gen-schema-viz.ts";
import { readDeclaration, siteDirFor } from "../../../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../../lib/roots.ts";
import { declaredPageRoute } from "../../viewer-declarations.ts";
import { siteNotBuilt } from "../../../test/support/checkout.ts";

const INSTANCE = resolve(HARNESS_ROOT);
/**
 * The published site root, READ rather than written.
 *
 * `site-dir-single-answer.test.ts` fails any source file that spells the
 * output site root as a literal, and it was right to fail this one: a test
 * that hardcodes `docs` is a second answer to a question `harness.json`
 * already answers, and it stops being true the moment the site root moves.
 * The handler segment is read the same way, for the same reason.
 */
const SITE = join(INSTANCE, siteDirFor(INSTANCE));
const HANDLER = readDeclaration(INSTANCE)?.name;
/**
 * Each kind's pages sit at its viewer's DECLARED route, `<locale>/<harness>/<id>`
 * (owner, 2026-10-09) — the route its generator writes under, asked rather
 * than composed from the handler and the kind.
 */
const VIEWER_OF: Record<string, string> = { schemas: "schemas-viewer", library: "library-viewer" };

/** A directory holding one subject page that declares itself for `scope`. */
function subjectPage(parent: string, dir: string, scope: string): void {
  mkdirSync(join(parent, dir), { recursive: true });
  writeFileSync(join(parent, dir, "index.html"), viewerHtml("../../assets/x/index.json", scope));
}

describe("orphanSubjectPages", () => {
  const tmp = () => mkdtempSync(join(tmpdir(), "viewer-orphans-"));

  it("a wanted subject is never an orphan", () => {
    const d = tmp();
    subjectPage(d, "who-iris", "who-iris");
    expect(orphanSubjectPages(d, ["who-iris"])).toEqual({ owned: [], foreign: [] });
  });

  it("the ankg case: a renamed subject leaves its old page behind, and it is found", () => {
    const d = tmp();
    subjectPage(d, "folio-assist-sci", "folio-assist-sci");
    subjectPage(d, "folio-assistant-sci", "folio-assistant-sci");
    const { owned, foreign } = orphanSubjectPages(d, ["folio-assistant-sci"]);
    expect(owned).toEqual(["folio-assist-sci"]);
    expect(foreign).toEqual([]);
  });

  it("a hand-authored page is FOREIGN — reported, never pruned", () => {
    // `deletion-requires-confirmation`: an agent does not remove a durable
    // artefact it did not create. This is the half that makes pruning safe to
    // run at all.
    const d = tmp();
    mkdirSync(join(d, "hand-authored"));
    writeFileSync(join(d, "hand-authored", "index.html"), "<!doctype html><title>mine</title>");
    expect(orphanSubjectPages(d, [])).toEqual({ owned: [], foreign: ["hand-authored"] });
  });

  it("a page whose SCOPE names a DIFFERENT subject is foreign, not owned", () => {
    // Ownership is the page naming ITSELF. A page that says it is for some
    // other subject is not one this generator wrote for this location, and
    // guessing is what the scoping rule exists to stop.
    const d = tmp();
    subjectPage(d, "who-iris", "something-else");
    const { owned, foreign } = orphanSubjectPages(d, []);
    expect(owned).toEqual([]);
    expect(foreign).toEqual(["who-iris"]);
  });

  it("a directory with no index.html is foreign", () => {
    const d = tmp();
    mkdirSync(join(d, "empty"));
    expect(orphanSubjectPages(d, [])).toEqual({ owned: [], foreign: ["empty"] });
  });

  it("files beside the subject directories are ignored", () => {
    // The parent's own `index.html` is not a subject directory, and neither is
    // a `.nojekyll`. Only directories are ever considered.
    const d = tmp();
    writeFileSync(join(d, "index.html"), viewerHtml("../assets/x/index.json"));
    writeFileSync(join(d, ".nojekyll"), "");
    expect(orphanSubjectPages(d, [])).toEqual({ owned: [], foreign: [] });
  });

  it("a missing parent directory is not an error", () => {
    // A generator that has never run has no page tree, and that is not a
    // finding about orphans.
    expect(orphanSubjectPages(join(tmp(), "never-written"), [])).toEqual({ owned: [], foreign: [] });
  });
});

describe("the committed tree carries no orphan", () => {
  // The ratchet, asserted against what is actually published rather than
  // against a fixture — a fixture passes on the day somebody re-keys a real
  // subject.
  it("this instance declares a name, so there is a handler segment to look under", () => {
    // Without it the two cases below would pass over a path that does not
    // exist, which is the vacuous-green failure this suite exists to avoid.
    expect(HANDLER).toBeTruthy();
  });

  describe.each(["schemas", "library"])("%s", (kind) => {
    // Standing alone the viewer's subject pages are not built: its generator
    // writes them at publish and they are gitignored (bean w1gy F18). An
    // undeclared route guards nothing, so the assertion below still names it.
    const route = declaredPageRoute(INSTANCE, VIEWER_OF[kind]!);
    const unbuilt =
      route !== undefined &&
      siteNotBuilt(`the ${kind} viewer's subject pages its generator writes at publish (gitignored)`, join(SITE, route));
    it.skipIf(unbuilt)("subject pages all declare themselves", () => {
      const route = declaredPageRoute(INSTANCE, VIEWER_OF[kind]!);
      expect(route, `${kind}: no declared viewer route`).toBeDefined();
      const dir = join(SITE, route!);
      const subs = readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name);
      expect(subs.length).toBeGreaterThan(0);
      for (const s of subs) {
        const html = readFileSync(join(dir, s, "index.html"), "utf-8");
        // A library page is a thin shell (#1881) whose identity is its config
        // block; a schema page still names itself in a SCOPE line.
        if (kind === "library") expect(isSubjectShell(html, s)).toBe(true);
        else expect(html).toContain(`var SCOPE = "${s}";`);
      }
    });
  });
});
