/**
 * Every external value that reaches a path in the MCP server is CHECKED.
 *
 * Bean `6bhf`, the box that reads *"a gate finds an external value reaching a
 * path join, so the property does not drift back"*.
 *
 * ## Why a source ratchet rather than route tests
 *
 * `src/core/tests/safe-path.test.ts` already pins the helpers thoroughly — 25
 * tests over `safeSegment`, `joinSegments`, `resolveWithin`, `realPathWithin`
 * and `writableWithin`, including the symlink escape that got a **200** out of
 * the lexical-only version. Repeating any of that here would buy nothing.
 *
 * What nothing checked is that the **sinks use them**. That is the gap `6bhf`
 * names, quoting `1wef`: *"somebody had understood this hazard exactly. Nothing
 * checked it, so the correctness was one edit from gone."* It was already true
 * once — three routes were fixed and `/api/import/scan` was missed, so the read
 * primitive survived the fix that was supposed to remove it.
 *
 * The handlers live inside one large `fetch`, reached only by starting a server
 * and doing real filesystem writes, so a route test would need a live port and
 * a temp store per case. This asserts the narrower property a regression would
 * break first: the guard is still adjacent to the sink.
 *
 * **What this is NOT.** A source-text assertion cannot prove a value is
 * validated on every path to a sink; it proves the guard has not been deleted.
 * Anti-vacuity is asserted below so a rename cannot turn it into a silent pass,
 * which is the failure mode of every grep-shaped check in this repository.
 */
import { describe, it, expect } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";
import { safeSegment } from "../src/core/safe-path.ts";

// `import.meta.dir` is `cat-harness-tools/test`, so the layer root is one up.
// Moved here with the server (bean `w2gr`, step 3a).
const SERVER = join(import.meta.dir, "../adapters/mcp-server/server.ts");
const src = readFileSync(SERVER, "utf-8");

describe("the file under test was actually read", () => {
  it("is the server, and is substantial — otherwise every assertion below is vacuous", () => {
    // A moved or renamed server would make `src` empty and every `not.toContain`
    // below pass trivially. This is the `translation-drift` rule applied to a
    // source check: a comparison over nothing reads as agreement.
    expect(src.length).toBeGreaterThan(50_000);
    expect(src).toContain('path === "/api/import/upload"');
    expect(src).toContain('path === "/api/import/scan"');
    expect(src).toContain('path === "/api/import/arxiv"');
  });

  it("imports the containment helpers rather than hand-rolling them", () => {
    expect(src).toContain('from "../../src/core/safe-path.js"');
    for (const helper of ["safeSegment", "realPathWithin", "writableWithin"]) {
      expect(src).toContain(helper);
    }
  });
});

describe("the exact pre-fix spellings are gone", () => {
  // Each string below was IN this file and was a live defect. They are asserted
  // verbatim rather than by pattern so a failure names the sink that came back.
  const regressions: Array<[string, string]> = [
    [
      "join(UPLOADS_DIR(), body.paperId)",
      "/api/import/scan took an unvalidated identifier into a read path",
    ],
    [
      'const filename = ext === ".pdf" ? "original.pdf" : file.name;',
      "/api/import/upload wrote to a path built from the uploaded file's own name",
    ],
    [
      'const id = paperId || file.name.replace(/\\.[^.]+$/, "")',
      "/api/import/upload used a SUPPLIED paperId verbatim while sanitising only the fallback",
    ],
  ];

  it.each(regressions.map(([spelling, why]) => [why, spelling] as const))("does not contain: %s", (_why, spelling) => {
    expect(src).not.toContain(spelling);
  });
});

describe("each identifier sink validates before the path is built", () => {
  it("every UPLOADS_DIR() join uses a checked identifier, never a raw request field", () => {
    // `join(UPLOADS_DIR(), X)` — X must not be a member expression off a
    // request body or form. A checked local (`id`, `scanId`) is what the fixed
    // routes pass.
    const joins = [...src.matchAll(/join\(\s*UPLOADS_DIR\(\)\s*,\s*([^),]+)\)/g)].map((m) => m[1].trim());
    expect(joins.length).toBeGreaterThan(0);
    const raw = joins.filter((a) => /\b(body|formData|req|params|query)\b/.test(a));
    expect(raw).toEqual([]);
  });

  it("the scan route refuses an unsafe paperId with a 400 rather than reading", () => {
    const scan = src.slice(src.indexOf('path === "/api/import/scan"'));
    const handler = scan.slice(0, scan.indexOf("/api/import/generate"));
    expect(handler).toContain("safeSegment(body.paperId)");
    expect(handler).toContain("must be one safe path segment");
  });

  it("the scan route contains each meta.files member instead of trusting it", () => {
    const scan = src.slice(src.indexOf('path === "/api/import/scan"'));
    const handler = scan.slice(0, scan.indexOf("/api/import/generate"));
    // The second traversal: `meta.files` is written from an uploaded file's own
    // name, so validating `paperId` alone leaves the read primitive reachable.
    expect(handler).toContain("realPathWithin(uploadDir");
    expect(handler).not.toMatch(/const texPath = join\(uploadDir, tf\);/);
  });

  it("the upload route checks both the identifier and the file name, and the write target", () => {
    const up = src.slice(src.indexOf('path === "/api/import/upload"'));
    const handler = up.slice(0, up.indexOf('path === "/api/import/arxiv"'));
    expect(handler).toContain("safeSegment(rawId)");
    expect(handler).toContain("safeSegment(basename(file.name))");
    expect(handler).toContain("writableWithin(UPLOADS_DIR()");
  });
});

