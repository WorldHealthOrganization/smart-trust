import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { audit, formatReport, reachableFrom, toolEntryPoints } from "../check-code-accounting";

/**
 * Throwaway trees, never the live repository.
 *
 * `yag0` this week was an assertion derived from the very data it was meant
 * to check, so it passed on broken data. The live numbers here move every
 * time somebody adds a file; what must not move is that the two questions
 * stay apart.
 */
function tree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "codeacct-"));
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, body);
  }
  return root;
}

function withTree<T>(files: Record<string, string>, fn: (root: string) => T): T {
  const root = tree(files);
  try {
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const instance = (name: string, dirs: object[]): string =>
  JSON.stringify({ name, directories: dirs });

describe("the two questions are reported APART", () => {
  /**
   * The whole specification, in one assertion. A file can be declared and
   * unreachable, or reachable and undeclared, and the two numbers must be
   * able to disagree. If one ever implied the other, a single average would
   * be as good — and `ylj7` exists because it is not.
   */
  test("a file can be DECLARED and unreachable", () => {
    withTree(
      {
        "alpha/alpha.json": instance("alpha", [
          { id: "code", path: "src/", graphTypologies: ["code"] },
        ]),
        "alpha/src/orphan.ts": "export const x = 1;\n",
        "package.json": JSON.stringify({ scripts: {} }),
      },
      (root) => {
        const a = audit(root);
        expect(a.declaredCode).toBe(1);
        expect(a.reachable).toBe(0);
      },
    );
  });

  test("...and REACHABLE while declared by nothing", () => {
    withTree(
      {
        "alpha/alpha.json": instance("alpha", []),
        "alpha/tools/index.ts": 'export const t = [{ invoke: { shell: "bun run alpha/loose.ts" } }];\n',
        "alpha/loose.ts": "export const y = 2;\n",
        "package.json": JSON.stringify({ scripts: {} }),
      },
      (root) => {
        const a = audit(root);
        expect(a.reachable).toBeGreaterThan(0);
        // `loose.ts` is in no declared directory — the other question is
        // unmoved by it, which is the point.
        expect(a.declaredCode).toBe(0);
      },
    );
  });

  /**
   * Question 1's two readings. `schemas/` is declared, and declared as
   * `schemas` rather than `code` — correctly, since adding `code` would give
   * one directory two kinds. Comparing the narrow number in one round against
   * the wide number in another reads an improvement as a regression, which
   * nearly happened on 2026-09-23.
   */
  test("`declaredAny` is wider than `declaredCode`, and both are reported", () => {
    withTree(
      {
        "alpha/alpha.json": instance("alpha", [
          { id: "schemas", path: "schemas/", graphTypologies: ["schemas"] },
          { id: "code", path: "src/", graphTypologies: ["code"] },
        ]),
        "alpha/schemas/a.ts": "export const a = 1;\n",
        "alpha/src/b.ts": "export const b = 1;\n",
        "package.json": JSON.stringify({ scripts: {} }),
      },
      (root) => {
        const a = audit(root);
        expect(a.declaredAny).toBe(2);
        expect(a.declaredCode).toBe(1);
        expect(a.total - a.declaredAny).toBe(0);
      },
    );
  });

  test("the report never prints a combined figure", () => {
    withTree({ "alpha/alpha.json": instance("alpha", []), "package.json": "{}" }, (root) => {
      const text = formatReport(audit(root));
      expect(text).toContain("1. DECLARED");
      expect(text).toContain("2. REACHABLE");
      expect(text).toContain("NOT averaged");
    });
  });
});

describe("toolEntryPoints follows package.json, not just literal paths", () => {
  test("a `bun run <script>` chain resolves to the .ts it ends at", () => {
    withTree(
      {
        "alpha/alpha.json": instance("alpha", []),
        "alpha/tools/index.ts": 'export const t = [{ invoke: { shell: "bun run gen" } }];\n',
        "alpha/gen.ts": "export const g = 1;\n",
        "package.json": JSON.stringify({ scripts: { gen: "bun run inner", inner: "bun run alpha/gen.ts" } }),
      },
      (root) => {
        expect(toolEntryPoints(root).entries).toEqual(["alpha/gen.ts"]);
      },
    );
  });

  test("a chain that loops terminates rather than hanging", () => {
    withTree(
      {
        "alpha/alpha.json": instance("alpha", []),
        "alpha/tools/index.ts": 'export const t = [{ invoke: { shell: "bun run a" } }];\n',
        "package.json": JSON.stringify({ scripts: { a: "bun run b", b: "bun run a" } }),
      },
      (root) => {
        expect(toolEntryPoints(root).entries).toEqual([]);
      },
    );
  });
});

describe("reachableFrom is a FLOOR, and says so by behaving like one", () => {
  test("follows a relative import, including through an index", () => {
    withTree(
      {
        "e.ts": 'import { y } from "./lib/index.js";\nexport const z = y;\n',
        "lib/index.ts": "export const y = 1;\n",
      },
      (root) => {
        const got = [...reachableFrom(root, ["e.ts"])].map((f) => f.replace(`${root}/`, "")).sort();
        expect(got).toEqual(["e.ts", "lib/index.ts"]);
      },
    );
  });

  /**
   * A dynamic import is NOT followed, so the module counts as unreachable.
   * Under-claiming coverage is the safe direction — the alternative is a
   * number that says a file is reached when nothing static reaches it.
   */
  test("does not follow a dynamic import, and so under-claims", () => {
    withTree(
      {
        "e.ts": 'export const load = () => import("./late.js");\n',
        "late.ts": "export const l = 1;\n",
      },
      (root) => {
        expect([...reachableFrom(root, ["e.ts"])]).toHaveLength(1);
      },
    );
  });

  test("an entry point that does not exist is skipped, not thrown on", () => {
    withTree({ "e.ts": "export const q = 1;\n" }, (root) => {
      expect([...reachableFrom(root, ["e.ts", "gone.ts"])]).toHaveLength(1);
    });
  });
});
