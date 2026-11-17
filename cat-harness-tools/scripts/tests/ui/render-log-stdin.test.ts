/**
 * Prose arrives on STDIN, not in argv — bean `ru6i`.
 *
 * ## Why, exactly, because the first version of this got it wrong
 *
 * **NOT a bug fix.** I claimed the four callers in `feature-staging.yml` were
 * broken by a quote in `$CLEANUP_REASON`, since each built its argument as
 * `--reason "PR #… confirmed by: $CLEANUP_REASON"`. Measured: **they were safe.**
 * Shell parameter expansion inside double quotes does not re-tokenize or re-quote,
 * so `he said "no"`, a backtick and a `$(id)` all arrived as one literal argument
 * with nothing executed. The value comes through `env:`, so it is a shell
 * variable — not a `${{ }}` template substitution, which would be another matter.
 *
 * **The actual reason is the contract.** `tool-types.ts` refuses prose as an argv
 * word by design, so `render-logging` could not have a Tool node at all while its
 * summary was a flag:
 *
 *     ✗ 1 command-line input(s) of a type that can express a shell payload:
 *         render-log.summary : Text — put free text on stdin
 *
 * That rule is about what a TYPE can express, not about today's callers — its own
 * argument being that "a caller is one refactor away from a template literal".
 * So these tests pin a defensive contract, and the hostile-prose case below is
 * evidence that the new path is sound rather than evidence the old one was not.
 *
 * @module scripts/tests/render-log-stdin.test
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SCRIPT = resolve(import.meta.dir, "../../render-log.ts");

interface Ran {
  code: number | null;
  stdout: string;
  stderr: string;
}

/** Run the CLI with an optional stdin body. */
function run(args: string[], stdin?: string): Ran {
  const r = Bun.spawnSync(["bun", "run", SCRIPT, ...args], {
    stdin: stdin === undefined ? "ignore" : new TextEncoder().encode(stdin),
  });
  const d = new TextDecoder();
  return { code: r.exitCode, stdout: d.decode(r.stdout), stderr: d.decode(r.stderr) };
}

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "render-log-stdin-"));
}

/** The one entry written under `dir`, parsed. */
function onlyEntry(dir: string): Record<string, unknown> {
  const logDir = join(dir, "_render-log");
  const files = readdirSync(logDir).filter((f) => f.endsWith(".jsonl"));
  expect(files).toHaveLength(1);
  const lines = readFileSync(join(logDir, files[0]!), "utf8").trim().split("\n").filter(Boolean);
  expect(lines).toHaveLength(1);
  return JSON.parse(lines[0]!) as Record<string, unknown>;
}

const BASE = ["--event", "rendered", "--kind", "staging-preview", "--path", "STAGING/x", "--slug", "x"];

