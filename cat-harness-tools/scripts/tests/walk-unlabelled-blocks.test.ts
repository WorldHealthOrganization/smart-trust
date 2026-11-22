import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { readUnlabelledBlockManifest, walkBlocks } from "../../pipeline/qa-utils";

/**
 * `walkBlocks` answers two different questions with one enumeration: "what is
 * in the dependency graph?" and "what prose ships?". Those diverge for
 * `prose()` blocks with no `label:` — chapter intros and outros, the notation
 * register. A block with no label cannot be a graph node, so the graph is right
 * to skip it; but 63 such blocks in the `qou` corpus carried 27,390 words that
 * no criterion could reach, while already holding `.qa.json` sidecars the sweep
 * could never refresh. See `qou/3fui`.
 *
 * The option separates the two questions. These tests pin that it stays
 * separated — the default must not start yielding unlabelled blocks into the
 * graph — and that the looser path did not reopen the hole `#125` closed.
 */
describe("walkBlocks: unlabelled prose", () => {
  const root = mkdtempSync(join(tmpdir(), "walk-unlabelled-"));
  const ch = join(root, "chapter-one");
  mkdirSync(ch, { recursive: true });

  writeFileSync(
    join(ch, "labelled.ts"),
    'import { proposition } from "x";\nexport default proposition({ label: "prop:a", title: "A" });\n',
  );
  writeFileSync(
    join(ch, "outro.ts"),
    'import { prose } from "x";\nexport default prose({ title: "Chapter close" });\n',
  );
  writeFileSync(join(ch, "outro.md"), "Some closing narrative.\n");
  // The `#125` shape: manifest source inside a template literal.
  writeFileSync(
    join(ch, "audit-script.ts"),
    "const ok = parse(`export default proposition({ label: \"prop:x\" });`);\nconsole.log(ok);\n",
  );

  const labels = (opts?: { includeUnlabelled?: boolean }): string[] =>
    [...walkBlocks(root, opts)].map((b) => b.label).sort();

  test("by default an unlabelled prose block is not yielded", () => {
    expect(labels()).toEqual(["prop:a"]);
  });

  test("with includeUnlabelled it is yielded under its slug", () => {
    expect(labels({ includeUnlabelled: true })).toEqual(["outro", "prop:a"]);
  });

  test("the unlabelled block still carries its .md, so criteria can read it", () => {
    const outro = [...walkBlocks(root, { includeUnlabelled: true })].find(
      (b) => b.label === "outro",
    );
    expect(outro?.md?.endsWith("outro.md")).toBe(true);
    expect(outro?.kind).toBe("prose");
  });

  test("the looser path does NOT readmit a builder inside a string literal", () => {
    // The regression #125 fixed. Neither mode may yield the audit script.
    expect(labels()).not.toContain("audit-script");
    expect(labels({ includeUnlabelled: true })).not.toContain("audit-script");
  });

  test("readUnlabelledBlockManifest declines a block that HAS a label", () => {
    // Labelled blocks belong to readBlockManifest; two paths claiming one file
    // is how the identity would drift.
    expect(readUnlabelledBlockManifest(join(ch, "labelled.ts"))).toBeUndefined();
  });

  test("readUnlabelledBlockManifest declines a non-manifest", () => {
    expect(readUnlabelledBlockManifest(join(ch, "audit-script.ts"))).toBeUndefined();
    expect(readUnlabelledBlockManifest(join(ch, "nope.ts"))).toBeUndefined();
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });
});
