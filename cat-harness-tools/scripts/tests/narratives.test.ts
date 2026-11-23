/**
 * Agent-drafted, human-confirmed narratives — beans `ju0u`, `04vl`.
 *
 * The state machine and the review queue are both proved against fixtures, and
 * every branch is mutation-checked, because **a queue that finds nothing is
 * indistinguishable from a queue that cannot see**.
 *
 * That sentence was here from the start and the suite still fell for it. This
 * header used to open *"nothing in `library/` carries a draft"*, and one test
 * asserted exactly that against the real corpus. Both stayed true until `d5f1`
 * wrote 24 drafts into every `library/<slug>/images.json` — after which the
 * claim was
 * false and the test still passed, because the queue read `doc.narrative` and
 * an images sidecar has none. The assertion was true of what the queue could
 * SEE and false of the corpus, which is the whole failure mode named above.
 *
 * So the corpus test now compares the queue against a count taken by walking
 * the JSON here, sharing no code with it. Two derivations that agree is
 * evidence; a zero compared against itself is not.
 *
 * @module scripts/tests/narratives
 */
import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { corpusDirectoriesForGraph as directoriesForGraph } from "../../schemas/kg/harness-config.ts";
import {
  NARRATIVE_STATES,
  NOT_AUTHORED,
  NarrativeSchema,
  REJECTION_REASONS,
  STATES_WITH_TEXT,
  awaitsConfirmation,
  isConfirmed,
} from "../../schemas/content/narrative.ts";
import {
  NARRATIVE_BEARING,
  atATerminal,
  decide,
  narrativesIn,
  queue,
  reviewer,
} from "../narratives.ts";
import {  } from "../../schemas/kg/cat-harness.js";
import { writeDeclaration } from "../../test/support/instance-fixture.js";
import { HARNESS_ROOT, TOOLS_ROOT } from "../lib/roots.ts";

const ROOT = resolve(HARNESS_ROOT);
const AGENT = { kind: "agent" as const, id: "claude-code", model: "claude-opus-5" };
const HUMAN = { kind: "human" as const, id: "litlfred" };
const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

const draft = { text: "Weekly case counts by country.", lang: "en", state: "draft" as const, drafted_by: AGENT };
/** A slot as stored since e1lo stage 4: a written narrative in a one-entry list; the empty slot bare. */
const slot = (n: { state: string }): unknown => (n.state === "not-authored" || Array.isArray(n) ? n : [n]);

describe("the state machine refuses records that mean nothing", () => {
  test("only `not-authored` has no text", () => {
    expect(NarrativeSchema.safeParse(NOT_AUTHORED).success).toBe(true);
    expect(NarrativeSchema.safeParse({ text: null, state: "draft", drafted_by: AGENT }).success).toBe(false);
    expect(NarrativeSchema.safeParse({ text: "x", state: "not-authored" }).success).toBe(false);
  });

  test("anything written records who wrote it", () => {
    // Otherwise `confirmed` could mean a person accepted words of unknown
    // origin — the provenance gap `iqim` closed for blocks, reappearing.
    expect(NarrativeSchema.safeParse({ text: "x", state: "draft" }).success).toBe(false);
  });

  test("AN AGENT CANNOT CONFIRM ITS OWN DRAFT", () => {
    // The load-bearing rule, and the whole difference between the option the
    // owner chose and the one they did not. Without it `confirmed` degrades
    // into "an agent said so twice".
    const base = { ...draft, state: "confirmed" as const };
    expect(NarrativeSchema.safeParse({ ...base, confirmed_by: AGENT }).success).toBe(false);
    expect(NarrativeSchema.safeParse({ ...base, confirmed_by: { kind: "script", id: "x" } }).success).toBe(false);
    expect(NarrativeSchema.safeParse({ ...base, confirmed_by: HUMAN }).success).toBe(true);
  });

  test("a rejection must say why", () => {
    const base = { ...draft, state: "rejected" as const, rejected_by: HUMAN };
    expect(NarrativeSchema.safeParse(base).success).toBe(false);
    expect(NarrativeSchema.safeParse({ ...base, rejection_reason: "" }).success).toBe(false);
    expect(NarrativeSchema.safeParse({ ...base, rejection_reason: REJECTION_REASONS[0] }).success).toBe(true);
  });

  test("a narrative cannot be both confirmed and rejected", () => {
    expect(
      NarrativeSchema.safeParse({
        ...draft,
        state: "confirmed",
        confirmed_by: HUMAN,
        rejected_by: HUMAN,
        rejection_reason: "x",
      }).success,
    ).toBe(false);
  });

  test("an agent draft still needs its model — inherited from `iqim`", () => {
    expect(
      NarrativeSchema.safeParse({ text: "x", state: "draft", drafted_by: { kind: "agent", id: "c" } }).success,
    ).toBe(false);
  });

  test("`STATES_WITH_TEXT` is derived, so a new state forces the question", () => {
    expect([...STATES_WITH_TEXT]).toEqual(NARRATIVE_STATES.filter((s) => s !== "not-authored"));
    expect(STATES_WITH_TEXT).not.toContain("not-authored");
  });

  test("only `confirmed` reads as confirmed", () => {
    expect(isConfirmed({ ...draft, state: "confirmed", confirmed_by: HUMAN })).toBe(true);
    for (const n of [NOT_AUTHORED, draft, { ...draft, state: "rejected", rejected_by: HUMAN, rejection_reason: "x" }]) {
      expect(isConfirmed(n)).toBe(false);
    }
    expect(awaitsConfirmation(draft)).toBe(true);
    expect(awaitsConfirmation(NOT_AUTHORED)).toBe(false);
  });
});

