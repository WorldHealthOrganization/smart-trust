/**
 * `buildPaper` hands every block it loads to the `block-status-overlay` slot
 * (bean `saqd`, row `pipeline/build.ts`): the science layer fills it with the
 * live Lean status overlay that used to be written here. With the slot filled
 * the overlay sees each block, its `.ts` and the paper directory; with nothing
 * filling it the build goes on and the blocks keep their manifests' status.
 */
import { afterAll, afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ContributionRegistry } from "../schemas/content/contributions.ts";
import { buildPaper } from "./build";
import { usePipelinePluginRegistry } from "./pipeline-plugins";

const TMP = mkdtempSync(join(tmpdir(), "build-status-overlay-"));
const paperDir = join(TMP, "paper");
mkdirSync(join(paperDir, "ch"), { recursive: true });
writeFileSync(join(paperDir, "paper.ts"), `export default { title: "P", chapters: [{ dir: "ch" }] };\n`);
writeFileSync(join(paperDir, "ch", "ch.ts"), `export default { title: "C", sections: [{ title: "S", blocks: ["rem-a"] }] };\n`);
writeFileSync(
  join(paperDir, "ch", "rem-a.ts"),
  `export default { kind: "remark", label: "rem:a", lean: { ref: "x:X.a", validation: "not_checked" } };\n`,
);
writeFileSync(join(paperDir, "ch", "rem-a.md"), "A remark.\n");

afterEach(() => usePipelinePluginRegistry(undefined));
afterAll(() => rmSync(TMP, { recursive: true, force: true }));

describe("the block-status-overlay slot", () => {
  it("a filled slot is handed each block, its .ts and the paper directory", async () => {
    const seen: Array<{ label: string; tsPath: string; paperDir: string }> = [];
    const reg = new ContributionRegistry();
    reg.register({
      name: "dep-overlay",
      pipelinePlugins: [
        {
          kind: "block-status-overlay",
          implementation: {
            overlay: (block: { label: string }, tsPath: string, dir: string) => {
              seen.push({ label: block.label, tsPath, paperDir: dir });
            },
          },
        },
      ],
    });
    usePipelinePluginRegistry(reg);
    const res = await buildPaper(join(paperDir, "paper.ts"));
    expect(res.issues.filter((i) => i.message.startsWith("Failed to load block"))).toEqual([]);
    expect(seen).toEqual([{ label: "rem:a", tsPath: join(paperDir, "ch", "rem-a.ts"), paperDir }]);
  });

  it("an unfilled slot is skipped: the block still loads, with no error", async () => {
    usePipelinePluginRegistry(new ContributionRegistry());
    const res = await buildPaper(join(paperDir, "paper.ts"));
    expect(res.issues.filter((i) => i.message.startsWith("Failed to load block"))).toEqual([]);
    expect(res.chapters.size).toBe(1);
  });
});
