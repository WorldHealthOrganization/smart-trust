/**
 * Phase 2 of `validate.ts` merges each vocabulary module's constraint context
 * into every block's (bean `saqd`, row `pipeline/validate.ts`). The science
 * layer's `mathpaper` vocabulary contributes the sibling `.lean` its
 * `lean-stub-conjecture-kind-check` reads, which `validate.ts` built itself
 * until then; this holds the composition end to end, so the rule still fires.
 *
 * Skipped when no discovered vocabulary contributes a context (a composition
 * that mounts no mathematics), and said so rather than passed.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { validateObjects } from "../../pipeline/validate";
import { vocabularies } from "../../schemas/content/vocabulary-modules.ts";

const mathpaper = vocabularies().find((v) => v.adapter === "mathpaper" && v.constraintContext);

describe("validate composes vocabulary constraint context", () => {
  test.skipIf(!mathpaper)("a sibling .lean the vocabulary reads reaches its rule", async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), "vocab-ctx-")));
    try {
      const dir = join(root, "ch");
      mkdirSync(dir);
      writeFileSync(join(dir, "ch.ts"), `export default ${JSON.stringify({ title: "C", sections: [{ title: "S", blocks: ["prop-a"] }] })};\n`);
      writeFileSync(join(dir, "prop-a.ts"), `export default { kind: "proposition", label: "prop:a", title: "A", chapter: "ch" };\n`);
      writeFileSync(join(dir, "prop-a.md"), "Body.\n");
      const kindCheck = (issues: { message: string }[]) => issues.filter((i) => i.message.startsWith("Kind mismatch: prop:a"));

      expect(kindCheck((await validateObjects(dir)).issues)).toEqual([]);
      writeFileSync(join(dir, "prop-a.lean"), "-- conjectural sibling stub\n");
      expect(kindCheck((await validateObjects(dir)).issues)).toHaveLength(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
