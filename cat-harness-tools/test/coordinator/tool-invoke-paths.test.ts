/**
 * A Tool node that names a command which does not run is unreachable through its
 * own declaration — and nothing checked that.
 *
 * ## The defect
 *
 * **Nine of the forty-four checkable `invoke.shell` values named a path that does
 * not exist.** Every one was missing the `cat-harness/` prefix, stale since the
 * layer moved under that directory, so `bun run scripts/ingest-document.ts`
 * failed with `Module not found`. `ingest-stdlib` and `ingest-extended` had been
 * unreachable through their own declared invocation for as long as the inversion
 * has been in, and `check:tools` was green throughout.
 *
 * `code-node-review` says why nobody expected the audit to catch it: *"what no
 * audit can tell you: whether the mechanism a Tool describes is the one that
 * runs"*. True of WHAT the command does — not of whether it exists, which is a
 * path and a filesystem. The honest split is to check the mechanical half and
 * leave the rest to a reviewer, which is what this is.
 *
 * ## Two roots, and getting it backwards would have broken twenty nodes
 *
 * `invoke.shell` resolves against the REPOSITORY — it is a command a caller
 * types, and `package.json` and `.github/` live at the repo root.
 * `invoke.*.module` resolves against the LAYER — it is loaded by this
 * layer's own server, same convention as `maintains.source`.
 *
 * All twenty `inProcess.module` values are instance-relative and correct. The
 * field's docstring said *"Repo-relative"* while giving `src/tools/workflow.ts`
 * as its example, which is instance-relative and is where the file actually is:
 * **the word was stale and the values were right.** A check that resolved both
 * against one root would have reported twenty false defects, or none of the nine
 * real ones.
 *
 * @module test/tool-invoke-paths.test
 *
 * Moved here from `cat-harness/scripts/tests/tool-invoke-paths.test.ts` to the
 * checkout's own test home `test/` (bean `7zz1`, owner ruling 2026-10-06
 * "Top-level instance"): every test in it resolves every Tool node's paths
 * against the repository and the layer implementing it, cat-harness-tools
 * among them, which only the whole checkout holds. Standing alone, cat-harness
 * has none of it, and `check:cat-harness-standalone` collects every test in
 * that layer. Paths are composed from ORIGIN_DIR, the directory it was written
 * in, so nothing it reads changed.
 */
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { unresolvedPaths } from "../../scripts/check-tools.ts";
import { tools, toolsOf } from "../../tools/discover.js";
import { layerRootsIn } from "../../schemas/kg/cat-harness.js";
import { resolveImplementingPath } from "../../schemas/kg/harness-config.js";
import { resolveScriptCommand } from "../../scripts/lib/script-command.ts";

/** The directory this test was written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move to the checkout's test home (bean `7zz1`). */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");


const INSTANCE = resolve(ORIGIN_DIR, "../..");
const REPO = resolve(INSTANCE, "..");

describe("every declared path exists", () => {
  test("the corpus is clean", () => {
    // The assertion that would have failed before the fix, naming the offenders.
    expect(unresolvedPaths()).toEqual([]);
  });

  test("there are paths to check — a clean run over zero declarations is not coverage", () => {
    // Guards the assertion above from passing because nothing was examined.
    const withShell = tools().filter((t) => typeof t.invoke?.shell === "string");
    expect(withShell.length).toBeGreaterThan(20);
  });
});

describe("the two roots, asserted separately because conflating them breaks 20 nodes", () => {
  test("every `invoke.shell` path resolves against the REPOSITORY", () => {
    const broken: string[] = [];
    for (const t of tools()) {
      const shell = t.invoke?.shell;
      if (typeof shell !== "string") continue;
      const m = /^(?:bun|bunx) run ([^\s]+)/.exec(shell);
      const target = m?.[1] ?? (/^[.\w][\w./-]*\.(?:ts|sh|ya?ml)$/.test(shell) ? shell : undefined);
      if (target !== undefined && /\.(?:ts|sh|ya?ml)$/.test(target) && !existsSync(join(REPO, target))) {
        broken.push(`${t.id}: ${shell}`);
      }
    }
    expect(broken).toEqual([]);
  });

  test("every `inProcess.module` resolves against the INSTANCE that implements it, and NOT against the repo", () => {
    // The second half is the interesting one: it pins the convention, so a future
    // change that "helpfully" rewrites these to repo-relative fails here rather
    // than silently making twenty modules unloadable.
    //
    // "The instance" is the declaring one OR the one layer whose own `needs`
    // names it (owner ruling T1, bean `70lx`): the definitions stay here while
    // the code moves up a layer, and the path is not rewritten to say so.
    //
    // Each node is resolved from the layer that DECLARES it — the harness's
    // from cat-harness, sci's `lean-formal-edges` from folio-assistant-sci —
    // which is how both MCP servers resolve them (bean riit, 3c).
    const mods = layerRootsIn(REPO).flatMap((inst) =>
      toolsOf(inst)
        .map((t) => ({ inst, id: t.id, mod: (t.invoke as { inProcess?: { module?: string } })?.inProcess?.module }))
        .filter((x): x is { inst: string; id: string; mod: string } => typeof x.mod === "string"),
    );
    expect(mods.length).toBeGreaterThan(10);
    for (const { inst, id, mod } of mods) {
      expect(resolveImplementingPath(inst, mod).state, `${id}: ${mod} under the implementing instance`).toBe("found");
      expect(existsSync(join(REPO, mod)), `${id}: ${mod} must NOT be repo-relative`).toBe(false);
    }
  });
});

