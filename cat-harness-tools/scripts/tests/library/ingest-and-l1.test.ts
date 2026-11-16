/**
 * The ingest rung decision, and the L1 completeness gate.
 *
 * Both are written against fixtures rather than `library/`, because the real
 * corpus is complete and passing: a test that only asserted "the repo is fine"
 * would keep passing if either checker were gutted to return nothing. The one
 * assertion that DOES read the corpus is pinned to what the four entries
 * already record, so it fails if the shape drifts.
 *
 * @module scripts/tests/ingest-and-l1
 */
import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { libraryEntries } from "../library-dirs.ts";

import {
  KIND_SIDECAR,
  NOT_DERIVABLE,
  PAGED_ONLY,
  appliesTo,
  checkAll,
  checkEntry,
  declaredFigureLabels,
  entryKind,
  expiredExceptions,
  sidecarDocument,
  sidecarRootFor,
  sourceBlockOf,
  sidecarStates,
  staleSidecars,
  ENTRY_DIRECTORIES,
  ENTRY_SIDECARS,
  libraryRootFor,
  entryLocales,
  localeGaps,
} from "../../check-l1-complete.ts";
import { resolveQaLocation } from "../../qa-store.ts";
import { NARRATIVE_BEARING } from "../../narratives.ts";
import {
  OCR_THRESHOLD_CHARS,
  ingestMode,
  mayPromote,
  qaLater,
  textLayerUnreadable,
  planFor,
  promoteCommand,
  usableOutlineEntries,
  withDerivedArms,
  withKnownTitle,
} from "../../ingest-document.ts";
import {  } from "../../../schemas/kg/cat-harness.js";
import { writeDeclaration } from "../../../test/support/instance-fixture.js";
import { pathToFileURL } from "node:url";
import { HARNESS_ROOT } from "../../lib/roots.ts";
import { GraphTypologyRegistry } from "../../../schemas/kg/graph-typology-registry.ts";

const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("what makes an outline entry capable of being a chapter", () => {
  // The rule lives in ONE language. It used to be spelled twice — once as a
  // TS regex, once as a Python regex inside a JS template literal, where the
  // backslashes were invalid escapes and were dropped. Python got a pattern
  // matching nothing and reported 35 entries of journal furniture as 19
  // usable chapters. The probe now emits (title, page) and this decides.
  const e = (title: string, page: number) => ({ title, page });

  test("a real heading counts", () => {
    expect(usableOutlineEntries([e("2. Preliminaries", 7)])).toBe(1);
  });

  test("an entry with no resolvable destination does not", () => {
    // PyMuPDF reports -1. Nothing to navigate to is nothing to divide at.
    expect(usableOutlineEntries([e("Issue Table of Contents", -1)])).toBe(0);
    expect(usableOutlineEntries([e("Article Contents", 0)])).toBe(0);
  });

  test("a bare page reference does not, in the spellings the corpus uses", () => {
    for (const t of ["p. 177", "p.177", "p 177", "pp. 12", "P. 3", "  p. 9  "]) {
      expect(usableOutlineEntries([e(t, 4)])).toBe(0);
    }
  });

  test("a heading that merely CONTAINS a page number still counts", () => {
    // The disqualifier is "is only a page reference", not "mentions one".
    expect(usableOutlineEntries([e("Chapter 3, p. 177", 9)])).toBe(1);
    expect(usableOutlineEntries([e("Theorem 177", 9)])).toBe(1);
  });

  test("the milnorlink shape: 35 in, 0 usable", () => {
    const toc = [
      e("Article Contents", -1),
      e("Issue Table of Contents", -1),
      ...Array.from({ length: 19 }, (_, i) => e(`p. ${177 + i}`, i + 2)),
      ...Array.from({ length: 14 }, (_, i) => e(`Some Other Article ${i}`, -1)),
    ];
    expect(toc).toHaveLength(35);
    expect(usableOutlineEntries(toc)).toBe(0);
  });

  test("nothing in is 0 out, not a crash", () => {
    expect(usableOutlineEntries([])).toBe(0);
  });
});

/**
 * A destination for the rung tests, stated rather than resolved.
 *
 * `planFor`'s third parameter defaults to `libraryRoot()`, which since bean
 * `frs5` REFUSES when the repository declares several libraries and none was
 * chosen — correctly, because filing a WHO publication into the science
 * library reads as ingested and is in the wrong corpus. These tests are about
 * WHICH RUNG a document needs and never about where its output lands, so they
 * say so instead of depending on a default that was only ever incidental.
 */
const LIB = "library";

