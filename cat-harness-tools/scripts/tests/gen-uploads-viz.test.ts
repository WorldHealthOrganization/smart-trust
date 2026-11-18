/**
 * The uploads harness is the QUEUE's, and stays the queue's.
 *
 * Issue #836, bean `v18c`. `uploads` and `library` declared the same
 * `coverage.visualiser`, so the uploads tile opened the corpus browser and
 * rendered the library's entry count — 0 on this layer, while 27 sources
 * waited in the queue beside it. The owner rejected all three ways of dividing
 * one page: *"funcionally different/behavior diffent so need distinct
 * harness"*.
 *
 * So the assertions here are about the SEPARATION, not about columns. A test
 * that checked the table's headings would pass just as happily on the day
 * somebody folded the corpus back in.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { itemState, viewerHtml } from "../gen-uploads-viz.ts";
import { unscopedSelectors } from "../lib/themed-page.ts";
import { readLibraryGraph } from "../library-graph.ts";
import { checkoutRootFor, layerRootsIn } from "../../schemas/kg/cat-harness.ts";
import type { UploadItem } from "../library-graph.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";

const item = (over: Partial<UploadItem> = {}): UploadItem => ({
  file: "2602.12670v4.pdf",
  kind: "file",
  instance: "folio-assistant",
  path: "uploads/2602.12670v4.pdf",
  bytes: 1769852,
  ext: "pdf",
  ingestedBy: "",
  docId: "",
  title: "",
  declaredFiles: 0,
  ...over,
});

describe("ONE dataset — this harness publishes no projection of its own", () => {
  test("the generator source emits no assets/uploads projection", () => {
    // Bean `flh4` / issue #618, recorded in `state-visualizer.ts`: the queue
    // block lives in `assets/library/index.json`, "since two projections over
    // it would be two answers to how many are queued". The first draft of this
    // generator emitted its own, which could not have DISAGREED on the day it
    // was written — the trap is the day one is regenerated and the other is
    // not. Asserted against the SOURCE, because a second projection is a thing
    // that gets added back by someone doing the obvious thing.
    const src = readFileSync(join(import.meta.dir, "..", "gen-uploads-viz.ts"), "utf8");
    expect(src).not.toMatch(/emit\(\s*join\(\s*dataDir/);
  });

  test("the viewer is pointed at the LIBRARY projection", () => {
    // `viewerPlacement(..., "library")` is what makes the href resolve to the
    // one dataset. Passing the uploads segment instead would mint a second.
    const src = readFileSync(join(import.meta.dir, "..", "gen-uploads-viz.ts"), "utf8");
    expect(src).toContain('viewerPlacement(site, route, "library")');
  });
});

describe("state is read from the corpus link, not guessed", () => {
  test("a unit no library slug names is waiting", () => {
    expect(itemState(item())).toBe("waiting");
  });

  test("a unit a slug names is ingested", () => {
    expect(itemState(item({ ingestedBy: "some-slug" }))).toBe("ingested");
  });
});

describe("the viewer is a queue view", () => {
  const html = viewerHtml("../../assets/uploads/index.json");

  test("the headline is what is WAITING, not a total", () => {
    // The pipeline doc's argument, made structural: the corpus grep searches
    // `library/` only, so a file waiting here makes a clean grep read as
    // "nobody has done this". A total would read as reassurance.
    expect(html).toContain("waiting to be ingested");
    const lead = html.indexOf("waiting to be ingested");
    const total = html.indexOf("queued units");
    expect(lead).toBeGreaterThan(-1);
    expect(total).toBeGreaterThan(-1);
    expect(lead).toBeLessThan(total);
  });

  test("it says why the queue matters, in the page rather than in a comment", () => {
    // A reader who opens this page and does not know the pipeline has to be
    // told there, not in a doc they would have to go and find.
    expect(html).toContain("library/");
    expect(html).toMatch(/not.*reachable by the corpus checklist/is);
  });

  test("an empty queue and an unreadable projection are DIFFERENT", () => {
    // Opposite facts, and the same rule the todo board states for its index.
    expect(html).toContain("Nothing in the queue");
    expect(html).toContain("This is not the same as an empty queue");
  });

  test("the projection is fetched by the RELATIVE href it was given", () => {
    // #801, one layer along: an absolute site-root path resolves against the
    // ORIGIN under a baseurl, which is how twelve navbar tiles came to 404.
    // The same bytes have to serve the canonical deploy and a branches/ preview.
    expect(html).toContain(JSON.stringify("../../assets/uploads/index.json"));
    expect(html).not.toMatch(/fetch\(["']\//);
  });

  test("a subject scope narrows the view without a second page template", () => {
    const scoped = viewerHtml("../../../assets/uploads/index.json", "folio-assistant");
    expect(scoped).toContain(JSON.stringify("folio-assistant"));
    // One template, two renderings — the rule gen-library-viz states for its
    // own two views.
    expect(scoped.replace(/folio-assistant/g, "").length).toBeGreaterThan(0);
  });
});

describe("the viewer is THEMED, so it carries the site's top band (2026-10-07)", () => {
  const html = viewerHtml("../../../assets/library/index.json", "who-iris", ["cat-harness", "who-iris"]);

  test("it is on the default layout, not a standalone document", () => {
    expect(html.startsWith("---\nlayout: default\n")).toBe(true);
    expect(html).not.toMatch(/<!doctype|<html|<head|<body/i);
    expect(html).toContain('<h1 id="up-title">');
    // The orphan pruner reads this line to establish ownership.
    expect(html).toMatch(/^var SCOPE = "who-iris";$/m);
  });

  test("it styles nothing outside its own wrapper", () => {
    expect(unscopedSelectors(html, ".up-page")).toEqual([]);
  });

  test("the subject pages are listed in the page, relative to it", () => {
    expect(html).toContain('<a href="../">All instances</a>');
    expect(html).toContain('<a href="../cat-harness/">cat-harness</a>');
    expect(html).toContain('<span aria-current="page">who-iris</span>');
  });
});

describe("a sidecar is not a queued document", () => {
  // Against the REAL corpus, because this defect is about what the queue
  // actually holds and a fixture would have been written by the same reading
  // that got it wrong. Found by rendering the page: five `.extraction.json`
  // files stood in the table as units "waiting to be ingested", 0 KB each,
  // inflating the headline from 20 to 27 — the one number the page exists for.
  const root = checkoutRootFor(join(HARNESS_ROOT));
  const g = readLibraryGraph(layerRootsIn(root), root);

  test("the corpus is readable, so the assertions below are not vacuous", () => {
    expect(g).not.toBeNull();
    expect(g!.uploads.length).toBeGreaterThan(0);
  });

  test("no extraction sidecar whose SOURCE is queued is itself a unit", () => {
    const names = new Set(g!.uploads.map((u) => u.file));
    const offenders = g!.uploads
      .map((u) => u.file)
      .filter((f) => f.endsWith(".extraction.json") && names.has(f.slice(0, -".extraction.json".length)));
    expect(offenders).toEqual([]);
  });

  test("an ORPHAN sidecar would still be a unit — the rule is keyed on the source", () => {
    // The sign-flipped defect: dropping every sidecar would hide a file that
    // nothing accounts for, which is exactly what a queue view is for. Asserted
    // on the RULE rather than on the corpus, which today has no orphan.
    const src = readFileSync(join(import.meta.dir, "..", "library-graph.ts"), "utf8");
    expect(src).toContain("!present.has(source)");
  });
});

/**
 * ADDING TO THE QUEUE — bean `v1hw` item 3, owner ruling 2026-09-23:
 * **a commit from a checkout.**
 *
 * The affordance is therefore a path and a command, not a control. A
 * published page cannot write to somebody's working tree, and a button that
 * looked like it could is `pb04` one layer up: a dead link invites a click
 * and then reads as "this site is broken".
 */