/** A repo-shaped fixture: harness.json declaring library/, and entries in it. */
function repo(entries: Record<string, unknown>): string {
  const root = mkdtempSync(join(tmpdir(), "narr-"));
  made.push(root);
  writeDeclaration(root, JSON.stringify({ name: "fixture", directories: [{ id: "library", path: "library", graphTypologies: ["library"] }] }));
  for (const [slug, narrative] of Object.entries(entries)) {
    mkdirSync(join(root, "library", slug), { recursive: true });
    writeFileSync(
      join(root, "library", slug, "tabular.jsonld"),
      JSON.stringify({ $schema: "folio-tabular-records/v1", narrative: slot(narrative as { state: string }) }, null, 2) + "\n",
    );
  }
  return root;
}

/**
 * Every draft under a library, counted by WALKING THE JSON.
 *
 * Deliberately shares no code with {@link narrativesIn}: it recurses over
 * whatever shape it finds rather than knowing about `narrative` or `images`,
 * so a queue blind to a container is not blind here in the same way. Two
 * independent derivations that agree is evidence. A count checked against
 * itself is the test that passed while the queue saw nothing.
 */
function draftsOnDisk(lib: string): number {
  let n = 0;
  const visit = (v: unknown): void => {
    if (Array.isArray(v)) {
      for (const x of v) visit(x);
      return;
    }
    if (typeof v !== "object" || v === null) return;
    const rec = v as Record<string, unknown>;
    if (rec.state === "draft" && typeof rec.text === "string" && rec.drafted_by) n++;
    // `superseded` (block-summary.ts) holds narratives a redraft REPLACED: a
    // record of what was there, never awaiting a person, so the queue rightly
    // does not offer it and this count must not either.
    for (const [k, x] of Object.entries(rec)) if (k !== "superseded") visit(x);
  };
  if (!existsSync(lib)) return 0;
  // EVERY JSON file under the library, not `NARRATIVE_BEARING`: walking the
  // queue's own list made this blind wherever the queue was. Until 2026-10-21
  // neither saw `vector-figures.json` or `figure-descriptions.json`, and the
  // two counts agreed.
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const f = join(dir, name.name);
      // `blocks/` holds the graph's projections: a figure block carries a COPY
      // of its image's narrative (`derivedFrom`), which a person reviews in
      // `images.json`, not here. Counting it would count each draft twice.
      if (name.isDirectory()) {
        if (name.name !== "blocks") walk(f);
      }
      else if (/\.jsonl?d?$/.test(name.name)) {
        // Unparseable is skipped, exactly as the queue skips it — otherwise the
        // two counts would disagree over a broken file rather than over a bug.
        try {
          visit(JSON.parse(readFileSync(f, "utf-8")));
        } catch {
          continue;
        }
      }
    }
  };
  walk(lib);
  return n;
}

