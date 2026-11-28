/**
 * ChangeSet against a real git fixture: one chapter, two sections, and each
 * kind of change made on the working tree against a committed base.
 */
import { afterEach, describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ChangeSetSchema, ChangeSetTextSchema, compareSnapshots, computeChangeSet, computeWithText, snapshot } from "./changeset.js";

interface Blk {
  slug: string;
  label: string;
  prose?: string;
  renamedFrom?: string[];
}

const block = (b: Blk) =>
  `export default definition({\n  label: "${b.label}",\n` +
  (b.renamedFrom ? `  renamedFrom: [${b.renamedFrom.map((l) => `"${l}"`).join(", ")}],\n` : "") +
  `});\n`;

const chapter = (sections: Record<string, string[]>) =>
  `export default chapter({\n  title: "Ch",\n  sections: [\n` +
  Object.entries(sections)
    .map(([label, slugs]) => `    { title: "${label}", label: "${label}", blocks: [${slugs.map((s) => `"${s}"`).join(", ")}] },\n`)
    .join("") +
  `  ],\n});\n`;

let roots: string[] = [];
afterEach(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
  roots = [];
});

function git(cwd: string, ...args: string[]) {
  return execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], {
    cwd,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

/** A committed folio; returns helpers to edit the working tree. */
function fixture(sections: Record<string, string[]>, blocks: Blk[]) {
  const repo = mkdtempSync(join(tmpdir(), "cs-"));
  roots.push(repo);
  const ch = join(repo, "folio", "ch");
  mkdirSync(ch, { recursive: true });
  const put = (b: Blk) => {
    writeFileSync(join(ch, `${b.slug}.ts`), block(b));
    writeFileSync(join(ch, `${b.slug}.md`), b.prose ?? `Prose of ${b.label}.\n`);
  };
  const layout = (s: Record<string, string[]>) => writeFileSync(join(ch, "ch.ts"), chapter(s));
  layout(sections);
  blocks.forEach(put);
  git(repo, "init", "-q");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "base");
  const base = git(repo, "rev-parse", "HEAD");
  const run = () => computeChangeSet({ repoRoot: repo, folio: "folio", base, head: "worktree" });
  const drop = (slug: string) => {
    unlinkSync(join(ch, `${slug}.ts`));
    unlinkSync(join(ch, `${slug}.md`));
  };
  return { repo, ch, put, layout, run, drop };
}

const ABC: Blk[] = [
  { slug: "a", label: "def:a" },
  { slug: "b", label: "def:b" },
  { slug: "c", label: "def:c" },
  { slug: "d", label: "def:d" },
];
const LAYOUT = { "sec:one": ["a", "b", "c"], "sec:two": ["d"] };

describe("ChangeSet", () => {
  it("noEditsNoChanges", () => {
    const f = fixture(LAYOUT, ABC);
    const cs = f.run();
    expect(cs.changes).toEqual([]);
    expect(cs.summary.unchanged).toBe(4);
    expect(ChangeSetSchema.safeParse(cs).success).toBe(true);
  });

  it("proseEditIsProseOnly", () => {
    const f = fixture(LAYOUT, ABC);
    f.put({ slug: "b", label: "def:b", prose: "Reworded.\n" });
    const [c] = f.run().changes;
    expect(c).toMatchObject({ change: "changed", label: "def:b", aspects: ["prose"] });
  });

  it("topInsertMovesNothing", () => {
    const f = fixture(LAYOUT, ABC);
    f.put({ slug: "z", label: "def:z" });
    f.layout({ "sec:one": ["z", "a", "b", "c"], "sec:two": ["d"] });
    const cs = f.run();
    expect(cs.summary).toMatchObject({ added: 1, changed: 0, moved: 0 });
    expect(cs.changes[0]).toMatchObject({ change: "added", label: "def:z" });
  });

  it("swapMovesExactlyOne", () => {
    const f = fixture(LAYOUT, ABC);
    f.layout({ "sec:one": ["b", "a", "c"], "sec:two": ["d"] });
    const cs = f.run();
    expect(cs.summary.moved).toBe(1);
    expect(cs.changes).toHaveLength(1);
  });

  it("crossSectionMoveHasBothPositions", () => {
    const f = fixture(LAYOUT, ABC);
    f.layout({ "sec:one": ["a", "b"], "sec:two": ["c", "d"] });
    const cs = f.run();
    expect(cs.changes).toHaveLength(1);
    const c = cs.changes[0]!;
    expect(c).toMatchObject({ change: "changed", label: "def:c", aspects: ["moved"] });
    if (c.change !== "changed") throw new Error("unreachable");
    expect(c.base.section).toBe("ch::sec:one");
    expect(c.head.section).toBe("ch::sec:two");
  });

  it("declaredRenameNotManifest", () => {
    const f = fixture(LAYOUT, ABC);
    f.put({ slug: "a", label: "def:a2", renamedFrom: ["def:a"], prose: "Prose of def:a.\n" });
    const cs = f.run();
    expect(cs.changes).toEqual([
      expect.objectContaining({ change: "changed", label: "def:a2", from: "def:a", aspects: ["renamed"] }),
    ]);
  });

  it("undeclaredRenameIsRemoveAdd", () => {
    const f = fixture(LAYOUT, ABC);
    f.put({ slug: "a", label: "def:a2" });
    const kinds = f.run().changes.map((c) => `${c.change}:${c.label}`);
    expect(kinds.sort()).toEqual(["added:def:a2", "removed:def:a"]);
  });

  it("removalReportsBasePosition", () => {
    const f = fixture(LAYOUT, ABC);
    f.drop("d");
    f.layout({ "sec:one": ["a", "b", "c"], "sec:two": [] });
    const cs = f.run();
    expect(cs.changes).toEqual([
      { change: "removed", label: "def:d", base: { file: "ch/d.ts", kind: "definition", section: "ch::sec:two", index: 0 } },
    ]);
  });

  it("unresolvableBaseThrows", () => {
    const f = fixture(LAYOUT, ABC);
    expect(() => computeChangeSet({ repoRoot: f.repo, folio: "folio", base: "no-such-ref" })).toThrow();
  });

  it("absentFolioAllAdditions", () => {
    // Exercises git archive on a path the base does not have: that is an
    // empty base, not an error, because the folio genuinely did not exist.
    const repo = mkdtempSync(join(tmpdir(), "cs-empty-"));
    roots.push(repo);
    writeFileSync(join(repo, "README.md"), "x\n");
    git(repo, "init", "-q");
    git(repo, "add", "-A");
    git(repo, "commit", "-q", "-m", "before the folio");
    const base = git(repo, "rev-parse", "HEAD");
    const ch = join(repo, "folio", "ch");
    mkdirSync(ch, { recursive: true });
    writeFileSync(join(ch, "ch.ts"), chapter({ "sec:one": ["a"] }));
    writeFileSync(join(ch, "a.ts"), block({ slug: "a", label: "def:a" }));
    const cs = computeChangeSet({ repoRoot: repo, folio: "folio", base });
    expect(cs.summary).toMatchObject({ added: 1, removed: 0, changed: 0 });
    expect(compareSnapshots(new Map(), snapshot(join(repo, "folio"))).summary.added).toBe(1);
  });
});

