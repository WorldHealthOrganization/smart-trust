/**
 * Agent summaries of prose blocks — the QA sidecar drained during ingestion.
 *
 * Owner, 2026-09-24: *"on library/ page, the extract of a node is shown, but
 * no agentic summary"*; *"Make as QA sidecar as part of general doc ingestion
 * to slowly drain."*
 *
 * What is proved here, each against a fixture built at test time:
 * the sidecar validates and refuses records that mean nothing; a changed
 * source reads as STALE; an agent cannot write `confirmed`; the queue leaves
 * out blocks with a current summary; the viewer carries the extract AND the
 * summary; and — against the real corpus — the backlog is not vacuous and
 * equals prose blocks minus summarised ones, counted by a walk that shares no
 * code with the queue.
 *
 * @module scripts/tests/block-summaries
 */
import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { existsSync, readFileSync, readdirSync } from "../../test/support/site-fs.ts";
import { overlayPath } from "../lib/layer-output.ts";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

import { siteDirFor } from "../../schemas/kg/cat-harness.ts";
import { corpusDirectoriesForGraph as directoriesForGraph } from "../../schemas/kg/harness-config.ts";
import {
  BlockSummariesSidecarSchema,
  SUMMARIES_FILE,
  sourceHash,
  summaryStatus,
  type BlockSummary,
} from "../../schemas/content/block-summary.ts";
import { NarrativeSchema } from "../../schemas/content/narrative.ts";
import { backlog, entryDirs, entryItems, langBacklog, next, record, sidecarDefects, summaryLocales, tally } from "../summaries.ts";
import { decide, queue } from "../narratives.ts";
import { checkEntry } from "../check-l1-complete.ts";
import { readEntryBlocks } from "../library-graph.ts";
import { writeDeclaration } from "../../test/support/instance-fixture.js";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { siteNotBuilt } from "../../test/support/checkout.ts";

const ROOT = resolve(HARNESS_ROOT);
const AGENT = { kind: "agent" as const, id: "claude-code", model: "test-model" };
const HUMAN = { kind: "human" as const, id: "litlfred" };
const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A library with one entry `doc` holding the given prose sections (name -> body). */
function fixture(sections: Record<string, string>): { root: string; entry: string } {
  const root = mkdtempSync(join(tmpdir(), "sum-"));
  made.push(root);
  writeDeclaration(root, {
    name: "fixture",
    directories: [{ id: "library", path: "library", graphTypologies: ["library"] }],
  });
  const entry = join(root, "library", "doc");
  mkdirSync(join(entry, "blocks"), { recursive: true });
  mkdirSync(join(entry, "sections"), { recursive: true });
  let page = 1;
  for (const [name, body] of Object.entries(sections)) {
    writeFileSync(join(entry, "sections", `${name}.md`), `---\ntitle: ${name}\n---\n${body}\n`);
    writeFileSync(
      join(entry, "blocks", `prose-${name}.jsonld`),
      JSON.stringify({
        "@id": `library/doc/blocks/prose-${name}`,
        "@type": ["folio-assistant-core:Prose", "doco:Section"],
        kind: "prose",
        title: name,
        pageStart: page++,
        text: `../sections/${name}.md`,
        provenance: "ingested",
      }),
    );
  }
  return { root, entry };
}

const id = (name: string) => `library/doc/blocks/prose-${name}`;

function draftFor(root: string, names: string[], text = "A short summary.") {
  const items = new Map(backlog(root).map((i) => [i.block, i]));
  return {
    drafted_by: AGENT,
    drafted_at: "2026-09-24",
    drafts: names.map((n) => ({ block: id(n), source_hash: items.get(id(n))!.hash!, text })),
  };
}

