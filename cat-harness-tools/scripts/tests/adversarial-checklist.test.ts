import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";

import {
  ADVERSARIAL_CHECKLISTS,
  ADVERSARIAL_CONTENT_KINDS,
  ALL_ADVERSARIAL_CHECKLIST_ITEMS,
  AdversarialChecklistItemSchema,
  getChecklistForKind,
  isAdversarialContentKind,
  PROCESS_ADVERSARIAL_CHECKLIST,
  SCHEMA_ADVERSARIAL_CHECKLIST,
  SKILL_ADVERSARIAL_CHECKLIST,
  TOOL_ADVERSARIAL_CHECKLIST,
  type AdversarialContentKind,
} from "../../schemas/sdlc/adversarial-checklist.ts";
import {
  executeBackfillBatch,
  GATE_PATH_NODES,
  gatherCandidateNodes,
  rankCandidateNodes,
  resolveSidecarPath,
  reviewAttestationPath,
  reviewNodeAdversarially,
} from "../adversarial-backfill.ts";
import {
  adversarialCoverageByGraph,
  asRecord,
  coverage,
} from "../audit-coverage.ts";
import { AdversarialReviewSchema } from "../../schemas/sdlc/red-flag.ts";
import { NOT_DISCLOSED } from "@litlfred/bootstrap-tools/schemas/model-registry.js";
import { repoRootFor } from "../../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";

const ROOT = resolve(HARNESS_ROOT);
const REPO = repoRootFor(ROOT);

describe("Adversarial Checklist Definitions (schemas/sdlc/adversarial-checklist.ts)", () => {
  it("defines checklists for all four content kinds", () => {
    expect(ADVERSARIAL_CONTENT_KINDS).toEqual(["tool", "schema", "skill", "process"]);
    for (const kind of ADVERSARIAL_CONTENT_KINDS) {
      expect(ADVERSARIAL_CHECKLISTS[kind]).toBeDefined();
      expect(ADVERSARIAL_CHECKLISTS[kind].length).toBeGreaterThan(0);
    }
  });

  it("validates every item against AdversarialChecklistItemSchema", () => {
    for (const item of ALL_ADVERSARIAL_CHECKLIST_ITEMS) {
      const parsed = AdversarialChecklistItemSchema.safeParse(item);
      expect(parsed.success).toBe(true);
    }
  });

  it("retrieves checklists by kind via getChecklistForKind", () => {
    expect(getChecklistForKind("tool")).toBe(TOOL_ADVERSARIAL_CHECKLIST);
    expect(getChecklistForKind("schema")).toBe(SCHEMA_ADVERSARIAL_CHECKLIST);
    expect(getChecklistForKind("skill")).toBe(SKILL_ADVERSARIAL_CHECKLIST);
    expect(getChecklistForKind("process")).toBe(PROCESS_ADVERSARIAL_CHECKLIST);
    // @ts-expect-error test invalid kind
    expect(getChecklistForKind("unknown")).toEqual([]);
  });

  it("validates kind strings with isAdversarialContentKind", () => {
    expect(isAdversarialContentKind("tool")).toBe(true);
    expect(isAdversarialContentKind("schema")).toBe(true);
    expect(isAdversarialContentKind("skill")).toBe(true);
    expect(isAdversarialContentKind("process")).toBe(true);
    expect(isAdversarialContentKind("doc")).toBe(false);
    expect(isAdversarialContentKind(null)).toBe(false);
    expect(isAdversarialContentKind(123)).toBe(false);
  });

  it("tool checklist extends code-node-review with expected rules", () => {
    for (const item of TOOL_ADVERSARIAL_CHECKLIST) {
      expect(item.kind).toBe("tool");
      expect(item.extendsSource).toBe("code-node-review");
    }
    const ids = TOOL_ADVERSARIAL_CHECKLIST.map((i) => i.id);
    expect(ids).toContain("tool-description-fidelity");
    expect(ids).toContain("tool-unknown-on-failure");
    expect(ids).toContain("tool-side-effects-declared");
    expect(ids).toContain("tool-deletion-guarded");
  });

  it("schema checklist extends code-node-review with expected rules", () => {
    for (const item of SCHEMA_ADVERSARIAL_CHECKLIST) {
      expect(item.kind).toBe("schema");
      expect(item.extendsSource).toBe("code-node-review");
    }
    const ids = SCHEMA_ADVERSARIAL_CHECKLIST.map((i) => i.id);
    expect(ids).toContain("schema-field-readers");
    expect(ids).toContain("schema-enums-closed");
    expect(ids).toContain("schema-docstring-fidelity");
    expect(ids).toContain("schema-backwards-compatible");
  });

  it("skill checklist extends devils-advocate-watcher with expected rules", () => {
    for (const item of SKILL_ADVERSARIAL_CHECKLIST) {
      expect(item.kind).toBe("skill");
      expect(item.extendsSource).toBe("devils-advocate-watcher");
    }
    const ids = SKILL_ADVERSARIAL_CHECKLIST.map((i) => i.id);
    expect(ids).toContain("skill-narrative-asserts-code");
    expect(ids).toContain("skill-no-contradiction");
    expect(ids).toContain("skill-no-prose-counts");
    expect(ids).toContain("skill-no-unasked-irreversible-action");
  });

  it("process checklist extends kg-audit with expected rules", () => {
    for (const item of PROCESS_ADVERSARIAL_CHECKLIST) {
      expect(item.kind).toBe("process");
      expect(item.extendsSource).toBe("kg-audit");
    }
    const ids = PROCESS_ADVERSARIAL_CHECKLIST.map((i) => i.id);
    expect(ids).toContain("process-gateway-branches");
    expect(ids).toContain("process-no-context-write");
    expect(ids).toContain("process-diagram-workflow-fidelity");
  });
});

