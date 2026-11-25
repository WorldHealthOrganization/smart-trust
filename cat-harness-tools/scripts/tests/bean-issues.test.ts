/**
 * Tests for queryable bean-issue links and the check-bean-issues audit.
 *
 * @module scripts/tests/bean-issues
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { BeanFrontMatterSchema } from "../../schemas/sdlc/bean-graph.ts";
import { readBeans } from "../beans.ts";
import {
  checkBeanIssues,
  extractIssueFromBody,
  formatReport,
  owesIssue,
  resolveIssue,
} from "../check-bean-issues.ts";

const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A temporary repository with a bean store containing the given beans. */
function store(beans: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "bean-issues-test-"));
  made.push(root);
  const defs = join(root, "beans", "defs");
  mkdirSync(defs, { recursive: true });
  writeFileSync(
    join(root, "beans", "beans.json"),
    JSON.stringify({
      name: "test-instance",
      directories: [{ id: "defs", path: "defs", graphTypologies: ["bean-defs"] }],
    }),
  );
  for (const [name, content] of Object.entries(beans)) {
    writeFileSync(join(defs, `${name}.md`), content);
  }
  return root;
}

function makeBean(id: string, fm: string, body = "Default body."): string {
  return `---\n# ${id}\n${fm}\n---\n\n${body}\n`;
}

describe("BeanFrontMatterSchema", () => {
  test("accepts front matter with positive integer numeric issue", () => {
    const raw = {
      title: "Feature with numeric issue",
      status: "in-progress",
      type: "feature",
      issue: 730,
    };
    const parsed = BeanFrontMatterSchema.parse(raw);
    expect(parsed.issue).toBe(730);
    expect(parsed.title).toBe("Feature with numeric issue");
  });

  test("accepts front matter with string issue shorthand (#730)", () => {
    const raw = {
      title: "Feature with shorthand issue",
      status: "todo",
      type: "feature",
      issue: "#730",
    };
    const parsed = BeanFrontMatterSchema.parse(raw);
    expect(parsed.issue).toBe("#730");
  });

  test("accepts front matter with full issue URL", () => {
    const url = "https://github.com/litlfred/folio-assistant/issues/730";
    const raw = {
      title: "Feature with issue URL",
      status: "todo",
      type: "feature",
      issue: url,
    };
    const parsed = BeanFrontMatterSchema.parse(raw);
    expect(parsed.issue).toBe(url);
  });

  test("accepts front matter without issue field (optional)", () => {
    const raw = {
      title: "Task with no issue",
      status: "todo",
      type: "task",
    };
    const parsed = BeanFrontMatterSchema.parse(raw);
    expect(parsed.issue).toBeUndefined();
  });

  test("rejects negative or zero numbers", () => {
    expect(() => BeanFrontMatterSchema.parse({ issue: -1 })).toThrow();
    expect(() => BeanFrontMatterSchema.parse({ issue: 0 })).toThrow();
  });

  test("rejects non-integer numbers", () => {
    expect(() => BeanFrontMatterSchema.parse({ issue: 730.5 })).toThrow();
  });

  test("rejects empty string issue", () => {
    expect(() => BeanFrontMatterSchema.parse({ issue: "" })).toThrow();
  });

  test("preserves additional unknown keys via passthrough", () => {
    const raw = {
      title: "Extended bean",
      issue: 42,
      custom_field: "value",
    };
    const parsed = BeanFrontMatterSchema.parse(raw) as Record<string, unknown>;
    expect(parsed.issue).toBe(42);
    expect(parsed.custom_field).toBe("value");
  });
});

describe("readBeans front-matter issue parsing", () => {
  test("parses numeric issue from bean front matter into BeanNode", () => {
    const root = store({
      a: makeBean("t-a", `title: With number\nstatus: todo\ntype: feature\nissue: 730`),
    });
    const beans = readBeans(root)!;
    expect(beans).toHaveLength(1);
    expect(beans[0]!.issue).toBe(730);
  });

  test("parses string issue from bean front matter into BeanNode", () => {
    const root = store({
      a: makeBean("t-a", `title: With string\nstatus: todo\ntype: feature\nissue: "#730"`),
    });
    const beans = readBeans(root)!;
    expect(beans).toHaveLength(1);
    expect(beans[0]!.issue).toBe("#730");
  });

  test("leaves issue undefined when absent from front matter", () => {
    const root = store({
      a: makeBean("t-a", `title: No issue\nstatus: todo\ntype: task`),
    });
    const beans = readBeans(root)!;
    expect(beans).toHaveLength(1);
    expect(beans[0]!.issue).toBeUndefined();
  });
});