describe("the upload affordance — `v1hw`", () => {
  const src = readFileSync(join(import.meta.dir, "..", "gen-uploads-viz.ts"), "utf8");

  test("it says the mechanism, in the owner's terms", () => {
    expect(src).toContain("committing them from a checkout");
  });

  test("the command is built PER QUEUE, from the queue's own dir", () => {
    // Three queues, three different paths. A single hardcoded "put it in
    // uploads/" would be wrong for two of them — the same defect as
    // `ingest`'s printed `-o`, which named one directory for two arms that
    // wanted different ones (#1050). If this ever becomes a literal, that
    // defect is back.
    expect(src).toContain("qs.map(function(q){");
    expect(src).toContain("q.dir");
    expect(src).not.toMatch(/cp YOUR-FILE\.pdf uploads\//);
  });

  test("NO `--library` value is printed — a queue does not determine one", () => {
    // Measured 2026-09-23, and it refuted the obvious sibling convention in
    // all three queues: `uploads/` has landed files in agent-skills (5) AND
    // smart-base (7); `cat-harness/uploads` in cat-harness (5) AND
    // folio-assistant-sci (1); `who-iris/uploads` in none at all, where
    // `<instance>/library` would have confidently said `who-iris/library`.
    //
    // So the page says what the tool says: the destination is chosen.
    expect(src).toContain("chosen, never derived");
    expect(src).toContain("--library &lt;destination&gt;");
    // Never a concrete library in the emitted command.
    expect(src).not.toMatch(/--library [a-z-]+\/library/);
  });

  test("no BACKTICK in the injected client comment — it lives in a template literal", () => {
    // One backtick here ends the page string and turns the rest of the file
    // into TypeScript, failing at a line far from the mistake. It happened on
    // the first draft of this panel; the same warning is written twice
    // elsewhere in this repository.
    const client = src.slice(src.indexOf("ADDING TO THE QUEUE"), src.indexOf('$("add").innerHTML'));
    expect(client).not.toContain("`");
  });
});

test("the emitted command uses an ESCAPE for the newline, not a real one", () => {
  // A literal newline inside a single-quoted JS string is a syntax error, and
  // that is what the first draft shipped: the template literal collapsed the
  // escape one level too far and the whole inline script failed to parse
  // ("Unexpected EOF"). Caught by `generated-viewer-scripts`, which parses
  // every inline script in every generated viewer — a gate doing exactly the
  // job it exists for, on a page that otherwise looked fine.
  const src = readFileSync(join(import.meta.dir, "..", "gen-uploads-viz.ts"), "utf8");
  const panel = src.slice(src.indexOf('$("add").innerHTML'), src.indexOf('var rows = sorted();'));
  expect(panel).toContain("\\\\n");
  expect(panel).not.toMatch(/'[^']*\n[^']*' \+/);
});
