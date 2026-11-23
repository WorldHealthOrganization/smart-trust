import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import {
  stripUpdatedAt,
  differsOnlyInUpdatedAt,
  checkStrictSuperset,
  classify,
} from "../bean-rollover.ts";

describe("bean-rollover: updated_at exclusion", () => {
  test("stripUpdatedAt removes updated_at line from front matter and preserves everything else", () => {
    const raw = `---
# folio-assistant-2h76
title: state branch p2
status: in-progress
type: task
created_at: 2026-10-02T22:42:36Z
updated_at: 2026-10-02T22:42:36Z
parent: folio-assistant-fs43
---

Body paragraph 1.

Body paragraph 2.
`;

    const expected = `---
# folio-assistant-2h76
title: state branch p2
status: in-progress
type: task
created_at: 2026-10-02T22:42:36Z
parent: folio-assistant-fs43
---

Body paragraph 1.

Body paragraph 2.
`;

    expect(stripUpdatedAt(raw).trim()).toBe(expected.trim());
  });

  test("differsOnlyInUpdatedAt returns true when only updated_at timestamp differs", () => {
    const a = `---
title: test bean
status: in-progress
updated_at: 2026-10-02T22:42:36Z
---
Same body text.
`;

    const b = `---
title: test bean
status: in-progress
updated_at: 2026-10-02T22:42:40Z
---
Same body text.
`;

    expect(differsOnlyInUpdatedAt(a, b)).toBe(true);
  });

  test("differsOnlyInUpdatedAt returns false when status or body differs", () => {
    const a = `---
title: test bean
status: in-progress
updated_at: 2026-10-02T22:42:36Z
---
Body text A.
`;

    const b = `---
title: test bean
status: ready-to-close
updated_at: 2026-10-02T22:42:40Z
---
Body text A.
`;

    const c = `---
title: test bean
status: in-progress
updated_at: 2026-10-02T22:42:40Z
---
Body text B.
`;

    expect(differsOnlyInUpdatedAt(a, b)).toBe(false);
    expect(differsOnlyInUpdatedAt(a, c)).toBe(false);
  });
});

describe("bean-rollover: strict superset detection", () => {
  test("detects base as strict superset when base contains claim note that head lacks (PR #1937 case)", () => {
    const base = `---
# folio-assistant-2h76
title: state branch p2
status: in-progress
type: task
created_at: 2026-10-02T22:42:36Z
updated_at: 2026-10-02T22:42:36Z
parent: folio-assistant-fs43
---

Body text.

_2026-10-02T22:42:36Z_ — Claimed by claude/state-branch-store — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).
`;

    const head = `---
# folio-assistant-2h76
title: state branch p2
status: in-progress
type: task
created_at: 2026-10-02T22:42:36Z
updated_at: 2026-10-02T22:42:40Z
parent: folio-assistant-fs43
---

Body text.
`;

    const res = checkStrictSuperset(base, head);
    expect(res).toBeDefined();
    expect(res?.side).toBe("base");
    expect(res?.diff).toContain("Claimed by claude/state-branch-store");
  });

  test("detects head as strict superset when head contains evidence section that base lacks", () => {
    const base = `---
title: task
status: in-progress
updated_at: 2026-10-02T22:42:36Z
---
Working on it.
`;

    const head = `---
title: task
status: in-progress
updated_at: 2026-10-02T22:50:00Z
---
Working on it.

## Evidence
- All gates green
`;

    const res = checkStrictSuperset(base, head);
    expect(res).toBeDefined();
    expect(res?.side).toBe("head");
    expect(res?.diff).toContain("## Evidence");
    expect(res?.diff).toContain("All gates green");
  });

  test("returns undefined when texts are identical once updated_at is stripped", () => {
    const base = `---
title: task
updated_at: 2026-10-02T10:00:00Z
---
Same body.
`;

    const head = `---
title: task
updated_at: 2026-10-02T11:00:00Z
---
Same body.
`;

    expect(checkStrictSuperset(base, head)).toBeUndefined();
  });

  test("NEGATIVE CONTROL (the dlqu case): returns undefined when both sides have divergent modifications", () => {
    const base = `---
title: task
status: in-progress
updated_at: 2026-10-02T10:00:00Z
---
Owner ruling: keep both sides.
`;

    const head = `---
title: task
status: in-progress
updated_at: 2026-10-02T11:00:00Z
---
Author note: divergent implementation approach.
`;

    // Neither is a superset; both modified the body differently
    expect(checkStrictSuperset(base, head)).toBeUndefined();
  });
});