describe("owesIssue criteria", () => {
  test("type 'feature' owes an issue", () => {
    const b = {
      id: "t-f",
      file: "f.md",
      title: "A feature",
      status: "todo",
      type: "feature",
      priority: "normal",
      parent: "",
      blocking: [],
      createdAt: "",
      updatedAt: "",
      body: "Body",
    };
    expect(owesIssue(b).owes).toBe(true);
  });

  test("type 'task' without special tags does not owe an issue", () => {
    const b = {
      id: "t-t",
      file: "t.md",
      title: "A task",
      status: "todo",
      type: "task",
      priority: "normal",
      parent: "",
      blocking: [],
      createdAt: "",
      updatedAt: "",
      body: "Body",
    };
    expect(owesIssue(b).owes).toBe(false);
  });

  test("tags declaring issue requirement owe an issue", () => {
    for (const tag of ["issue-required", "needs-issue", "requires-issue"]) {
      const b = {
        id: "t-tagged",
        file: "t.md",
        title: "Tagged task",
        status: "todo",
        type: "task",
        priority: "normal",
        parent: "",
        blocking: [],
        createdAt: "",
        updatedAt: "",
        body: "Body",
        tags: [tag],
      };
      expect(owesIssue(b).owes).toBe(true);
    }
  });

  test("body declaring stakeholder adjudication owes an issue", () => {
    const b = {
      id: "t-adj",
      file: "t.md",
      title: "Adjudication item",
      status: "todo",
      type: "task",
      priority: "normal",
      parent: "",
      blocking: [],
      createdAt: "",
      updatedAt: "",
      body: "This design requires stakeholder adjudication before landing.",
    };
    expect(owesIssue(b).owes).toBe(true);
  });

  test("openOnly option excludes closed beans", () => {
    const b = {
      id: "t-done",
      file: "t.md",
      title: "Completed feature",
      status: "completed",
      type: "feature",
      priority: "normal",
      parent: "",
      blocking: [],
      createdAt: "",
      updatedAt: "",
      body: "Done.",
    };
    expect(owesIssue(b, { openOnly: true }).owes).toBe(false);
    expect(owesIssue(b, { openOnly: false }).owes).toBe(true);
  });
});

describe("extractIssueFromBody and resolveIssue", () => {
  test("extracts issue from URL in body", () => {
    const body = "Tracked at https://github.com/litlfred/folio-assistant/issues/1042 for review.";
    expect(extractIssueFromBody(body)).toBe("https://github.com/litlfred/folio-assistant/issues/1042");
  });

  test("extracts issue from 'issue #123' or 'issue 123'", () => {
    expect(extractIssueFromBody("Discussed in issue #941.")).toBe("#941");
    expect(extractIssueFromBody("See issue 941 for details.")).toBe("#941");
  });

  test("extracts issue from 'gh-123'", () => {
    expect(extractIssueFromBody("Fixes gh-88.")).toBe("#88");
  });

  test("extracts issue from standalone '#123'", () => {
    expect(extractIssueFromBody("Adjudication in #123.")).toBe("#123");
  });

  test("does not false-positive on markdown headings", () => {
    expect(extractIssueFromBody("# Heading 1\n## Heading 2\n### Heading 3")).toBeUndefined();
  });

  test("resolveIssue prefers frontmatter over body", () => {
    const b = {
      id: "t-pref",
      file: "t.md",
      title: "Preferred",
      status: "todo",
      type: "feature",
      priority: "normal",
      parent: "",
      blocking: [],
      createdAt: "",
      updatedAt: "",
      issue: 730,
      body: "Also mentions #999.",
    };
    const res = resolveIssue(b);
    expect(res).toBeDefined();
    expect(res!.source).toBe("frontmatter");
    expect(res!.issue).toBe(730);
  });

  test("resolveIssue falls back to body reference", () => {
    const b = {
      id: "t-fb",
      file: "t.md",
      title: "Body reference",
      status: "todo",
      type: "feature",
      priority: "normal",
      parent: "",
      blocking: [],
      createdAt: "",
      updatedAt: "",
      body: "Adjudication tracked in #456.",
    };
    const res = resolveIssue(b);
    expect(res).toBeDefined();
    expect(res!.source).toBe("body");
    expect(res!.issue).toBe("#456");
  });
});