describe("the sidecar validates, and refuses records that mean nothing", () => {
  const rec = (over: Partial<BlockSummary> = {}): BlockSummary => ({
    block: "library/doc/blocks/prose-a",
    source: "sections/a.md",
    source_hash: "a".repeat(64),
    narrative: [{ text: "x", lang: "en", state: "draft", drafted_by: AGENT }],
    ...over,
  });
  const doc = (summaries: unknown[]) => ({ $schema: "folio-block-summaries/v1", entry: "doc", summaries });

  test("a draft by an agent naming its model validates", () => {
    expect(BlockSummariesSidecarSchema.safeParse(doc([rec()])).success).toBe(true);
  });

  test("an empty slot is refused — no record already means not summarised", () => {
    expect(BlockSummariesSidecarSchema.safeParse(doc([rec({ narrative: { text: null, state: "not-authored" } })])).success).toBe(false);
  });

  test("two records for one block are refused", () => {
    expect(BlockSummariesSidecarSchema.safeParse(doc([rec(), rec()])).success).toBe(false);
  });

  test("the hash is a full sha256", () => {
    expect(BlockSummariesSidecarSchema.safeParse(doc([rec({ source_hash: "abc" })])).success).toBe(false);
  });

  test("an agent draft with no model is refused — inherited from the attribution schema", () => {
    const n = [{ text: "x", lang: "en", state: "draft", drafted_by: { kind: "agent", id: "c" } }];
    expect(BlockSummariesSidecarSchema.safeParse(doc([{ ...rec(), narrative: n }])).success).toBe(false);
  });

  test("every committed summaries.json validates", () => {
    const files = entryDirs(ROOT).map((d) => join(d, SUMMARIES_FILE)).filter((f) => existsSync(f));
    // Not vacuous: the first drain wrote one.
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const r = BlockSummariesSidecarSchema.safeParse(JSON.parse(readFileSync(f, "utf-8")));
      expect(r.success, f).toBe(true);
    }
  });
});

describe("a changed source reads as STALE, not as right", () => {
  test("editing the section's text marks its summary stale and puts it back in the queue", () => {
    const { root, entry } = fixture({ a: "Alpha text.", b: "Beta text." });
    record(draftFor(root, ["a", "b"]), root);
    expect(backlog(root)).toHaveLength(0);

    writeFileSync(join(entry, "sections", "a.md"), "---\ntitle: a\n---\nAlpha text, revised.\n");
    const status = new Map(entryItems(entry).map((i) => [i.block, i.status]));
    expect(status.get(id("a"))).toBe("stale");
    expect(status.get(id("b"))).toBe("draft");
    expect(backlog(root).map((i) => i.block)).toEqual([id("a")]);
  });

  test("a front-matter-only edit is NOT a change of text", () => {
    const { root, entry } = fixture({ a: "Alpha text." });
    record(draftFor(root, ["a"]), root);
    writeFileSync(join(entry, "sections", "a.md"), "---\ntitle: a renamed\n---\nAlpha text.\n");
    expect(entryItems(entry)[0]!.status).toBe("draft");
  });

  test("summaryStatus compares the hash — the mutation target", () => {
    // Mutation-checked by hand: removing the `source_hash !== bodyHash(body)`
    // line in summaryStatus turns this `stale` into `draft` and fails here.
    const narrative = { text: "x", state: "draft" as const, drafted_by: AGENT };
    const rec = { block: "b", source: "s", source_hash: sourceHash("old"), narrative };
    expect(summaryStatus(rec, "old")).toBe("draft");
    expect(summaryStatus(rec, "new")).toBe("stale");
    expect(summaryStatus({ ...rec, narrative: { ...narrative, state: "confirmed", confirmed_by: HUMAN } }, "new")).toBe("stale");
    expect(summaryStatus(undefined, "x")).toBe("not-summarised");
    expect(summaryStatus(undefined, null)).toBe("unreadable");
    expect(summaryStatus(undefined, "")).toBe("empty");
  });

  test("the review queue shows a stale draft as stale, and refuses to confirm it", () => {
    const { root, entry } = fixture({ a: "Alpha text." });
    record(draftFor(root, ["a"]), root);
    writeFileSync(join(entry, "sections", "a.md"), "---\n---\nChanged.\n");
    const items = queue(root).filter((q) => q.file.endsWith(SUMMARIES_FILE));
    expect(items).toHaveLength(1);
    expect(items[0]!.stale).toBe(true);
    expect(() => decide(items[0]!, "confirm", { by: HUMAN, root })).toThrow(/STALE/);
  });

  test("decide re-checks freshness even when the listing said fresh", () => {
    const { root, entry } = fixture({ a: "Alpha text." });
    record(draftFor(root, ["a"]), root);
    const [item] = queue(root).filter((q) => q.file.endsWith(SUMMARIES_FILE));
    expect(item!.stale).toBeUndefined();
    writeFileSync(join(entry, "sections", "a.md"), "---\n---\nChanged after listing.\n");
    expect(() => decide(item!, "confirm", { by: HUMAN, root })).toThrow(/STALE/);
  });

  test("a fresh draft IS confirmable by a person, and then leaves the backlog as confirmed", () => {
    const { root, entry } = fixture({ a: "Alpha text." });
    record(draftFor(root, ["a"]), root);
    const [item] = queue(root).filter((q) => q.file.endsWith(SUMMARIES_FILE));
    expect(decide(item!, "confirm", { by: HUMAN, root }).state).toBe("confirmed");
    expect(entryItems(entry)[0]!.status).toBe("confirmed");
  });
});

