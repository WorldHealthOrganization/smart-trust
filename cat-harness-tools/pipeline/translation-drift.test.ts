/**
 * A published translation that has drifted from its source — bean `07p7`.
 *
 * ## The measurement this suite exists because of
 *
 * The first pass at this bean reported five faithful translations as five
 * headings adrift from their source, and I nearly shipped it as the headline.
 * The count came from `grep -c '^#'`, which counts the `#` COMMENT lines in a
 * page's YAML front matter as headings. Strip the front matter and all five
 * match exactly.
 *
 * So the front-matter strip is the first thing tested, with a fixture whose
 * front matter carries more `#` lines than the body has headings. A checker
 * that gets this wrong does not fail quietly: it reports every translation in
 * the corpus as broken, which is the fastest way to have a gate switched off.
 *
 * @module pipeline/translation-drift.test
 */
import { describe, expect, test } from "bun:test";

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { repoRootFor, siteDirFor } from "../schemas/kg/cat-harness.ts";

import {
  KNOWN_DRIFT,
  GLOSSARY_RENDERER,
  UNCATALOGED,
  comparableSource,
  driftFor,
  headingsOf,
  shapeOf,
  sameStructure,
  uncatalogedFor,
  uncatalogedGlossaries,
} from "./translation-drift.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";

/** The LAYER root — `translations/` and the site live under it. */
const ROOT = resolve(HARNESS_ROOT);

const FRONT_MATTER_WITH_COMMENTS = `---
lang: fr
# this is a comment, not a heading
# and so is this
# there are more of these than there are headings
nav_exclude: true
---

# Intégration de l'agent

## 1. Déterminez dans quel dépôt vous vous trouvez
`;

describe("front matter is stripped BEFORE anything is counted", () => {
  test("a `#` inside front matter is a comment, not a heading", () => {
    // The exact defect: three comment lines and two real headings. Counting
    // naively gives five, and every translation reads as drifted.
    const hs = headingsOf(FRONT_MATTER_WITH_COMMENTS);
    expect(hs.length).toBe(2);
    expect(hs.map((h) => h.level)).toEqual([1, 2]);
  });

  test("a page with no front matter is read whole", () => {
    expect(headingsOf("# Title\n\n## One\n").length).toBe(2);
  });

  test("unterminated front matter does not swallow the page", () => {
    // `---` with no closing fence: the page is read as-is rather than
    // silently yielding zero headings, which would read as agreement.
    expect(headingsOf("---\nlang: fr\n\n# Title\n").length).toBe(1);
  });

  test("a `#` that is not a heading is not counted", () => {
    // No space after the hashes, and a hash mid-line. Neither is a heading.
    expect(headingsOf("#nothashheading\ntext # not a heading\n")).toEqual([]);
  });
});

describe("structure is compared, never the words", () => {
  const src = headingsOf("# T\n\n## 1. One\n\n## 2. Two\n\n### Detail\n");

  test("a faithful translation matches — different words, same shape", () => {
    const fr = headingsOf("# Titre\n\n## 1. Un\n\n## 2. Deux\n\n### Détail\n");
    expect(sameStructure(src, fr)).toBe(true);
  });

  test("a MISSING section is drift — the landing-page defect this found", () => {
    // What the gate actually caught on its first run: the English landing
    // page gained "Four things, in order" and no translation followed, so a
    // reader in five languages cannot reach that section.
    expect(sameStructure(src, headingsOf("# Titre\n\n## 1. Un\n\n### Détail\n"))).toBe(false);
  });

  test("a RE-LEVELLED section is drift even at the same count", () => {
    // Same number of headings, different nesting: the page still reads
    // differently, and a count-only comparison would pass it.
    expect(sameStructure(src, headingsOf("# T\n\n## 1. Un\n\n## 2. Deux\n\n## Détail\n"))).toBe(false);
  });

  test("RE-ORDERED numbering is drift", () => {
    // `2.` before `1.`: same levels, same count, wrong order.
    expect(sameStructure(src, headingsOf("# T\n\n## 2. Deux\n\n## 1. Un\n\n### Détail\n"))).toBe(false);
  });

  test("an unnumbered heading does not match a numbered one", () => {
    expect(sameStructure(src, headingsOf("# T\n\n## Un\n\n## 2. Deux\n\n### Détail\n"))).toBe(false);
  });
});

