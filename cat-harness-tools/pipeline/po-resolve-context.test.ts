/**
 * `poResolveContext` — the folio-level half of PO resolution, built once.
 *
 * Bean `ksg3`: a sweep that rebuilt the instance graph per (block, locale)
 * spent 98% of `translation-block-qa --check` doing it. Passing the context in
 * is only a speed-up if it changes NOTHING about what resolves, so every case
 * here asserts the two calls agree — same files, same order, same labels.
 *
 * A file of its own rather than a block in `po-resolve.test.ts`, whose fixture
 * header another branch is rewriting; the fixture here is under the system
 * temp directory for the reason `dlqu` gives there.
 */
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { poResolveContext, resolvePoSources } from "./po-resolve";
import { writeInstanceConfig } from "../test/support/instance-fixture.js";

const TMP = mkdtempSync(join(tmpdir(), "test_po_resolve_context-"));
const DEP = join(TMP, "dep-folio");
const SILENT = join(TMP, "silent-dep");

function po(dir: string, name: string) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), `msgid "x"\nmsgstr "${name}"\n`, "utf-8");
}

beforeAll(() => {
  for (const f of ["my-block.po", "chapter-01.po", "global.po"]) po(join(TMP, "tr", "fr"), f);
  po(join(DEP, "translations", "fr"), "my-block.po");
  po(join(DEP, "translations", "fr"), "global.po");
  // A dependency that declares it provides no translations, though it has one.
  po(join(SILENT, "translations", "fr"), "global.po");
  writeInstanceConfig(DEP, JSON.stringify({ translation: { translationDir: "translations" } }));
  writeInstanceConfig(SILENT, JSON.stringify({}));
  writeInstanceConfig(TMP, JSON.stringify({
    translation: { translationDir: "tr" },
    dependencies: {
      folioAssistant: [
        { name: "dep-folio", path: DEP },
        { name: "silent-dep", path: SILENT, provides: ["skills"] },
      ],
    },
  }));
});

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe("poResolveContext", () => {
  it("names the folio's own directory and only the dependencies that provide translations", () => {
    const ctx = poResolveContext(TMP);
    expect(ctx.translationDir).toBe(join(TMP, "tr"));
    expect(ctx.dependencies).toEqual([
      { name: "dep-folio", translationDir: join(DEP, "translations") },
    ]);
  });

  const cases: [string, string | undefined, string][] = [
    ["my-block", "chapter-01", "fr"],
    ["my-block", undefined, "fr"],
    ["absent", "chapter-01", "fr"],
    ["my-block", "chapter-01", "es"],
  ];
  it.each(cases.map(([b, s, l]) => [b, s ?? "-", l, s] as const))("resolves %s/%s/%s exactly as without a context", (blockStem, _slug, locale, chapterSlug) => {
    const opts = { folioRoot: TMP, locale, blockStem, chapterSlug };
    const without = resolvePoSources(opts);
    const withCtx = resolvePoSources(opts, poResolveContext(TMP));
    expect(withCtx).toEqual(without);
  });

  it("only the folio-level half is fixed — a .po added after the context was built is still found", () => {
    const before = poResolveContext(TMP);
    po(join(TMP, "tr", "fr"), "late.po");
    const opts = { folioRoot: TMP, locale: "fr", blockStem: "late" };
    expect(resolvePoSources(opts, before).map((s) => s.resolution)).toContain("block");
    expect(resolvePoSources(opts).map((s) => s.resolution)).toContain("block");
  });
});