describe("`narrativesIn` reads both shapes and says where each one sits", () => {
  test("a flat document yields one, at `narrative`", () => {
    expect(narrativesIn({ narrative: [draft] })).toEqual([{ path: ["narrative", 0], narrative: draft, lang: "en" }]);
  });

  test("an images sidecar yields one per DESCRIBED image, with its id", () => {
    const got = narrativesIn({
      images: [
        { id: "a", role: "logo", narrative: [draft] },
        { id: "b", role: "page-scan" },
        { id: "c", role: "figure", narrative: [{ ...draft, text: "something else" }] },
      ],
    });
    expect(got.map((g) => g.path)).toEqual([
      ["images", 0, "narrative", 0],
      ["images", 2, "narrative", 0],
    ]);
    expect(got.map((g) => g.subject)).toEqual(["a", "c"]);
  });

  test("a CSVW record yields one per transcribed TABLE, named by its label", () => {
    // Transcribed tables in a paged entry: `tables[i]["fac:narrative"]` in `tabular.csvw.json`.
    const got = narrativesIn({
      tables: [
        { url: "tables/table-1.csv", "fac:label": "Table 1", "fac:narrative": [draft] },
        { url: "tables/table-2.csv" },
        { url: "tables/table-3.csv", "fac:narrative": [{ ...draft, text: "something else" }] },
      ],
    });
    expect(got.map((g) => g.path)).toEqual([
      ["tables", 0, "fac:narrative", 0],
      ["tables", 2, "fac:narrative", 0],
    ]);
    expect(got.map((g) => g.subject)).toEqual(["Table 1", "tables/table-3.csv"]);
  });

  test("the index is the image's POSITION, not the narrative's ordinal", () => {
    // `images[2]` is the FIRST narrative here. Numbering by arrival would
    // write the reviewer's decision onto `images[0]` — a different picture,
    // silently, with both records still looking well-formed.
    expect(narrativesIn({ images: [{ id: "a" }, { id: "b" }, { id: "c", narrative: [draft] }] })[0].path).toEqual([
      "images",
      2,
      "narrative",
      0,
    ]);
  });

  test("both shapes at once are both returned", () => {
    // No file does this today. The function must not depend on that: a
    // container that silently drops one shape when the other is present is
    // the same blindness one layer down.
    expect(narrativesIn({ narrative: [draft], images: [{ id: "a", narrative: [draft] }] }).map((g) => g.path)).toEqual([
      ["narrative", 0],
      ["images", 0, "narrative", 0],
    ]);
  });

  test("a document with neither yields a DETERMINED empty", () => {
    expect(narrativesIn({ $schema: "folio-document-images/v1" })).toEqual([]);
    expect(narrativesIn({ images: [] })).toEqual([]);
    // `images: null` is the sidecar's could-not-determine. Nothing to review
    // is the right answer; crashing on it is not.
    expect(narrativesIn({ images: null })).toEqual([]);
  });

  test("a malformed narrative is skipped rather than half-read", () => {
    expect(narrativesIn({ narrative: { state: "draft" } })).toEqual([]);
    expect(narrativesIn({ images: [{ id: "a", narrative: "words" }] })).toEqual([]);
    expect(narrativesIn({ images: [null, "x", 3] })).toEqual([]);
  });

  test("a vector-figures sidecar yields one per described figure, with its id", () => {
    const got = narrativesIn({ figures: [{ id: "vfig-p003", narrative: [{ ...draft, lang: "en" }] }, { id: "vfig-p004" }] });
    expect(got.map((g) => [g.path, g.subject, g.lang])).toEqual([[["figures", 0, "narrative", 0], "vfig-p003", "en"]]);
  });

  test("figure descriptions are keyed by document, which becomes the item's slug", () => {
    const got = narrativesIn({ descriptions: { "doc-a": [{ figure: "Figure 2", narrative: [draft] }] } });
    expect(got).toEqual([
      { path: ["descriptions", "doc-a", 0, "narrative", 0], narrative: draft, lang: "en", subject: "Figure 2", slug: "doc-a" },
    ]);
  });

  test("`images.json` is in the bearing list — necessary, and on its own useless", () => {
    // Adding it here without {@link narrativesIn} found exactly nothing: the
    // file was opened, `doc.narrative` was read, and it has none.
    expect(NARRATIVE_BEARING).toContain("images.json");
  });
});