describe("checkBeanIssues logic", () => {
  test("passes when every feature specifies an issue in front matter", () => {
    const root = store({
      f1: makeBean("t-f1", "title: F1\nstatus: todo\ntype: feature\nissue: 730"),
      f2: makeBean("t-f2", "title: F2\nstatus: in-progress\ntype: feature\nissue: '#731'"),
      t1: makeBean("t-t1", "title: Task\nstatus: todo\ntype: task"),
    });
    const report = checkBeanIssues(root);
    expect(report.problems).toEqual([]);
    expect(report.totalOwed).toBe(2);
    expect(report.compliant).toHaveLength(2);
  });

  test("passes when feature specifies issue in body", () => {
    const root = store({
      f1: makeBean("t-f1", "title: F1\nstatus: todo\ntype: feature", "Human review in issue #555."),
    });
    const report = checkBeanIssues(root);
    expect(report.problems).toEqual([]);
    expect(report.totalOwed).toBe(1);
    expect(report.compliant[0]!.source).toBe("body");
    expect(report.compliant[0]!.issue).toBe("#555");
  });

  test("fails when a feature has no issue in front matter or body", () => {
    const root = store({
      f1: makeBean("t-f1", "title: Unlinked feature\nstatus: todo\ntype: feature", "No issue here."),
    });
    const report = checkBeanIssues(root);
    expect(report.problems).toHaveLength(1);
    expect(report.problems[0]).toContain("t-f1");
    expect(report.problems[0]).toContain("owes an issue");
  });

  test("returns store null and 0 problems when no bean store exists", () => {
    const root = mkdtempSync(join(tmpdir(), "bean-empty-"));
    made.push(root);
    const report = checkBeanIssues(root);
    expect(report.store).toBeNull();
    expect(report.problems).toEqual([]);
    expect(formatReport(report)).toContain("no bean store");
  });

  test("formats report correctly with pass and compliant beans", () => {
    const root = store({
      f1: makeBean("t-f1", "title: F1\nstatus: todo\ntype: feature\nissue: 730"),
    });
    const report = checkBeanIssues(root);
    const text = formatReport(report);
    expect(text).toContain("every bean owing an issue is linked to an issue");
    expect(text).toContain("t-f1: 730 (from frontmatter)");
  });

  test("formats report correctly with failures and guidance", () => {
    const root = store({
      f1: makeBean("t-f1", "title: Bad\nstatus: todo\ntype: feature"),
    });
    const report = checkBeanIssues(root);
    const text = formatReport(report);
    expect(text).toContain("✗ t-f1");
    expect(text).toContain("Add `issue: <number|string>`");
  });

  test("honours baseline for accepted missing issues", () => {
    const root = store({
      f1: makeBean("t-f1", "title: Legacy feature\nstatus: todo\ntype: feature"),
    });
    // Create baseline
    const baselinePath = join(root, "scripts", "bean-issues-baseline.json");
    mkdirSync(join(root, "scripts"), { recursive: true });
    writeFileSync(
      baselinePath,
      JSON.stringify({
        outstanding: ["missing-issue:t-f1"],
      }),
    );
    const report = checkBeanIssues(root);
    expect(report.problems).toEqual([]);
    expect(report.outstanding).toHaveLength(1);
    expect(report.outstanding[0]).toContain("t-f1");
    expect(formatReport(report)).toContain("baselined defect(s)");
  });

  test("flags stale baseline entries", () => {
    const root = store({
      f1: makeBean("t-f1", "title: Compliant feature\nstatus: todo\ntype: feature\nissue: 730"),
    });
    // Create baseline with non-existent issue
    const baselinePath = join(root, "scripts", "bean-issues-baseline.json");
    mkdirSync(join(root, "scripts"), { recursive: true });
    writeFileSync(
      baselinePath,
      JSON.stringify({
        outstanding: ["missing-issue:t-repaired"],
      }),
    );
    const report = checkBeanIssues(root);
    expect(report.stale).toEqual(["missing-issue:t-repaired"]);
    expect(formatReport(report)).toContain("matches nothing — remove it");
  });
});
