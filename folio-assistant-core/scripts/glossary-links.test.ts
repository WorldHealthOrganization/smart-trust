import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findings } from "./glossary-links.ts";

const root = mkdtempSync(join(tmpdir(), "gl-"));
mkdirSync(join(root, "folio"), { recursive: true });
writeFileSync(join(root, "folio", "g.md"), "| Term | Definition |");
const term = (id: string, source?: string) => ({ instance: "hb", scheme: "hb", id, label: id, root, ...(source ? { source } : {}) });

describe("glossary-links (folio-assistant-core#498, warn-only)", () => {
  test("missingSourceReported", () => {
    const f = findings([term("a", "folio/g.md#L1"), term("b", "folio/gone.md"), term("c", "who-iris/library/x.md")], [], new Map());
    expect(f.map((x) => [x.kind, x.where])).toEqual([["source-missing", "hb/hb/b"]]);
  });

  test("unknownDefinesReported", () => {
    const f = findings([term("a")], [{ source: "folio/p.md", defines: ["a", "zz"] }], new Map());
    expect(f.map((x) => [x.kind, x.where, x.message.slice(0, 12)])).toEqual([["defines-unknown", "folio/p.md", 'defines "zz"']]);
  });

  test("unusedOnlyWithAll", () => {
    expect(findings([term("a")], [], new Map())).toEqual([]);
    expect(findings([term("a")], [], new Map(), true).map((x) => x.kind)).toEqual(["unused"]);
    expect(findings([term("a")], [], new Map([["hb--hb--a", []]]), true)).toEqual([]);
  });
});
