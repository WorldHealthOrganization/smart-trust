/**
 * The voices reader and its viewer.
 *
 * Bean `bu2q`. Four things are asserted here, and each is something that would
 * go wrong SILENTLY — a page that renders, looks right, and says something
 * false. A generator whose output is HTML has no type system between it and
 * the reader, so the checks that matter are the ones about what the page
 * CLAIMS.
 *
 * The tests of this file that read the whole checkout (draws the voices
 * folio-assistant-sci, smart-base and who-iris ship) live in
 * `test/voices-viz-checkout.test.ts` (bean `7zz1`): standing alone,
 * cat-harness has none of it.
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readVoicesGraph, type VoicesGraph } from "../../voices-graph.ts";
import { projection, viewerHtml } from "../../gen-voices-viz.ts";
import { unscopedSelectors } from "../../lib/themed-page.ts";
import { shippedVoices, overlaySeverityOf } from "../../../pipeline/voice-criteria.ts";
import { overlayCriterionId } from "../../../pipeline/voice-criteria.ts";
import { directoriesForGraph, layerRootsIn, repoRootFor } from "../../../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../../lib/roots.ts";

const INSTANCE = join(HARNESS_ROOT);
/** The repository root — `repoRootFor` takes a LAYER root and is `dirname`. */
const REPO = repoRootFor(INSTANCE);

/** Read once — the reader touches the filesystem across every layer. */
const G: VoicesGraph = (() => {
  const g = readVoicesGraph([INSTANCE]);
  if (g === null) throw new Error("no voices directory is declared — the fixture is the corpus");
  return g;
})();

