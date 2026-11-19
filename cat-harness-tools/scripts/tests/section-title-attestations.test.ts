/**
 * Section-title-audit's verdicts in the attestations store, its sidecar a
 * derived working copy — bean `folio-assistant-5qy8`, the owner's option 1.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SectionTitleAttestationsSchema } from "../../schemas/sdlc/qa-attestations.js";
import {
  derivedCopyPath,
  legacySidecarPath,
  loadVerdicts,
  saveVerdicts,
  slotFor,
  verdictStorePath,
  verdictsInLegacySidecar,
} from "../../pipeline/section-title-attestations.ts";
import { TOOLS_ROOT } from "../lib/roots.ts";

const DIR = mkdtempSync(join(tmpdir(), "section-title-att-"));
afterAll(() => rmSync(DIR, { recursive: true, force: true }));

let n = 0;
/** A content root with one paper and one chapter of two sections. */
function folio(): string {
  const root = join(DIR, `f${n++}`);
  const paper = join(root, "folio", "demo-paper");
  mkdirSync(join(paper, "ch-one"), { recursive: true });
  writeFileSync(join(paper, "demo-paper.ts"), 'export default { title: "Demo", authors: [], chapters: [{ dir: "ch-one" }] };\n');
  writeFileSync(
    join(paper, "ch-one", "ch-one.ts"),
    'export default {\n  title: "A Chapter",\n  sections: [\n' +
      '    { title: "Setting the Scene", label: "sec:scene", blocks: [] },\n' +
      '    { title: "What Follows", label: "sec:next", blocks: [] },\n  ],\n};\n',
  );
  return root;
}

const decided = { title: "Setting the Scene", depth: 1, result: "pass", reviewer: "agent", reviewed_hash: "h1", stale_mode: "manifest" as const };

describe("the store and the legacy sidecar", () => {
  test("a legacy sidecar's DECIDED slots move; pending ones carry no judgement and do not", () => {
    const moved = verdictsInLegacySidecar({
      chapters: {
        "ch-one": {
          agent: {
            "sec:scene": decided,
            "sec:next": { title: "What Follows", depth: 1, result: "pending", reviewer: null, reviewed_hash: null, stale_mode: "manifest" },
          },
        },
      },
    });
    expect(Object.keys(moved["ch-one"]!)).toEqual(["sec:scene"]);
  });

  test("a pre-thorough slot with no stale_mode moves as `manifest`, the mode the writer always read it in", () => {
    const { stale_mode: _drop, ...legacy } = decided;
    const moved = verdictsInLegacySidecar({ chapters: { "ch-one": { agent: { "sec:scene": legacy } } } });
    expect(moved["ch-one"]!["sec:scene"]!.stale_mode).toBe("manifest");
  });

  test("with no store, loadVerdicts reads the legacy sidecar and says how many it moves", () => {
    const root = folio();
    writeFileSync(legacySidecarPath(root, "demo-paper"), JSON.stringify({ chapters: { "ch-one": { agent: { "sec:scene": decided } } } }));
    const r = loadVerdicts(root, "demo-paper");
    expect(r.state).toBe("ok");
    if (r.state === "ok") expect(r.moved).toBe(1);
  });

  test("saved verdicts are a valid section-title attestations file, and read back with nothing to move", () => {
    const root = folio();
    const at = saveVerdicts(root, "demo-paper", { "ch-one": { "sec:scene": decided } });
    expect(at).toBe(verdictStorePath(root, "demo-paper").path);
    expect(SectionTitleAttestationsSchema.safeParse(JSON.parse(readFileSync(at, "utf8"))).success).toBe(true);
    const r = loadVerdicts(root, "demo-paper");
    expect(r.state === "ok" && r.moved === 0 && r.verdicts["ch-one"]!["sec:scene"]!.result === "pass").toBe(true);
  });

  test("FALSIFICATION: a corrupt store refuses — nothing is written over a store that cannot be read", () => {
    const root = folio();
    const { path } = verdictStorePath(root, "demo-paper");
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, "{ not json");
    expect(loadVerdicts(root, "demo-paper").state).toBe("refused");
  });
});

describe("a slot counts a verdict only against the hash it reviewed", () => {
  const node = { title: "Setting the Scene", depth: 1 };
  test("same hash in the verdict's own mode: the verdict", () => {
    expect(slotFor(node, decided, () => "h1", "thorough").result).toBe("pass");
  });
  test("FALSIFICATION: a changed hash re-opens the slot, and shows the stale verdict", () => {
    const s = slotFor(node, decided, () => "h2", "manifest");
    expect(s.result).toBe("pending");
    expect("stale_verdict" in s && s.stale_verdict?.result).toBe("pass");
  });
  test("the verdict's mode picks the hash, not the run's", () => {
    // A manifest-mode verdict under a --thorough run is checked against the
    // manifest hash, so a thorough run does not stale every shallow verdict.
    const s = slotFor(node, decided, (m) => (m === "manifest" ? "h1" : "subtree"), "thorough");
    expect(s.result).toBe("pass");
  });
});

describe("the audit, end to end on a folio", () => {
  const audit = (cwd: string, ...args: string[]) =>
    spawnSync("bun", ["run", join(TOOLS_ROOT, "pipeline/qa-section-title-audit.ts"), ...args], { cwd, encoding: "utf-8", timeout: 90_000 });

  test("--write-sidecar writes the derived copy under test/results/, and commits nothing on main", () => {
    const root = folio();
    const r = audit(root, "--report-only", "--write-sidecar");
    expect(r.status).toBe(0);
    expect(existsSync(derivedCopyPath(root, "demo-paper"))).toBe(true);
    expect(existsSync(legacySidecarPath(root, "demo-paper"))).toBe(false);
    expect(`${r.stdout}`).toContain("0 decided");
  });

  test("--verdict writes the STORE, and the next run carries it until the manifest changes", () => {
    const root = folio();
    audit(root, "--report-only", "--write-sidecar");
    const v = audit(root, "--verdict", "--chapter", "demo-paper/ch-one", "--section", "sec:scene", "--result", "pass", "--reviewer", "agent");
    expect(v.status).toBe(0);
    const store = JSON.parse(readFileSync(verdictStorePath(root, "demo-paper").path, "utf8"));
    expect(SectionTitleAttestationsSchema.safeParse(store).success).toBe(true);

    audit(root, "--report-only", "--write-sidecar");
    const slot = () => JSON.parse(readFileSync(derivedCopyPath(root, "demo-paper"), "utf8")).chapters["ch-one"].agent["sec:scene"];
    expect(slot().result).toBe("pass");

    const m = join(root, "folio", "demo-paper", "ch-one", "ch-one.ts");
    writeFileSync(m, readFileSync(m, "utf8").replace("What Follows", "What Comes Next"));
    audit(root, "--report-only", "--write-sidecar");
    expect(slot().result).toBe("pending");
    expect(slot().stale_verdict.result).toBe("pass");
  });

  test("`pending` is refused as a verdict", () => {
    const root = folio();
    audit(root, "--report-only", "--write-sidecar");
    const v = audit(root, "--verdict", "--chapter", "demo-paper/ch-one", "--section", "sec:scene", "--result", "pending");
    expect(v.status).toBe(2);
  });

  test("FALSIFICATION: an unreadable store is exit 2 — could not determine, never green", () => {
    const root = folio();
    const { path } = verdictStorePath(root, "demo-paper");
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, "{ not json");
    const r = audit(root, "--report-only", "--write-sidecar");
    expect(r.status).toBe(2);
  });
});