describe("the queue shows exactly what is waiting on a person", () => {
  test("a draft appears; settled and empty ones do not", () => {
    const root = repo({
      adraft: draft,
      bconfirmed: { ...draft, state: "confirmed", confirmed_by: HUMAN },
      crejected: { ...draft, state: "rejected", rejected_by: HUMAN, rejection_reason: "x" },
      dempty: NOT_AUTHORED,
    });
    const q = queue(root);
    expect(q.map((i) => i.slug)).toEqual(["adraft"]);
  });

  test("a library-level figure description is offered, under its document, and a decision lands on it", () => {
    const root = repo({});
    mkdirSync(join(root, "library"), { recursive: true });
    const f = join(root, "library", "figure-descriptions.json");
    writeFileSync(
      f,
      JSON.stringify({ $schema: "folio-figure-descriptions/v1", descriptions: { "doc-a": [{ figure: "Figure 2", narrative: [draft] }] } }, null, 2) + "\n",
    );
    const q = queue(root);
    expect(q.map((i) => [i.slug, i.subject, i.file])).toEqual([["doc-a", "Figure 2", join("library", "figure-descriptions.json")]]);
    decide(q[0]!, "confirm", { by: HUMAN, root });
    const [written] = JSON.parse(readFileSync(f, "utf-8")).descriptions["doc-a"][0].narrative;
    expect(written.state).toBe("confirmed");
    expect(written.confirmed_by).toEqual(HUMAN);
  });

  test("a paged entry's transcribed table is offered, and a decision lands on the table", () => {
    const root = repo({});
    mkdirSync(join(root, "library", "paged"), { recursive: true });
    writeFileSync(join(root, "library", "paged", "structure.json"), "{}\n");
    const f = join(root, "library", "paged", "tabular.csvw.json");
    writeFileSync(f, JSON.stringify({ tables: [{ url: "t1.csv", "fac:label": "Table 1", "fac:narrative": [draft] }] }, null, 2) + "\n");
    const q = queue(root);
    expect(q.map((i) => [i.slug, i.subject])).toEqual([["paged", "Table 1"]]);
    expect(q.length).toBe(draftsOnDisk(join(root, "library")));
    decide(q[0]!, "confirm", { by: HUMAN, root });
    const [written] = JSON.parse(readFileSync(f, "utf-8")).tables[0]["fac:narrative"];
    expect(written.state).toBe("confirmed");
    expect(written.confirmed_by).toEqual(HUMAN);
  });

  test("a summary's SUPERSEDED history is not awaiting anyone — by the queue or by the walk", () => {
    const root = repo({});
    mkdirSync(join(root, "library", "s"), { recursive: true });
    writeFileSync(
      join(root, "library", "s", "summaries.json"),
      JSON.stringify({ summaries: [{ block: "b/1", narrative: [draft], superseded: [{ ...draft, text: "an older draft" }] }] }, null, 2) + "\n",
    );
    expect(queue(root).length).toBe(1);
    expect(draftsOnDisk(join(root, "library"))).toBe(1);
  });

  test("a REJECTED draft is never re-offered", () => {
    // The reasons exist precisely so the same text does not come back around.
    const root = repo({ x: { ...draft, state: "rejected", rejected_by: HUMAN, rejection_reason: REJECTION_REASONS[1] } });
    expect(queue(root)).toEqual([]);
  });

  test("an unparseable file is skipped rather than crashing the queue", () => {
    const root = repo({ ok: draft });
    mkdirSync(join(root, "library", "broken"), { recursive: true });
    writeFileSync(join(root, "library", "broken", "tabular.jsonld"), "{ not json");
    expect(queue(root).map((i) => i.slug)).toEqual(["ok"]);
  });

  test("no library at all is an empty queue, not a crash", () => {
    const root = mkdtempSync(join(tmpdir(), "narr-none-"));
    made.push(root);
    writeDeclaration(root, JSON.stringify({ name: "x", directories: [] }));
    expect(queue(root)).toEqual([]);
  });

  test("THE REAL CORPUS'S DRAFTS ARE VISIBLE — the zero this asserted was blindness", () => {
    // This read `expect(queue(ROOT)).toEqual([])` and went on passing after
    // `d5f1` put 24 drafts into `library/*/images.json`, because the queue
    // read `doc.narrative` and an images sidecar has none. Green, and wrong
    // about the repository it was pointed at.
    //
    // A count the queue produces cannot check the queue, so the second one is
    // taken by walking the JSON (`draftsOnDisk`), sharing no code with it.
    const q = queue(ROOT);
    // Summed over EVERY declared library, because `queue` is. Counting one of
    // them against a queue that spans all of them would make this assertion
    // fail for a correct queue — and, worse, pass for a broken one the day
    // both counts were narrowed together. Bean `a02m`.
    const libs = directoriesForGraph(ROOT, "library");
    const onDisk = (libs.length > 0 ? libs : [join(ROOT, "library")])
      .map((d) => draftsOnDisk(d))
      .reduce((a, b) => a + b, 0);
    expect(q.length).toBe(onDisk);
    // And a floor, so this cannot lapse back into an assertion about nothing.
    // Not the number: a count in a test is a claim that goes stale, and 24 is
    // a property of today's corpus rather than of the queue.
    expect(q.length).toBeGreaterThan(0);
    // It walks every JSON file of every declared library: under 1 s alone,
    // 5.8 s measured beside the other corpus tests, so not the 5 s default.
  }, 30_000);

  test("every draft in a multi-narrative file names its SUBJECT", () => {
    // A reviewer shown twenty-four entries labelled only `wpr-rdo-2020-003-eng`
    // is being asked to tell them apart by their text — which is the thing
    // under review. The label has to come from outside it.
    for (const it of queue(ROOT)) {
      if (it.path.length > 1) expect(it.subject).toBeTruthy();
    }
  });
});

