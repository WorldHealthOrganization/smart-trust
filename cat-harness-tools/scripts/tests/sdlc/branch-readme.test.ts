/**
 * `branch:readme` — bean `esz4`. The reader is injected, so every verdict is
 * reached without a remote.
 */
import { describe, expect, test } from "bun:test";

import type { FileRead } from "../../branch-store.ts";
import { GENERATED_MARK, renderBranchReadme, verdictFor, type BranchDeclaration } from "../../branch-readme.ts";

const SHA = "3d4caf6e0f1c322b7a976150fe1f237bf36c927f";
const tipManifest = {
  $schema: "state-manifest/v1",
  keyedBy: "tip",
  status: "active",
  authoritative: true,
  subgraph: "beans",
  source: { ref: "main", sha: SHA },
  seededAt: "2026-10-02T22:31:02Z",
  graphs: [{ path: "beans", tree: SHA, files: 3 }],
};
const decl: BranchDeclaration = { instance: "h", id: "beans", path: "beans", graphTypologies: ["beans"], description: "The work plan.", keyedBy: "tip" };

/** A reader over an in-memory branch: path → text, or a whole-branch failure. */
function reader(files: Record<string, string>, fail?: FileRead): (b: string, k: string, p: string) => FileRead {
  return (branch, _k, path) => {
    if (fail) return fail;
    return path in files
      ? { state: "hit", branch, tip: SHA, path, blob: "b", text: files[path]! }
      : { state: "miss", reason: `${path} is not on ${branch}` };
  };
}

describe("renderBranchReadme", () => {
  test("states what a reader cannot recover from the files: status, provenance, writes, declarer", () => {
    const md = renderBranchReadme("cat/h/beans", [decl], tipManifest as never);
    expect(md.startsWith(GENERATED_MARK)).toBe(true);
    expect(md).toContain("**active** — authoritative");
    expect(md).toContain(`from \`main\` at \`${SHA}\``);
    expect(md).toContain("never force-pushed".replace("never", "Never"));
    expect(md).toContain("| `h` | `beans` | `beans` | `beans` | The work plan. |");
  });

  test("is deterministic — the same sources render byte-identical text", () => {
    expect(renderBranchReadme("b", [decl], tipManifest as never)).toBe(renderBranchReadme("b", [decl], tipManifest as never));
  });

  test("a commit-keyed branch with no manifest is described as derived, not as unknown", () => {
    const md = renderBranchReadme("cat/h/qa-reports", [{ ...decl, keyedBy: "commit", id: "qa" }], undefined);
    expect(md).toContain("QA results branch");
    expect(md).toContain("Derived and regenerable");
  });
});

describe("verdictFor", () => {
  test("a README equal to its rendering is CURRENT", () => {
    const rendered = renderBranchReadme("b", [decl], tipManifest as never);
    const v = verdictFor("b", [decl], reader({ "manifest.json": JSON.stringify(tipManifest), "README.md": rendered }));
    expect(v.state).toBe("current");
  });

  test("an absent or hand-written README is STALE, and says which", () => {
    const m = { "manifest.json": JSON.stringify(tipManifest) };
    expect(verdictFor("b", [decl], reader(m))).toMatchObject({ state: "stale", reason: "README.md is absent" });
    expect(verdictFor("b", [decl], reader({ ...m, "README.md": "# b\n" }))).toMatchObject({ state: "stale", reason: "README.md is hand-written" });
  });

  test("a manifest that is not state-manifest/v1 is UNKNOWN — a README is never rendered from a guess", () => {
    const bad = { ...tipManifest, source: { ref: "main", sha: `${SHA}^` } };
    const v = verdictFor("b", [decl], reader({ "manifest.json": JSON.stringify(bad), "README.md": "x" }));
    expect(v.state).toBe("unknown");
    expect("reason" in v && v.reason).toContain("source.sha");
  });

  test("an unreachable branch is UNKNOWN, never stale", () => {
    const v = verdictFor("b", [decl], reader({}, { state: "unknown", reason: "ls-remote failed" }));
    expect(v.state).toBe("unknown");
  });

  test("a family and a Tool-owned branch are set aside by name, not checked", () => {
    expect(verdictFor("cat/x/", [{ ...decl, family: true }], reader({})).state).toBe("family");
    expect(verdictFor("gh-pages", [{ ...decl, keyedBy: "route", tool: "gh-pages" }], reader({})).state).toBe("tool");
  });
});
