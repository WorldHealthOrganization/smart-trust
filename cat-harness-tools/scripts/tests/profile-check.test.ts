/**
 * `content_profile_check` — the enforcement half of the profile split.
 *
 * This is the check that catches what schema validation structurally cannot:
 * a `theorem` is a valid `theorem` whatever folio it sits in, and
 * `constraints.ts` has no way to read `harness.config.json`. Without this, a
 * document folio accumulates math blocks and fails at *publication*, in a
 * renderer whose error mentions a missing `.lean` file and says nothing about
 * profiles.
 */
import { describe, test, expect, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

import { checkFolioProfile, readFolioProfile, formatProfileCheck } from "../../pipeline/profile-check";
import { writeInstanceConfig } from "../../test/support/instance-fixture.js";

const dirs: string[] = [];

function folio(contentType?: string): string {
  const d = mkdtempSync(join(tmpdir(), "folio-profile-"));
  dirs.push(d);
  mkdirSync(join(d, "folio", "doc", "ch"), { recursive: true });
  if (contentType !== undefined) {
    writeInstanceConfig(d, JSON.stringify({ contentType }));
  }
  return d;
}

/** Write a block manifest the textual walker will recognise. */
function block(root: string, dir: string, body: string): void {
  writeFileSync(join(dir, `${root}.ts`), body, "utf-8");
  writeFileSync(join(dir, `${root}.md`), "text\n", "utf-8");
}

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

describe("readFolioProfile", () => {
  test("reads the declared type and records where it came from", () => {
    const d = folio("document");
    const r = readFolioProfile(d);
    expect(r.profile).toBe("document");
    expect(r.declaredBy).toContain('contentType: "document"');
  });

  test("no config falls back to paper, and says it is a fallback", () => {
    const d = folio(undefined);
    const r = readFolioProfile(d);
    expect(r.profile).toBe("paper");
    expect(r.declaredBy).toContain("default");
  });

  test("an unparseable config is reported, not silently defaulted", () => {
    // Every other tool reading harness.config.json is equally in the dark here;
    // a report that says "paper" with no explanation hides that.
    const d = folio("document");
    writeInstanceConfig(d, "{ not json");
    const r = readFolioProfile(d);
    expect(r.profile).toBe("paper");
    expect(r.declaredBy).toContain("unreadable");
  });
});

describe("a conforming document folio", () => {
  test("passes with every document kind present", () => {
    const d = folio("document");
    const ch = join(d, "folio", "doc", "ch");
    block("a", ch, 'import { prose } from "x";\nexport default prose({ label: "prose:a" });\n');
    block("b", ch, 'import { remark } from "x";\nexport default remark({ label: "rem:b" });\n');
    block("c", ch, 'import { table } from "x";\nexport default table({ label: "tbl:c" });\n');

    const r = checkFolioProfile(d);
    expect(r.blocksChecked).toBe(3);
    expect(r.violations).toEqual([]);
    expect(formatProfileCheck(r)).toContain("✓");
  });
});

describe("violations", () => {
  test("a math kind in a document folio", () => {
    const d = folio("document");
    block("t", join(d, "folio", "doc", "ch"),
      'import { theorem } from "x";\nexport default theorem({ label: "thm:t" });\n');

    const r = checkFolioProfile(d);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0].reason).toBe("kind-outside-profile");
    expect(r.violations[0].kind).toBe("theorem");
    // The message has to name the remedy, or the author's only move is to
    // delete work they may legitimately want.
    expect(r.violations[0].detail).toContain('contentType: "paper"');
  });

  test("a `lean` field on a kind the document profile otherwise allows", () => {
    // Rule 1 alone would let this through: `remark` IS a document kind, and
    // its `lean` is optional on the type. The profile forbids populating it.
    const d = folio("document");
    block("r", join(d, "folio", "doc", "ch"),
      'import { remark } from "x";\nexport default remark({\n  label: "rem:r",\n  lean: { ref: "lean4:P/M#f" },\n});\n');

    const r = checkFolioProfile(d);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0].reason).toBe("lean-in-document");
    expect(r.violations[0].detail).toContain("manifest declares");
  });

  test("a `.lean` sibling with nothing in the manifest", () => {
    // Formalization can be carried by convention alone — <root>.lean beside
    // <root>.ts — so reading the manifest is not enough.
    const d = folio("document");
    const ch = join(d, "folio", "doc", "ch");
    block("s", ch, 'import { example } from "x";\nexport default example({ label: "ex:s" });\n');
    writeFileSync(join(ch, "s.lean"), "theorem foo : True := trivial\n", "utf-8");

    const r = checkFolioProfile(d);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0].reason).toBe("lean-in-document");
    expect(r.violations[0].detail).toContain("sibling");
  });

  test("the report names the file, so the finding is actionable", () => {
    const d = folio("document");
    block("t", join(d, "folio", "doc", "ch"),
      'import { lemma } from "x";\nexport default lemma({ label: "lem:t" });\n');
    const text = formatProfileCheck(checkFolioProfile(d));
    expect(text).toContain("lem:t");
    expect(text).toContain("t.ts");
    expect(text).toContain("✗");
  });
});

describe("the paper profile admits what the document profile forbids", () => {
  test("the same corpus passes as a paper and fails as a document", () => {
    const write = (d: string): void => {
      const ch = join(d, "folio", "doc", "ch");
      block("t", ch, 'import { theorem } from "x";\nexport default theorem({ label: "thm:t" });\n');
      block("p", ch, 'import { prose } from "x";\nexport default prose({ label: "prose:p" });\n');
    };
    const paper = folio("paper");
    write(paper);
    expect(checkFolioProfile(paper).violations).toEqual([]);

    const doc = folio("document");
    write(doc);
    expect(checkFolioProfile(doc).violations).toHaveLength(1);
  });
});

describe("an absent corpus", () => {
  test("no folio/ is zero blocks, not an error", () => {
    const d = mkdtempSync(join(tmpdir(), "folio-empty-"));
    dirs.push(d);
    writeInstanceConfig(d, JSON.stringify({ contentType: "document" }));
    const r = checkFolioProfile(d);
    expect(r.blocksChecked).toBe(0);
    expect(r.violations).toEqual([]);
  });
});