describe("an agent cannot write `confirmed`", () => {
  test("record refuses a draft that claims any state but draft", () => {
    const { root } = fixture({ a: "Alpha." });
    const f = draftFor(root, ["a"]);
    for (const state of ["confirmed", "rejected"]) {
      expect(() => record({ ...f, drafts: f.drafts.map((d) => ({ ...d, state })) }, root)).toThrow(/only a person/);
    }
    expect(existsSync(join(root, "library", "doc", SUMMARIES_FILE))).toBe(false);
  });

  test("the schema refuses a confirmation by an agent", () => {
    const n = { text: "x", state: "confirmed", drafted_by: AGENT, confirmed_by: AGENT };
    expect(NarrativeSchema.safeParse(n).success).toBe(false);
  });

  test("record writes drafts only, and only for an agent naming its model", () => {
    const { root } = fixture({ a: "Alpha." });
    const f = draftFor(root, ["a"]);
    expect(() => record({ ...f, drafted_by: HUMAN }, root)).toThrow(/AGENT/);
    expect(() => record({ ...f, drafted_by: { kind: "agent", id: "x" } as never }, root)).toThrow(/model/);
    record(f, root);
    const doc = JSON.parse(readFileSync(join(root, "library", "doc", SUMMARIES_FILE), "utf-8"));
    // A one-entry list naming its language, the form the store was migrated to (e1lo).
    expect(doc.summaries[0].narrative).toHaveLength(1);
    expect(doc.summaries[0].narrative[0].state).toBe("draft");
    expect(doc.summaries[0].narrative[0].lang).toBe("en");
    expect(doc.summaries[0].narrative[0].drafted_by.model).toBe("test-model");
  });

  test("record stores the language a draft names, else the file's, else en (e1lo)", () => {
    const langOf = (f: Parameters<typeof record>[0], root: string) => {
      record(f, root);
      return JSON.parse(readFileSync(join(root, "library", "doc", SUMMARIES_FILE), "utf-8")).summaries[0].narrative[0].lang;
    };
    const a = fixture({ a: "Alpha." });
    const fa: Parameters<typeof record>[0] = { ...draftFor(a.root, ["a"]), lang: "fr" };
    expect(langOf(fa, a.root)).toBe("fr");
    const b = fixture({ a: "Alpha." });
    const fb = draftFor(b.root, ["a"]);
    expect(langOf({ ...fb, lang: "fr", drafts: fb.drafts.map((d) => ({ ...d, lang: "pt-BR" })) }, b.root)).toBe("pt-BR");
    const c = fixture({ a: "Alpha." });
    const fc: Parameters<typeof record>[0] = { ...draftFor(c.root, ["a"]), lang: "not a tag" };
    expect(() => record(fc, c.root)).toThrow();
  });

  test("record refuses a hash that no longer matches — it summarised something else", () => {
    const { root, entry } = fixture({ a: "Alpha." });
    const f = draftFor(root, ["a"]);
    writeFileSync(join(entry, "sections", "a.md"), "---\n---\nMoved on.\n");
    expect(() => record(f, root)).toThrow(/source_hash/);
  });

  test("record is all-or-nothing", () => {
    const { root } = fixture({ a: "Alpha.", b: "Beta." });
    const f = draftFor(root, ["a", "b"]);
    f.drafts[1]!.source_hash = "0".repeat(64);
    expect(() => record(f, root)).toThrow();
    expect(existsSync(join(root, "library", "doc", SUMMARIES_FILE))).toBe(false);
  });
});

