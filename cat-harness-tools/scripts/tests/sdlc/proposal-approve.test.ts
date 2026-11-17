/**
 * Approving a proposal seeds its work plan, and both ends name each other.
 *
 * @module scripts/tests/sdlc/proposal-approve
 *
 * Work item folio-assistant-exrp, plan step 4 (owner 2026-11-05: "Docs/proposals/
 * once approved become workplans"; card: "Proposal seeds plan").
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { approveProposal, frontMatterValue } from "../../proposal-approve.ts";
import { listBeans } from "../../beans-fallback.ts";
import { addTagsInText, proposalPlanFindings, workPlanOf } from "../../../schemas/sdlc/work-plan.ts";

const PROPOSAL = "docs/proposals/p.md";

function checkout(beans: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), "proposal-approve-"));
  mkdirSync(join(root, "beans"), { recursive: true });
  mkdirSync(join(root, "docs/proposals"), { recursive: true });
  writeFileSync(join(root, ".beans.yml"), "beans:\n  path: beans\n  prefix: t-\n  id_length: 4\n");
  writeFileSync(join(root, PROPOSAL), `---\ntitle: "Do the thing"\nkind: proposal\nsummary: >-\n  Why.\n---\n\n# Do the thing\n`);
  for (const [id, fm] of Object.entries(beans)) {
    writeFileSync(join(root, "beans", `${id}--x.md`), `---\n# ${id}\ntitle: ${id}\n${fm}\n---\n\nBody.\n`);
  }
  return root;
}
const tagsOf = (root: string, id: string): string[] => {
  const f = readdirSync(join(root, "beans")).find((n) => n.startsWith(`${id}--`))!;
  const m = /^tags:\n((?:[ \t]+- .*\n)+)/m.exec(readFileSync(join(root, "beans", f), "utf-8"));
  return m ? m[1]!.split("\n").map((l) => l.replace(/^\s*- /, "").trim()).filter(Boolean) : [];
};

describe("proposal:approve", () => {
  test("with no --plan it creates an epic titled as the proposal, and both ends name each other", () => {
    const root = checkout();
    const r = approveProposal({ root, proposal: PROPOSAL, processes: ["Process_ContentLifecycle"], on: "2026-11-05" });
    expect(r.created).toBe(true);
    const epic = listBeans(root).find((b) => b.id === r.plan)!;
    expect(epic.type).toBe("epic");
    expect(epic.title).toBe("Do the thing");
    expect(workPlanOf(tagsOf(root, r.plan))).toEqual({ processes: ["Process_ContentLifecycle"], proposal: PROPOSAL });
    const p = readFileSync(join(root, PROPOSAL), "utf-8");
    expect(frontMatterValue(p, "status")).toBe("approved");
    expect(frontMatterValue(p, "approvedOn")).toBe("2026-11-05");
    expect(frontMatterValue(p, "plan")).toBe(r.plan);
    expect(p).toContain("summary: >-\n  Why.");
    expect(proposalPlanFindings([{ path: PROPOSAL, status: "approved", plan: r.plan }], [{ id: r.plan, tags: tagsOf(root, r.plan) }])).toEqual([]);
  });

  test("with --plan it tags that epic or milestone and keeps its other tags", () => {
    const root = checkout({ "t-goal": "status: todo\ntype: milestone\ntags:\n    - vocabulary" });
    const r = approveProposal({ root, proposal: PROPOSAL, plan: "t-goal", processes: ["P"], on: "2026-11-05" });
    expect(r.created).toBe(false);
    expect(tagsOf(root, "t-goal")).toEqual(["vocabulary", "process:P", `proposal:${PROPOSAL}`]);
  });

  test("refuses what would not be a plan: no process, a feature, an unknown id", () => {
    const root = checkout({ "t-feat": "status: todo\ntype: feature" });
    expect(() => approveProposal({ root, proposal: PROPOSAL, processes: [] })).toThrow(/process it runs/);
    expect(() => approveProposal({ root, proposal: PROPOSAL, plan: "t-feat", processes: ["P"] })).toThrow(/epic or a milestone/);
    expect(() => approveProposal({ root, proposal: PROPOSAL, plan: "t-none", processes: ["P"] })).toThrow(/no work item/);
    expect(readFileSync(join(root, PROPOSAL), "utf-8")).not.toContain("status:");
  });

  test("a dry run writes nothing", () => {
    const root = checkout();
    const r = approveProposal({ root, proposal: PROPOSAL, processes: ["P"], dryRun: true });
    expect(r.tags).toEqual(["process:P", `proposal:${PROPOSAL}`]);
    expect(listBeans(root)).toEqual([]);
    expect(readFileSync(join(root, PROPOSAL), "utf-8")).not.toContain("status:");
  });

  test("approving twice without --plan is refused, naming the plan", () => {
    const root = checkout();
    const r = approveProposal({ root, proposal: PROPOSAL, processes: ["P"] });
    expect(() => approveProposal({ root, proposal: PROPOSAL, processes: ["Q"] })).toThrow(new RegExp(`--plan ${r.plan}`));
  });
});

describe("proposal ↔ plan findings: reported, never fatal", () => {
  test("each way the two ends can disagree", () => {
    const items = [
      { id: "e1", tags: ["process:P", "proposal:docs/proposals/other.md"] },
      { id: "e2", tags: ["proposal:docs/proposals/c.md"] },
    ];
    const f = proposalPlanFindings(
      [
        { path: "docs/proposals/a.md", status: "approved" },
        { path: "docs/proposals/b.md", status: "approved", plan: "e1" },
        { path: "docs/proposals/c.md", status: "approved", plan: "e2" },
        { path: "docs/proposals/d.md", status: "approved", plan: "nope" },
        { path: "docs/proposals/e.md", plan: "e1" },
      ],
      items,
    );
    expect(f.map((x) => x.id)).toEqual(["docs/proposals/a.md", "docs/proposals/b.md", "docs/proposals/c.md", "docs/proposals/d.md"]);
    expect(f[0]!.problem).toContain("names no plan");
    expect(f[1]!.problem).toContain("`docs/proposals/other.md`");
    expect(f[2]!.problem).toContain("not a work plan yet");
    expect(f[3]!.problem).toContain("not a work item");
  });
});

describe("adding tags keeps the rest of the file", () => {
  test("extends the sequence, creates it after type:, never repeats a tag", () => {
    const a = "---\n# x\ntitle: T\ntype: epic\ntags:\n    - a\ncreated_at: z\n---\n\nbody\n";
    expect(addTagsInText(a, ["b", "a", "b"])).toBe("---\n# x\ntitle: T\ntype: epic\ntags:\n    - a\n    - b\ncreated_at: z\n---\n\nbody\n");
    expect(addTagsInText("---\n# x\ntype: epic\n---\nbody\n", ["p"])).toBe("---\n# x\ntype: epic\ntags:\n    - p\n---\nbody\n");
    expect(addTagsInText(a, ["a"])).toBe(a);
  });
});

describe("--check reads every proposal against the store", () => {
  test("an approved proposal with no plan is found; one approved through the command is not", async () => {
    const { checkProposals } = await import("../../proposal-approve.ts");
    const root = checkout();
    writeFileSync(join(root, "docs/proposals/q.md"), "---\ntitle: Q\nstatus: approved\n---\n");
    writeFileSync(join(root, "docs/proposals", "README.md"), "---\ngenerated: x\n---\n");
    approveProposal({ root, proposal: PROPOSAL, processes: ["P"] });
    const r = checkProposals(root, "docs/proposals");
    expect(r.proposals).toBe(2);
    expect(r.findings.map((f) => f.id)).toEqual(["docs/proposals/q.md"]);
  });
});
