import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { igChangeSet, kramdownId, openPrFor, splitPage, writeReviewData } from "./ig-review-data.ts";

describe("kramdownId: the id Jekyll gives a heading", () => {
  test("kramdownIdsAsPublished", () => {
    expect(kramdownId("Children")).toBe("children");
    expect(kramdownId("Women of child-bearing age (15 to 49 years)")).toBe("women-of-child-bearing-age-15-to-49-years");
    expect(kramdownId("Messages to caregivers (Ministry of Health poster)")).toBe("messages-to-caregivers-ministry-of-health-poster");
    expect(kramdownId("2. Scope")).toBe("scope");
  });
});

describe("splitPage", () => {
  test("splitPageAtHeadings", () => {
    const parts = splitPage("Intro.\n\n### Notes\nA\n```\n# not a heading\n```\n### Notes\nB\n");
    expect(parts.map((p) => p.id)).toEqual(["_top", "notes", "notes-1"]);
    expect(parts[1]!.text).toContain("# not a heading");
  });
});

describe("igChangeSet: the default branch against the working tree", () => {
  const git = (d: string, ...a: string[]) => spawnSync("git", ["-C", d, ...a], { encoding: "utf-8" });
  const repo = (): string => {
    const d = mkdtempSync(join(tmpdir(), "ig-review-"));
    git(d, "init", "-q", "-b", "main");
    git(d, "config", "user.email", "t@example.org");
    git(d, "config", "user.name", "t");
    mkdirSync(join(d, "input", "pagecontent"), { recursive: true });
    mkdirSync(join(d, "input", "cql"), { recursive: true });
    writeFileSync(join(d, "sushi-config.yaml"), "id: x\n");
    writeFileSync(join(d, "input", "pagecontent", "schedule.md"), "Ages.\n\n### Children\n| 10 years | HPV |\n{:.grid}\n\n### Women\nTd\n");
    writeFileSync(join(d, "input", "cql", "Logic.cql"), "define Due: birthDate + 10 years\n");
    writeFileSync(join(d, "input", "book.xlsx"), Buffer.from([0x50, 0x4b, 0, 1]));
    git(d, "add", "-A");
    git(d, "commit", "-qm", "base");
    return d;
  };
  const plain = (md: string) => `<p>${md}</p>`;

  test("changeSetSectionsLogicWorkbook", () => {
    const d = repo();
    writeFileSync(join(d, "input", "pagecontent", "schedule.md"), "Ages.\n\n### Children\n| 9 years | HPV |\n{:.grid}\n\n### Women\nTd\n");
    writeFileSync(join(d, "input", "cql", "Logic.cql"), "define Due: birthDate + 9 years\n");
    writeFileSync(join(d, "input", "book.xlsx"), Buffer.from([0x50, 0x4b, 0, 2]));
    writeFileSync(join(d, "input", "pagecontent", "new.md"), "### Added\nx\n");
    const r = igChangeSet({ ig: d, base: "main", render: plain });
    expect(r.changeset.changes.map((c) => [c.change, c.label])).toEqual([
      ["added", "new/added"],
      ["changed", "schedule/children"],
      ["changed", "input/book.xlsx"],
      ["changed", "input/cql/Logic.cql"],
    ]);
    const children = r.changeset.changes[1]!;
    expect(children.change === "changed" && children.head).toMatchObject({ page: "schedule.html", anchor: "children", section: "pages::schedule" });
    const book = r.changeset.changes[2]!;
    expect(book.change === "changed" && book.aspects).toEqual(["manifest"]);
    expect(r.text.blocks["input/book.xlsx"]).toEqual({});
    expect(r.text.blocks["schedule/children"]!.head!.prose).toContain("9 years");
    // The kramdown attribute line is Jekyll's, so it is not rendered as text.
    expect(r.text.blocks["schedule/children"]!.head!.html).not.toContain("{:.grid}");
    expect(r.changeset.summary).toMatchObject({ added: 1, changed: 3, removed: 0, unchanged: 3, prose: 2, manifest: 1 });
  });

  test("outlinePagesThenSources", () => {
    const d = repo();
    writeFileSync(join(d, "sushi-config.yaml"), "id: x\ntitle: \"Uganda Immunizations\"\n");
    const r = igChangeSet({ ig: d, base: "main", render: plain });
    const doc = r.outline.documents[0]!;
    expect(doc).toMatchObject({ slug: "input", title: "Uganda Immunizations", page: "index.html" });
    expect(doc.chapters.map((c) => c.title)).toEqual(["Pages", "Sources"]);
    expect(doc.chapters[0]!.sections).toEqual([{ key: "pages::schedule", title: "Children", blocks: ["schedule/_top", "schedule/children", "schedule/women"] }]);
    expect(doc.chapters[1]!.sections.map((s) => s.key)).toEqual(["sources::.", "sources::input", "sources::input/cql"]);
    // Every key the ChangeSet uses is one the outline has, so its badges find a row.
    const keys = new Set(doc.chapters.flatMap((c) => c.sections.map((s) => s.key)));
    for (const c of r.changeset.changes) expect(keys.has((c.change === "removed" ? c.base : c.head).section)).toBe(true);
  });

  test("impactNamesPagesAndAnchors", () => {
    const d = repo();
    writeFileSync(join(d, "input", "pagecontent", "schedule.md"), "Ages.\n\n### Children\n| 9 years | HPV |\n{:.grid}\n");
    writeFileSync(join(d, "input", "cql", "Logic.cql"), "define Due: birthDate + 9 years\n");
    writeFileSync(join(d, "input", "pagecontent", "new.md"), "### Added\nx\n");
    writeFileSync(join(d, "sushi-config.yaml"), "id: y\n");
    const r = igChangeSet({ ig: d, base: "main", render: plain });
    expect(r.impact).toMatchObject({ $schema: "rendered-impact/v1", method: "cone", renderer: "fhir-ig-pages" });
    expect(r.impact.files).toEqual([
      { path: "new.html", change: "added", role: "content", via: ["input/pagecontent/new.md"], anchors: ["added"] },
      // "women" was removed: its id is gone from the page, so it is no anchor.
      { path: "schedule.html", change: "changed", role: "content", via: ["input/pagecontent/schedule.md"], anchors: ["children"] },
    ]);
    expect(r.impact.undetermined).toEqual([
      { input: "input/cql/Logic.cql", reason: expect.stringContaining("IG Publisher"), scope: "unknown" },
      { input: "sushi-config.yaml", reason: expect.stringContaining("any rendered page"), scope: "all" },
    ]);
  });

  test("unchangedTreeDeterminedEmpty", () => {
    const d = repo();
    const r = igChangeSet({ ig: d, base: "main", render: plain });
    expect(r.changeset.changes).toEqual([]);
    const site = join(d, "_site");
    writeReviewData(site, r);
    expect(JSON.parse(readFileSync(join(site, "changeset.json"), "utf-8")).$schema).toBe("folio-changeset/v1");
    expect(JSON.parse(readFileSync(join(site, "changeset-text.json"), "utf-8")).$schema).toBe("folio-changeset-text/v1");
    expect(JSON.parse(readFileSync(join(site, "rendered-impact.json"), "utf-8"))).toMatchObject({ $schema: "rendered-impact/v1", files: [], undetermined: [] });
    expect(JSON.parse(readFileSync(join(site, "outline.json"), "utf-8")).documents).toHaveLength(1);
  });
});