describe("deciding writes the file, and validates before it does", () => {
  const now = new Date("2026-09-19T16:00:00.000Z");

  test("confirming records the HUMAN and the time", () => {
    const root = repo({ x: draft });
    const q = queue(root);
    const out = decide(q[0], "confirm", { by: HUMAN, now, root });
    expect(out.state).toBe("confirmed");
    expect(out.confirmed_by).toEqual(HUMAN);
    expect(out.confirmed_at).toBe("2026-09-19T16:00:00Z");
    // The draft attribution SURVIVES: who wrote it and who accepted it are
    // both still answerable afterwards.
    expect(out.drafted_by).toEqual(AGENT);
    const onDisk = JSON.parse(readFileSync(join(root, q[0].file), "utf-8")) as { narrative: unknown[] };
    expect(NarrativeSchema.safeParse(onDisk.narrative[0]).success).toBe(true);
    expect(queue(root)).toEqual([]);
  });

  test("rejecting keeps the reason", () => {
    const root = repo({ x: draft });
    const out = decide(queue(root)[0], "reject", { by: HUMAN, reason: REJECTION_REASONS[0], now, root });
    expect(out.state).toBe("rejected");
    expect(out.rejection_reason).toBe(REJECTION_REASONS[0]);
    expect(out.text).toBe(draft.text);
  });

  test("an invalid decision NEVER reaches the file", () => {
    // Validated before the write, because a bad record on disk is one the gate
    // has to catch later — by which time it is committed.
    const root = repo({ x: draft });
    const q = queue(root);
    const before = readFileSync(join(root, q[0].file), "utf-8");
    expect(() => decide(q[0], "reject", { by: HUMAN, now, root })).toThrow(/must say why/);
    expect(readFileSync(join(root, q[0].file), "utf-8")).toBe(before);
    expect(() =>
      decide(q[0], "confirm", { by: AGENT as unknown as typeof HUMAN, now, root }),
    ).toThrow(/human/);
    expect(readFileSync(join(root, q[0].file), "utf-8")).toBe(before);
  });
});

/** A sidecar-shaped fixture: three images, two of them described. */
function imagesRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "narr-img-"));
  made.push(root);
  writeDeclaration(root, JSON.stringify({ name: "fixture", directories: [{ id: "library", path: "library", graphTypologies: ["library"] }] }));
  mkdirSync(join(root, "library", "x"), { recursive: true });
  writeFileSync(
    join(root, "library", "x", "images.json"),
    JSON.stringify(
      {
        $schema: "folio-document-images/v1",
        doc_id: "x",
        images: [
          { id: "a", page: 1, role: "logo", narrative: [draft] },
          { id: "b", page: 2, role: "page-scan" },
          { id: "c", page: 3, role: "figure", narrative: [{ ...draft, text: "The other one." }] },
        ],
      },
      null,
      2,
    ) + "\n",
  );
  return root;
}