describe("bean-rollover: classification in a git repository", () => {
  function initTestRepo(): {
    repo: string;
    cleanup: () => void;
    commit: (msg: string) => string;
    branch: (name: string) => void;
    checkout: (name: string) => void;
  } {
    const dir = mkdtempSync(join(tmpdir(), "bean-rollover-test-repo-"));
    const exec = (cmd: string, args: string[]) => {
      const r = spawnSync(cmd, args, { cwd: dir, encoding: "utf-8" });
      if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed: ${r.stderr}`);
      return r.stdout.trim();
    };

    exec("git", ["init", "-b", "main"]);
    exec("git", ["config", "user.name", "Test"]);
    exec("git", ["config", "user.email", "test@example.com"]);

    return {
      repo: dir,
      cleanup: () => rmSync(dir, { recursive: true, force: true }),
      commit: (msg: string) => {
        exec("git", ["add", "."]);
        exec("git", ["commit", "-m", msg]);
        return exec("git", ["rev-parse", "HEAD"]);
      },
      branch: (name: string) => {
        exec("git", ["branch", name]);
      },
      checkout: (name: string) => {
        exec("git", ["checkout", name]);
      },
    };
  }

  test("change to ONLY updated_at reports already-on-main, NOT adjudicate", () => {
    const t = initTestRepo();
    try {
      const beanPath = "beans/defs/folio-assistant-test.md";
      const beanDir = join(t.repo, "beans", "defs");
      spawnSync("mkdir", ["-p", beanDir]);

      // Fork commit
      writeFileSync(
        join(t.repo, beanPath),
        `---
title: test bean
status: in-progress
updated_at: 2026-10-01T10:00:00Z
---
Same body content.
`,
      );
      const fork = t.commit("initial");

      // PR branch: only bumps updated_at
      t.branch("pr");
      t.checkout("pr");
      writeFileSync(
        join(t.repo, beanPath),
        `---
title: test bean
status: in-progress
updated_at: 2026-10-01T12:00:00Z
---
Same body content.
`,
      );
      const head = t.commit("pr bump updated_at");

      // Main branch: also only bumps updated_at
      t.checkout("main");
      writeFileSync(
        join(t.repo, beanPath),
        `---
title: test bean
status: in-progress
updated_at: 2026-10-01T11:00:00Z
---
Same body content.
`,
      );
      const base = t.commit("main bump updated_at");

      const verdict = classify(base, head, fork, beanPath, t.repo);
      expect(verdict.state).toBe("already-on-main");
      expect(verdict.state).not.toBe("adjudicate");
    } finally {
      t.cleanup();
    }
  });

  test("strict superset on base reports port-superset with superset: base", () => {
    const t = initTestRepo();
    try {
      const beanPath = "beans/defs/folio-assistant-test.md";
      const beanDir = join(t.repo, "beans", "defs");
      spawnSync("mkdir", ["-p", beanDir]);

      // Fork commit: status todo
      writeFileSync(
        join(t.repo, beanPath),
        `---
title: test bean
status: todo
updated_at: 2026-10-01T10:00:00Z
---
Body text.
`,
      );
      const fork = t.commit("initial");

      // PR branch: transitions to in-progress
      t.branch("pr");
      t.checkout("pr");
      writeFileSync(
        join(t.repo, beanPath),
        `---
title: test bean
status: in-progress
updated_at: 2026-10-01T11:00:00Z
---
Body text.
`,
      );
      const head = t.commit("pr claim");

      // Main branch: transitions to in-progress AND appends claim note
      t.checkout("main");
      writeFileSync(
        join(t.repo, beanPath),
        `---
title: test bean
status: in-progress
updated_at: 2026-10-01T10:30:00Z
---
Body text.

_2026-10-01_ — Claimed by session on main.
`,
      );
      const base = t.commit("main claim and note");

      const verdict = classify(base, head, fork, beanPath, t.repo);
      expect(verdict.state).toBe("port-superset");
      expect(verdict.superset).toBe("base");
      expect(verdict.diff).toContain("Claimed by session on main");
      expect(verdict.state).not.toBe("adjudicate");
      expect(verdict.state).not.toBe("port");
    } finally {
      t.cleanup();
    }
  });

  test("strict superset on head reports port-superset with superset: head", () => {
    const t = initTestRepo();
    try {
      const beanPath = "beans/defs/folio-assistant-test.md";
      const beanDir = join(t.repo, "beans", "defs");
      spawnSync("mkdir", ["-p", beanDir]);

      // Fork commit: status in-progress
      writeFileSync(
        join(t.repo, beanPath),
        `---
title: test bean
status: in-progress
updated_at: 2026-10-01T10:00:00Z
---
Body text.
`,
      );
      const fork = t.commit("initial");

      // Main branch: adds note A
      t.checkout("main");
      writeFileSync(
        join(t.repo, beanPath),
        `---
title: test bean
status: in-progress
updated_at: 2026-10-01T10:30:00Z
---
Body text.

_2026-10-01_ — Note from main.
`,
      );
      const base = t.commit("main note");

      // PR branch: had note from main (merged) AND added completion evidence
      t.branch("pr");
      t.checkout("pr");
      writeFileSync(
        join(t.repo, beanPath),
        `---
title: test bean
status: in-progress
updated_at: 2026-10-01T11:00:00Z
---
Body text.

_2026-10-01_ — Note from main.

## Evidence
- 100% test coverage
`,
      );
      const head = t.commit("pr completion");

      const verdict = classify(base, head, fork, beanPath, t.repo);
      expect(verdict.state).toBe("port-superset");
      expect(verdict.superset).toBe("head");
      expect(verdict.diff).toContain("Evidence");
      expect(verdict.diff).toContain("100% test coverage");
    } finally {
      t.cleanup();
    }
  });

  test("NEGATIVE CONTROL (dlqu case): divergent edits report adjudicate", () => {
    const t = initTestRepo();
    try {
      const beanPath = "beans/defs/folio-assistant-test.md";
      const beanDir = join(t.repo, "beans", "defs");
      spawnSync("mkdir", ["-p", beanDir]);

      // Fork commit
      writeFileSync(
        join(t.repo, beanPath),
        `---
title: test bean
status: in-progress
updated_at: 2026-10-01T10:00:00Z
---
Common initial body.
`,
      );
      const fork = t.commit("initial");

      // PR branch: edits body to approach X
      t.branch("pr");
      t.checkout("pr");
      writeFileSync(
        join(t.repo, beanPath),
        `---
title: test bean
status: in-progress
updated_at: 2026-10-01T11:00:00Z
---
Common initial body.

Author approach X implementation.
`,
      );
      const head = t.commit("pr approach X");

      // Main branch: edits body to approach Y
      t.checkout("main");
      writeFileSync(
        join(t.repo, beanPath),
        `---
title: test bean
status: in-progress
updated_at: 2026-10-01T10:30:00Z
---
Common initial body.

Owner ruling approach Y implementation.
`,
      );
      const base = t.commit("main approach Y");

      const verdict = classify(base, head, fork, beanPath, t.repo);
      expect(verdict.state).toBe("adjudicate");
      expect(verdict.because).toContain("both this PR and the base changed this bean");
    } finally {
      t.cleanup();
    }
  });

  test("pure port when base has not touched bean since fork", () => {
    const t = initTestRepo();
    try {
      const beanPath = "beans/defs/folio-assistant-test.md";
      const beanDir = join(t.repo, "beans", "defs");
      spawnSync("mkdir", ["-p", beanDir]);

      // Fork commit
      writeFileSync(
        join(t.repo, beanPath),
        `---
title: test bean
status: todo
updated_at: 2026-10-01T10:00:00Z
---
Todo body.
`,
      );
      const fork = t.commit("initial");

      // PR branch: advances to in-progress
      t.branch("pr");
      t.checkout("pr");
      writeFileSync(
        join(t.repo, beanPath),
        `---
title: test bean
status: in-progress
updated_at: 2026-10-01T11:00:00Z
---
Work underway.
`,
      );
      const head = t.commit("pr work");

      // Main branch: untouched
      t.checkout("main");
      const base = fork;

      const verdict = classify(base, head, fork, beanPath, t.repo);
      expect(verdict.state).toBe("port");
      expect(verdict.because).toContain("the base has not touched this bean");
    } finally {
      t.cleanup();
    }
  });
});
