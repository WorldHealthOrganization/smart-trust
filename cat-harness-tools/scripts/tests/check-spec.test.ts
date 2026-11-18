import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, resolve } from "node:path";
import {
  extractClarificationMarkers,
  extractH2Sections,
  isStatusAdjudicated,
  loadDeclaredSpecTemplate,
  validateSpec,
} from "../../schemas/sdlc/spec-template.ts";
import {
  DEFAULT_TEMPLATE_PATH,
  checkSpecBeforeCode,
  parseBeanDefinition,
  type FetchResult,
} from "../check-spec.ts";

describe("spec-template — declared artefact and section extraction", () => {
  test("loadDeclaredSpecTemplate loads mandatory sections from declared template markdown", () => {
    const templatePath = resolve(DEFAULT_TEMPLATE_PATH);
    const declared = loadDeclaredSpecTemplate(templatePath);
    expect(declared.mandatorySections).toContain("User Scenarios & Testing");
    expect(declared.mandatorySections).toContain("Requirements");
    expect(declared.mandatorySections).toContain("Success Criteria");
    expect(declared.metadataFields).toContain("Feature Branch");
    expect(declared.metadataFields).toContain("Status");
  });

  test("extractH2Sections extracts clean section titles without markdown decorations", () => {
    const text = `
# Feature Specification: Test Feature

## User Scenarios & Testing *(mandatory)*
Content here.

## Edge Cases
Content here.

## Requirements *(mandatory)*
Content here.
`;
    const sections = extractH2Sections(text);
    expect(sections).toEqual([
      "User Scenarios & Testing",
      "Edge Cases",
      "Requirements",
    ]);
  });
});

describe("validateSpec — mandatory sections and naming missing ones (SC-003)", () => {
  const completeSpec = `
# Feature Specification: Example Feature

**Feature Branch**: \`claude/example\`
**Created**: 2026-10-07
**Status**: Draft
**Issue**: #100

## User Scenarios & Testing *(mandatory)*

### P1 — Core journey
Given x, When y, Then z.

## Edge Cases
None.

## Requirements *(mandatory)*
- FR-001: System must work.

## Success Criteria *(mandatory)*
- SC-001: 100% of tests pass.

## Assumptions
Assumption 1.
`;

  test("a spec containing all mandatory sections passes validation", () => {
    const result = validateSpec(completeSpec);
    expect(result.state).toBe("pass");
    expect(result.findings).toEqual([]);
    expect(result.missingSections).toEqual([]);
    expect(result.status).toBe("Draft");
  });

  test("a spec missing 'Success Criteria' fails and explicitly names the missing section", () => {
    const missingSc = `
# Feature Specification: Example Feature

**Feature Branch**: \`claude/example\`
**Created**: 2026-10-07
**Status**: Draft
**Issue**: #100

## User Scenarios & Testing *(mandatory)*
Given x, When y, Then z.

## Requirements *(mandatory)*
- FR-001: System must work.
`;
    const result = validateSpec(missingSc);
    expect(result.state).toBe("fail");
    expect(result.missingSections).toContain("Success Criteria");
    expect(result.findings.some((f) => f.includes('missing mandatory section: "Success Criteria"'))).toBe(true);
  });

  test("a spec missing 'Requirements' fails and explicitly names the missing section", () => {
    const missingReq = `
# Feature Specification: Example Feature

**Feature Branch**: \`claude/example\`
**Created**: 2026-10-07
**Status**: Draft

## User Scenarios & Testing *(mandatory)*
Given x, When y, Then z.

## Success Criteria *(mandatory)*
- SC-001: Pass.
`;
    const result = validateSpec(missingReq);
    expect(result.state).toBe("fail");
    expect(result.missingSections).toContain("Requirements");
  });

  test("a spec missing 'User Scenarios & Testing' fails and explicitly names it", () => {
    const missingScenarios = `
# Feature Specification: Example Feature

**Status**: Draft

## Requirements *(mandatory)*
- FR-001: Pass.

## Success Criteria *(mandatory)*
- SC-001: Pass.
`;
    const result = validateSpec(missingScenarios);
    expect(result.state).toBe("fail");
    expect(result.missingSections).toContain("User Scenarios & Testing");
  });
});

