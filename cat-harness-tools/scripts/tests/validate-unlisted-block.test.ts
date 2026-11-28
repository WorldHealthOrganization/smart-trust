/**
 * no-unlisted-block — a block on disk that no section lists (bean `eqly`).
 *
 * The other direction, listed and absent, is already an error
 * (`Block manifest not found`); one test pins that too, so the pair the bean
 * asked for is covered in one place.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { validateObjects } from "../../pipeline/validate";
import type { ValidationIssue } from "../../schemas/types.ts";

type Sec = { title: string; blocks: string[] } | { name: string };

/** A chapter directory `ch/` with `ch.ts` listing `sections`, and a `.ts` + `.md` per block. */
function chapter(sections: Sec[], blocks: string[], extra: Record<string, string> = {}): { root: string; dir: string } {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "unlisted-")));
  const dir = join(root, "ch");
  mkdirSync(dir);
  writeFileSync(join(dir, "ch.ts"), `export default ${JSON.stringify({ title: "Chapter", sections })};\n`);
  for (const b of blocks) {
    writeFileSync(join(dir, `${b}.ts`), `export default { kind: "prose", label: "rem:${b}", title: "T", chapter: "ch" };\n`);
    writeFileSync(join(dir, `${b}.md`), `Body of ${b}.\n`);
  }
  for (const [f, body] of Object.entries(extra)) writeFileSync(join(dir, f), body);
  return { root, dir };
}

const unlisted = (issues: ValidationIssue[]) => issues.filter((i) => i.message.includes("[unlisted-block]"));

describe("no-unlisted-block", () => {
  test("flags a block on disk that no section lists, as a warning naming it", async () => {
    const { root, dir } = chapter([{ title: "S", blocks: ["alpha"] }], ["alpha", "ghost"]);
    const { issues } = await validateObjects(dir);
    const found = unlisted(issues);
    expect(found.map((i) => i.block)).toEqual(["ghost"]);
    expect(found[0]!.level).toBe("warning");
    rmSync(root, { recursive: true, force: true });
  });

  test("a block listed only in a subsection is listed", async () => {
    const { root, dir } = chapter(
      [{ title: "S", blocks: ["alpha"], subsections: [{ title: "Sub", blocks: ["beta"] }] } as Sec],
      ["alpha", "beta"],
    );
    expect(unlisted((await validateObjects(dir)).issues)).toEqual([]);
    rmSync(root, { recursive: true, force: true });
  });

  test("the chapter's own manifest and a non-block helper module are not blocks", async () => {
    const { root, dir } = chapter([{ title: "S", blocks: ["alpha"] }], ["alpha"], {
      "helpers.ts": "export default { notABlock: true };\n",
    });
    expect(unlisted((await validateObjects(dir)).issues)).toEqual([]);
    rmSync(root, { recursive: true, force: true });
  });

  test("a section reference makes membership undetermined: said once as info, no orphans claimed", async () => {
    const { root, dir } = chapter([{ title: "S", blocks: ["alpha"] }, { name: "elsewhere" }], ["alpha", "ghost"]);
    const { issues } = await validateObjects(dir);
    expect(unlisted(issues)).toEqual([]);
    const notes = issues.filter((i) => i.message.includes('check "no-unlisted-block" could not determine'));
    expect(notes.length).toBe(1);
    expect(notes[0]!.level).toBe("info");
    rmSync(root, { recursive: true, force: true });
  });

  test("the other direction: listed in a section, absent from disk, is an error", async () => {
    const { root, dir } = chapter([{ title: "S", blocks: ["alpha", "missing"] }], ["alpha"]);
    const { issues } = await validateObjects(dir);
    const missing = issues.filter((i) => i.message.startsWith("Block manifest not found"));
    expect(missing.length).toBe(1);
    expect(missing[0]!.level).toBe("error");
    rmSync(root, { recursive: true, force: true });
  });
});