describe("what the check deliberately does NOT rule on", () => {
  test("a bare command is not reported as a missing path", () => {
    // `beans`, `jq` and the like are RUNTIME DEPENDENCIES, and `requires.runtime`
    // is where that claim lives. Reporting them as unresolved paths would make the
    // check unusable and would also be a lie — they are not paths.
    const bare = tools().filter((t) => {
      const sh = t.invoke?.shell;
      return typeof sh === "string" && !/^(?:bun|bunx) run /.test(sh) && !/\.(?:ts|sh|ya?ml)$/.test(sh);
    });
    expect(bare.length).toBeGreaterThan(0);
    const flagged = unresolvedPaths().map((u) => u.tool);
    for (const t of bare) expect(flagged).not.toContain(t.id);
  });

  test("a `package.json` script name is not treated as a path", () => {
    // `bun run cat kg:audit` names a script, not a file. Treating it as a path would
    // report every script-backed node as broken.
    const scripted = tools().filter((t) => {
      const sh = t.invoke?.shell;
      return typeof sh === "string" && /^bun run (?:cat )?[a-z][\w-]*:/.test(sh);
    });
    expect(scripted.length).toBeGreaterThan(5);
    const flagged = unresolvedPaths().map((u) => u.tool);
    for (const t of scripted) expect(flagged).not.toContain(t.id);
  });
});

/**
 * Owner, 2026-10-15 ("J2"): a Tool DEFINED in the harness names its command by
 * a script KEY (`bun run cat <key>`), and the layer that implements it declares
 * the command under that key (`checkoutScripts`), so the definition never names
 * the layer above it. The key is resolved when the command runs
 * (`run-script.ts`), and by any reader that needs the command itself.
 */
describe("a harness Tool names its command by a script key, resolved from a declaration", () => {
  test("a key resolves to the command its manifest declares, arguments kept", () => {
    const r = resolveScriptCommand(REPO, "bun run cat pdf:viewer --embed");
    expect(r?.key).toBe("pdf:viewer");
    expect(r?.command).toMatch(/\/scripts\/pdf-viewer\.ts --embed$/);
  });

  test("a key no manifest declares does not resolve, and is a finding rather than a pass", () => {
    expect(resolveScriptCommand(REPO, "bun run cat no-such:script-key")).toBeUndefined();
  });

  test("a command that is not a key comes back unchanged", () => {
    expect(resolveScriptCommand(REPO, "beans list")).toEqual({ command: "beans list" });
    expect(resolveScriptCommand(REPO, "bun run cat scripts/x.ts")).toEqual({ command: "bun run cat scripts/x.ts" });
  });

  test("no command or install line of the harness's own Tools names the tools layer's code", () => {
    const harness = layerRootsIn(REPO).find((r) => resolve(r) === INSTANCE)!;
    const lines = toolsOf(harness).flatMap((t) => [
      ...Object.values(t.invoke as Record<string, unknown>).filter((v): v is string => typeof v === "string").map((v) => ({ id: t.id, v })),
      ...Object.values(t.install as Record<string, unknown>).filter((v): v is string => typeof v === "string").map((v) => ({ id: t.id, v })),
    ]);
    expect(lines.length).toBeGreaterThan(20);
    const tooling = /(?:^|[\s"'/])cat-harness-tools\//;
    expect(lines.filter((l) => tooling.test(l.v)).map((l) => `${l.id}: ${l.v}`)).toEqual([]);
  });

  test("every key a harness Tool names is declared, so every one of them runs", () => {
    const harness = layerRootsIn(REPO).find((r) => resolve(r) === INSTANCE)!;
    const keyed = toolsOf(harness)
      .flatMap((t) => [t.invoke.shell, t.install.cli, t.install.container].filter((v): v is string => typeof v === "string" && /^bun run cat [^\s]+/.test(v)).map((v) => ({ id: t.id, v })));
    expect(keyed.length).toBeGreaterThan(40);
    expect(keyed.filter((k) => resolveScriptCommand(REPO, k.v) === undefined).map((k) => `${k.id}: ${k.v}`)).toEqual([]);
  });
});
