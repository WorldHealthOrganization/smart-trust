/**
 * `content_list` reports a block's kind by reading the BUILDER it calls.
 *
 * It used to match `/kind:\s*["'](\w+)["']/` against the manifest source, and
 * no builder-authored manifest contains that: `prose({ label: … })` produces
 * `kind: "prose"` at *runtime*, and the source never spells it out. So the
 * match failed on every block in every folio and fell through to the
 * `"unknown"` default — found by scaffolding a real folio and listing it.
 *
 * These tests pin the property `content_list` now depends on, and pin that the
 * old regex genuinely could not have satisfied it. Asserting the fix works
 * without also asserting the old approach failed would leave open that the two
 * were equivalent and something else was wrong.
 */
import { describe, test, expect, afterEach } from "bun:test";
import { existsSync, mkdtempSync, rmSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

import {
  readBlockManifest,
  readUnlabelledBlockManifest,
} from "../../pipeline/qa-utils";
import { initFolio, templatesDirs } from "../init-folio";
import { notApplicableAlone } from "../../test/support/checkout.ts";

const dirs: string[] = [];

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

/** Scaffold a folio and return its first chapter directory. */
function scaffoldChapter(contentType: "paper" | "document"): string {
  const d = mkdtempSync(join(tmpdir(), "content-list-"));
  dirs.push(d);
  initFolio({
    targetDir: d,
    contentType,
    slug: "cold-chain-guidance",
    title: "Cold Chain Guidance",
    authors: ["A. Author"],
    link: "sibling",
    assistantPath: "folio-assistant",
    skipVcs: true,
  });
  return join(d, "folio", "cold-chain-guidance", "introduction");
}

/** What `content_list` reads for one `.ts`, exactly as the tool does. */
function identify(tsPath: string): { kind: string; label: string } | undefined {
  return readBlockManifest(tsPath) ?? readUnlabelledBlockManifest(tsPath);
}

/** The detector `content_list` used before the fix. */
function legacyKind(tsPath: string): string {
  return readFileSync(tsPath, "utf-8").match(/kind:\s*["'](\w+)["']/)?.[1] ?? "unknown";
}

/**
 * A paper folio is scaffolded from the `paper` template profile, which a layer
 * above holds (folio-assistant-sci, move M11): without it there is no paper
 * folio to list (bean w1gy F18). A lookup that throws guards nothing.
 */
const NO_PAPER_PROFILE = ((): boolean => {
  let held: boolean;
  try {
    held = templatesDirs().some((d) => existsSync(join(d, "paper")));
  } catch {
    return false;
  }
  return !held && notApplicableAlone("the `paper` folio-template profile, which folio-assistant-sci (a higher instance) holds");
})();

describe("block identification in a scaffolded folio", () => {
  test("a builder-authored block reports its real kind and label", () => {
    const ch = scaffoldChapter("document");
    const block = identify(join(ch, "overview.ts"));
    expect(block).toBeDefined();
    expect(block!.kind).toBe("prose");
    expect(block!.label).toBe("prose:overview");
  });

  test("the old regex could not have found it — this is the regression", () => {
    const ch = scaffoldChapter("document");
    // The manifest genuinely contains no literal `kind:`; that is the point.
    const src = readFileSync(join(ch, "overview.ts"), "utf-8");
    expect(src).toContain("prose({");
    expect(src).not.toMatch(/kind:\s*["']/);
    expect(legacyKind(join(ch, "overview.ts"))).toBe("unknown");
  });

  test("the chapter manifest is not a block", () => {
    // It sits in the same directory as the blocks, and was being listed as one
    // of that chapter's content objects.
    const ch = scaffoldChapter("document");
    expect(identify(join(ch, "introduction.ts"))).toBeUndefined();
  });

  test.skipIf(NO_PAPER_PROFILE)("exactly one .ts in the starter chapter is a block", () => {
    // The `(N blocks)` header counts what is listed; before the fix it counted
    // `.ts` files, which is two here.
    const ch = scaffoldChapter("paper");
    const tsFiles = readdirSync(ch).filter((f) => f.endsWith(".ts"));
    expect(tsFiles).toHaveLength(2);
    expect(tsFiles.filter((f) => identify(join(ch, f)))).toHaveLength(1);
  });
});