describe("a declared directory that is not there is a ROW, not a silence", () => {
  test("a declared-but-absent directory IS reported, on a fixture that cannot be closed", () => {
    // This asserted "at least one is false today", and its own comment named
    // the hazard: closing the gap and a reader that DROPS absent directories
    // make the corpus look identical. The gap was then closed — `agent-skills`
    // shipped its voices on 2026-09-22, bean `26tu` — and the assertion went
    // red for the good reason.
    //
    // A test whose subject is a defect expires when the defect is fixed, so
    // the subject is now a fixture: a layer declaring a `voices` directory
    // that is not there. It asserts the READER's behaviour, which is the thing
    // that must never regress, and no amount of tidying the corpus can make it
    // vacuous.
    const root = mkdtempSync(join(tmpdir(), "voices-absent-"));
    const inst = join(root, "myinst");
    mkdirSync(inst, { recursive: true });
    writeFileSync(
      join(inst, "myinst.json"),
      JSON.stringify({
        name: "myinst",
        directories: [
          {
            id: "voices",
            path: "skills/voices/",
            graphTypologies: ["voices"],
            description: "declared and deliberately absent — the fixture for this test",
          },
        ],
      }),
    );
    try {
      const g = readVoicesGraph([inst], root)!;
      expect(g).not.toBeNull();
      const absent = g.directories.filter((d) => !d.present);
      expect(absent.length).toBe(1);
      expect(absent[0]!.voices).toEqual([]);
      expect(absent[0]!.dir).toContain("skills/voices");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("...and the corpus's directories are all ACCOUNTED FOR, present or not", () => {
    // The other half, and the one the old assertion was really protecting: a
    // reader that silently dropped an absent directory would pass the fixture
    // above only if it dropped it there too — but a reader that drops them
    // only when SOME are present would not. So every declared voices directory
    // must appear in the graph, whatever its state on disk.
    const declared = layerRootsIn(REPO).flatMap((r) => directoriesForGraph(r, "voices"));
    expect(G.directories.length).toBe(declared.length);
    for (const d of G.directories) {
      expect(typeof d.present).toBe("boolean");
      if (!d.present) expect(d.voices).toEqual([]);
    }
  });

  test("an absent directory still reports its declared path", () => {
    for (const d of G.directories.filter((x) => !x.present)) {
      expect(d.dir.length).toBeGreaterThan(0);
      expect(d.instance.length).toBeGreaterThan(0);
    }
  });
});

describe("the citations — the reason the page exists", () => {
  test("every rule cites something, and the reader says WHICH KIND", () => {
    const rules = G.voices.flatMap((v) => v.rules);
    expect(rules.length).toBeGreaterThan(0);
    for (const r of rules) {
      expect(r.citation === "library" || r.citation === "kg-node").toBe(true);
      expect(r.cites).toBeTruthy();
    }
  });

  test("every rule carries the passage it was read from", () => {
    // PR #210 is the reason: ten plausible rules per voice with `source: null`,
    // one asserting the opposite of what its source says. A quote is what lets
    // a reviewer check a derivation without opening the PDF.
    for (const r of G.voices.flatMap((v) => v.rules)) {
      expect(r.quote.trim().length).toBeGreaterThan(0);
    }
  });

  test("the totals add up to the rules, rather than being counted twice", () => {
    const rules = G.voices.flatMap((v) => v.rules);
    expect(G.totals.rules).toBe(rules.length);
    expect(G.totals.citingLibrary + G.totals.citingKgNode).toBe(rules.length);
    expect(G.totals.voices).toBe(G.voices.length);
  });
});

describe("the page agrees with the QA sidecars about severity", () => {
  test("`overlaySeverity` and `criterion` match what the criteria derivation produces", () => {
    // A page showing one severity while the sidecars carry another is worse
    // than a page showing none: it is a second answer, free to disagree, and
    // the reader has no way to tell which is live. Two readers over one fact,
    // checked against each other rather than hoped about.
    const byId = new Map(shippedVoices(INSTANCE).map((s) => [s.voice.id, s.voice]));
    for (const v of G.voices) {
      const voice = byId.get(v.id);
      expect(voice).toBeDefined();
      expect(v.overlaySeverity).toBe(overlaySeverityOf(voice!));
      expect(v.criterion).toBe(overlayCriterionId(v.id));
    }
  });
});

describe("the viewer page", () => {
  const html = viewerHtml("../../assets/voices/index.json");

  test("it carries no stray backtick — the failure mode this generator family has", () => {
    // Twice in the sibling generator, both times in a COMMENT: a backtick
    // terminates the template literal and the rest becomes TypeScript, failing
    // at a line far from the mistake. Bean `bmr0`.
    expect(html).not.toContain("`");
  });

  test("it is THEMED, so it carries the site's top band (2026-10-07)", () => {
    expect(html.startsWith("---\nlayout: default\n")).toBe(true);
    expect(html).not.toMatch(/<!doctype|<html|<head|<body|<main\b|<header\b|<footer\b/i);
    expect(html).toContain('<h1 id="vo-title">');
    expect(unscopedSelectors(html, ".vo-page")).toEqual([]);
    const sub = viewerHtml("x", "who-iris", ["smart-base", "who-iris"]);
    expect(sub).toContain('<a href="../smart-base/">smart-base</a>');
    expect(sub).toContain('<span aria-current="page">who-iris</span>');
  });

  test("it names its own scope, which is what makes pruning safe", () => {
    expect(/var SCOPE = "";/.test(html)).toBe(true);
    expect(/var SCOPE = "who-iris";/.test(viewerHtml("x", "who-iris"))).toBe(true);
  });

  test("it fetches the projection at the href it was given", () => {
    expect(html).toContain('fetch("../../assets/voices/index.json")');
  });

  test("it escapes interpolated text", () => {
    // Every voice field reaches the DOM through `esc`, and a quote is prose
    // from a source document — the one field most likely to contain a bracket.
    expect(html).toContain("function (s) {");
    expect(html).toContain('replace(/</g, "&lt;")');
  });

  test("it renders the no-citation state as a finding rather than a blank", () => {
    // Unreachable through the schema, and rendered anyway: a reader who cannot
    // tell "no citation" from "citation not rendered" learns nothing from an
    // empty cell.
    expect(html).toContain("This rule cites nothing");
  });

  test("it is dark by default, and the site's `light` switch beats it", () => {
    // Themed since 2026-10-07: the site's own switch (`data-fa-scheme`, which
    // head_custom.html always sets) decides, not the OS media query, and the
    // site's ground is dark first.
    expect(html).toMatch(/\.vo-page \{\s*color-scheme:dark;/);
    expect(html).toContain(':root[data-fa-scheme="light"] .vo-page {');
  });
});

describe("vendor overrides live in DECLARED sub-graphs of voices", () => {
  // Owner, 2026-09-30 (bean `rkqp`): "vendors/<id>/ should be declared
  // subgraphs along with vendors/". Superseding the reserved name below: the
  // loader descends only where `voices.json` / `vendors/vendors.json` say to.
  // Owner, 2026-09-22: "vendor overides go in sub-sub-grahiphs like
  // voice/vendors or voices-vendors". The nested spelling was taken, because
  // the flat one needs a SECOND declared graph for one concept.
  //
  // These run against a throwaway directory rather than the corpus, because
  // this repository ships no vendor override yet — and a test that can only
  // assert once content exists is a test that does not guard the layout the
  // content is about to be written into.

  const profile = (id: string, overrides?: string) =>
    JSON.stringify({
      $schema: "folio-voice/v1",
      id,
      title: `${id} — a fixture voice`,
      description: `The ${id} voice, used only by this test.`,
      provenance: "evidence",
      sources: [{ title: "A fixture source" }],
      ...(overrides === undefined ? {} : { extends: { voiceId: overrides } }),
      rules: [
        {
          id: `${id}-one-rule`,
          title: `${id} keeps at least one rule`,
          description: "A voice with no rules does not parse, so the fixture carries one.",
          category: "structure",
          severity: "minor",
          source: { path: "skills/authoring/authoring-core/technical-documentation.md", quote: "a fixture quote" },
        },
      ],
    });

  function fixture(): string {
    const root = mkdtempSync(join(tmpdir(), "voices-vendors-"));
    const voices = join(root, "skills", "voices");
    mkdirSync(join(voices, "base-voice"), { recursive: true });
    writeFileSync(join(voices, "base-voice", "voice.json"), profile("base-voice"));
    mkdirSync(join(voices, "vendors", "base-voice-acme"), { recursive: true });
    writeFileSync(
      join(voices, "vendors", "base-voice-acme", "voice.json"),
      profile("base-voice-acme", "base-voice"),
    );
    const decl = (ids: string[]) =>
      JSON.stringify({ name: "t", directories: ids.map((id) => ({ id, path: id, graphTypologies: ["voice-vendors"] })) });
    writeFileSync(join(voices, "voices.json"), decl(["vendors"]));
    writeFileSync(join(voices, "vendors", "vendors.json"), decl(["base-voice-acme"]));
    return root;
  }

  test("a voice under `vendors/` is LOADED, not silently skipped", async () => {
    // The defect this guards is `dh4f`: the reader scanned one level and took a
    // directory for a voice only where it held a `voice.json`. `vendors/` holds
    // none, so every override under it would have read as absent — a clean run
    // over real content.
    const { loadVoices } = await import("../../../schemas/content/voices.ts");
    const root = fixture();
    try {
      const ids = loadVoices(root).map((v) => v.id).sort();
      expect(ids).toEqual(["base-voice", "base-voice-acme"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("`vendors` itself is never loaded AS a voice", async () => {
    const { loadVoices } = await import("../../../schemas/content/voices.ts");
    const root = fixture();
    try {
      expect(loadVoices(root).map((v) => v.id)).not.toContain("vendors");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the FILE carries the relation, not the path", async () => {
    // The directory is where a person looks. Nothing downstream may infer
    // "this overrides that" from a path, which is the standing rule that a
    // declaration inside the file is the contract.
    const { loadVoices } = await import("../../../schemas/content/voices.ts");
    const root = fixture();
    try {
      const vendor = loadVoices(root).find((v) => v.id === "base-voice-acme")!;
      expect(vendor.extends?.voiceId).toBe("base-voice");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("an UNDECLARED directory holding voices is refused, loudly", async () => {
    // Not a silent part of the graph, and not silently skipped either: the
    // skip is `dh4f`, a clean read over real content. The error names the fix.
    const { loadVoices } = await import("../../../schemas/content/voices.ts");
    const root = fixture();
    const stray = join(root, "skills", "voices", "notes", "draft");
    mkdirSync(stray, { recursive: true });
    writeFileSync(join(stray, "voice.json"), profile("draft"));
    try {
      expect(() => loadVoices(root)).toThrow(/not declared.*voices\.json/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a vendor missing from vendors.json is refused, not skipped", async () => {
    const { loadVoices } = await import("../../../schemas/content/voices.ts");
    const root = fixture();
    const extra = join(root, "skills", "voices", "vendors", "base-voice-other");
    mkdirSync(extra, { recursive: true });
    writeFileSync(join(extra, "voice.json"), profile("base-voice-other"));
    try {
      expect(() => loadVoices(root)).toThrow(/vendors\.json/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the declaration files are never loaded AS voices", async () => {
    const { loadVoices } = await import("../../../schemas/content/voices.ts");
    const root = fixture();
    try {
      const ids = loadVoices(root).map((v) => v.id);
      expect(ids).not.toContain("voices");
      expect(ids).not.toContain("vendors");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

/**
 * Bean `qgjh`: every citation that resolves carries its links — a library
 * source through the library resolver, a KG node through the file resolver —
 * and one that does not resolve carries none.
 */
describe("citations carry their links (qgjh)", () => {
  const rule = (citation: string, cites: string) => ({ id: "r", citation, cites, citesInstance: "x" });
  const g = {
    totals: { voices: 1 },
    voices: [{ rules: [rule("library", "lib-item#s1"), rule("kg-node", "skills/a.md"), rule("kg-node", "gone.md")] }],
  };
  const lib = { links: (id: string) => (id === "lib-item" ? { viewer: "v/#x%2Flib-item" } : undefined) };
  const kg = (ref: string) => (ref === "skills/a.md" ? { source: "https://host/skills/a.md" } : undefined);
  const out = projection(g as never, lib, kg) as { voices: { rules: { links?: unknown }[] }[] };
  const [a, b, c] = out.voices[0]!.rules;

  test("a library citation carries the library resolver's links", () => {
    expect(a!.links).toEqual({ viewer: "v/#x%2Flib-item" });
  });
  test("a KG-node citation carries its file link", () => {
    expect(b!.links).toEqual({ source: "https://host/skills/a.md" });
  });
  test("a citation nothing resolves carries no links", () => {
    expect(c!.links).toBeUndefined();
  });
});