describe("a decision lands on the PICTURE the reviewer saw", () => {
  const now = new Date("2026-09-20T09:00:00.000Z");

  test("confirming the second draft writes `images[2]` and leaves its siblings alone", () => {
    const root = imagesRepo();
    const q = queue(root);
    expect(q.map((i) => i.subject)).toEqual(["a", "c"]);

    decide(q[1], "confirm", { by: HUMAN, now, root });

    const doc = JSON.parse(readFileSync(join(root, "library", "x", "images.json"), "utf-8")) as {
      narrative?: unknown;
      images: { id: string; role: string; narrative?: { state: string }[] }[];
    };
    expect(doc.images[2].narrative?.[0]?.state).toBe("confirmed");
    expect(doc.images[0].narrative?.[0]?.state).toBe("draft");
    expect(doc.images[1].narrative).toBeUndefined();
    // And NO stray top-level record. `doc.narrative = …` — correct while every
    // bearing file held one narrative — would have written here, left all 24
    // drafts untouched, and the queue would re-offer the same picture forever
    // while each confirmation reported success.
    expect(doc.narrative).toBeUndefined();
    expect(queue(root).map((i) => i.subject)).toEqual(["a"]);
  });

  test("the rest of the sidecar survives the rewrite", () => {
    // `decide` writes the whole file back. Ids, pages and roles are what the
    // `d5f1` inspection pass cost a corpus sweep to establish, and a reviewer
    // accepting a sentence must not silently drop them.
    const root = imagesRepo();
    decide(queue(root)[0], "confirm", { by: HUMAN, now, root });
    const doc = JSON.parse(readFileSync(join(root, "library", "x", "images.json"), "utf-8")) as {
      $schema: string;
      doc_id: string;
      images: { id: string; page: number; role: string }[];
    };
    expect(doc.$schema).toBe("folio-document-images/v1");
    expect(doc.doc_id).toBe("x");
    expect(doc.images.map((i) => i.id)).toEqual(["a", "b", "c"]);
    expect(doc.images.map((i) => i.role)).toEqual(["logo", "page-scan", "figure"]);
    expect(doc.images.map((i) => i.page)).toEqual([1, 2, 3]);
  });

  test("a path into nothing is REFUSED rather than brought into being", () => {
    // Assignment through a stale path would happily create `images[9]` on an
    // array of three, or a `narrative` key on `undefined` would throw a
    // TypeError naming nothing useful. Either way the reviewer's decision is
    // recorded against no picture.
    const root = imagesRepo();
    const item = { ...queue(root)[0], path: ["images", 9, "narrative", 0] as const };
    expect(() => decide(item, "confirm", { by: HUMAN, now, root })).toThrow(/does not exist/);
    expect(queue(root).map((i) => i.subject)).toEqual(["a", "c"]);
  });

  test("rejecting one draft does not settle the others", () => {
    const root = imagesRepo();
    decide(queue(root)[0], "reject", { by: HUMAN, reason: REJECTION_REASONS[0], now, root });
    expect(queue(root).map((i) => i.subject)).toEqual(["c"]);
  });
});

describe("the review step is selection, not typing", () => {
  test("every rejection reason is reachable by NUMBER", () => {
    // The owner has very limited hand function. A rejection that demands a
    // typed sentence is a rejection that will not happen, and `confirmed`
    // then means "nobody got round to objecting" — worse than not having the
    // state at all.
    expect(REJECTION_REASONS.length).toBeGreaterThan(0);
    for (const r of REJECTION_REASONS) expect(r.length).toBeGreaterThan(0);
  });

  test("a decision is one word and one number — measured, not asserted vaguely", () => {
    // The falsifier for this whole design: if confirming costs a sentence of
    // typing it will not happen, and `confirmed` becomes "nobody got round to
    // objecting". So the cost is measured rather than hoped for.
    const confirm = "bun run cat narratives:confirm 1";
    const reject = "bun run cat narratives:reject 1 --why 2";
    // Past the script name, the user types a number and at most a flag+number.
    expect(confirm.slice("bun run cat narratives:confirm ".length)).toBe("1");
    expect(reject.slice("bun run cat narratives:reject ".length)).toBe("1 --why 2");
    // And no rejection anywhere needs prose: every reason has a number.
    expect(REJECTION_REASONS.every((_, i) => Number.isInteger(i + 1))).toBe(true);
  });

  // Each CLI run is a cold `bun run` (about 3 s in an index checkout), so three
  // of them overrun bun's 5 s default and fail as a timeout, not on a verdict.
  test("a bad selection says the range rather than acting", () => {
    for (const n of ["0", "99", "x"]) {
      const r = Bun.spawnSync(["bun", "run", join(TOOLS_ROOT, "scripts/narratives.ts"), "confirm", n], { cwd: ROOT });
      expect(r.exitCode).not.toBe(0);
    }
  }, 30_000);

  test("a rejection with no reason is refused at the CLI too", () => {
    const r = Bun.spawnSync(["bun", "run", join(TOOLS_ROOT, "scripts/narratives.ts"), "reject", "1"], { cwd: ROOT });
    expect(r.exitCode).not.toBe(0);
  }, 30_000);
});