describe("Adversarial Backfill & Risk-Ranking (scripts/adversarial-backfill.ts)", () => {
  it("specifies the 5 critical gate-path nodes in mandatory order", () => {
    expect(GATE_PATH_NODES).toHaveLength(5);
    expect(GATE_PATH_NODES.map((n) => n.id)).toEqual([
      "gates",
      "merge-base",
      "regen-after-merge",
      "merge-conflict-patterns",
      "kg-qa",
    ]);
  });

  // Walks the whole repository for fan-in, so it runs near the 5s default on CI (5.2s on #1227); same budget as the coverage walks below.
  it("ranks the 5 critical gate-path nodes first in risk ranking", () => {
    const candidates = gatherCandidateNodes(ROOT);
    expect(candidates.length).toBeGreaterThanOrEqual(5);

    const ranked = rankCandidateNodes(candidates, ROOT);
    expect(ranked.length).toBeGreaterThanOrEqual(5);

    const top5Ids = ranked.slice(0, 5).map((r) => r.id);
    expect(top5Ids).toEqual([
      "gates",
      "merge-base",
      "regen-after-merge",
      "merge-conflict-patterns",
      "kg-qa",
    ]);
  }, 30_000);

  it("reviews a node adversarially producing valid AdversarialReview", () => {
    const testNode = {
      id: "test-gates",
      kind: "tool" as AdversarialContentKind,
      path: "scripts/gates.ts",
      sourceHash: "abc123456789",
    };
    const { review, findings, durationMs, tokens } = reviewNodeAdversarially(testNode, ROOT);

    expect(durationMs).toBeGreaterThanOrEqual(0);
    expect(tokens).toBeGreaterThan(0);
    const parsed = AdversarialReviewSchema.safeParse(review);
    expect(parsed.success).toBe(true);
    expect(review.coverage.files_reviewed).toBe(1);
    expect(review.flags).toHaveLength(findings.filter((f) => f.weight === "blocking").length);
  });

  it("records the declared not-disclosed model, never a hard-coded id (owner E1, 2026-10-15)", () => {
    const { review } = reviewNodeAdversarially(
      { id: "test-gates", kind: "tool" as AdversarialContentKind, path: "scripts/gates.ts", sourceHash: "abc123456789" },
      ROOT,
    );
    expect(review.reviewer.model).toBe(NOT_DISCLOSED);
    expect(review.reviewer.session).toBeTruthy();
  });

  it("detects known defect pattern in review (narrative asserts code)", () => {
    const badSkillNode = {
      id: "bad-skill",
      kind: "skill" as AdversarialContentKind,
      path: "skills/bad-skill.md",
      sourceHash: "111222333444",
    };
    // A scratch root holding a skill whose narrative quotes the known-broken
    // command, and the same skill with the command corrected.
    const root = mkdtempSync(join(tmpdir(), "adv-defect-"));
    try {
      mkdirSync(join(root, "skills"), { recursive: true });
      const file = join(root, badSkillNode.path);
      writeFileSync(file, "# Bad skill\n\nStart the work with `beans <id> --status in-progress`.\n");
      const { review, findings } = reviewNodeAdversarially(badSkillNode, root);
      expect(review.result).toBe("fail");
      expect(findings.map((f) => f.id)).toEqual(["adv-bad-skill-skill-narrative-asserts-code"]);
      expect(review.flags.map((f) => f.where)).toEqual(["skills/bad-skill.md:command-invocation"]);
      expect(AdversarialReviewSchema.safeParse(review).success).toBe(true);

      writeFileSync(file, "# Bad skill\n\nStart the work with `beans update <id> --status in-progress`.\n");
      const fixed = reviewNodeAdversarially(badSkillNode, root);
      expect(fixed.review.result).toBe("pass");
      expect(fixed.findings).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("never passes a node whose file does not exist, nor counts it as reviewed", () => {
    const root = mkdtempSync(join(tmpdir(), "adv-missing-"));
    try {
      const node = {
        id: "ghost",
        kind: "tool" as AdversarialContentKind,
        path: "scripts/ghost.ts",
        sourceHash: "000000000000",
      };
      expect(existsSync(join(root, node.path))).toBe(false);
      const { review, findings } = reviewNodeAdversarially(node, root);
      expect(review.result).not.toBe("pass");
      expect(review.result).toBe("unknown");
      expect(review.coverage.files_reviewed).toBe(0);
      expect(review.coverage.skipped).toEqual([{ path: "scripts/ghost.ts", why: "file does not exist" }]);
      expect(findings).toEqual([]);
      expect(AdversarialReviewSchema.safeParse(review).success).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  // Walks the whole repository for fan-in, so it runs near the 5s default on CI (5.2s on #1227); same budget as the coverage walks below.
  it("executes backfill batch writing to sidecars and NEVER creates beans", () => {
    const beansDir = join(ROOT, "beans", "defs");
    const beanFilesBefore = existsSync(beansDir) ? readdirSync(beansDir) : [];

    const candidates = gatherCandidateNodes(ROOT);
    // The batch WRITES. Its sidecars go to a scratch tree, never the real
    // cat-harness results tree: written there, `merge-base` (a gate-path node
    // that is no cat-harness Tool) became a verdict about another layer's
    // subject, and `kg-audit-foreign-subjects` failed whenever the two test
    // files shared a shard. The nodes are still READ from the real checkout.
    const scratch = mkdtempSync(join(tmpdir(), "adv-backfill-"));
    try {
      const ranked = rankCandidateNodes(candidates, ROOT).map((n) => ({
        ...n,
        sidecarPath: join(scratch, relative(ROOT, n.sidecarPath)),
      }));
      const report = executeBackfillBatch(ranked, { repoRoot: ROOT, limit: 2 });

      expect(report.nodesReviewed).toBe(2);
      expect(report.totalEstimatedTokens).toBeGreaterThan(0);
      expect(report.measurements).toHaveLength(2);

      // Verify sidecars were written, and only into the scratch tree
      for (const m of report.measurements) {
        expect(m.sidecarPath.startsWith(scratch + sep)).toBe(true);
        expect(existsSync(m.sidecarPath)).toBe(true);
      }
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }

    // Verify NO new beans were created in beans/defs/
    const beanFilesAfter = existsSync(beansDir) ? readdirSync(beansDir) : [];
    expect(beanFilesAfter.length).toBe(beanFilesBefore.length);
  }, 30_000);
});

describe("Audit Coverage Adversarial Integration (scripts/audit-coverage.ts)", () => {
  it("adversarialCoverageByGraph reports reviewed for kinds with reviewed sidecars", () => {
    const advMap = adversarialCoverageByGraph(REPO, ROOT);
    // `schemas` is not asserted: its one adversarially reviewed sidecar,
    // `schemas/kg-qa`, was removed as dead with the owner's authorisation
    // (cat-harness 4f72623f), so no schemas review is left to restore
    // (cat-harness d37c20c4). The two that were restored are asserted.
    expect(advMap.get("tools")).toBe("reviewed");
    expect(advMap.get("skills")).toBe("reviewed");
  }, 30_000);

  it("KindCoverage rows include adversarial column with valid states", () => {
    const { rows } = coverage(REPO);
    expect(rows.length).toBeGreaterThan(0);

    const validStates = new Set(["reviewed", "stale", "never"]);
    for (const row of rows) {
      expect(validStates.has(row.adversarial)).toBe(true);
    }

    const toolsRow = rows.find((r) => r.kind === "tools");
    expect(toolsRow?.adversarial).toBe("reviewed");

    // `schemas`: see the test above — no reviewed schemas sidecar is left.

    const skillsRow = rows.find((r) => r.kind === "skills");
    expect(skillsRow?.adversarial).toBe("reviewed");

    const docsRow = rows.find((r) => r.kind === "docs");
    expect(docsRow?.adversarial).toBe("never");
  });

  it("asRecord preserves adversarial coverage state", () => {
    const { rows } = coverage(REPO);
    const toolsRow = rows.find((r) => r.kind === "tools");
    expect(toolsRow).toBeDefined();

    // What the name says: the record carries the row's state, whichever it is.
    // It asserted "reviewed", which held only while the backfill test above
    // wrote a reviewed sidecar into the REAL cat-harness tree before it ran.
    const record = asRecord(toolsRow!);
    expect(["reviewed", "stale", "never"]).toContain(toolsRow!.adversarial);
    expect(record.adversarial).toBe(toolsRow!.adversarial);
    expect(record).not.toHaveProperty("files");
    expect(record).not.toHaveProperty("sidecars");
    expect(record.hasFiles).toBe(true);
  });
});

describe("Adversarial reviews in the attestation store (D2 (a), cat-harness#857)", () => {
  const review = {
    reviewer: { by: "agent", session: "session_test", model: NOT_DISCLOSED },
    author_sessions: [],
    skill_hash: "hash:adversarial-checklist:v1",
    at: "2026-10-31T00:00:00.000Z",
    coverage: { files_total: 1, files_reviewed: 1, skipped: [] },
    result: "pass",
    flags: [],
    findings: [],
  };
  const withStore = (pinned: (current: string) => string, fn: (root: string) => void): void => {
    const root = mkdtempSync(join(tmpdir(), "adv-store-"));
    try {
      mkdirSync(join(root, "skills"), { recursive: true });
      writeFileSync(join(root, "skills", "s.md"), "# a skill\n");
      const current = createHash("sha256").update(readFileSync(join(root, "skills", "s.md"))).digest("hex").slice(0, 12);
      const file = join(root, "test", "attestations", "adversarial-review", "skills", "s.attestations.json");
      mkdirSync(join(file, ".."), { recursive: true });
      writeFileSync(
        file,
        JSON.stringify({
          $schema: "qa-attestations/v1",
          family: "adversarial-review",
          subject: { kind: "skill", id: "s", path: "skills/s.md" },
          adversarial_reviews: [review],
          source_hash: pinned(current),
        }),
      );
      // No `test/results/` at all: the derived tree is not committed.
      expect(existsSync(join(root, "test", "results"))).toBe(false);
      fn(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  };

  it("counts a committed review as reviewed when its pinned hash is current", () => {
    withStore((c) => c, (root) => {
      expect(adversarialCoverageByGraph(root, root).get("skills")).toBe("reviewed");
    });
  });

  it("counts a committed review as stale when the subject changed since", () => {
    withStore(() => "000000000000", (root) => {
      expect(adversarialCoverageByGraph(root, root).get("skills")).toBe("stale");
    });
  });

  it("resolveSidecarPath derives the post-#1014 sdlc skill path from the store and marks reviewed sdlc skills as reviewed in --rank", () => {
    const skillNode = GATE_PATH_NODES.find((n) => n.kind === "skill")!;
    expect(skillNode).toBeDefined();

    const oldPre1014Sidecar = join(ROOT, "test", "results", "kg-qa", "skills", "sdlc", "sdlc-core", `${skillNode.id}.kg-qa.json`);
    const derivedSidecar = resolveSidecarPath(skillNode, ROOT);

    expect(derivedSidecar).not.toBe(oldPre1014Sidecar);
    expect(derivedSidecar).toBe(join(ROOT, "test", "results", "kg-qa", "sdlc", "skills", "sdlc-core", `${skillNode.id}.kg-qa.json`));

    const oldAtt = reviewAttestationPath(oldPre1014Sidecar, ROOT);
    const derivedAtt = reviewAttestationPath(derivedSidecar, ROOT);
    expect(oldAtt).toBeDefined();
    expect(derivedAtt).toBeDefined();
    // Fails on the old pre-#1014 path and passes on the derived one.
    expect(existsSync(oldAtt!.file)).toBe(false);
    expect(existsSync(derivedAtt!.file)).toBe(true);

    const ranked = rankCandidateNodes(gatherCandidateNodes(ROOT), ROOT);
    const rankedSkill = ranked.find((r) => r.id === skillNode.id);
    expect(rankedSkill).toBeDefined();
    expect(rankedSkill!.hasReview).toBe(true);
    expect(rankedSkill!.isStale).toBe(false);
  }, 30_000);
});