describe("which rung a document needs", () => {
  test("an embedded outline selects pdf-structure — the structure is READ", () => {
    const p = planFor("x.pdf", { outline: 258, outlineUsable: 257, chars: 90_000 }, LIB);
    expect(p.rung).toBe("pdf-structure");
    // The step is an ABSOLUTE path since 2026-09-20 — `"scripts/<name>.py"`
    // was resolved against the CWD and `bun run` puts you at the repository
    // root, one level above where the helpers live, so every rung died with
    // `can't open file`. Asserting the BASENAME rather than a spelling of the
    // location is what stops this test re-pinning the next relocation.
    expect(p.steps[0]!.some((a) => a.endsWith("/pdf-structure.py"))).toBe(true);
    expect(p.why).toContain("258");
    // Measured on uploads/9789241548960_eng.pdf, 2026-09-20.
    expect(p.why).toContain("257");
  });

  test("an outline of JUNK is not a structure — the bean `8shg` case", () => {
    // Measured on uploads/milnorlink.pdf, 2026-09-20: 35 entries, and not one
    // of them a heading. 19 are bare page labels (`p. 177`, `p. 178`, …) and
    // 16 have no resolvable destination, because the outline is JSTOR's
    // journal wrapper — this article's pages, then THIRTEEN OTHER ARTICLES
    // from the same issue that are not in the file at all.
    //
    // Routing on the raw count sent this to `pdf-structure`, which would have
    // produced a section tree of page numbers plus thirteen phantom chapters.
    // The committed entry is at `pdf-pages`, and it was RIGHT: this bean was
    // opened believing the opposite.
    const p = planFor("x.pdf", { outline: 35, outlineUsable: 0, chars: 47_871 }, LIB);
    expect(p.rung).toBe("pdf-pages");
    // Present but unusable is a THIRD fact. Reporting it as "no outline" is a
    // different lie, and is how the committed structure_note came to say so.
    expect(p.why).toContain("35");
    expect(p.why).not.toContain("no outline");
  });

  test("a junk outline still falls through to OCR when there is no text either", () => {
    const p = planFor("x.pdf", { outline: 35, outlineUsable: 0, chars: 0 }, LIB);
    expect(p.rung).toBe("pdf-ocr+pdf-pages");
    expect(p.why).toContain("35");
  });

  test("an outline whose usability was NOT measured is undetermined, not structure", () => {
    // A probe predating `outlineUsable` omits it. Absent is UNKNOWN: routing
    // on the raw count would reinstate the bug above, and calling it "no
    // outline" would be the other lie. So neither — re-probe.
    for (const probe of [
      { outline: 35, chars: 47_871 },
      { outline: 35, outlineUsable: null, chars: 47_871 },
    ]) {
      const p = planFor("x.pdf", probe, LIB);
      expect({ rung: p.rung, steps: p.steps.length }).toEqual({ rung: "undetermined", steps: 0 });
      expect(p.why).toContain("unknown");
    }
  });

  test("no outline but a text layer selects pdf-structure, which decides inferred contents vs pages", () => {
    // Issue #2302 / bean z3rf: pdf-structure.py uses the inferred contents only
    // when they pass its three trust tests, else one section per page. Routing
    // to pdf-pages here made those tests unreachable from `bun run cat ingest`.
    const p = planFor("x.pdf", { outline: 0, chars: 50_000 }, LIB);
    expect(p.rung).toBe("pdf-structure");
    expect(p.steps).toHaveLength(1);
    expect(p.steps[0]![1]).toContain("pdf-structure.py");
    expect(p.why).toContain("trust tests");
  });

  test("no outline and almost no text selects OCR FIRST, then pages", () => {
    const p = planFor("x.pdf", { outline: 0, chars: OCR_THRESHOLD_CHARS - 1 }, LIB);
    expect(p.rung).toBe("pdf-ocr+pdf-pages");
    expect(p.steps.map((s) => s[1]!.replace(/^.*\//, ""))).toEqual(["pdf-ocr.py", "pdf-pages.py"]);
    expect(p.steps[1]).toContain("--from-ocr");
  });

  test("the OCR threshold is a boundary, not a vibe", () => {
    expect(planFor("x.pdf", { outline: 0, chars: OCR_THRESHOLD_CHARS }, LIB).rung).toBe("pdf-structure");
    expect(planFor("x.pdf", { outline: 0, chars: OCR_THRESHOLD_CHARS - 1 }, LIB).rung).toBe("pdf-ocr+pdf-pages");
  });

  test("a PDF that cannot be probed is UNDETERMINED and runs nothing", () => {
    // Never "no outline". A document filed under the wrong rung reads as
    // ingested while its structure is wrong -- the 6xaz failure mode.
    for (const probe of [
      { outline: null, chars: null, error: "no PDF backend" },
      { outline: null, chars: 10 },
      { outline: 3, outlineUsable: 3, chars: null },
    ]) {
      const p = planFor("x.pdf", probe, LIB);
      expect({ rung: p.rung, steps: p.steps.length }).toEqual({ rung: "undetermined", steps: 0 });
    }
  });
});

/** A library entry with every derivable requirement satisfied. */
function entry(over: Partial<Record<"structure" | "manifest" | "images", unknown>> = {}, opts: { sections?: number; blocks?: number } = {}): string {
  const root = mkdtempSync(join(tmpdir(), "l1-"));
  made.push(root);
  const dir = join(root, "doc");
  mkdirSync(join(dir, "sections"), { recursive: true });
  mkdirSync(join(dir, "blocks"), { recursive: true });
  for (let i = 0; i < (opts.sections ?? 2); i++) writeFileSync(join(dir, "sections", `s${i}.md`), "x");
  // `.jsonld` with a real `kind` and `provenance`, because that is what
  // `gen-library-jsonld.ts` writes and what `narrative-provenance` reads. The
  // fixture used to write `b0.json` containing `{}`, which satisfied a
  // file-COUNT requirement and nothing else — fine until a requirement looked
  // inside, which is an argument for fixtures that resemble the artefact.
  for (let i = 0; i < (opts.blocks ?? 1); i++) {
    writeFileSync(
      join(dir, "blocks", `b${i}.jsonld`),
      JSON.stringify({ "@id": `b${i}`, kind: "prose", provenance: "ingested" }),
    );
  }
  writeFileSync(
    join(dir, "structure.json"),
    JSON.stringify(
      over.structure ?? {
        _schema: "pdf-structure/v1",
        doc_id: "doc",
        toc_source: "none",
        // Real section objects, not `[1, 2]`: `structure` is checked against
        // pdf-structure/v1 (issue #1112), for the reason the blocks comment below gives.
        sections: [1, 2].map((n) => ({ id: `s${n}`, number: null, title: `S${n}`, level: 1, page_start: n, page_end: n, n_chars: 1, n_words: 1 })),
        // Bean `nso8`: technical metadata is a CHECKED requirement, so a
        // fixture that stands for "every derivable requirement satisfied" has
        // to carry it. It was `not-derivable` until `_tech_meta.py` existed.
        source: { file: "x.pdf", sha256: "a".repeat(64), bytes: 1, mtime: "2026-01-01T00:00:00Z", mimetype_sniffed: "application/pdf", mimetype_source: "magic-bytes" },
      },
    ),
  );
  writeFileSync(
    join(dir, "manifest.jsonld"),
    JSON.stringify(over.manifest ?? { "@id": "x", "@type": ["folio-assistant-core:SourceDocument"], contains: ["a"], provenance: {} }),
  );
  // Bean `d5f1` shipped, so `image-descriptions` is CHECKED rather than
  // not-derivable, and a fixture standing for "every derivable requirement
  // satisfied" has to carry it — the same argument the `nso8` comment above
  // makes for technical metadata. One page scan: geometry settles its role
  // and a scan needs no narrative, so this is a complete entry rather than a
  // described one.
  writeFileSync(
    join(dir, "images.json"),
    JSON.stringify(
      over.images ?? {
        $schema: "folio-document-images/v1",
        doc_id: "doc",
        images: [
          {
            id: "img-p001-1",
            file: "images/img-p001-1.png",
            page: 1,
            role: "page-scan",
            basis: { method: "geometry", coverage: 0.99, imagesOnPage: 1, page: 1 },
          },
        ],
      },
    ),
  );
  return dir;
}

const states = (d: string) =>
  Object.fromEntries(checkEntry(d).requirements.filter((r) => r.state !== "not-derivable").map((r) => [r.name, r.state]));

describe("L1 completeness", () => {
  test("a full entry is complete", () => {
    expect(Object.values(states(entry())).every((s) => s === "met")).toBe(true);
  });

  test("each missing artefact is reported unmet, not skipped", () => {
    expect(states(entry({}, { sections: 0 })).sections).toBe("unmet");
    expect(states(entry({}, { blocks: 0 })).blocks).toBe("unmet");
    expect(states(entry({ manifest: { "@id": "x" } })).manifest).toBe("unmet");
    expect(states(entry({ manifest: { "@id": "x", "@type": [], contains: [] } })).provenance).toBe("unmet");
    expect(states(entry({ structure: { _schema: "pdf-structure/v1", sections: [] } })).structure).toBe("unmet");
    // No `source` at all is the `milnorlink` state before `nso8`: the entry
    // looked ingested and nothing recorded what file it came from.
    expect(states(entry({ structure: { _schema: "pdf-structure/v1", sections: [1] } }))["technical-metadata"]).toBe(
      "unmet",
    );
    // A PARTIAL `source` is unmet too. `pdf-structure.py` wrote one without
    // `mtime` or a sniffed mimetype, and a half-filled block that read `met`
    // would have hidden exactly the gap this bean closed.
    expect(
      states(
        entry({
          structure: { _schema: "pdf-structure/v1", sections: [1], source: { file: "x.pdf", sha256: "a", bytes: 1 } },
        }),
      )["technical-metadata"],
    ).toBe("unmet");
  });

  test("unparseable JSON is unmet rather than an exception", () => {
    const d = entry();
    writeFileSync(join(d, "structure.json"), "{ not json");
    expect(states(d).structure).toBe("unmet");
  });

  test("an empty structure with NO note is unmet — nothing says the emptiness was determined", () => {
    const d = entry({ structure: { _schema: "pdf-structure/v1", sections: [] } });
    expect(states(d)["structure-note"]).toBe("unmet");
    const noted = entry({
      structure: { _schema: "pdf-structure/v1", sections: [], structure_note: "no outline; none claimed" },
    });
    expect(states(noted)["structure-note"]).toBeUndefined();
  });

  test("what no arm can produce is NOT-DERIVABLE, never met", () => {
    // The third state is the reason this gate can ship before the nine INGEST
    // arms exist. If any of these ever reads `met`, the gate is lying.
    const nd = checkEntry(entry()).requirements.filter((r) => r.state === "not-derivable");
    expect(nd.map((r) => r.name).sort()).toEqual(NOT_DERIVABLE.map((nd) => nd.name).sort());
    expect(nd.every((r) => /bean \w+/.test(r.detail))).toBe(true);
  });

  test("NO DECLARATION is undetermined — never 'nothing to check'", () => {
    // Three states, and this is the one that used to be missing. A root with
    // no `harness.json` returned `[]`, indistinguishable from a declared
    // library holding nothing, and the CLI printed "nothing to check" and
    // exited 0. Measured 2026-09-20: `bun run cat check:l1-complete` runs from
    // the REPOSITORY root while the instance lives under `cat-harness/`, so
    // the gate found no declaration and passed over four real entries.
    const base = mkdtempSync(join(tmpdir(), "l1-undeclared-"));
    made.push(base);
    const root = join(base, "sub");
    mkdirSync(root, { recursive: true });
    expect(checkAll(root)).toBeUndefined();
  });

  test("...and a DECLARED library holding nothing is `[]`, a real finding", () => {
    const base = mkdtempSync(join(tmpdir(), "l1-empty-"));
    made.push(base);
    const root = join(base, "sub");
    mkdirSync(join(root, "library"), { recursive: true });
    writeDeclaration(root, JSON.stringify({
        name: "t",
        directories: [{ id: "library", path: "library/", graphTypologies: ["library"] }],
      }));
    expect(checkAll(root)).toEqual([]);
  });

  test("the real corpus passes every derivable requirement", () => {
    const reports = checkAll(join(HARNESS_ROOT));
    expect(reports, "no `library` declared — this test would be vacuous").toBeDefined();
    if (reports === undefined) return;
    expect(reports.length).toBeGreaterThan(0);
    const bad = reports.flatMap((r) =>
      r.requirements.filter((q) => q.state === "unmet").map((q) => `${r.slug}: ${q.name} — ${q.detail}`),
    );
    expect(bad).toEqual([]);
    // A real-corpus walk, over bun's 5 s default on a busy runner (7.6 s on
    // cat-harness-tools#1715). The same budget as the other real-corpus tests.
  }, 30_000);
});

describe("the verdict as a committed sidecar", () => {
  const doc = (d: string) => sidecarDocument(checkEntry(d));

  test("the ASSET is the subject and the TOOL is the producer", () => {
    // The owner's question was which of the two a sidecar hangs off. It is not
    // a choice: `qa-results/v1` already carries both, and the tool was never a
    // separate subject -- it is provenance.
    const d = doc(entry());
    expect(d.$schema).toBe("qa-results/v1");
    expect(d.subject.kind).toBe("library-document");
    expect(d.producer.script).toBe("scripts/check-l1-complete.ts");
    expect(d.producer.script_hash).toMatch(/^[0-9a-f]{12}$/);
  });

  test("a DEFECT and a GAP are separate families, and neither is hidden", () => {
    const d = doc(entry({}, { sections: 0 }));
    expect(d.families.unmet.count).toBe(1);
    expect(d.families.notDerivable.count).toBe(NOT_DERIVABLE.length);
  });

  test("total counts the not-derivable too, so it is zero only when every requirement was checked", () => {
    // The tempting design counts only `unmet`, so a good entry reads
    // `total: 0` while requirements no arm can produce were never checked:
    // "unknown rendered as a pass". The last not-derivable requirement,
    // `audio-transcripts`, moved into the checked set with its arm (bean
    // `1r0p`), so a clean entry's zero is now a measurement.
    const clean = doc(entry());
    expect(clean.families.unmet.count).toBe(0);
    expect(clean.total).toBe(NOT_DERIVABLE.length);
    expect(clean.families.notDerivable.count).toBe(NOT_DERIVABLE.length);
  });

  test("rerunning produces the same bytes, and carries no timestamp", () => {
    // Byte stability keeps a committed verdict out of every diff; no
    // `updated_at` keeps two concurrent changes from colliding on one line
    // (bean y7b3, #1707).
    const d = entry();
    expect(JSON.stringify(doc(d))).toBe(JSON.stringify(sidecarDocument(checkEntry(d))));
    expect(doc(d)).not.toHaveProperty("updated_at");
  });

  test("a missing sidecar is stale, not absent-and-fine", () => {
    const base = mkdtempSync(join(tmpdir(), "l1-side-"));
    made.push(base);
    const root = join(base, "sub");
    mkdirSync(root, { recursive: true });
    const off = staleSidecars(root, [checkEntry(entry())]);
    expect(off).toHaveLength(1);
    expect(off[0]).toContain("no sidecar");
  });

  test("the committed verdicts for the real corpus are current — or, when not committed, ABSENT and never current", () => {
    // Bean 0dav: QA results leave `main` for the `qa-reports` branch, so the
    // verdicts may legitimately not be in this checkout. Then every entry must
    // read `absent` — never `current`, which would be a clean answer about
    // a file that is not there.
    const root = join(HARNESS_ROOT);
    const all = checkAll(root);
    expect(all, "no `library` declared — staleness over nothing proves nothing").toBeDefined();
    const states = sidecarStates(root, all ?? []);
    expect(states.length).toBeGreaterThan(0);
    // Bean 5hox: the directory declares `storage`, so its working copy is not
    // a record and, with no `--against`, every verdict in a stored `qa`
    // directory reads UNKNOWN — and an instance in the overlay with no stored
    // `qa` directory and no committed sidecar (`smart-trust-phw`) reads ABSENT;
    // never `current` or `stale` about a copy nobody stored.
    const results = join(root, "test", "results");
    const loc = resolveQaLocation(join(root, ".."));
    const storedRoots = new Set(loc.directories.filter((d) => d.storage).map((d) => d.absPath));
    if (storedRoots.has(results)) {
      for (const x of states) {
        const entryResults = join(sidecarRootFor(root, x.slug), "test", "results");
        if (storedRoots.has(entryResults)) {
          expect(x.state).toBe("unknown");
        } else if (!existsSync(join(entryResults, "library-qa"))) {
          expect(x.state).toBe("absent");
        }
      }
      return;
    }
    if (!existsSync(join(root, "test", "results", "library-qa"))) {
      expect(new Set(states.map((x) => x.state))).toEqual(new Set(["absent"]));
      return;
    }
    expect(staleSidecars(root, all ?? [])).toEqual([]);
    // A real-corpus walk: ~5.2 s on the CI runner, over bun's 5 s default, so
    // it timed out there as a "new failure" on unrelated PRs. A timeout, not a
    // skip — the same budget the other real-corpus tests carry.
  }, 30_000);
});


describe("the third state has to EXPIRE — bean `pn6j`", () => {
  // The last entry NOT_DERIVABLE held, until its arm landed (bean `1r0p`).
  // The expiry mechanism is tested on it as a fixture.
  const AUDIO_WAS = [{ name: "audio-transcripts", bean: "1r0p", probe: "transcript" }] as const;

  test("an expired claim is REPORTED: the probe exists, so the arm runs", () => {
    // The failure this guards, measured 2026-09-20: `image-descriptions` sat
    // in NOT_DERIVABLE naming `d5f1` while all four library entries carried a
    // complete `images.json` — 2, 20, 121 and 21 images, every one with a
    // role and a basis. The gate reported "no arm builds this yet" and
    // checked none of it.
    const found = expiredExceptions(["/x", "/y"], (d, f) => d === "/y" && f === "transcript", AUDIO_WAS);
    expect(found.map((e) => e.name)).toEqual(["audio-transcripts"]);
    expect(found[0].bean).toBe("1r0p");
    expect(found[0].found).toBe("/y");
  });

  test("nothing expires when no probe is present", () => {
    expect(expiredExceptions(["/x"], () => false)).toEqual([]);
  });

  test("the real corpus has no expired claim", () => {
    // THE RATCHET. When an arm lands, this fails until its requirement moves
    // into the checked set — which is what "shrinks by work rather than by
    // editing" was always supposed to mean.
    // Every declared library, READ. This composed `<instance>/library` and
    // threw ENOENT the moment bean `frs5` moved the corpus out of it — which
    // at least failed loudly. The version of this that would have been worse
    // is the one that returns an empty list: `expiredExceptions([])` is `[]`,
    // so a ratchet asserting "no expired claim" would have passed over nothing
    // at all. The `dirs.length` floor below is there for exactly that, and it
    // is kept.
    const dirs = libraryEntries().map((e) => e.dir);
    expect(dirs.length, "no library entries found — this ratchet would be vacuous").toBeGreaterThan(0);
    expect(expiredExceptions(dirs, (d, f) => existsSync(join(d, f)))).toEqual([]);
  });

  test("the probe was what the BEAN said its arm writes, and the arm writes it", () => {
    // `1r0p`: "library/<slug>/transcript/ holds the source-language
    // transcript and each translation" — a DIRECTORY. The first version of
    // this probe guessed `transcript.json` and would never have fired, so the
    // ratchet could not ratchet. The arm landed writing exactly that
    // directory, so the requirement left NOT_DERIVABLE for the checked set.
    expect(AUDIO_WAS[0]!.probe).toBe("transcript");
    expect(ENTRY_DIRECTORIES).toContain(AUDIO_WAS[0]!.probe);
    expect(NOT_DERIVABLE.find((nd) => nd.name === "audio-transcripts")).toBeUndefined();
  });

  test("a DIRECTORY probe fires — existsSync is not file-only", () => {
    // The mechanism the correction depends on: the probe is checked with
    // `existsSync`, which is true for a directory. Asserted rather than
    // assumed, because the whole fix rests on it.
    const root = mkdtempSync(join(tmpdir(), "probe-"));
    made.push(root);
    const entry = join(root, "doc");
    mkdirSync(join(entry, "transcript"), { recursive: true });
    expect(expiredExceptions([entry], (d, f) => existsSync(join(d, f)), AUDIO_WAS).map((e) => e.name)).toEqual([
      "audio-transcripts",
    ]);
  });

  test("every remaining entry carries a PROBE, so it can expire at all", () => {
    // An entry with no probe is one that can never expire — the state the
    // whole corpus was in before this change.
    for (const nd of NOT_DERIVABLE) {
      expect(nd.probe.trim().length).toBeGreaterThan(0);
      expect(nd.bean.trim().length).toBeGreaterThan(0);
    }
  });

  test("`image-descriptions` is CHECKED now, not excused", () => {
    expect(NOT_DERIVABLE.map((nd) => nd.name)).not.toContain("image-descriptions");
  });
});

describe("the bearing list is SHARED with the review queue", () => {
  test("this gate reads `images.json` because the queue says it is bearing", () => {
    // The list and the shape were RESTATED here — same three files, same
    // `doc.narrative` single-narrative read — and went stale at the same time
    // and for the same reason as the queue's copy did (bean `04vl`): 24
    // drafts live at `images[i].narrative` in `images.json`, which has no
    // top-level `narrative` at all. One rule in two places is two rules.
    expect(NARRATIVE_BEARING).toContain("images.json");
  });

  test("the corpus's drafts are COUNTED, not reported as absent", () => {
    // The symptom: "no narrative-bearing file in this entry", four times,
    // over four entries holding 24 drafts between them.
    const root = pathToFileURL(HARNESS_ROOT + "/").pathname.replace(/\/$/, "");
    const reports = checkAll(root);
    expect(reports).toBeDefined();
    const details = reports!
      .map((r) => r.requirements.find((q) => q.name === "narrative-review")?.detail ?? "")
      .join(" | ");
    const drafts = [...details.matchAll(/(\d+) draft/g)].reduce((n, m) => n + Number(m[1]), 0);
    expect(drafts).toBeGreaterThan(0);
    // A real-corpus walk too: the same budget, for the same reason.
  }, 30_000);
});


describe("image-descriptions has three states, and the third is not a pass", () => {
  /** The `image-descriptions` verdict for a fixture with this sidecar. */
  const imgState = (images: unknown): { state: string; detail: string } => {
    const r = checkEntry(entry({ images })).requirements.find((q) => q.name === "image-descriptions");
    return { state: r?.state ?? "(absent)", detail: r?.detail ?? "" };
  };

  const base = { $schema: "folio-document-images/v1", doc_id: "doc" };
  const scan = {
    id: "i1",
    file: "images/i1.png",
    page: 1,
    role: "page-scan",
    basis: { method: "geometry", coverage: 0.99, imagesOnPage: 1, page: 1 },
  };

  test("`images: null` is NOT-DERIVABLE, carrying the sidecar's own reason", () => {
    // The sidecar's could-not-determine, passed through rather than
    // flattened. `unmet` would ask somebody to fix a document that is not
    // broken; `met` would be the pass-by-default this gate exists against.
    const r = imgState({ ...base, images: null, undetermined_reason: "no backend available" });
    expect(r.state).toBe("not-derivable");
    expect(r.detail).toContain("no backend available");
  });

  test("an image with an UNDETERMINED role is unmet — nobody judged it", () => {
    // The third state one level down: whether this image needs describing is
    // unknown, so counting it as described is a pass by default.
    const r = imgState({ ...base, images: [{ id: "i1", file: "images/i1.png", role: "undetermined" }] });
    expect(r.state).toBe("unmet");
    expect(r.detail).toContain("undetermined role");
  });

  test("a DESCRIBABLE image with no narrative is unmet", () => {
    const logo = {
      id: "i2",
      file: "images/i2.png",
      role: "logo",
      basis: {
        method: "inspection",
        by: { kind: "agent", id: "claude", model: "claude-opus-5" },
        at: "2026-09-20",
        saw: "an organisation emblem",
        page: 1,
      },
    };
    expect(imgState({ ...base, images: [scan, logo] }).state).toBe("unmet");
  });

  test("a page scan needs no narrative — geometry settles it", () => {
    // 140 of this corpus's 164 images are page scans. Requiring a description
    // of each would be wrong six times out of seven.
    expect(imgState({ ...base, images: [scan] }).state).toBe("met");
  });

  describe("a description per configured language (bean d5f1)", () => {
    const by = { kind: "agent", id: "claude", model: "claude-opus-5-5" };
    const said = (lang: string | undefined, state = "draft") => ({
      text: `described in ${lang ?? "the default"}`,
      state,
      drafted_by: by,
      drafted_at: "2026-10-30",
      ...(lang ? { lang } : {}),
    });
    const figure = (narrative: unknown) => ({
      id: "f1",
      file: "images/f1.png",
      role: "figure",
      basis: { method: "inspection", by, at: "2026-10-30", saw: "a figure", page: 1 },
      narrative,
    });
    const UN = ["ar", "zh", "en", "fr", "ru", "es"];

    test("English alone is unmet, and the detail names each missing locale", () => {
      // The defect this closes: the drain reported 0 English-only figures
      // while 31 sat in smart-ra, because the gate asked only for ANY narrative.
      const r = imgState({ ...base, images: [scan, figure([said("en")])] });
      expect(r.state).toBe("unmet");
      expect(r.detail).toContain("1 lack a narrative in a configured language");
      for (const l of ["ar", "zh", "fr", "ru", "es"]) expect(r.detail).toContain(`${l} (1)`);
      expect(r.detail).not.toContain("en (1)");
    });

    test("all six UN languages is met", () => {
      expect(imgState({ ...base, images: [figure(UN.map((l) => said(l)))] }).state).toBe("met");
    });

    test("a single-form narrative with no lang counts as English", () => {
      const gaps = localeGaps([{ narrative: said(undefined) } as never], ["en"]);
      expect(gaps.images).toBe(0);
    });

    test("a not-authored entry covers nothing", () => {
      const gaps = localeGaps([{ narrative: [said("en"), said("fr", "not-authored")] } as never], ["en", "fr"]);
      expect(gaps.images).toBe(1);
      expect([...gaps.byLocale]).toEqual([["fr", 1]]);
    });

    test("an entry with no instance config is owed the six UN languages", () => {
      expect([...entryLocales(entry())].sort()).toEqual([...UN].sort());
    });
  });

  test("a missing images.json is UNMET, not not-derivable", () => {
    // The arm exists now, so its absence is a defect in this entry rather
    // than a gap in the platform. That distinction is the whole point of
    // moving the requirement out of NOT_DERIVABLE.
    const dir = entry();
    rmSync(join(dir, "images.json"));
    const r = checkEntry(dir).requirements.find((q) => q.name === "image-descriptions");
    expect(r?.state).toBe("unmet");
    expect(r?.detail).toContain("pdf-images.py");
  });
});

describe("refuse to promote — the gate between the arms and the library", () => {
  /**
   * The owner's decision, 2026-09-20: an unmet document must not reach
   * `library/`, and the way to achieve that is to never move it there —
   * NOT to move it back. Nothing is deleted and nothing leaves `library/`,
   * so `deletion-requires-confirmation` is untouched.
   */
  test("promotion is a SEPARATE step — one rung is not a whole pipeline", () => {
    // Measured while building this, and it changed the design: `planFor` runs
    // ONE rung. `pdf-pages.py` alone yields page files and none of
    // structure.json, sections/, blocks/, manifest.jsonld or images.json, so
    // gating at the end of the ingest command refused the document on SEVEN
    // unmet requirements — and would refuse every document ever ingested.
    //
    // A gate that always refuses is one somebody switches off, which is worse
    // than no gate. So the arms accumulate in staging and `--promote` is the
    // single moment anything crosses into `library/`.
    // Behavioural. A source grep for `--promote` matched the string at a
    // SECOND call site, so dropping the guard at the first survived the
    // mutation — which is why the mode is a named function now.
    expect(ingestMode([])).toBe("stage");
    expect(ingestMode(["uploads/x.pdf"])).toBe("stage");
    expect(ingestMode(["--promote"])).toBe("promote");
    expect(ingestMode(["uploads/x.pdf", "--promote"])).toBe("promote");
    // And the arms must NOT re-run on a promote: staging already holds them.
    const src = readFileSync(new URL("../../ingest-document.ts", import.meta.url).pathname, "utf-8");
    expect(src).toContain('ingestMode(argv) === "promote" ? [] : plan.steps');
  });

  test("the derived arms run for a PDF rung and NOT for archive or tabular", () => {
    // `l1-blocks`' own header records what the missing sequence cost: "a
    // pipeline that cannot terminate, and it was invisible because both ends
    // looked healthy". Staging exits 0 and says `✓ staged`, while `mayPromote`
    // requires every requirement met — so nothing could ever cross into
    // `library/`. Verified end to end 2026-09-23: one document now goes
    // uploads/ -> library/ in two commands.
    const base = { rung: "pdf-pages" as const, why: "", steps: [["python3", "pdf-pages.py"]] };
    const armed = withDerivedArms(base, "/tmp/x.pdf", "/stage", "/stage/slug", "/lib");
    expect(armed.steps).toHaveLength(12);
    // The LaTeX overlay straight after the rung, so every arm that reads
    // `sections/` reads the overlaid text. It takes the ENTRY and the
    // destination LIBRARY, where a fetched `source/` lives.
    expect(armed.steps[1]).toEqual([
      "python3",
      expect.stringContaining("latex-math-overlay.py"),
      "/stage/slug",
      "--library",
      "/lib",
    ]);
    expect(armed.steps[2]).toEqual(["python3", expect.stringContaining("pdf-images.py"), "-o", "/stage", "/tmp/x.pdf"]);
    // The vector arm — bean `a8wy`. Same two arguments as the raster arm: it
    // reads the PDF, so it takes the source and the library ROOT.
    expect(armed.steps[3]).toEqual([
      "python3",
      expect.stringContaining("pdf-vector-labels.py"),
      "-o",
      "/stage",
      "/tmp/x.pdf",
    ]);
    // The vector FIGURE arm — bean `ay3x`. Same arguments again, and it must
    // precede the verdict arm, which re-applies the `vfig-` judgements its
    // `"w"` open would otherwise erase.
    expect(armed.steps[4]).toEqual([
      "python3",
      expect.stringContaining("pdf-vector-figures.py"),
      "-o",
      "/stage",
      "/tmp/x.pdf",
    ]);
    expect(armed.steps[5]).toEqual(["bun", "run", expect.stringContaining("l1-blocks.ts"), "-o", "/stage/slug"]);
    // Footnotes (owner, 2026-11-11): after the blocks, which each note names; the ENTRY and the PDF.
    expect(armed.steps[6]).toEqual(["python3", expect.stringContaining("pdf-footnotes.py"), "/stage/slug", "/tmp/x.pdf"]);
    // The table arm (owner, 2026-11-14): the ENTRY, the DESTINATION library
    // (a transcription there is kept, never overwritten) and the PDF.
    expect(armed.steps[7]).toEqual([
      "bun",
      "run",
      expect.stringContaining("pdf-tables-csvw.ts"),
      "--staging",
      "/stage/slug",
      "--library",
      "/lib",
      "/tmp/x.pdf",
    ]);
    // The Stage B aspects (requirements, 2026-11-01) read `sections/`, so they take the ENTRY.
    expect(armed.steps[8]).toEqual(["python3", expect.stringContaining("extract-candidates.py"), "--aspects-only", "/stage/slug"]);
    // The verdict arm — bean `8suc`. It takes the ENTRY directory and the
    // DESTINATION LIBRARY, because the judgement lives in the library and a
    // staging directory does not say which one that is.
    expect(armed.steps[9]).toEqual([
      "bun",
      "run",
      expect.stringContaining("apply-image-verdicts.ts"),
      "--staging",
      "/stage/slug",
      "--library",
      "/lib",
    ]);
    // The cover arm (owner, 2026-10-16): page 1, into the entry, so `avatarOf` takes it before a figure.
    expect(armed.steps[10]).toEqual(["python3", expect.stringContaining("pdf-cover.py"), "/tmp/x.pdf", "-o", "/stage/slug/cover.png", "--width", "300"]);
    // The extraction record, last: it reads what every arm above wrote, and
    // names the rung that wrote `structure.json`.
    expect(armed.steps[11]).toEqual([
      "bun",
      "run",
      expect.stringContaining("entry-extraction.ts"),
      "--staging",
      "/stage/slug",
      "--library",
      "/lib",
      "--structure-tool",
      "pdf-pages.py",
    ]);

    // NOT for the other kinds, and this is stated rather than assumed.
    // `check-l1-complete`'s `PAGED_ONLY` list exists because not every
    // requirement applies to every kind, and neither archive nor tabular was
    // measured here. "More arms cannot hurt" is how a gate starts reporting a
    // requirement over content it was never about.
    for (const rung of ["archive", "tabular", "undetermined"] as const) {
      expect(withDerivedArms({ ...base, rung }, "/tmp/x.pdf", "/stage", "/stage/slug", "/lib").steps).toHaveLength(1);
    }
  });

  test("the PDF is passed in, never read back off the rung's argv", () => {
    // The rung's last argument happens to be the PDF today. A sequencer that
    // depended on that breaks silently the first time a rung grows a trailing
    // flag — and silently is the operative word: `pdf-images.py` would be
    // handed a flag as its source and fail, or worse, succeed over nothing.
    const armed = withDerivedArms(
      { rung: "pdf-structure", why: "", steps: [["python3", "pdf-structure.py", "-o", "/stage", "/real.pdf", "--ocr"]] },
      "/real.pdf",
      "/stage",
      "/stage/slug",
      "/lib",
    );
    expect(armed.steps.find((st) => st.some((a) => a.includes("pdf-images.py")))?.at(-1)).toBe("/real.pdf");
  });

  test("the arms are pointed at STAGING, never at the library", () => {
    // The whole mechanism is which directory `-o` receives. If a step is ever
    // handed the library again, the document is filed before anything can
    // refuse it and this gate becomes decoration.
    const src = readFileSync(new URL("../../ingest-document.ts", import.meta.url).pathname, "utf-8");
    // The staging LIBRARY ROOT, not the entry directory. `planFor`'s third
    // argument is what `libraryRoot()` returns, and every arm creates
    // `<lib>/<slug>/` beneath it. Passing the entry directory produced
    // `ingest-staging/<slug>/<slug>/`, so `checkEntry` read an empty parent
    // and reported EVERY requirement unmet — a refusal indistinguishable from
    // a correct one. Shipped in #495; caught by running a CSV through the
    // live pipeline, because the milnorlink checks passed over it (the
    // incomplete case refuses either way, and the complete case was staged by
    // hand straight into the entry directory).
    // The third argument is what matters; `--text` adds two after it (2026-10-14).
    expect(src).toContain("planFor(pdf, undefined, stagingRoot,");
    expect(src).not.toContain("const plan = planFor(pdf);");

    // AND THE SAME FOR THE SENTENCE IT PRINTS, which this test did not cover
    // until 2026-09-23 — so the code path was fixed in #495 while the
    // INSTRUCTION went on telling an agent to do the wrong thing for four
    // days. Measured by following it: `pdf-images.py -o ingest-staging/<slug>`
    // wrote `ingest-staging/<slug>/<slug>/images.json`, and the entry's own
    // `images.json` stayed absent — reproducing by hand exactly the defect the
    // comment above describes.
    //
    // A fixed code path does not fix the prose beside it. They are two
    // surfaces and only one of them was asserted.
    // THE SENTENCE IS GONE ENTIRELY, and that is the fix rather than the
    // wording. It gave ONE `-o` for arms that take opposite conventions —
    // `pdf-images.py` wants the library ROOT, `l1-blocks.ts` wants the ENTRY
    // directory and throws "no structure.json" otherwise — so no value was
    // correct for both, and #1035's correction made it right for one arm and
    // wrong for the other in the same stroke. `withDerivedArms` hands each the
    // directory it wants, so there is no instruction left to get wrong.
    expect(src).not.toContain("run the remaining arms");

    // AND THE TWO ARMS GET DIFFERENT DIRECTORIES, which is the whole reason
    // the sentence could not be saved. If these ever collapse to one value,
    // one of the arms is silently broken again.
    expect(src).toContain('["python3", pyHelper("pdf-images.py"), "-o", stagingRoot, pdf]');
    expect(src).toContain('["bun", "run", tsHelper("l1-blocks.ts"), "-o", staging]');
    expect(src).toContain('const staging = join(stagingRoot, slug);');
  });

  test("the verdict arm runs AFTER pdf-images.py, which is the whole mechanism", () => {
    // `pdf-images.py` opens the sidecar with `"w"` — no existence check, no
    // merge (`pdf-images.py`, the `open(target, "w")` near the end). So it
    // overwrites any narrative already applied. Order these two the other way
    // and every run silently wipes the judgements it just wrote: the file
    // still parses, still validates, and simply has no descriptions in it.
    //
    // Asserted as an ORDER rather than as two separate presence checks,
    // because presence is exactly what would still hold in the broken case.
    const armed = withDerivedArms(
      { rung: "pdf-structure" as const, why: "", steps: [["python3", "pdf-structure.py"]] },
      "/tmp/x.pdf",
      "/stage",
      "/stage/slug",
      "/lib",
    );
    const images = armed.steps.findIndex((s) => s.some((a) => a.includes("pdf-images.py")));
    const verdicts = armed.steps.findIndex((s) => s.some((a) => a.includes("apply-image-verdicts.ts")));
    expect(images).toBeGreaterThanOrEqual(0);
    expect(verdicts).toBeGreaterThan(images);
  });

  test("the verdict arm is given the DESTINATION library, not the staging root", () => {
    // A staging directory does not say which library a document is being
    // promoted into — `v1hw` measured that three queues fed five libraries.
    // Handing this arm the staging root would make it read a verdicts file
    // that is not there, report "nothing to apply", and let a document with
    // committed judgements promote with none of them applied: a silent pass
    // over real work, which is the `1xhc` shape this bean is already about.
    const armed = withDerivedArms(
      { rung: "pdf-pages" as const, why: "", steps: [["python3", "pdf-pages.py"]] },
      "/tmp/x.pdf",
      "/stage",
      "/stage/slug",
      "/some/library",
    );
    const arm = armed.steps.find((s) => s.some((a) => a.includes("apply-image-verdicts.ts")));
    expect(arm?.[arm.indexOf("--library") + 1]).toBe("/some/library");
    expect(arm).not.toContain("/stage");
  });

  test("staging is NOT dot-prefixed", () => {
    // `.beans/` and `.harness/` were moved out from behind dots on 2026-09-18
    // because the artefacts a person looks for first were the hardest to
    // find, and this repository's own guard rejects a dot-prefixed segment. A
    // staging tree holding a REFUSED document is exactly what somebody comes
    // looking for.
    const src = readFileSync(new URL("../../ingest-document.ts", import.meta.url).pathname, "utf-8");
    expect(src).toContain('"ingest-staging"');
    expect(src).not.toContain('".ingest-staging"');
  });

  test("the printed next step is the caller's own command, plus --promote — bean `apui`", () => {
    // It was recomposed relative to the instance root and printed
    // `../uploads/X.pdf`, which is "not there" from the repository root where
    // `bun run` puts you, and it dropped `--library`, which a repo declaring
    // several libraries refuses to guess. Measured by running it, 2026-10-06.
    expect(promoteCommand(["uploads/x.pdf", "--library", "../sib/library"])).toBe(
      "bun run cat ingest uploads/x.pdf --library ../sib/library --promote",
    );
    // A filename with a space survives a copy-paste into a shell.
    expect(promoteCommand(["uploads/Skills in X.pdf"])).toBe('bun run cat ingest "uploads/Skills in X.pdf" --promote');
    // Never doubled, and a dry run is not what gets promoted.
    expect(promoteCommand(["uploads/x.pdf", "--dry-run", "--promote"])).toBe("bun run cat ingest uploads/x.pdf --promote");
  });

  test("promotion mints the entry's JSON-LD for its DESTINATION, before anything is copied", () => {
    // Without this a promoted entry failed `gen-library-jsonld --check` (37
    // stale nodes on the 2026-10-06 run) and named the staging tree's
    // instance, so the path was four commands, two of them corpus-wide.
    const src = readFileSync(new URL("../../ingest-document.ts", import.meta.url).pathname, "utf-8");
    const built = src.indexOf("buildEntryNodes(slug, staging, out)");
    expect(built).toBeGreaterThan(0);
    // Built before the copy, so an unbuildable entry is refused, not half-filed.
    expect(built).toBeLessThan(src.indexOf("cpSync(staging, out"));
  });

  test("ONE unmet requirement refuses the whole entry", () => {
    // Behavioural, not a source grep. The two mutations that survived the
    // first pass — dropping the `--promote` guard, and `if (unmet.length)` →
    // `if (false)` — both read fine textually, so the decision was extracted
    // into `mayPromote` and is tested here on its values.
    expect(mayPromote([{ name: "a", state: "met", detail: "" }])).toBe(true);
    expect(mayPromote([{ name: "a", state: "unmet", detail: "" }])).toBe(false);
    expect(
      mayPromote([
        { name: "a", state: "met", detail: "" },
        { name: "b", state: "unmet", detail: "" },
      ]),
    ).toBe(false);
  });

  test("a text layer of mojibake or reversed Arabic ligatures is not text", () => {
    // Owner, 2026-11-10: "rules may assume LTR languages". Both shapes measured on the IRIS pilot.
    expect(textLayerUnreadable({ outline: 0, chars: 5000, letters: 4000, nonspace: 4200 })).toBeUndefined();
    expect(textLayerUnreadable({ outline: 0, chars: 5000, letters: 300, nonspace: 4200 })).toContain("mojibake");
    expect(textLayerUnreadable({ outline: 0, chars: 90000, letters: 70000, nonspace: 75000, arabicWords: 12798, arabicLigatureReversed: 967 })).toContain("right-to-left");
    expect(textLayerUnreadable({ outline: 0, chars: 90000, letters: 70000, nonspace: 75000, arabicWords: 12798, arabicLigatureReversed: 10 })).toBeUndefined();
    // Too few Arabic words to judge, and an old probe with no counts, decide nothing.
    expect(textLayerUnreadable({ outline: 0, chars: 900, letters: 700, nonspace: 750, arabicWords: 20, arabicLigatureReversed: 5 })).toBeUndefined();
    expect(textLayerUnreadable({ outline: 0, chars: 900 })).toBeUndefined();
  });

  test("a text layer in the wrong script for the document's language is not text", () => {
    // 10665/69384 (Arabic): Arabic glyphs mapped onto Latin-1 code points.
    const latin1 = { outline: 0, chars: 9000, letters: 6000, nonspace: 7000, scriptLetters: { latin: 5900, arabic: 12 } };
    expect(textLayerUnreadable(latin1, ["ar"])).toContain("wrong script");
    // No language known, or a Latin-script language, decides nothing.
    expect(textLayerUnreadable(latin1)).toBeUndefined();
    expect(textLayerUnreadable(latin1, ["fr"])).toBeUndefined();
    // Mixed scripts among the languages: not judged.
    expect(textLayerUnreadable(latin1, ["ar", "en"])).toBeUndefined();
    expect(textLayerUnreadable({ ...latin1, scriptLetters: { latin: 900, arabic: 5100 } }, ["ar"])).toBeUndefined();
    expect(textLayerUnreadable({ ...latin1, scriptLetters: { latin: 4000, cyrillic: 2000 } }, ["ru-RU"])).toBeUndefined();
    expect(textLayerUnreadable({ ...latin1, scriptLetters: { latin: 5900, han: 100 } }, ["zh"])).toContain("han");
  });

  test("--qa-later lets ONLY the QA-only requirements stay unmet", () => {
    // Owner, 2026-11-10 (who-iris#207): bulk derivation of referenced items;
    // image narratives are written afterwards, as QA_ONLY already says.
    const images = { name: "image-descriptions", state: "unmet" as const, detail: "" };
    const structure = { name: "structure", state: "unmet" as const, detail: "" };
    expect(mayPromote([images])).toBe(false);
    expect(mayPromote([images], true)).toBe(true);
    expect(mayPromote([images, structure], true)).toBe(false);
    expect(qaLater(["x.pdf", "--promote", "--qa-later"])).toBe(true);
    expect(qaLater(["x.pdf", "--promote"])).toBe(false);
  });

  test("`not-derivable` does NOT refuse — that is the third state's whole job", () => {
    // A requirement with no arm (`audio-transcripts`, until bean `1r0p`). Refusing every document until every arm
    // exists makes the gate unusable, and an unusable gate gets switched off.
    expect(mayPromote([{ name: "audio-transcripts", state: "not-derivable", detail: "" }])).toBe(true);
    expect(
      mayPromote([
        { name: "audio-transcripts", state: "not-derivable", detail: "" },
        { name: "structure", state: "met", detail: "" },
      ]),
    ).toBe(true);
  });

  test("an EMPTY requirement list does not promote by vacuous truth", () => {
    // `every` over `[]` is true, so a bare `every` would promote an entry
    // nothing examined. `mayPromote` refuses it itself, and — belt and braces —
    // `checkEntry` on an empty directory still yields requirements.
    expect(mayPromote([])).toBe(false);
    expect(mayPromote([], true)).toBe(false);
    const empty = mkdtempSync(join(tmpdir(), "stage-vac-"));
    made.push(empty);
    expect(checkEntry(empty).requirements.length).toBeGreaterThan(0);
  });

  test("an unmet entry has unmet requirements to refuse ON", () => {
    // The gate reads `checkEntry(staging)`. A staging tree with nothing in it
    // must produce unmet requirements — if it produced none, promotion would
    // succeed over an empty directory, which is the vacuity this repository
    // keeps paying for.
    const empty = mkdtempSync(join(tmpdir(), "stage-"));
    made.push(empty);
    const unmet = checkEntry(empty).requirements.filter((r) => r.state === "unmet");
    expect(unmet.length).toBeGreaterThan(0);
    expect(unmet.map((r) => r.name)).toContain("structure");
  });

  test("a COMPLETE entry has none, so it can promote", () => {
    // The other half, and the one that stops this being a gate that always
    // refuses. Verified end-to-end against the real corpus as well: copying
    // `library/milnorlink/` into staging and promoting it was a byte-identical
    // no-op, exit 0.
    expect(checkEntry(entry()).requirements.filter((r) => r.state === "unmet")).toEqual([]);
  });
});

describe("the L1 gate stopped assuming every document is a PDF", () => {
  /**
   * Found by running a real CSV through the LIVE pipeline, not by reading the
   * code. It routed correctly to the tabular rung, `tabular-records.py`
   * extracted one sheet and six headers — and the gate then demanded
   * `structure.json`, `sections/`, `blocks/` and an `images.json`, with
   * `image-descriptions` advising a reader to "run scripts/pdf-images.py" on
   * a spreadsheet.
   *
   * Cosmetic until `pn6j` gated promotion on it. After that it was a
   * PERMANENT BLOCKER: a CSV cannot have a chapter tree, so it could never be
   * promoted, and the gate added one PR earlier made every non-paged document
   * un-ingestable.
   */
  test("a sidecar names the shape — and absence is UNDETERMINED, not paged", () => {
    expect(entryKind((f) => f === "structure.json")).toBe("paged");
    expect(entryKind((f) => f === "tabular.jsonld")).toBe("tabular");
    expect(entryKind((f) => f === "contents.jsonld")).toBe("archive");
    // The third state, and it must not be "assume paged": an entry no rung
    // has run on has nothing DERIVED, which is a different fact from a paged
    // document missing its chapter tree.
    expect(entryKind(() => false)).toBe("undetermined");
  });

  test("a tabular entry is not asked for a chapter tree", () => {
    for (const r of PAGED_ONLY) expect(appliesTo(r, "tabular")).toBe(false);
    expect(appliesTo("manifest", "tabular")).toBe(true);
    expect(appliesTo("technical-metadata", "tabular")).toBe(true);
    expect(appliesTo("tabular-records", "tabular")).toBe(true);
  });

  test("a paged entry still faces every requirement", () => {
    for (const r of PAGED_ONLY) expect(appliesTo(r, "paged")).toBe(true);
  });

  test("UNDETERMINED keeps every requirement — the vacuity this guards", () => {
    // An entry nothing has run on must not satisfy the gate by having no
    // applicable requirements. That would let an empty directory promote,
    // which is the exact failure `mayPromote`'s `every` would wave through.
    for (const r of PAGED_ONLY) expect(appliesTo(r, "undetermined")).toBe(true);
  });

  test("`image-descriptions` is not demanded of a spreadsheet", () => {
    // The line that made the defect obvious when read aloud:
    //   image-descriptions  no images.json — run scripts/pdf-images.py
    expect(appliesTo("image-descriptions", "tabular")).toBe(false);
    expect(appliesTo("image-descriptions", "archive")).toBe(false);
    expect(appliesTo("image-descriptions", "paged")).toBe(true);
  });

  test("the source block is read from whichever sidecar the entry HAS", () => {
    // Three requirements each rolled their own reader, all reading
    // `structure.json` only. A CSV's `tabular.jsonld` carries a complete
    // source block, and they reported "no `source` block — re-run the ingest
    // rung": advice that was wrong, and that re-running would not have fixed.
    const dir = mkdtempSync(join(tmpdir(), "src-"));
    made.push(dir);
    expect(sourceBlockOf(dir)).toBeUndefined();
    writeFileSync(
      join(dir, "tabular.jsonld"),
      JSON.stringify({ source: { file: "x.csv", sha256: "a".repeat(64), mimetype_source: "unrecognised" } }),
    );
    expect(sourceBlockOf(dir)?.file).toBe("x.csv");
  });

  test("checkEntry on a REAL tabular entry emits no paged requirement", () => {
    // The end-to-end assertion, not a predicate one. `appliesTo` can be
    // perfect while nothing calls it — the filter being dropped was caught
    // only by the sidecar-staleness test, which fires on any edit to this
    // file and so proves nothing about the behaviour.
    //
    // Shaped like what `tabular-records.py` actually writes: measured on a
    // real CSV, 1 sheet, 6 headers, `mimetype_sniffed: null` because a CSV
    // has no magic bytes.
    const dir = mkdtempSync(join(tmpdir(), "tab-entry-"));
    made.push(dir);
    writeFileSync(
      join(dir, "tabular.jsonld"),
      JSON.stringify({
        $schema: "folio-tabular-records/v1",
        "@id": "who-measles-coverage",
        source: {
          file: "who-measles-coverage.csv",
          sha256: "7".repeat(64),
          bytes: 323,
          mtime: "2026-09-20T11:33:50Z",
          mimetype_sniffed: null,
          mimetype_source: "unrecognised",
        },
        format: "csv",
        sheets: [{ name: "who-measles-coverage", headers: ["country", "iso3"], rows: 8, columns: 6 }],
        n_sheets: 1,
        narrative: { text: null, state: "not-authored" },
      }),
    );
    const names = checkEntry(dir).requirements.map((r) => r.name);
    for (const paged of PAGED_ONLY) expect(names).not.toContain(paged);
    // And it is not empty: an entry with NO applicable requirements would
    // promote over anything.
    expect(names.length).toBeGreaterThan(0);
    expect(names).toContain("manifest");
  });

  test("every sidecar in KIND_SIDECAR names a kind that is not `undetermined`", () => {
    // A row mapping to `undetermined` would make the third state reachable by
    // PRESENCE, which is the opposite of what it means.
    for (const [kind] of KIND_SIDECAR) expect(kind).not.toBe("undetermined");
    expect(KIND_SIDECAR.length).toBeGreaterThan(1);
  });
});


describe("a document's figures can be VECTOR, and the gate no longer passes over them — bean `m4xy`", () => {
  // `pdf-images.py` recovers the RASTER layer. WHO's frameworks, maturity
  // models and process flows are drawn in vector, so they are never placed —
  // and `image-descriptions` reported `met` over a document whose every figure
  // was missing. Measured on `smart-base/library/9789240120747-eng`: SIX
  // captioned figures declared, ZERO images placed, and the verdict read "0
  // image(s), 0 describable and all described".
  const base = { $schema: "folio-document-images/v1", doc_id: "doc" };

  /** A fixture whose first section carries `body`. */
  const withSection = (body: string, images: unknown): { state: string; detail: string } => {
    const dir = entry({ images });
    writeFileSync(join(dir, "sections", "s0.md"), body);
    const r = checkEntry(dir).requirements.find((q) => q.name === "image-descriptions");
    return { state: r?.state ?? "(absent)", detail: r?.detail ?? "" };
  };

  test("a caption is counted at the start of a line; a cross-reference is not", () => {
    // "see Fig. 3.1" runs mid-sentence and is the same label as its caption,
    // so counting both would double it. Matching at line start is why the
    // figure is a LOWER BOUND rather than a measurement.
    const dir = entry({});
    writeFileSync(
      join(dir, "sections", "s0.md"),
      "Fig. 1. The first one\nsome prose referring to see Fig. 1 and see Fig. 9 inline\nFigure 2.3. Another\n",
    );
    writeFileSync(join(dir, "sections", "s1.md"), "Fig. 1. repeated in a list of figures\n");
    const labels = declaredFigureLabels(join(dir, "sections"));
    expect([...labels].sort()).toEqual(["1", "2.3"]);
  });

  test("ZERO images placed, but every declared figure is CAPTIONED — the caption is the handle", () => {
    // Owner ruling 2026-09-23, over building a vector arm: the caption text is
    // the reader's handle and the arm is a later bean. This test asserted
    // `not-derivable` until then, and the change is the ruling rather than a
    // gate being lowered — the caption has to actually be there, per figure.
    const r = withSection("Fig. 3. DIIG digital health enterprise architecture framework\n", {
      ...base,
      images: [],
    });
    expect(r.state).toBe("met");
    // MET ON THE EVIDENCE, NOT ON A COUNT. The caption is quoted into the
    // detail, so a reader can see what stood in for the description. `m4xy`
    // exists because an entry could be "L1-complete, gate-green, and missing
    // every figure it declares, with nothing anywhere signalling a gap" — a
    // bare `met` here would rebuild exactly that.
    expect(r.detail).toContain("DIIG digital health enterprise architecture framework");
    expect(r.detail).toContain("m4xy");
  });

  test("a figure with NO caption text is still not-derivable, and is NAMED", () => {
    // `Fig. 7` with nothing after it is a cross-reference or a caption this
    // lower bound could not read. Either way nothing describes that figure, so
    // the caption handle does not reach it and saying otherwise would be the
    // silent pass this gate exists against.
    //
    // Measured on the real corpus 2026-09-23: `9789240093362-eng` declares 18
    // figures and only THREE are captions. A blanket `met` on "declares
    // figures" would have passed over fifteen.
    const r = withSection("Fig. 7 illustrates the maturity model\n", { ...base, images: [] });
    expect(r.state).toBe("not-derivable");
    // The LABEL is named, so a reader sees which figure is uncovered rather
    // than a bare shortfall they cannot act on.
    expect(r.detail).toContain("Fig. 7");
    expect(r.detail).toContain("m4xy");
  });

  test("a caption beats a bare mention of the SAME figure, in either order", () => {
    // One real caption and three cross-references is a captioned figure. The
    // handbook's `Fig. 5` is exactly this: "Fig. 5 illustrates the M&E …"
    // appears before "Fig. 5. Intervention maturity over time".
    const r = withSection(
      "Fig. 5 illustrates the M&E framework\nFig. 5. Intervention maturity over time\n",
      { ...base, images: [] },
    );
    expect(r.state).toBe("met");
    expect(r.detail).toContain("Intervention maturity over time");
  });

  test("...and NOT `unmet`, because that would be a permanent blocker", () => {
    // `pn6j`'s failure, which this must not repeat: a requirement no amount of
    // work can satisfy blocks promotion forever. `not-derivable` is reported
    // and does not block, which is what makes it safe to be honest.
    const r = withSection("Fig. 3. A vector diagram\n", { ...base, images: [] });
    expect(r.state).not.toBe("unmet");
  });

  test("zero images and NO declared figures stays `met` — a determined empty", () => {
    // `who-rhr-1806-eng` genuinely places none and declares none. The new
    // state must not fire on it, or every image-free document reads as gapped.
    const r = withSection("Prose with no figures at all.\n", { ...base, images: [] });
    expect(r.state).toBe("met");
  });

  test("described images still pass, but the detail refuses to claim coverage", () => {
    // DIIG places 17 and declares 42; the 17 are logos, a photograph and a
    // barcode. Counts are NOT compared — the MAPS Toolkit declares 4 and
    // places 162, so `placed >= declared` would read as covered and be wrong.
    const r = withSection("Fig. 5.6.2. How mHero integrates digital health interventions\n", {
      ...base,
      images: [
        {
          id: "i1",
          file: "images/i1.png",
          role: "figure",
          basis: { method: "geometry", coverage: 0.4, imagesOnPage: 1, page: 1 },
          // One per configured language: English alone is unmet now (d5f1).
          narrative: ["ar", "zh", "en", "fr", "ru", "es"].map((lang) => ({
            text: "A logo.",
            lang,
            state: "draft",
            drafted_by: { kind: "agent", id: "a", model: "m" },
          })),
        },
      ],
    });
    expect(r.state).toBe("met");
    expect(r.detail).toContain("declares at least 1 captioned figure");
    expect(r.detail).toContain("NOT established");
  });
});

/**
 * WHAT AN ENTRY MAY NOT CONTAIN — bean `3psh`.
 *
 * THE CORPUS CANNOT TEST THIS. Measured 2026-09-23: 5 libraries, 21 entries,
 * **zero** orphans and zero unexpected children. So a green corpus run proves
 * nothing about this requirement, and these fixtures are not belt-and-braces
 * — they are the only thing that will ever execute the branch. `1xhc`: a gate
 * that does not fire is indistinguishable from one that passed.
 *
 * What the defect looked like before, measured on a real complete entry: it
 * passed clean, passed again with a nested orphan holding an `images.json`
 * under the WRONG `doc_id`, and passed a third time with a wholly unexpected
 * loose file — because no requirement said what an entry may not contain.
 */
describe("an entry's contents are a CLOSED set — `3psh`", () => {
  const entry = (children: Record<string, string | null>): string => {
    const dir = mkdtempSync(join(tmpdir(), "l1-contents-"));
    made.push(dir);
    for (const [name, body] of Object.entries(children)) {
      if (body === null) mkdirSync(join(dir, name), { recursive: true });
      else writeFileSync(join(dir, name), body);
    }
    return dir;
  };
  const contents = (dir: string) => checkEntry(dir).requirements.find((r) => r.name === "contents");

  const PAGED = {
    "structure.json": '{"$schema":"pdf-structure/v1","doc_id":"d","sections":[]}',
    "manifest.jsonld": "{}",
    "images.json": '{"$schema":"folio-document-images/v1","doc_id":"d","images":[]}',
    sections: null,
    blocks: null,
  };

  test("a clean entry is MET, and says how many children it accounted for", () => {
    const r = contents(entry(PAGED));
    expect(r?.state).toBe("met");
    expect(r?.detail).toContain("5 child(ren)");
  });

  test("`images/` and `ocr/` are allowed — they are arms' output, not strays", () => {
    // Measured on the corpus: `images/` on 13 of 21 entries and `ocr/` on 2.
    // A closed set that excluded them would fail 13 entries on its first run,
    // which is how a new gate gets weakened back out again.
    expect(contents(entry({ ...PAGED, images: null, ocr: null }))?.state).toBe("met");
  });

  test("a NESTED ORPHAN is unmet and is NAMED", () => {
    // The original incident: `pdf-images.py` derived the doc id differently
    // from `pdf-structure.py` and wrote into a sibling; after a rename the
    // sibling ended up INSIDE the entry. Both duplicates were byte-identical
    // apart from `doc_id` and both were committed unnoticed.
    const r = contents(entry({ ...PAGED, "260725032v1": null }));
    expect(r?.state).toBe("unmet");
    expect(r?.detail).toContain("260725032v1");
    // NAMED, NOT REMOVED — `deletion-requires-confirmation`. An orphan is
    // evidence of which arm misfiled it; deleting it destroys that.
    expect(r?.detail).toContain("Reported, not removed");
  });

  test("an unexpected loose FILE is unmet too — not only directories", () => {
    const r = contents(entry({ ...PAGED, "notes.txt": "x" }));
    expect(r?.state).toBe("unmet");
    expect(r?.detail).toContain("notes.txt");
  });

  test("a dotfile is NOT a stray", () => {
    // `.DS_Store` and friends are the environment's, not an arm's. Flagging
    // them would train a reader to ignore this finding, which is worse than
    // not having it.
    expect(contents(entry({ ...PAGED, ".DS_Store": "x" }))?.state).toBe("met");
  });

  test("the allowed set is the DECLARED one, not a literal repeated here", () => {
    // If these drift apart, the requirement and its documentation disagree
    // and only one of them is executable.
    for (const d of ENTRY_DIRECTORIES) expect(contents(entry({ ...PAGED, [d]: null }))?.state).toBe("met");
    for (const f of ENTRY_SIDECARS) expect(contents(entry({ ...PAGED, [f]: "{}" }))?.state).toBe("met");
  });
});

/**
 * A DECLARED library sub-graph inside an entry is the entry's own KG content,
 * not a stray — bean `8pzh` item 1 (owner, 2026-10-12: L1 extraction output
 * lives beside its library entry and is published with it). The kind comes
 * from the registry (`within: "library"`), never a directory name here.
 */
describe("an entry's declared library sub-graph is not a stray — `8pzh`", () => {
  const PAGED = {
    "structure.json": '{"$schema":"pdf-structure/v1","doc_id":"d","sections":[]}',
    "manifest.jsonld": "{}",
  };
  const registry = (): GraphTypologyRegistry => {
    const reg = new GraphTypologyRegistry();
    reg.register("probe-extraction", { renderable: false, holds: "derived", summary: "x", within: "library" });
    reg.register("probe-loose", { renderable: false, holds: "derived", summary: "x" });
    return reg;
  };
  /** An instance whose `library/e1/` holds `out/`, declared with `kinds` (or not at all). */
  const instance = (kinds: string[] | undefined): string => {
    const root = mkdtempSync(join(tmpdir(), "l1-subgraph-"));
    made.push(root);
    const e1 = join(root, "library", "e1");
    mkdirSync(join(e1, "out"), { recursive: true });
    for (const [n, b] of Object.entries(PAGED)) writeFileSync(join(e1, n), b);
    writeFileSync(join(e1, "out", "graph.json"), "{}");
    writeFileSync(
      join(root, "fixture.json"),
      JSON.stringify({
        $schema: "cat-harness-declaration/1.0.0",
        name: "fixture",
        directories: [
          { id: "library", path: "library/", graphTypologies: ["library"] },
          ...(kinds === undefined ? [] : [{ id: "e1-out", path: "library/e1/out/", graphTypologies: kinds }]),
        ],
      }),
    );
    return e1;
  };
  const contents = (dir: string) => checkEntry(dir, registry()).requirements.find((r) => r.name === "contents");

  test("a directory declared with a within-library kind is MET", () => {
    expect(contents(instance(["probe-extraction"]))?.state).toBe("met");
  });

  test("the same directory UNDECLARED is still a stray", () => {
    const r = contents(instance(undefined));
    expect(r?.state).toBe("unmet");
    expect(r?.detail).toContain("out");
  });

  test("declared with a kind that is NOT within library is still a stray", () => {
    expect(contents(instance(["probe-loose"]))?.state).toBe("unmet");
  });
});

describe("libraryRootFor (bean 12ws)", () => {
  test("returns cwd when it declares a library graph", () => {
    // A fixture, not a sibling instance: `who-iris/` exists only in the
    // monorepo, so reading it fails the standalone ratchet. Nested one level
    // inside `base` so `dirname(root)` is `base` rather than `tmpdir()`.
    const base = mkdtempSync(join(tmpdir(), "l1-root-"));
    made.push(base);
    const root = join(base, "sub");
    mkdirSync(root, { recursive: true });
    writeDeclaration(root, {
      name: "t",
      directories: [{ id: "library", path: "library/", graphTypologies: ["library"] }],
    });
    expect(libraryRootFor(root)).toBe(root);
  });

  test("falls back to own instance when cwd does not declare a library", () => {
    const own = resolve(HARNESS_ROOT);
    // A fresh EMPTY directory nested inside `base`, not directly in `tmpdir()`:
    // the shared temp root holds whatever other tests left there, and a leaked
    // fixture instance with a `library` (e.g. `libqa-*`, 156 of them measured
    // on 2026-10-09) makes `tmpdir()` a parent directory that holds instances.
    const base = mkdtempSync(join(tmpdir(), "l1-nolib-"));
    made.push(base);
    const empty = join(base, "sub");
    mkdirSync(empty, { recursive: true });
    const fallback = libraryRootFor(empty);
    expect(fallback).toBe(own);
  });
});


// ── The text rung, through the one entry point (owner, 2026-10-14) ─────────
//
// A Markdown source reached `library/` through `text-structure.ts` alone and
// never got its KG nodes (litlfred/dth-hrh): the skill named two more steps
// and nothing ran them. Through `cat ingest --text` it takes the notebook's
// derived arm, and `--promote` writes its nodes as for every rung.
describe("--text: a text source through cat ingest", () => {
  test("is routed to text-structure only when the caller says so, never by extension", () => {
    const p = planFor("/tmp/HWF_Outline.md", undefined, LIB, null, true);
    expect(p.rung).toBe("text");
    expect(p.steps).toHaveLength(1);
    const step = p.steps[0]!;
    expect(step.join(" ")).toContain("text-structure.ts");
    expect(step).toContain("--doc-id");
    expect(step[step.length - 1]).toBe("/tmp/HWF_Outline.md");
    // Without the flag the same file is not read as text: the extension decides nothing.
    expect(planFor("/tmp/HWF_Outline.md", { outline: 0, chars: 50_000 }, LIB, null, false).rung).not.toBe("text");
  });

  test("a binary file is refused as text, not read", () => {
    expect(planFor("/tmp/x.md", undefined, LIB, "application/pdf", true).rung).toBe("undetermined");
    expect(planFor("/tmp/x.xml", undefined, LIB, "application/xml", true).rung).toBe("text");
  });

  test("it takes the l1-blocks arm, and a known title reaches the rung", () => {
    const p = planFor("/tmp/HWF_Outline.md", undefined, LIB, null, true);
    const armed = withDerivedArms(p, "/tmp/HWF_Outline.md", "/stage", "/stage/slug", "/lib");
    expect(armed.steps).toHaveLength(3);
    expect(armed.steps[1]!.join(" ")).toContain("l1-blocks.ts -o /stage/slug");
    expect(armed.steps[2]!.join(" ")).toContain("extract-candidates.py --aspects-only /stage/slug");
    expect(withKnownTitle(p, "The Outline").steps[0]).toContain("--title");
  });
});