describe("the prose flags are REFUSED, not ignored", () => {
  // The whole value of the refusal: a caller left behind by the migration must be
  // told. Ignoring the flag would write an entry saying something was published
  // and not WHAT, which is the ambiguity this log exists to prevent.
  test.each(["--summary", "--reason", "--detail"])("%s in argv exits 2 and names itself", (flag) => {
    const dir = tmp();
    try {
      const r = run(["--dir", dir, ...BASE, flag, "some prose"], '{"summary":"s"}');
      expect(r.code).toBe(2);
      expect(r.stderr).toContain(flag);
      expect(r.stderr).toContain("no longer travel in argv");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("all three are named together rather than one at a time", () => {
    // A caller with three stale flags should learn that in one run, not three.
    const dir = tmp();
    try {
      const r = run(["--dir", dir, ...BASE, "--summary", "a", "--reason", "b", "--detail", "c"], '{"summary":"s"}');
      expect(r.code).toBe(2);
      for (const f of ["--summary", "--reason", "--detail"]) expect(r.stderr).toContain(f);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("refusing writes NOTHING — a refusal is not a log entry", () => {
    const dir = tmp();
    try {
      run(["--dir", dir, ...BASE, "--summary", "a"], '{"summary":"s"}');
      expect(readdirSync(dir)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("stdin that is not usable prose is exit 2, never a silent write", () => {
  const cases: Array<[string, string | undefined, RegExp]> = [
    ["no stdin at all", undefined, /no stdin|empty/i],
    ["empty stdin", "", /empty/i],
    ["not JSON", "summary: hello", /not JSON/i],
    ["a JSON array", '["summary"]', /single JSON OBJECT/i],
    ["a bare string", '"just a string"', /single JSON OBJECT/i],
    ["a non-string summary", '{"summary": 42}', /must be a string/i],
    ["a missing summary", '{"reason":"r"}', /`summary` is required/i],
    ["an empty summary", '{"summary":"   "}', /`summary` is required/i],
  ];
  test.each(cases)("%s is refused, and nothing is written", (_name, body, expected) => {
    const dir = tmp();
    try {
      const r = run(["--dir", dir, ...BASE], body);
      expect(r.code).toBe(2);
      expect(r.stderr).toMatch(expected);
      // The third-state rule: could-not-read is never a clean write.
      expect(r.stderr).toContain("Nothing was written");
      expect(readdirSync(dir)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("prose survives stdin verbatim", () => {
  test("a reason full of shell metacharacters lands inert and unchanged", () => {
    // Evidence the new path is sound. Note this is NOT a regression test for the
    // old one — see the module docstring; the old argv form passed this string
    // intact too.
    const hostile = 'merged; and he said "ship it" `whoami` $(id) & rm -rf /';
    const dir = tmp();
    try {
      const r = run(
        ["--dir", dir, "--event", "removed", "--kind", "staging-preview", "--path", "STAGING/x", "--slug", "x"],
        JSON.stringify({ summary: "preview removed", reason: hostile }),
      );
      expect(r.code).toBe(0);
      expect(onlyEntry(dir).reason).toBe(hostile);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a newline in the detail survives, which no argv word carries comfortably", () => {
    const detail = "line one\nline two\n\tindented";
    const dir = tmp();
    try {
      const r = run(["--dir", dir, ...BASE], JSON.stringify({ summary: "s", detail }));
      expect(r.code).toBe(0);
      expect(onlyEntry(dir).detail).toBe(detail);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("`format` is declared, and absence is the default", () => {
  test("an entry that declares nothing carries NO format field", () => {
    // Absence must stay meaningful. Writing `format: "text"` on every entry would
    // be noise, and would make a missing field look like a bug rather than the
    // documented default.
    const dir = tmp();
    try {
      expect(run(["--dir", dir, ...BASE], '{"summary":"s"}').code).toBe(0);
      expect("format" in onlyEntry(dir)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a declared format is carried through", () => {
    const dir = tmp();
    try {
      expect(run(["--dir", dir, ...BASE], '{"summary":"**bold**","format":"markdown"}').code).toBe(0);
      expect(onlyEntry(dir).format).toBe("markdown");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("the format is NOT sniffed from markdown-looking prose", () => {
    // The reason for declaring rather than detecting: a reason like "the *only*
    // liveness signal was stale" contains emphasis it does not mean.
    const dir = tmp();
    try {
      expect(run(["--dir", dir, ...BASE], '{"summary":"the *only* signal was stale"}').code).toBe(0);
      expect("format" in onlyEntry(dir)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("the rules that predate this change still hold", () => {
  test("a `removed` entry with no reason is still refused, now from stdin", () => {
    // `EVENTS_REQUIRING_REASON` is enforced in `buildEntry`, so moving the
    // transport must not have bypassed it.
    const dir = tmp();
    try {
      const r = run(
        ["--dir", dir, "--event", "removed", "--kind", "staging-preview", "--path", "STAGING/x"],
        '{"summary":"gone"}',
      );
      expect(r.code).toBe(1);
      expect(r.stderr).toMatch(/reason is required/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("an unsafe path is still refused, and the prose never reaches a file", () => {
    const dir = tmp();
    try {
      const r = run(["--dir", dir, "--event", "rendered", "--kind", "staging-preview", "--path", "STAGING/../x"], '{"summary":"s"}');
      expect(r.code).toBe(1);
      expect(readdirSync(dir)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a missing --dir is still usage, and the usage SHOWS the stdin shape", () => {
    const r = run(["--event", "rendered"], '{"summary":"s"}');
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("STDIN");
    expect(r.stderr).toContain("jq -n --arg");
  });
});