describe("the queue leaves out blocks that already have a current summary", () => {
  test("drafted and confirmed are out; not-summarised, stale and rejected are in", () => {
    const { root } = fixture({ a: "A.", b: "B.", c: "C." });
    expect(backlog(root)).toHaveLength(3);
    record(draftFor(root, ["a", "b"]), root);
    expect(backlog(root).map((i) => i.block)).toEqual([id("c")]);

    const item = queue(root).find((q) => q.subject === "prose-b")!;
    decide(item, "reject", { by: HUMAN, reason: "too vague to be useful", root });
    expect(backlog(root).map((i) => i.block).sort()).toEqual([id("b"), id("c")]);
    // The rejection reason travels to the next drafter.
    expect(next(root, { n: 5 }).find((n) => n.block === id("b"))?.rejected?.reason).toBe("too vague to be useful");
  });

  test("redrafting a rejected block keeps the rejection under `superseded`", () => {
    const { root, entry } = fixture({ a: "A." });
    record(draftFor(root, ["a"]), root);
    decide(queue(root)[0]!, "reject", { by: HUMAN, reason: "wrong", root });
    record(draftFor(root, ["a"], "A better summary."), root);
    const [rec] = JSON.parse(readFileSync(join(entry, SUMMARIES_FILE), "utf-8")).summaries;
    expect(rec.narrative[0].state).toBe("draft");
    expect(rec.superseded[0].rejection_reason).toBe("wrong");
  });

  test("a current draft is never overwritten by another", () => {
    const { root } = fixture({ a: "A." });
    const f = draftFor(root, ["a"]);
    record(f, root);
    expect(() => record(f, root)).toThrow(/already has a current draft/);
  });

  test("a draft in another language is added beside a current summary, which is kept (e1lo)", () => {
    const { root, entry } = fixture({ a: "A." });
    // Built while the block is still in the backlog, which is where draftFor reads its hash.
    const fr = { ...draftFor(root, ["a"], "Un résumé en français."), lang: "fr" };
    record(draftFor(root, ["a"], "An English summary."), root);
    decide(queue(root)[0]!, "confirm", { by: HUMAN, root });
    record(fr, root);
    const [rec] = JSON.parse(readFileSync(join(entry, SUMMARIES_FILE), "utf-8")).summaries;
    expect(rec.narrative.map((n: { lang: string; state: string }) => `${n.lang}:${n.state}`)).toEqual(["en:confirmed", "fr:draft"]);
    expect(rec.superseded).toBeUndefined();
    // The same language again is still refused, so nothing is overwritten.
    expect(() => record(fr, root)).toThrow(/already has a current .* in "fr"/);
    // The block is not back in the backlog.
    expect(backlog(root)).toHaveLength(0);
  });

  test("--lang serves summarised blocks missing that language, with their current summaries (e1lo)", () => {
    const { root, entry } = fixture({ a: "A.", b: "B.", c: "C." });
    const fr = { ...draftFor(root, ["a"], "Un résumé."), lang: "fr" };
    record(draftFor(root, ["a", "b"], "A summary."), root);
    // c has no summary at all: it is in the summary backlog, not the translation one.
    expect(langBacklog(root, "fr").map((i) => i.block)).toEqual([id("a"), id("b")]);
    const [n] = next(root, { n: 1, lang: "fr" });
    expect(n?.lang).toBe("fr");
    expect(n?.summaries).toEqual({ en: "A summary." });
    record(fr, root);
    expect(langBacklog(root, "fr").map((i) => i.block)).toEqual([id("b")]);
    expect(langBacklog(root, "en")).toHaveLength(0);
    // The plain queue is unchanged by translations.
    expect(backlog(root).map((i) => i.block)).toEqual([id("c")]);
    // With no translation config, the six UN languages are owed.
    expect(summaryLocales(entry).sort()).toEqual(["ar", "en", "es", "fr", "ru", "zh"]);
  });

  test("an empty section is not prose to summarise, and not backlog", () => {
    const { root, entry } = fixture({ a: "A.", e: "" });
    expect(entryItems(entry).find((i) => i.block === id("e"))?.status).toBe("empty");
    expect(backlog(root).map((i) => i.block)).toEqual([id("a")]);
    expect(tally(entryItems(entry))).toMatchObject({ prose: 1, empty: 1, backlog: 1 });
  });
});

