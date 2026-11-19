/**
 * A general node's prose may name a file; the name has to still resolve
 * (bean `epbt`). Four states, and only one is a finding.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { classifyName, diagramProse, generalDeclarationProse, namedFiles } from "../prose-names.js";

describe("namedFiles — what prose names", () => {
  test("paths, bare names and backticked names are all read, once each", () => {
    expect(
      namedFiles("`feature-staging.yml` publishes; see docs/proposals/x.md and feature-staging.yml again."),
    ).toEqual(["feature-staging.yml", "docs/proposals/x.md"]);
  });

  test("a URL is not a file in this checkout", () => {
    expect(namedFiles("see https://example.org/spec/core.json for the schema")).toEqual([]);
  });

  test("a word ending in a dot is not a file", () => {
    expect(namedFiles("It is done. Then the next step.")).toEqual([]);
  });
});

describe("classifyName — four states", () => {
  const root = mkdtempSync(join(tmpdir(), "prose-names-"));
  mkdirSync(join(root, "notes", "proposals"), { recursive: true });
  writeFileSync(join(root, "notes", "proposals", "here.md"), "x");
  const basenames = new Set(["feature-staging.yml"]);

  test("a path that exists resolves", () => {
    expect(classifyName("notes/proposals/here.md", [root], basenames)).toBe("resolves");
  });

  test("a bare name some tracked file carries resolves", () => {
    expect(classifyName("feature-staging.yml", [root], basenames)).toBe("resolves");
  });

  test("a glob or placeholder is not a path", () => {
    expect(classifyName("processes/*.bpmn", [root], basenames)).toBe("not-a-path");
    expect(classifyName("<slug>.md", [root], basenames)).toBe("not-a-path");
  });

  test("a bare name nothing carries is UNDETERMINED — an output or example as often as stale", () => {
    expect(classifyName("qa.json", [root], basenames)).toBe("undetermined");
  });

  test("a path in a directory that is not here is UNDETERMINED — no claim this checkout can refute", () => {
    expect(classifyName("work/work.json", [root], basenames)).toBe("undetermined");
  });

  test("a path whose directory IS here and whose file is not is MISSING — the one finding", () => {
    expect(classifyName("notes/proposals/gone.md", [root], basenames)).toBe("missing");
  });

  test("any root may resolve it — a sibling instance's path spelled from its own root", () => {
    const sibling = mkdtempSync(join(tmpdir(), "prose-names-sib-"));
    mkdirSync(join(sibling, "schemas"), { recursive: true });
    writeFileSync(join(sibling, "schemas", "m.ts"), "x");
    expect(classifyName("schemas/m.ts", [root, sibling], basenames)).toBe("resolves");
  });
});

describe("where general prose is read from", () => {
  test("a @general declaration's doc comment and body are read; others are not", () => {
    const src =
      "/**\n * The thing. @general\n * See `scripts/a.ts`.\n */\nexport interface G {\n  /** Read by `scripts/b.ts`. */\n  x: string;\n}\n" +
      "/** Not general. `scripts/c.ts` */\nexport interface H {\n  y: string;\n}\n";
    const got = generalDeclarationProse(src);
    expect(got.map((g) => g.name)).toEqual(["G"]);
    expect(namedFiles(got[0]!.prose)).toEqual(["scripts/a.ts", "scripts/b.ts"]);
  });

  test("a diagram's documentation is read, entity-decoded; its XML comments are not", () => {
    const xml =
      "<!-- see docs/old.md -->" +
      "<bpmn:process><bpmn:documentation>`x.ts` &amp; docs/new.md</bpmn:documentation></bpmn:process>";
    expect(namedFiles(diagramProse(xml))).toEqual(["x.ts", "docs/new.md"]);
  });
});