describe("openPrFor: the PR a preview's banner names (bean zvl0)", () => {
  const reply = (body: unknown, ok = true) => (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;

  test("prFromEventPayload", async () => {
    const dir = mkdtempSync(join(tmpdir(), "zvl0-"));
    const ev = join(dir, "event.json");
    writeFileSync(ev, JSON.stringify({ pull_request: { number: 12, html_url: "https://github.com/o/r/pull/12" } }));
    const pr = await openPrFor("o/r", "b", { env: { GITHUB_EVENT_PATH: ev }, fetch: (() => { throw new Error("no call expected"); }) as unknown as typeof fetch });
    expect(pr).toEqual({ number: "12", url: "https://github.com/o/r/pull/12" });
  });

  test("prFromApiForBranch", async () => {
    let asked = "";
    const f = (async (u: string) => {
      asked = u;
      return { ok: true, json: async () => [{ number: 12, html_url: "https://github.com/o/r/pull/12" }] };
    }) as unknown as typeof fetch;
    const pr = await openPrFor("o/r", "feat/x", { env: { GITHUB_EVENT_PATH: "/nonexistent" }, fetch: f });
    expect(pr).toEqual({ number: "12", url: "https://github.com/o/r/pull/12" });
    expect(asked).toBe("https://api.github.com/repos/o/r/pulls?state=open&head=o%3Afeat%2Fx");
  });

  test("noPrNeverGuess", async () => {
    expect(await openPrFor("o/r", "b", { env: {}, fetch: reply([]) })).toBeNull();
    expect(await openPrFor("o/r", "b", { env: {}, fetch: reply({ message: "rate limited" }, false) })).toBeNull();
    expect(await openPrFor("o/r", "b", { env: {}, fetch: (async () => { throw new Error("offline"); }) as unknown as typeof fetch })).toBeNull();
  });
});