describe("semantic QA: what the schema cannot see", () => {
  test("a record for a block that is not there is a broken reference, and the L1 gate says so", () => {
    const { root, entry } = fixture({ a: "A." });
    record(draftFor(root, ["a"]), root);
    const doc = JSON.parse(readFileSync(join(entry, SUMMARIES_FILE), "utf-8"));
    doc.summaries[0].block = id("gone");
    writeFileSync(join(entry, SUMMARIES_FILE), JSON.stringify(doc));
    expect(sidecarDefects(entry)[0]).toMatch(/no such prose block/);
    expect(checkEntry(entry).requirements.find((r) => r.name === "block-summaries")?.state).toBe("unmet");
  });

  test("a sidecar naming another entry is a defect", () => {
    const { root, entry } = fixture({ a: "A." });
    record(draftFor(root, ["a"]), root);
    const doc = JSON.parse(readFileSync(join(entry, SUMMARIES_FILE), "utf-8"));
    writeFileSync(join(entry, SUMMARIES_FILE), JSON.stringify({ ...doc, entry: "other" }));
    expect(sidecarDefects(entry)[0]).toMatch(/names entry "other"/);
  });

  test("a backlog is advisory: met, with the count in the detail", () => {
    const { entry } = fixture({ a: "A.", b: "B." });
    const r = checkEntry(entry).requirements.find((q) => q.name === "block-summaries")!;
    expect(r.state).toBe("met");
    expect(r.detail).toMatch(/backlog 2/);
  });
});

describe("the viewer carries the extract AND the summary", () => {
  test("a summarised prose block projects both, and an unsummarised one says so", () => {
    const { root, entry } = fixture({ a: "Alpha text in full.", b: "Beta." });
    record(draftFor(root, ["a"], "Alpha, summarised."), root);
    const blocks = readEntryBlocks(entry);
    const a = blocks.find((b) => b.id === id("a"))!;
    expect(a.content).toBe("Alpha text in full.");
    expect(a.summary?.text).toBe("Alpha, summarised.");
    expect(a.summary?.status).toBe("draft");
    expect(a.summary?.draftedBy).toEqual({ kind: "agent", id: "claude-code", model: "test-model" });
    const b = blocks.find((x) => x.id === id("b"))!;
    expect(b.content).toBe("Beta.");
    expect(b.summary).toEqual({ status: "not-summarised" });
  });

  const DRAINED = join(ROOT, siteDirFor(ROOT), "assets", "library", "entries", "arxiv-2312.07755v1.json");
  // Standing alone the entry projection is not built: `library:viz` writes it
  // at publish, and `assets/library/` is gitignored (bean w1gy F18).
  test.skipIf(
    siteNotBuilt("the drained entry's library projection `library:viz` writes at publish (gitignored)", DRAINED),
  )("the committed projection of the drained entry carries both", () => {
    const f = DRAINED;
    const blocks = JSON.parse(readFileSync(f, "utf-8")).blocks as { kind: string; content: string | null; summary: { text?: string } | null }[];
    const both = blocks.filter((b) => b.kind === "prose" && b.content && b.summary?.text);
    expect(both.length).toBeGreaterThan(0);
  });
});