describe("safeSegment(basename(x)) — the composition the upload route now uses", () => {
  // Worth pinning because neither half is sufficient alone and the order
  // matters. `basename` reduces a path to its last component; `safeSegment`
  // then rejects what `basename` legitimately returns but a path must not be.
  it("basename alone CONTAINS a traversal but does not reject it", () => {
    expect(basename("../../../../etc/passwd")).toBe("passwd");
    // input-site: inert #a9e1a1dc — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
    expect(basename("/etc/passwd")).toBe("passwd");
  });

  it("basename alone is NOT enough — `..` survives it", () => {
    expect(basename("../..")).toBe("..");
    // which is exactly what safeSegment exists to refuse
    expect(safeSegment(basename("../.."))).toBeUndefined();
  });

  it("an ordinary upload name passes through unchanged", () => {
    expect(safeSegment(basename("main.tex"))).toBe("main.tex");
    expect(safeSegment(basename("Paper 2026 (final).tex"))).toBe("Paper 2026 (final).tex");
  });

  it("a NUL-bearing name is refused outright, not truncated", () => {
    // `basename` does not strip NUL, so the refusal comes from `safeSegment` —
    // and it refuses rather than repairing, which is the whole point: a
    // truncated path is one the check and the kernel disagree about.
    expect(basename("main.tex\0.png")).toBe("main.tex\0.png");
    expect(safeSegment(basename("main.tex\0.png"))).toBeUndefined();
    expect(safeSegment("main\0.tex")).toBeUndefined();
  });
});

describe("MCP tools (src/tools) contain the paths their arguments name", () => {
  // Security review 2026-10-31: the HTTP handlers above were covered, the MCP
  // tools were not, and `translation_*` joined `source`, `po_file` and `locale`
  // straight into read and write paths. Same ratchet, same limits: it proves
  // the guard is next to the sink, not that every value reaching it is checked.
  const TOOLS = join(import.meta.dir, "../src/tools");
  const files = readdirSync(TOOLS).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
  const read = (f: string) => readFileSync(join(TOOLS, f), "utf-8");

  // A path built from a root and a bare variable. Literal-only joins
  // (`join(repoRoot, "beans", "defs")`) do not match.
  const SINK = /\b(join|resolve)\(\s*(repoRoot|root|process\.cwd\(\))\s*,\s*([A-Za-z_][A-Za-z0-9_.]*)\s*[,)]/;
  const GUARD = /\b(safeSegment|joinSegments|realPathWithin|writableWithin|resolveWithin)\(/;
  // Values that come from a committed file this tool wrote, not from an argument.
  const NOT_AN_ARGUMENT = new Set(["state.source"]);

  it("reads the tools directory — otherwise the checks below are vacuous", () => {
    expect(files.length).toBeGreaterThan(10);
    expect(files).toContain("translation.ts");
  });

  it("every root-plus-variable path has a containment check on the same or the next three lines", () => {
    const unguarded: string[] = [];
    let seen = 0;
    for (const f of files) {
      const lines = read(f).split("\n");
      lines.forEach((line, i) => {
        const m = line.match(SINK);
        if (!m) return;
        seen++;
        if (NOT_AN_ARGUMENT.has(m[3])) return;
        if (!GUARD.test(lines.slice(i, i + 4).join("\n"))) unguarded.push(`${f}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(seen).toBeGreaterThan(0);
    expect(unguarded).toEqual([]);
  });

  it("the pre-fix translation spellings are gone", () => {
    const src = read("translation.ts");
    for (const spelling of [
      "join(repoRoot, source)",
      "join(repoRoot, po_file)",
      "join(repoRoot, pot_file)",
      "join(repoRoot, inputPath)",
      "join(translationsRoot(repoRoot), locale)",
    ]) {
      expect(src).not.toContain(spelling);
    }
    expect(src).toContain('from "../core/safe-path.js"');
    expect(src).toContain("LocaleSchema");
  });
});