describe("validateSpec — unresolved [NEEDS CLARIFICATION] markers (SC-004)", () => {
  test("extractClarificationMarkers extracts all clarification markers", () => {
    const text = `
Some text with [NEEDS CLARIFICATION: threshold value] and another [NEEDS CLARIFICATION].
`;
    const markers = extractClarificationMarkers(text);
    expect(markers.length).toBe(2);
    expect(markers[0]).toBe("[NEEDS CLARIFICATION: threshold value]");
    expect(markers[1]).toBe("[NEEDS CLARIFICATION]");
  });

  test("unresolved clarification markers are permitted in Draft status", () => {
    const draftWithMarker = `
# Feature Specification: Example Feature

**Status**: Draft

## User Scenarios & Testing *(mandatory)*
Test.

## Requirements *(mandatory)*
FR-001: Do something [NEEDS CLARIFICATION: what to do].

## Success Criteria *(mandatory)*
SC-001: Done.
`;
    const result = validateSpec(draftWithMarker);
    expect(result.state).toBe("pass");
    expect(result.unresolvedClarifications.length).toBe(1);
    expect(result.isAdjudicated).toBe(false);
  });

  test("unresolved clarification markers BLOCK reaching Adjudicated status (SC-004)", () => {
    const adjudicatedWithMarker = `
# Feature Specification: Example Feature

**Status**: Adjudicated

## User Scenarios & Testing *(mandatory)*
Test.

## Requirements *(mandatory)*
FR-001: Do something [NEEDS CLARIFICATION: what to do].

## Success Criteria *(mandatory)*
SC-001: Done.
`;
    const result = validateSpec(adjudicatedWithMarker);
    expect(result.state).toBe("fail");
    expect(result.isAdjudicated).toBe(true);
    expect(result.findings.some((f) => f.includes("unresolved [NEEDS CLARIFICATION] marker(s)"))).toBe(true);
  });

  test("requireAdjudicated option enforces that markers are resolved even if status is not explicit", () => {
    const spec = `
# Feature Specification: Example Feature

**Status**: WIP

## User Scenarios & Testing *(mandatory)*
Test.

## Requirements *(mandatory)*
FR-001: Do something [NEEDS CLARIFICATION: pending decision].

## Success Criteria *(mandatory)*
SC-001: Done.
`;
    const result = validateSpec(spec, { requireAdjudicated: true });
    expect(result.state).toBe("fail");
    expect(result.findings.some((f) => f.includes("unresolved [NEEDS CLARIFICATION] marker(s)"))).toBe(true);
  });
});

describe("isStatusAdjudicated", () => {
  test("recognizes adjudicated status keywords", () => {
    expect(isStatusAdjudicated("Adjudicated")).toBe(true);
    expect(isStatusAdjudicated("Approved")).toBe(true);
    expect(isStatusAdjudicated("Accepted by BA")).toBe(true);
    expect(isStatusAdjudicated("Completed")).toBe(true);
  });

  test("recognizes non-adjudicated status keywords", () => {
    expect(isStatusAdjudicated("Draft")).toBe(false);
    expect(isStatusAdjudicated("WIP")).toBe(false);
    expect(isStatusAdjudicated("Under Review")).toBe(false);
    expect(isStatusAdjudicated(undefined)).toBe(false);
  });
});

/**
 * Run the real CLI (`--spec-before-code --issue 730`) with a stand-in `gh` on
 * PATH, so the exit code the titles name is the one the process returns. The
 * stand-in prints `stdout` and exits `status`, the two things
 * `fetchIssueComments` reads from the real one.
 */