describe("an agent cannot record itself as the human — the hole the tool itself opened", () => {
  test("`reviewer()` refuses outside a terminal", () => {
    // Found by DRIVING the CLI, not by reading it. In this container
    // `git config user.name` is "Claude", so the tool wrote
    //   "rejected_by": { "kind": "human", "id": "Claude" }
    // — the agent recorded itself as the human reviewer. The schema could not
    // catch it: a rule about WHO MAY ACT cannot be enforced by a rule about
    // what is written.
    expect(() => reviewer({ interactive: false })).toThrow(/non-interactive/);
  });

  test("the test suite itself has no terminal, which is the point", () => {
    // If this ever reads true under `bun test`, the guard has stopped guarding
    // and every assertion below it is worthless.
    expect(atATerminal()).toBe(false);
  });

  test("a scripted decision must supply the reviewer explicitly", () => {
    // `opts.by` is the caller's assertion and is trusted as such; omitting it
    // falls through to `reviewer()`, which refuses here.
    const root = repo({ x: draft });
    expect(() => decide(queue(root)[0], "confirm", { root })).toThrow(/non-interactive/);
  });

  test("the CLI refuses and leaves the record untouched", () => {
    const root = repo({ x: draft });
    const before = readFileSync(join(root, queue(root)[0].file), "utf-8");
    const r = Bun.spawnSync(["bun", "run", join(TOOLS_ROOT, "scripts/narratives.ts"), "confirm", "1"], { cwd: ROOT });
    expect(r.exitCode).not.toBe(0);
    expect(readFileSync(join(root, queue(root)[0].file), "utf-8")).toBe(before);
  });
});

// ── One narrative per language — bean `cat-tools-e1lo`, stage 2 ──────────
//
// A slot may hold a list, one entry per `lang` (`NarrativeSlotSchema`). The
// queue reads it through `narrativesOfSlot`, so each translation is its own
// item with its own path, and a decision lands on that one entry.

describe("a slot with one narrative per language", () => {
  const en = { ...draft, lang: "en" };
  const fr = { ...draft, text: "Nombre de cas par semaine et par pays.", lang: "fr" };

  test("yields one item per language, each at its own index", () => {
    expect(narrativesIn({ narrative: [en, fr] })).toEqual([
      { path: ["narrative", 0], narrative: en, lang: "en" },
      { path: ["narrative", 1], narrative: fr, lang: "fr" },
    ]);
  });

  test("inside an images sidecar too, keeping the image's id", () => {
    const got = narrativesIn({ images: [{ id: "fig-1", narrative: [en, fr] }] });
    expect(got.map((g) => [g.path, g.subject, g.lang])).toEqual([
      [["images", 0, "narrative", 0], "fig-1", "en"],
      [["images", 0, "narrative", 1], "fig-1", "fr"],
    ]);
  });

  test("a list that breaks the slot rules is skipped, not half-read", () => {
    // Two `fr`: a reviewer would confirm one while the other is shown.
    expect(narrativesIn({ narrative: [fr, { ...fr }] })).toEqual([]);
  });

  test("confirming the French one writes the French one, and the English draft is untouched", () => {
    const root = repo({ alist: [en, fr] });
    const q = queue(root);
    expect(q.map((i) => i.lang)).toEqual(["en", "fr"]);
    decide(q[1]!, "confirm", { by: HUMAN, now: new Date("2026-10-20T00:00:00Z"), root });
    const stored = JSON.parse(readFileSync(join(root, "library", "alist", "tabular.jsonld"), "utf-8")) as {
      narrative: { state: string; lang: string }[];
    };
    expect(stored.narrative.map((n) => [n.lang, n.state])).toEqual([
      ["en", "draft"],
      ["fr", "confirmed"],
    ]);
  });
});
