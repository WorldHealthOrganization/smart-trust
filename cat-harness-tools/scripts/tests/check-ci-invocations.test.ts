/**
 * `check:ci-invocations` reads the direct `--check` calls out of workflow YAML.
 *
 * cat-harness-tools#1701: smart-ips-pilgrimage's workflows run
 * `bun input/scripts/translation-pot.ts --check` with no `run`, which the
 * matcher missed, so the gate found nothing there and exited 2.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ciInvocations } from "../check-ci-invocations.ts";

function over(yml: string) {
  const dir = mkdtempSync(join(tmpdir(), "ci-invocations-"));
  try {
    writeFileSync(join(dir, "w.yml"), yml);
    return ciInvocations(dir).map((i) => `${i.script} ${i.args.join(" ")}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("ciInvocations", () => {
  test("`bun run <script>.ts --check` is found, as before", () => {
    expect(over("        run: bun run cat-harness-tools/scripts/gen-x.ts --strict --check\n")).toEqual([
      "cat-harness-tools/scripts/gen-x.ts --strict --check",
    ]);
  });

  test("`bun <script>.ts --check` with no `run` is found too", () => {
    expect(over("        run: bun input/scripts/translation-pot.ts --check\n")).toEqual(["input/scripts/translation-pot.ts --check"]);
  });

  test("the bare form ends at a shell operator or a comment", () => {
    expect(over("  run: bun scripts/y.ts --check --quiet && echo ok\n  run: bun scripts/z.ts --check  # why\n")).toEqual([
      "scripts/y.ts --check --quiet",
      "scripts/z.ts --check",
    ]);
  });

  test("a bare call with an argument it cannot reproduce is not run cut short", () => {
    expect(over('  out="$(bun cat-harness-tools/scripts/subgraph-readmes.ts --check --repo "$own" 2>&1)"\n')).toEqual([]);
  });
});