function runSpecBeforeCodeCli(gh: { stdout: string; status: number }): number | null {
  const bin = mkdtempSync(resolve(tmpdir(), "check-spec-gh-"));
  try {
    writeFileSync(resolve(bin, "gh.out"), gh.stdout);
    const stub = resolve(bin, "gh");
    writeFileSync(stub, `#!/bin/sh\ncat "${resolve(bin, "gh.out")}"\nexit ${gh.status}\n`);
    chmodSync(stub, 0o755);
    const res = spawnSync(
      process.execPath,
      [resolve(import.meta.dir, "../check-spec.ts"), "--spec-before-code", "--issue", "730"],
      { encoding: "utf-8", env: { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH ?? ""}` } },
    );
    return res.status;
  } finally {
    rmSync(bin, { recursive: true, force: true });
  }
}

describe("checkSpecBeforeCode — spec-before-code gate (Child 3 / issue #753)", () => {
  const validSpecText = `
# Feature Specification: Test Feature

**Feature Branch**: \`claude/test\`
**Created**: 2026-10-09
**Status**: Draft
**Issue**: #730

## User Scenarios & Testing *(mandatory)*
Given a feature request, When spec-before-code runs, Then it verifies the spec.

## Requirements *(mandatory)*
- FR-001: Spec must exist before code.

## Success Criteria *(mandatory)*
- SC-001: 100% of feature beans have valid spec comments.
`;

  const invalidSpecTextMissingReq = `
# Feature Specification: Test Feature

**Feature Branch**: \`claude/test\`
**Created**: 2026-10-09
**Status**: Draft

## User Scenarios & Testing *(mandatory)*
Scenario.

## Success Criteria *(mandatory)*
- SC-001: Pass.
`;

  test("passing case: returns state pass when referenced issue carries a valid spec comment", () => {
    const mockFetch = (_issueNum: number): FetchResult => ({
      state: "ok",
      content: validSpecText,
    });

    const res = checkSpecBeforeCode(730, { fetchComments: mockFetch });
    expect(res.state).toBe("pass");
    expect(res.findings).toEqual([]);
    expect(res.issueNumber).toBe(730);
    expect(res.specResult?.state).toBe("pass");
    // The same input through the CLI exits 0: the stand-in `gh` reaches the
    // gate, so the non-zero exits below are the gate's and not the harness's.
    expect(runSpecBeforeCodeCli({ stdout: JSON.stringify([{ body: validSpecText }]), status: 0 })).toBe(0);
  });

  test("failing case: missing spec comment on issue reports a finding, not silence (exit 1)", () => {
    const mockFetch = (_issueNum: number): FetchResult => ({
      state: "ok",
      content: undefined,
    });

    const res = checkSpecBeforeCode(730, { fetchComments: mockFetch });
    expect(res.state).toBe("finding");
    expect(res.findings.length).toBeGreaterThan(0);
    expect(res.findings[0]).toContain("carries no reachable spec comment");
    expect(runSpecBeforeCodeCli({ stdout: "[]", status: 0 })).toBe(1);
  });

  test("failing case: invalid spec comment (missing mandatory section) reports a finding (exit 1)", () => {
    const mockFetch = (_issueNum: number): FetchResult => ({
      state: "ok",
      content: invalidSpecTextMissingReq,
    });

    const res = checkSpecBeforeCode(730, { fetchComments: mockFetch });
    expect(res.state).toBe("finding");
    expect(res.findings.length).toBeGreaterThan(0);
    expect(res.findings.some((f) => f.includes('missing mandatory section: "Requirements"'))).toBe(true);
    expect(
      runSpecBeforeCodeCli({ stdout: JSON.stringify([{ body: invalidSpecTextMissingReq }]), status: 0 }),
    ).toBe(1);
  });

  test("failing case: spec with unresolved [NEEDS CLARIFICATION] when requireAdjudicated reports a finding", () => {
    const specWithClarification = `
# Feature Specification: Test Feature

**Status**: Draft

## User Scenarios & Testing *(mandatory)*
Journey.

## Requirements *(mandatory)*
FR-001: Do work [NEEDS CLARIFICATION: exact behavior].

## Success Criteria *(mandatory)*
SC-001: Done.
`;
    const mockFetch = (): FetchResult => ({
      state: "ok",
      content: specWithClarification,
    });

    const res = checkSpecBeforeCode(730, {
      fetchComments: mockFetch,
      requireAdjudicated: true,
    });
    expect(res.state).toBe("finding");
    expect(res.findings.some((f) => f.includes("unresolved [NEEDS CLARIFICATION] marker(s)"))).toBe(true);
  });

  test("could-not-determine case: unreachable issue reports unknown (exit 2)", () => {
    const mockFetch = (_issueNum: number): FetchResult => ({
      state: "unknown",
      reason: "API rate limit exceeded or network down",
    });

    const res = checkSpecBeforeCode(730, { fetchComments: mockFetch });
    expect(res.state).toBe("unknown");
    expect(res.reason).toContain("could not determine");
    expect(res.reason).toContain("failed to fetch comments for issue #730");
    expect(runSpecBeforeCodeCli({ stdout: "", status: 1 })).toBe(2);
  });

  test("feature bean with referenced issue carrying a valid spec passes", () => {
    const beanContent = `---
# folio-assistant-4kq7
title: 'Feature test'
type: feature
status: todo
---

Issue: https://github.com/litlfred/folio-assistant/issues/730
`;
    const mockFetch = (_issueNum: number): FetchResult => ({
      state: "ok",
      content: validSpecText,
    });

    const res = checkSpecBeforeCode({
      beanPath: beanContent,
      fetchComments: mockFetch,
    });
    expect(res.state).toBe("pass");
    expect(res.issueNumber).toBe(730);
    expect(res.beanInfo?.type).toBe("feature");
    expect(res.beanInfo?.id).toBe("folio-assistant-4kq7");
  });

  test("feature bean with NO referenced issue reports a finding (breach is not silent)", () => {
    const beanContentNoIssue = `---
# folio-assistant-9999
title: 'Unlinked feature'
type: feature
status: in-progress
---

Some description without any issue link.
`;
    const res = checkSpecBeforeCode({ beanPath: beanContentNoIssue });
    expect(res.state).toBe("finding");
    expect(res.findings.length).toBeGreaterThan(0);
    expect(res.findings[0]).toContain("carries no reference to a governing issue");
  });

  test("non-feature bean (type: task) passes without requiring a spec", () => {
    const taskBean = `---
# folio-assistant-1234
title: 'Maintenance task'
type: task
status: todo
---

Just a chore.
`;
    const res = checkSpecBeforeCode({ beanPath: taskBean });
    expect(res.state).toBe("pass");
    expect(res.reason).toContain("type 'task'");
  });
});

describe("parseBeanDefinition — bean metadata & issue extraction", () => {
  test("extracts issue from body github url", () => {
    const raw = `---
# folio-assistant-4kq7
title: 'Adopt spec-kit'
type: feature
---

Issue: https://github.com/litlfred/folio-assistant/issues/730
`;
    const info = parseBeanDefinition(raw);
    expect(info.id).toBe("folio-assistant-4kq7");
    expect(info.type).toBe("feature");
    expect(info.issueNumber).toBe(730);
    expect(info.repo).toBe("litlfred/folio-assistant");
  });

  test("extracts issue from front matter", () => {
    const raw = `---
id: my-bean
type: feature
issue: 755
---
Body text
`;
    const info = parseBeanDefinition(raw);
    expect(info.id).toBe("my-bean");
    expect(info.type).toBe("feature");
    expect(info.issueNumber).toBe(755);
  });
});