describe("changeset-text (bean d903): what the diff renderers read", () => {
  it("textCarriesChangedSidesOnly", () => {
    const f = fixture(LAYOUT, ABC);
    f.put({ slug: "b", label: "def:b", prose: "Reworded **now**.\n" });
    f.put({ slug: "z", label: "def:z", prose: "New block.\n" });
    f.drop("d");
    f.layout({ "sec:one": ["a", "b", "c", "z"], "sec:two": [] });
    const base = git(f.repo, "rev-parse", "HEAD");
    const { changeset, text } = computeWithText({ repoRoot: f.repo, folio: "folio", base, head: "worktree" }, true);
    expect(ChangeSetTextSchema.safeParse(text).success).toBe(true);
    const t = text!.blocks;
    expect(Object.keys(t).sort()).toEqual(changeset.changes.map((c) => c.label).sort());
    expect(t["def:b"]!.base!.prose).toBe("Prose of def:b.\n");
    expect(t["def:b"]!.head!.html).toContain("<strong>now</strong>");
    expect(t["def:z"]).toEqual({ head: { prose: "New block.\n", html: expect.stringContaining("New block.") } });
    expect(t["def:d"]!.head).toBeUndefined();
    expect(t["def:a"]).toBeUndefined();
  });

  it("tableProseRenderedAsTable", () => {
    const f = fixture(LAYOUT, ABC);
    f.put({ slug: "b", label: "def:b", prose: "| A | B |\n|---|---|\n| 1 | 2 |\n" });
    const base = git(f.repo, "rev-parse", "HEAD");
    const { text } = computeWithText({ repoRoot: f.repo, folio: "folio", base, head: "worktree" }, true);
    const html = text!.blocks["def:b"]!.head!.html;
    expect(html).toContain("<table>");
    expect(html).toContain("<td>2</td>");
    expect(html).not.toContain("|");
  });

  it("renamedBaseReadUnderOldLabel", () => {
    const f = fixture(LAYOUT, ABC);
    f.put({ slug: "b", label: "def:bee", renamedFrom: ["def:b"], prose: "Renamed and reworded.\n" });
    const base = git(f.repo, "rev-parse", "HEAD");
    const { text } = computeWithText({ repoRoot: f.repo, folio: "folio", base, head: "worktree" }, true);
    expect(text!.blocks["def:bee"]!.base!.prose).toBe("Prose of def:b.\n");
    expect(text!.blocks["def:bee"]!.head!.prose).toBe("Renamed and reworded.\n");
  });

  it("changesetOmitsProsePath", () => {
    const f = fixture(LAYOUT, ABC);
    f.put({ slug: "b", label: "def:b", prose: "x\n" });
    expect(JSON.stringify(f.run())).not.toContain("mdPath");
  });
});