describe("the backlogs are reviewable, not a policy", () => {
  test("a headingless source is UNREADABLE, never agreement", () => {
    // Every translation "matches" a source with no headings, so the
    // comparison cannot fail. That is the vacuity this whole bean is about,
    // one function down.
    expect(comparableSource([])).toBe(false);
    expect(comparableSource([{ level: 1, ordinal: "" }])).toBe(true);
  });

  test("a backlog entry pins the SHAPE, so a page cannot drift further in silence", () => {
    // Found by mutation: the first version exempted the whole PAGE, so
    // re-levelling a heading in an already-backlogged translation passed. An
    // entry now records both counts and suppresses only that divergence.
    // Counts were not enough, and the SAME mutation proved it twice: pinning
    // `6 -> 5` headings still let a re-levelled heading through, because
    // re-levelling changes no count. The entry pins the full shape.
    for (const k of KNOWN_DRIFT) {
      expect(k.sourceShape.length).toBeGreaterThan(0);
      expect(k.sourceShape).not.toBe(k.translationShape);
    }
    // And the shape must distinguish a re-levelling from the original, which
    // is exactly what a count does not.
    const five = headingsOf("# T\n## A\n## B\n## C\n## D\n");
    const relevelled = headingsOf("# T\n## A\n## B\n## C\n### D\n");
    expect(five.length).toBe(relevelled.length);
    expect(shapeOf(five)).not.toBe(shapeOf(relevelled));
  });

  test("every recorded drift names WHAT is missing, and when", () => {
    // "drifted" alone would leave a translator re-deriving the divergence,
    // and an entry with no date cannot be told from one that has become
    // permanent.
    for (const k of KNOWN_DRIFT) {
      expect(k.reason.trim().length).toBeGreaterThan(20);
      expect(k.since).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(k.translation).toMatch(/^[a-z-]+\/\S+$/);
    }
  });

  test("every uncatalogued entry states a reason and a date", () => {
    for (const u of uncatalogedFor(repoRootFor(ROOT))) {
      expect(u.reason.trim().length).toBeGreaterThan(20);
      expect(u.since).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test("no page is recorded TWICE — once would be enough to hide it", () => {
    const all = [...KNOWN_DRIFT.map((k) => k.translation), ...uncatalogedFor(repoRootFor(ROOT)).map((u) => u.translation)];
    expect(all.length).toBe(new Set(all).size);
  });
});

describe("the glossary pages are recorded at their DECLARED routes", () => {
  // They used to be written down with the declaring layer's name spelled
  // out, which made this lower layer name a layer above it
  // (check:reference-direction). The route is now read from whichever
  // layer declares a visualiser the glossary renderer draws.
  test("a declared glossary visualiser yields one entry per locale at its route", () => {
    const repo = mkdtempSync(join(tmpdir(), "drift-glossary-"));
    try {
      mkdirSync(join(repo, "acme"));
      writeFileSync(
        join(repo, "acme", "acme.json"),
        JSON.stringify({ name: "acme", visualisers: [{ id: "terms", renderedBy: GLOSSARY_RENDERER }] }),
      );
      expect(uncatalogedGlossaries(repo).map((u) => u.translation)).toEqual(
        ["ar", "es", "fr", "ru", "zh"].flatMap((l) => [`${l}/acme/terms`, `${l}/en/acme/terms`]),
      );
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test("a checkout declaring no glossary visualiser records none", () => {
    const repo = mkdtempSync(join(tmpdir(), "drift-glossary-"));
    try {
      mkdirSync(join(repo, "acme"));
      writeFileSync(join(repo, "acme", "acme.json"), JSON.stringify({ name: "acme", visualisers: [] }));
      expect(uncatalogedGlossaries(repo)).toEqual([]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test("standing alone, a glossary page the site holds is recorded at its route", () => {
    // check-standalone lays out this layer and its `needs` only, so the
    // layer declaring the glossary visualiser may be absent while the site
    // still holds the page its generator wrote.
    const repo = mkdtempSync(join(tmpdir(), "drift-glossary-site-"));
    try {
      const site = join(repo, "site");
      mkdirSync(join(site, "acme", "terms"), { recursive: true });
      writeFileSync(join(site, "acme", "terms", "index.md"), "---\ngenerated: acme/scripts/glossary-page.ts — do not hand-edit\n---\n# Terms\n");
      mkdirSync(join(site, "acme", "notes"), { recursive: true });
      writeFileSync(join(site, "acme", "notes", "index.md"), "---\ntitle: Notes\n---\n# Notes\n");
      expect(uncatalogedGlossaries(repo, site).map((u) => u.translation)).toEqual(
        ["ar", "es", "fr", "ru", "zh"].flatMap((l) => [`${l}/acme/terms`, `${l}/en/acme/terms`]),
      );
      expect(uncatalogedGlossaries(repo).map((u) => u.translation)).toEqual([]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test("the written-down backlog holds no glossary route", () => {
    expect(UNCATALOGED.filter((u) => /\/glossary$/.test(u.translation))).toEqual([]);
  });
});

describe("the real corpus — and the gate can actually fail", () => {
  test("translations were COMPARED — zero compared is never agreement", () => {
    // `driftFor` filters what it compared, so a reader that finds no
    // translated page reports no drift: a clean sweep over a corpus it could
    // not read. Asserted rather than inferred from the silence below.
    expect(driftFor(ROOT).compared).toBeGreaterThan(0);
  });

  test("no NEW drift, and nothing unreadable", () => {
    // THE RATCHET. `unreadable` is listed alongside `error` deliberately: a
    // sweep blind on one page has not cleared the others, so it must not read
    // as a pass.
    const { findings } = driftFor(ROOT);
    expect(findings.map((f) => `${f.severity} ${f.subject}: ${f.message}`)).toEqual([]);
  });

  test("every KNOWN_DRIFT entry still describes drift that EXISTS", () => {
    // The direction that rots silently, and the one `ot9a` was made of: a
    // page is fixed, its backlog entry stays, and the table becomes a set of
    // claims about a corpus that has moved on. Each entry earns its place by
    // being re-derived here — with the entry removed, the drift must reappear.
    const withoutBacklog = driftFor(ROOT, { ignoreKnownDrift: true });
    const stillDrifted = new Set(
      withoutBacklog.findings.filter((f) => f.severity === "error").map((f) => f.subject),
    );
    const fixed = KNOWN_DRIFT.filter((k) => !stillDrifted.has(k.translation)).map((k) => k.translation);
    expect(fixed).toEqual([]);
  });

  test("the gate is not vacuous — a real page, with a section cut, is drift", () => {
    // This used to be proved by the backlog itself: with KNOWN_DRIFT ignored,
    // the five untranslated landing pages turned the sweep red. Translating
    // them (bean `alox`, 2026-09-23) emptied the backlog, and with it that
    // witness — a clean corpus and a comparison that finds nothing look the
    // same. So the witness is now a MUTATION of a real page: the French
    // landing page matches its source, and the same page with one section
    // removed does not.
    const site = resolve(ROOT, siteDirFor(ROOT));
    const src = headingsOf(readFileSync(resolve(site, "index.md"), "utf-8"));
    const fr = readFileSync(resolve(site, "fr/index.md"), "utf-8");
    expect(comparableSource(src)).toBe(true);
    expect(sameStructure(src, headingsOf(fr))).toBe(true);
    const cut = fr.replace(/^## Quatre choses, dans l'ordre$/m, "");
    expect(cut).not.toBe(fr);
    expect(sameStructure(src, headingsOf(cut))).toBe(false);
  });
});
