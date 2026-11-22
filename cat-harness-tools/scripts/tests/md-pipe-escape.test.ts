/**
 * Escaping a Markdown table cell's pipes must escape backslashes too, in the
 * same pass. `s.replace(/\|/g, "\\|")` alone lets a value ending in `\` turn
 * the escape `\|` into `\\|`, which un-escapes the pipe and breaks the table
 * (CodeQL "incomplete string escaping", high). The idiom is
 * `s.replace(/[\\|]/g, "\\$&")`. This test holds every source in the layer
 * to it, so the class cannot come back one file at a time.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const LAYER = resolve(import.meta.dir, "..", "..");
const UNSAFE = '.replace(/\\|/g, "\\\\|")';

describe("Markdown pipe escaping", () => {
  test("the idiom escapes backslashes and pipes in one pass", () => {
    const esc = (s: string) => s.replace(/[\\|]/g, "\\$&");
    expect(esc("a|b")).toBe("a\\|b");
    expect(esc("ends in \\|")).toBe("ends in \\\\\\|");
    expect(esc("plain")).toBe("plain");
  });

  test("no source in this layer escapes pipes without escaping backslashes", () => {
    // A directory walk, not `git ls-files`: the layer is often mounted in a checkout that does not track it.
    const files = [...new Bun.Glob("**/*.ts").scanSync({ cwd: LAYER })].filter(
      (f) => !f.split("/").includes("node_modules") && !f.endsWith("md-pipe-escape.test.ts"),
    );
    expect(files.length).toBeGreaterThan(0);
    const offenders = files.filter((f) => readFileSync(join(LAYER, f), "utf8").includes(UNSAFE));
    expect(offenders).toEqual([]);
  });
});
