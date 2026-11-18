/**
 * `prose-claims-resolve` — bean `ca4a`, issue #1042 (R3).
 *
 * The property that matters most is the one that keeps this from crying wolf:
 * a claim is FALSE only where this repository can honestly say so, and
 * everything else is UNDETERMINED — counted, never passed.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { claimsEntry, judgePair, resolveCited, rootScripts, type PairClaim } from "../pair-claims";

function repo(): string {
  const root = mkdtempSync(join(tmpdir(), "pair-claims-"));
  mkdirSync(join(root, "cat-harness/schemas"), { recursive: true });
  mkdirSync(join(root, "cat-harness/skills/pkg"), { recursive: true });
  mkdirSync(join(root, "cat-harness/scripts"), { recursive: true });
  mkdirSync(join(root, ".github/workflows"), { recursive: true });
  writeFileSync(join(root, "cat-harness/schemas/types.ts"), "export interface Report { a: number }\n");
  writeFileSync(join(root, "cat-harness/scripts/run-me.ts"), "console.log(1)\n");
  writeFileSync(join(root, "package.json"), JSON.stringify({ scripts: { "kg:audit": "x" } }));
  writeFileSync(join(root, ".github/workflows/w.yml"), "jobs:\n  build:\n    runs-on: x\n");
  return root;
}

const skill = (root: string, md: string) => {
  writeFileSync(join(root, "cat-harness/skills/pkg/s.md"), md);
  writeFileSync(join(root, "cat-harness/skills/pkg/s.ts"), "export {}\n");
  return { kind: "co-located" as const, prose: "cat-harness/skills/pkg/s.md", code: "cat-harness/skills/pkg/s.ts" };
};
const outcomes = (cs: PairClaim[]) => cs.map((c) => `${c.shape}:${c.outcome}`);

describe("resolveCited", () => {
  test("found; missing from an existing directory; or pointing outside", () => {
    const r = repo();
    expect(resolveCited(r, "schemas/types.ts").file).toBeDefined();
    expect(resolveCited(r, "schemas/gone.ts")).toEqual({ knownDir: true });
    expect(resolveCited(r, "content/schema/x.ts")).toEqual({ knownDir: false });
  });

  test("folio-assistant/ is this instance's root, as a folio mounts it", () => {
    expect(resolveCited(repo(), "folio-assistant/schemas/types.ts").file).toBeDefined();
  });
});

describe("judgePair — location", () => {
  test("holds, false-in-known-dir, and undetermined-outside", () => {
    const r = repo();
    const p = skill(r, "`Report` in `schemas/types.ts`. `Missing` in `schemas/types.ts`. `A` in `schemas/gone.ts`. `B` in `content/schema/x.ts`.");
    expect(outcomes(judgePair(r, p, new Set()))).toEqual([
      "location:holds",
      "location:false",
      "location:false",
      "location:undetermined",
    ]);
  });
});

describe("judgePair — bun run", () => {
  test("a known script holds; an unknown one is undetermined, never false", () => {
    const r = repo();
    const p = skill(r, "Run `bun run cat kg:audit` then `bun run validate-refs`.");
    expect(outcomes(judgePair(r, p, new Set(["kg:audit"])))).toEqual(["script:holds", "script:undetermined"]);
  });

  test("a file path holds, is false in a known dir, or undetermined outside", () => {
    const r = repo();
    const p = skill(r, "`bun run cat-harness/scripts/run-me.ts`, `bun run cat-harness/scripts/gone.ts`, `bun run report.ts`.");
    expect(outcomes(judgePair(r, p, new Set()))).toEqual(["file-run:holds", "file-run:false", "file-run:undetermined"]);
  });
});

describe("judgePair — the nodes a workflow's jobs name", () => {
  test("a node the diagram has holds; one it lacks is false", () => {
    const r = repo();
    mkdirSync(join(r, "cat-harness/processes"), { recursive: true });
    mkdirSync(join(r, ".github/workflows"), { recursive: true });
    writeFileSync(join(r, "cat-harness/processes/p.bpmn"), `<bpmn:process id="P"><bpmn:task id="Task_Build"/></bpmn:process>`);
    writeFileSync(
      join(r, ".github/workflows/w.yml"),
      "# bpmn: cat-harness/processes/p.bpmn\njobs:\n  build:\n    # bpmn-node: Task_Build\n  deploy:\n    # bpmn-node: Task_Gone\n",
    );
    const p = { kind: "implements" as const, prose: "cat-harness/processes/p.bpmn", code: ".github/workflows/w.yml" };
    expect(outcomes(judgePair(r, p, new Set()))).toEqual(["job:holds", "job:false"]);
  });
});

describe("claimsEntry — the kg-qa criterion", () => {
  const c = (outcome: PairClaim["outcome"]): PairClaim => ({ shape: "script", subject: "x", outcome });
  test("n/a with nothing parsed; fail on any false; unknown when all undetermined; else pass", () => {
    expect(claimsEntry([]).result).toBe("n/a");
    expect(claimsEntry([c("holds"), c("false")]).result).toBe("fail");
    expect(claimsEntry([c("undetermined"), c("undetermined")]).result).toBe("unknown");
    expect(claimsEntry([c("holds"), c("undetermined")]).result).toBe("pass");
  });
});

describe("rootScripts", () => {
  test("a checkout with no package.json has no scripts, rather than crashing the audit (ho66)", () => {
    // A layer standing alone is its own checkout; the aggregate's package.json
    // is not in it. Throwing here took every `kg:audit` run down standalone.
    const dir = mkdtempSync(join(tmpdir(), "pair-claims-nopkg-"));
    expect(rootScripts(dir).size).toBe(0);
    writeFileSync(join(dir, "package.json"), JSON.stringify({ scripts: { gates: "x" } }));
    expect([...rootScripts(dir)]).toEqual(["gates"]);
  });
});