describe("the real backlog — not vacuous, and it adds up", () => {
  /**
   * Prose blocks and current summaries counted by WALKING THE FILES, sharing
   * no code with `summaries.ts`: two derivations that agree is evidence.
   */
  function walk(): { prose: number; summarised: number } {
    let prose = 0;
    let summarised = 0;
    // A library its owner holds back (bean x80s) is not backlog. Read from the
    // owner's declaration file directly, sharing no code with summaries.ts.
    // An entry can be held on its own (`heldEntries`, bean `j7ql`).
    const ownerEntry = (lib: string): { summaries?: string; heldEntries?: string[] } | undefined => {
      const owner = dirname(resolve(lib));
      // The layer's declaration, or — for a library declared from within a
      // named sub-graph, as cat-harness's corpus is — that sub-graph's `graph.json`.
      const decl = [join(owner, `${basename(owner)}.json`), join(owner, "graph.json")].find((f) => existsSync(f));
      if (decl === undefined) return undefined;
      const dirs = (JSON.parse(readFileSync(decl, "utf-8")).directories ?? []) as {
        path: string;
        summaries?: string;
        heldEntries?: string[];
      }[];
      return dirs.find((d) => resolve(owner, d.path) === resolve(lib));
    };
    const heldByOwner = (lib: string): boolean => ownerEntry(lib)?.summaries === "held";
    for (const lib of directoriesForGraph(ROOT, "library").filter((d) => existsSync(d) && !heldByOwner(d))) {
      const heldHere = new Set(ownerEntry(lib)?.heldEntries ?? []);
      // An entry is `<slug>/` or, filed by concern group since bean `6fez`,
      // `<group>/<slug>/`; a hold names the slug wherever it is filed.
      const entries: string[] = [];
      for (const top of readdirSync(lib)) {
        if (existsSync(join(lib, top, "blocks"))) entries.push(top);
        else if (statSync(overlayPath(join(lib, top))).isDirectory())
          for (const sub of readdirSync(join(lib, top))) if (existsSync(join(lib, top, sub, "blocks"))) entries.push(join(top, sub));
      }
      for (const rel of entries) {
        if (heldHere.has(basename(rel))) continue;
        const blocksDir = join(lib, rel, "blocks");
        const sc = join(lib, rel, SUMMARIES_FILE);
        const recs = new Map<string, { source_hash: string; narrative: { state: string } | { state: string }[] }>(
          existsSync(sc) ? JSON.parse(readFileSync(sc, "utf-8")).summaries.map((r: { block: string }) => [r.block, r]) : [],
        );
        for (const f of readdirSync(blocksDir)) {
          // A block is a `.jsonld` node (`.json` before the JSON-LD rename);
          // the `.md` beside it is a block's text, not a block. The library
          // tally reads the same files (summaries.ts `entryItems`).
          if (!f.endsWith(".jsonld") && !f.endsWith(".json")) continue;
          const b = JSON.parse(readFileSync(join(blocksDir, f), "utf-8"));
          if (b.kind !== "prose" || typeof b.text !== "string") continue;
          const md = readFileSync(join(blocksDir, b.text), "utf-8");
          const body = md.replace(/^---[\s\S]*?---\n/, "").trim();
          if (body === "") continue;
          prose++;
          const r = recs.get(b["@id"]);
          const h = createHash("sha256").update(body).digest("hex");
          if (r && r.source_hash === h && [r.narrative].flat().every((n) => n.state === "draft" || n.state === "confirmed")) summarised++;
        }
      }
    }
    return { prose, summarised };
  }

  test("backlog > 0 and backlog === prose - summarised", () => {
    const t = tally(entryDirs(ROOT).flatMap((d) => entryItems(d)));
    const w = walk();
    expect(t.backlog).toBeGreaterThan(0);
    expect(t.prose).toBe(w.prose);
    expect(t.summarised).toBe(w.summarised);
    expect(t.backlog).toBe(w.prose - w.summarised);
    expect(backlog(ROOT)).toHaveLength(t.backlog);
    // The first drain is on disk.
    expect(w.summarised).toBeGreaterThan(0);
  });
});

describe("a library whose owner holds summaries back (bean x80s)", () => {
  test("is named as held, and the drain never offers its blocks", async () => {
    const { heldLibraries, next } = await import("../summaries.ts");
    const held = heldLibraries(ROOT);
    // The owner's 2026-09-24 decision, declared on agent-skills' library and
    // carried per entry when that corpus dissolved into cat-harness's (bean j7ql).
    // Filed by concern group since bean `6fez` (`library/conduct/<slug>`).
    expect(held.some((d) => d.endsWith("/arxiv-2607.25032v1"))).toBe(true);
    for (const b of next(ROOT, { n: 10_000 })) {
      expect(held.some((d) => d.endsWith(`/${b.entry}`) || existsSync(join(d, b.entry)))).toBe(false);
    }
    expect(entryDirs(ROOT).some((e) => held.some((d) => e === d || e.startsWith(d + "/")))).toBe(false);
  });
});
