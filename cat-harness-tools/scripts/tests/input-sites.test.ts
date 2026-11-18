/**
 * Bean `f017` — the input-site audit (`input-sites.ts`), the runtime trace
 * (`input-trace.ts`) and what they make `input-hash.ts` refuse.
 *
 * The falsifier the bean names is a check skipped while something it reads
 * has changed. Each "refuses" test below hands the fingerprint a source that
 * reads something the hash cannot see, and asserts it is UNDETERMINED (the
 * check runs). The "hashes" tests change a value a verdict names and assert
 * the fingerprint moves. The last block holds the data claims that `imports`
 * and `scripts` annotations in this repository make to the data they depend on.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

import { instanceDirectoriesForGraph } from "../../schemas/kg/cat-harness.ts";
import { declaredDirectories } from "../../schemas/kg/declared-nodes.ts";
import { orderedDependencies } from "../../schemas/kg/harness-config.ts";
import { defaultGraphTypologies } from "../../schemas/kg/graph-typology-registry.ts";
import { moduleRootOf, parseValidatorRef } from "../../schemas/kg/kind-validator.ts";
import { layerRootsIn } from "../../schemas/kg/instance-roots.ts";
import { INSTANCE_THEMES_MODULE, THEMES_GRAPH_TYPOLOGY } from "../../schemas/ui/theme-by-ref.ts";

import { blankSource, auditClosure, isChildSpawn, mainBlockLines, outsideTemplates, parseVerdicts, scanSource, SiteMemo, statementPin } from "../input-sites.ts";
import { pluginTableModules, toolRegistrarModules, validatorModules } from "../declared-imports.ts";
import { discoverTools } from "../../tools/discover.ts";
import { resolveModule } from "../tool-api.ts";
import { checkFingerprint, entryFiles, FileDigests, TRACKED, type Fingerprint } from "../input-hash.ts";
import { openTrace, qaRefLine, TRACE_ENV } from "../../schemas/sdlc/input-trace.ts";
import { HARNESS_ROOT, TOOLS_ROOT } from "../lib/roots.ts";
import { dirname } from "node:path";

const isUndetermined = (f: Fingerprint, needle?: string) => {
  expect("undetermined" in f).toBe(true);
  if (needle !== undefined) expect((f as { undetermined: string }).undetermined).toContain(needle);
};
const hashOf = (f: Fingerprint) => {
  if (!("hash" in f)) throw new Error(`expected a hash, got: ${f.undetermined}`);
  return f.hash;
};
/** The pin `scanSource` wants for the first site in `src`. */
const pinOf = (src: string) => scanSource("x.ts", src)[0]!.pin;

describe("the scanner", () => {
  test("text in comments and strings is not a site; code is", () => {
    const src = [
      "// process.env.A in a line comment",
      "/* Date.now() in a block comment */",
      'const s = "process.env.B is a string";',
      "const t = `${process.env.C} in a template expression`;",
      "const r = /process\\.env\\.D/;",
      "const u = Date.now();",
    ].join("\n");
    expect(scanSource("x.ts", src).map((s) => [s.line, s.risks])).toEqual([
      [4, ["env"]],
      [6, ["clock"]],
    ]);
  });

  test("a plain named import is not a site; a renamed or namespace import of a risky module is", () => {
    const src = [
      'import { spawnSync } from "node:child_process";',
      'import {\n  execFileSync,\n} from "node:child_process";',
      'import * as cp from "node:child_process";',
      'import { tmpdir as td } from "node:os";',
    ].join("\n");
    expect(scanSource("x.ts", src).map((s) => s.line)).toEqual([5, 6]);
  });

  test("regex `.exec(` and `typeof spawnSync` are not spawns", () => {
    expect(scanSource("x.ts", "const m = re.exec(line);\nlet r: ReturnType<typeof spawnSync>;\n")).toEqual([]);
  });

  test("an annotation is read, pinned, and goes stale when its statement changes", () => {
    const site = 'const r = spawnSync("git", ["ls-files"]);';
    const ok = `// input-site: tree #${pinOf(site)} — the index\n${site}\n`;
    expect(scanSource("x.ts", ok)[0]!.verdicts).toEqual([{ kind: "tree" }]);
    const edited = ok.replace("ls-files", "log");
    expect(scanSource("x.ts", edited)[0]!.verdicts).toBe("stale");
  });

  test("a statement's pin covers its continuation lines", () => {
    const a = ['const r = spawnSync(', '  "git",', '  ["ls-files"],', ");"];
    const b = ['const r = spawnSync(', '  "git",', '  ["log"],', ");"];
    expect(statementPin(a, 0)).not.toBe(statementPin(b, 0));
  });

  test("verdicts parse, and a bad one is malformed rather than accepted", () => {
    expect(parseVerdicts("env A,B; tree")).toEqual([{ kind: "env", names: ["A", "B"] }, { kind: "tree" }]);
    expect(parseVerdicts("refs origin/main")).toEqual([{ kind: "refs", names: ["origin/main"] }]);
    expect("error" in (parseVerdicts("vibes") as object)).toBe(true);
    expect("error" in (parseVerdicts("env") as object)).toBe(true);
    expect("error" in (parseVerdicts("tree x") as object)).toBe(true);
    const site = "const v = process.env.X;";
    const bad = scanSource("x.ts", `// input-site: vibes #${pinOf(site)} — no\n${site}\n`)[0]!;
    expect(bad.malformed).toContain("unknown verdict");
  });

  test("`traced` needs the inputSiteReached() hook directly above the site, and the hook needs `traced`", () => {
    const site = "const t = Date.now();";
    const pin = pinOf(site);
    const good = scanSource("x.ts", `// input-site: traced #${pin} — w\ninputSiteReached("w");\n${site}\n`)[0]!;
    expect(good.verdicts).toEqual([{ kind: "traced" }]);
    expect(scanSource("x.ts", `// input-site: traced #${pin} — w\n${site}\n`)[0]!.malformed).toContain("inputSiteReached");
    expect(scanSource("x.ts", `// input-site: inert #${pin} — w\ninputSiteReached("w");\n${site}\n`)[0]!.malformed).toContain("traced");
  });

  test("an `if (import.meta.main) { … }` block is found on the blanked source", () => {
    const src = 'const a = 1;\nif (import.meta.main) {\n  const s = "}";\n  run();\n}\nconst b = 2;\n';
    expect([...mainBlockLines(blankSource(src))]).toEqual([1, 2, 3, 4]);
  });
});

describe("the fingerprint refuses what it cannot see", () => {
  let root: string;
  const scripts = { "c:check": "bun run scripts/c.ts --check", "s:check": "bash scripts/s.sh" };
  const tracked = { inputs: [TRACKED], outputs: [] };
  const globbed = { inputs: ["src/**/*.md"], outputs: [] };
  const git = (...args: string[]) => {
    const r = Bun.spawnSync(["git", ...args], { cwd: root, stdout: "pipe", stderr: "pipe" });
    if (r.exitCode !== 0) throw new Error(r.stderr.toString());
  };
  const commit = (msg: string) => {
    git("add", "-A");
    git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", msg);
  };
  const write = (rel: string, text: string) => {
    mkdirSync(join(root, rel, ".."), { recursive: true });
    writeFileSync(join(root, rel), text);
  };
  /** Write `scripts/lib.ts` with one site, annotated with `verdict` and its correct pin. */
  const lib = (statement: string, verdict?: string) => {
    const line = `export const v = () => ${statement.replace(/^const \w+ = /, "")}`;
    const head = verdict === undefined ? "" : `// input-site: ${verdict} #${pinOf(line)} — test\n`;
    write("scripts/lib.ts", `${head}${line}\n`);
  };
  const fp = (io = tracked, script = "c:check") => checkFingerprint(root, scripts, script, io, new FileDigests(root));

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "f017-sites-"));
    write("scripts/c.ts", 'import { v } from "./lib.ts";\nconsole.log(v());\n');
    write("scripts/lib.ts", "export const v = () => 1;\n");
    write("scripts/s.sh", "echo hi\n");
    write("src/a.md", "a\n");
    write(".gitignore", "build/\nignored/\n");
    git("init", "-q");
    commit("fixture");
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  test("a clean closure hashes", () => {
    hashOf(fp());
  });

  test("an UNANNOTATED site anywhere in the import closure", () => {
    lib("process.env.SECRET_SWITCH;");
    isUndetermined(fp(), "unannotated input site at scripts/lib.ts:1 (env)");
  });

  test("a STALE pin", () => {
    write("scripts/lib.ts", '// input-site: tree #00000000 — wrong pin\nexport const v = () => Bun.spawnSync(["git", "ls-files"]);\n');
    isUndetermined(fp(), "stale input-site pin");
  });

  test("an unannotated non-literal dynamic import", () => {
    write("scripts/lib.ts", "const m = 'z';\nexport const v = await import(`./${m}.ts`);\n");
    isUndetermined(fp(), "non-literal dynamic import");
  });

  test("a non-TypeScript script, whose reads cannot be audited", () => {
    isUndetermined(fp(tracked, "s:check"), "not TypeScript/JavaScript");
  });

  test("a `tree` site under a narrow (non-{tracked}) declaration", () => {
    lib('const r = Bun.spawnSync(["git", "ls-files"]);', "tree");
    hashOf(fp(tracked));
    isUndetermined(fp(globbed), "only a {tracked} declaration covers");
  });

  test("an `env-unset` variable that is set", () => {
    lib("const x = process.env.F017_OUTSIDE;", "env-unset F017_OUTSIDE");
    hashOf(fp());
    process.env.F017_OUTSIDE = "/somewhere/else";
    try {
      isUndetermined(fp(), "$F017_OUTSIDE is set");
    } finally {
      delete process.env.F017_OUTSIDE;
    }
  });

  test("a site in an `import.meta.main` block counts when the file is the ENTRY, not when it is imported", () => {
    const site = "const t = Date.now();";
    write("scripts/c.ts", `import { v } from "./lib.ts";\nif (import.meta.main) {\n  ${site}\n  console.log(v(), t);\n}\n`);
    write("scripts/lib.ts", `export const v = () => 1;\nif (import.meta.main) {\n  ${site}\n}\n`);
    isUndetermined(fp(), "scripts/c.ts:3 (clock)");
    write("scripts/c.ts", 'import { v } from "./lib.ts";\nconsole.log(v());\n');
    hashOf(fp());
  });

  test("an `import type` is not followed, a value import is", () => {
    write("scripts/risky.ts", "export type T = number;\nexport const r = Date.now();\n");
    write("scripts/c.ts", 'import type { T } from "./risky.ts";\nconst x: T = 1;\nconsole.log(x);\n');
    hashOf(fp());
    write("scripts/c.ts", 'import { r } from "./risky.ts";\nconsole.log(r);\n');
    isUndetermined(fp(), "scripts/risky.ts:2 (clock)");
  });

  test("`imports` and `scripts` targets join the closure and are audited too", () => {
    write("plugins/p.ts", "export const p = Date.now();\n");
    lib("const m = require(path);", "imports plugins/*.ts");
    isUndetermined(fp(), "plugins/p.ts:1 (clock)");
    write("plugins/p.ts", "export const p = 1;\n");
    hashOf(fp());

    const withRun = { ...scripts, "r:check": "bun run scripts/r.ts" };
    write("scripts/r.ts", "console.log(Date.now());\n");
    lib('const p = Bun.spawn(["bun", "run", "r:check"]);', "scripts r:check");
    isUndetermined(checkFingerprint(root, withRun, "c:check", tracked, new FileDigests(root)), "scripts/r.ts:1 (clock)");
    lib('const p = Bun.spawn(["bun", "run", "nope"]);', "scripts nope");
    isUndetermined(checkFingerprint(root, withRun, "c:check", tracked, new FileDigests(root)), "does not resolve");
  });

  describe("the fingerprint HASHES what a verdict names", () => {
    test("an `env` variable's value", () => {
      lib("const x = process.env.F017_MODE;", "env F017_MODE");
      const unset = hashOf(fp());
      process.env.F017_MODE = "a";
      try {
        const a = hashOf(fp());
        process.env.F017_MODE = "";
        const empty = hashOf(fp());
        expect(new Set([unset, a, empty]).size).toBe(3);
      } finally {
        delete process.env.F017_MODE;
      }
    });

    test("`head`: a new commit moves the hash although the tree did not", () => {
      lib('const r = Bun.spawnSync(["git", "log", "-1"]);', "head");
      commit("annotated");
      const before = hashOf(fp());
      git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "empty");
      expect(hashOf(fp())).not.toBe(before);
    });

    test("`refs`: a moved ref moves the hash; a missing one is hashed as missing", () => {
      lib('const r = Bun.spawnSync(["git", "log", "f017-ref"]);', "refs f017-ref");
      commit("annotated");
      const missing = hashOf(fp());
      git("branch", "f017-ref");
      const present = hashOf(fp());
      expect(present).not.toBe(missing);
    });

    test("an IGNORED file under {tracked} — a walker reads it whether or not git does", () => {
      write("ignored/data.json", "{}\n");
      const before = hashOf(fp());
      write("ignored/data.json", '{"changed": true, "and": "longer"}\n');
      expect(hashOf(fp())).not.toBe(before);
    });

    test("a BUILD OUTPUT directory is not hashed — and naming one in source is a site", () => {
      write("build/report.json", '{"generated_at": 1}\n');
      const before = hashOf(fp());
      write("build/report.json", '{"generated_at": 2}\n');
      expect(hashOf(fp())).toBe(before);
      write("scripts/lib.ts", 'export const v = () => require("node:fs").readFileSync("build/report.json");\n');
      isUndetermined(fp(), "scripts/lib.ts:1 (build)");
    });

    test("the input-hash cache itself is not an input", () => {
      const before = hashOf(fp());
      write("build/regen-cache/input-hashes.json", '{"version": 3, "pairs": {}}\n');
      write("build/regen-cache/traces/1-1.log", "x\n");
      expect(hashOf(fp())).toBe(before);
    });
  });
});

describe("the runtime trace", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "f017-trace-"));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const inChild = (env: Record<string, string | undefined>, code: string) => {
    const file = join(root, "child.ts");
    writeFileSync(file, `import { inputSiteReached, qaRefLine, quietly } from ${JSON.stringify(join(TOOLS_ROOT, "schemas", "sdlc", "input-trace.ts"))};\n${code}\n`);
    const r = Bun.spawnSync(["bun", file], { env, stdout: "pipe", stderr: "pipe" });
    expect(r.exitCode).toBe(0);
  };

  test("a run that reaches no traced site reports nothing", () => {
    const t = openTrace(root);
    inChild(t.env, "console.log(1);");
    expect(t.reached()).toBeUndefined();
  });

  test("a run that reaches one reports it, through a child process's inherited environment", () => {
    const t = openTrace(root);
    inChild(t.env, 'inputSiteReached("network");');
    expect(t.reached()).toBe("network");
  });

  test("a qa-reports read is tolerated only for a ref whose baseline the fingerprint hashed", () => {
    let t = openTrace(root);
    inChild(t.env, 'inputSiteReached(qaRefLine("main"));');
    expect(t.reached(["main"])).toBeUndefined();
    t = openTrace(root);
    inChild(t.env, 'inputSiteReached(qaRefLine("main"));');
    expect(t.reached([])).toBe(qaRefLine("main"));
    t = openTrace(root);
    inChild(t.env, 'inputSiteReached(qaRefLine("pr/7"));');
    expect(t.reached(["main"])).toBe(qaRefLine("pr/7"));
  });

  test("quietly() silences the parts of a reader that already reported itself", () => {
    const t = openTrace(root);
    inChild(t.env, 'inputSiteReached(qaRefLine("main")); quietly(() => inputSiteReached("branch-store x"));');
    expect(t.reached(["main"])).toBeUndefined();
  });

  test("without the variable set, the hook writes nothing anywhere", () => {
    // The same calls in a child whose environment lacks the variable, run
    // from the scratch root: the trace file the variable would have named
    // stays absent, and the child leaves nothing beside its own source.
    const t = openTrace(root);
    const { [TRACE_ENV]: _unset, ...env } = t.env;
    const code = 'inputSiteReached("nothing to see"); quietly(() => inputSiteReached("still nothing"));';
    const file = join(root, "child.ts");
    writeFileSync(file, `import { inputSiteReached, quietly } from ${JSON.stringify(join(TOOLS_ROOT, "schemas", "sdlc", "input-trace.ts"))};\n${code}\n`);
    const r = Bun.spawnSync(["bun", file], { cwd: root, env, stdout: "pipe", stderr: "pipe" });
    expect(r.exitCode).toBe(0);
    expect(t.reached()).toBeUndefined();
    const left = readdirSync(root, { recursive: true }).map(String).sort();
    expect(left).toEqual(["build", "build/regen-cache", "build/regen-cache/traces", "child.ts"]);
    // ...and the same child WITH the variable does write, so the silence above
    // is the missing variable's and not a hook that writes nowhere at all.
    inChild(t.env, code);
    expect(t.reached()).toBe("nothing to see");
  });
});

// ── The data claims this repository's annotations make ────────────────────
//
// An `imports` / `scripts` verdict names the targets of a computed load. The
// targets are chosen by DATA in the tree, so a new datum outside the named
// globs would load a module the audit never scanned. These hold the data to
// the annotations.
describe("annotations hold to the data that chooses their targets", () => {
  const repo = join(dirname(HARNESS_ROOT));
  const globMatch = (glob: string, rel: string) => new Bun.Glob(glob).match(rel);

  // The loaders reach a layer only through `layerRootsIn` (one level
  // below the checkout) and its declared dependencies, so the claim is held
  // over exactly those roots. None found is a pass — standalone, a computed
  // load with no data loads nothing.
  const roots = () => {
    const out = new Set(layerRootsIn(repo).map((r) => resolve(r)));
    for (const r of [...out]) for (const d of orderedDependencies(r)) out.add(resolve(d.rootPath));
    return [...out];
  };
  const annotated = (file: string, glob: string) =>
    scanSource(file, readFileSync(join(repo, file), "utf-8")).some(
      (s) => Array.isArray(s.verdicts) && s.verdicts.some((v) => v.kind === "imports" && v.globs.includes(glob)),
    );
  const relTo = (abs: string) => relative(repo, abs);

  test("every instance a loader can reach is one level below the checkout, where the `*/` globs look", () => {
    for (const r of roots()) {
      const rel = relTo(r);
      expect(rel === "" || (!rel.startsWith("..") && !rel.includes("/")), `${r} is not a top-level instance of ${repo}`).toBe(true);
    }
  });

  const declaredBy = (file: string, source: string) =>
    scanSource(file, readFileSync(join(repo, file), "utf-8")).some(
      (s) => Array.isArray(s.verdicts) && s.verdicts.some((v) => v.kind === "declared" && v.sources.includes(source)),
    );

  test("every qa-checker and pipeline-plugin ref is a module harness-config's `declared plugin-tables` names", () => {
    const named = new Set(pluginTableModules(repo));
    const all = roots();
    // A ref is relative to the layer that owns the node: the deepest root holding it.
    const ownerOf = (dir: string) => all.filter((r) => dir.startsWith(`${r}/`)).sort((a, b) => b.length - a.length)[0]!;
    for (const graph of ["qa-checkers", "pipeline-plugins"]) {
      for (const dir of declaredDirectories(repo, graph)) {
        if (!existsSync(dir)) continue;
        const root = ownerOf(resolve(dir));
        for (const f of readdirSync(dir).filter((n) => n.endsWith(".json"))) {
          const raw = JSON.parse(readFileSync(join(dir, f), "utf-8")) as { check?: string; implementation?: string };
          const ref = raw.check ?? raw.implementation;
          if (typeof ref !== "string" || !ref.includes("#")) continue;
          const target = resolve(root, ref.split("#")[0]!);
          if (!existsSync(target)) continue; // harness-config throws naming the node: it loads nothing
          expect(named.has(relTo(target)), `${dir}/${f}: ${relTo(target)} is not named by plugin-tables`).toBe(true);
        }
      }
    }
    // The module moved into this layer with schemas/kg/ (8lcl); named from TOOLS_ROOT, not spelled.
    // declared-path-literal: the module whose `input-site` annotation is the subject of this assertion, the same file this test imports; no declaration answers where a module of this layer sits.
    expect(declaredBy(relTo(join(TOOLS_ROOT, "schemas/kg/harness-config.ts")), "plugin-tables")).toBe(true);
  });

  test("every Tool's in-process registrar is a module tool-api's `declared tool-registrars` names", () => {
    const named = toolRegistrarModules(repo);
    expect(named).toBeDefined();
    const all = layerRootsIn(repo);
    for (const inst of all) {
      for (const def of discoverTools(repo, undefined, inst).tools) {
        const ip = def.invoke.inProcess;
        if (!def.invoke.mcp || !ip) continue;
        // The computation the site makes (tool-api.ts mcpToolList).
        const abs = resolveModule(ip.module, inst, all);
        if (abs === undefined) continue; // mcpToolList loads nothing for it
        expect(named!.includes(relTo(resolve(abs))), `${def.id}: ${relTo(abs)} is not named by tool-registrars`).toBe(true);
      }
    }
    // declared-path-literal: the module whose `input-site` annotation is the subject of this assertion, the same file this test imports; no declaration answers where a module of this layer sits.
    expect(declaredBy(relTo(join(TOOLS_ROOT, "scripts/tool-api.ts")), "tool-registrars")).toBe(true);
  });

  test("every declared validator module, from any root a caller passes, is one `declared validator-refs` names", () => {
    const named = new Set(validatorModules(repo));
    const registry = defaultGraphTypologies;
    registry.ensureCheckout(repo);
    // The loaders resolve an unqualified ref against the layer root their CALLER passes.
    const callerRoots = [repo, ...roots()];
    let seen = 0;
    for (const kind of registry.names()) {
      const def = registry.get(kind);
      const refs = [def?.validator, ...Object.values(def?.nodeSchemas ?? {}).map((r) => (r as { validator?: string }).validator)];
      for (const raw of refs) {
        if (typeof raw !== "string") continue;
        const ref = parseValidatorRef(raw);
        for (const r of callerRoots) {
          const base = moduleRootOf(ref, r);
          if (base === undefined) continue; // unresolvable: loads nothing
          const target = resolve(base, ref.module);
          if (!existsSync(target)) continue; // the loader reports it unresolvable: loads nothing
          seen++;
          expect(named.has(relTo(target)), `${kind}: ${raw} -> ${relTo(target)} is not named by validator-refs`).toBe(true);
        }
      }
    }
    expect(seen).toBeGreaterThan(0);
    // declared-path-literal: the two modules that load the declared validator refs, whose `input-site` annotations are the subject of this assertion; no declaration answers where a module of this layer sits.
    for (const file of ["kind-validator.ts", "node-kind-index.ts"]) expect(declaredBy(relTo(join(TOOLS_ROOT, "schemas/kg", file)), "validator-refs"), file).toBe(true);
    // It loads the whole typology registry and resolves every validator ref from
    // every layer root: 6-7 s on a composed checkout, over bun's 5 s default
    // whenever another test file ran first in the same process.
  }, 30_000);

  test("every instance themes module lies under theme-by-ref's `imports` glob", () => {
    for (const root of roots()) {
      for (const dir of instanceDirectoriesForGraph(root, THEMES_GRAPH_TYPOLOGY)) {
        const f = join(dir, INSTANCE_THEMES_MODULE);
        if (existsSync(f)) expect(globMatch("*/themes/themes.ts", relTo(f)), `${relTo(f)} is outside the glob`).toBe(true);
      }
    }
    // declared-path-literal: the module whose `input-site` annotation is the subject of this assertion, the same file this test imports; no declaration answers where a module of this layer sits.
    expect(annotated(relTo(join(TOOLS_ROOT, "schemas/ui/theme-by-ref.ts")), "*/themes/themes.ts")).toBe(true);
  });

  test("skill-register's `scripts` annotation names exactly the verify half of its STEPS", async () => {
    const { STEPS } = await import("../skill-register.ts");
    const verify = [...new Set(STEPS.flatMap((s: { verify: readonly string[] }) => s.verify))].sort();
    const sites = scanSource("s.ts", readFileSync(join(repo, "cat-harness-tools/scripts/skill-register.ts"), "utf-8"));
    const named = sites.flatMap((s) => (Array.isArray(s.verdicts) ? s.verdicts : [])).filter((v) => v.kind === "scripts");
    expect(named.length).toBeGreaterThan(0);
    for (const v of named) expect([...(v as { names: string[] }).names].sort()).toEqual(verify);
  });
});

describe("the audit walks only what can run", () => {
  test("outsideTemplates blanks template text only, and only on a balanced lex", () => {
    const src = 'import { a } from "./a.ts"; // x\nconst t = `import "./w.ts" ${f("./k")}`;\n';
    const out = outsideTemplates(src);
    expect(out).toContain('from "./a.ts"');
    expect(out).toContain('f("./k")');
    expect(out).not.toContain("./w.ts");
    const unbalanced = 'const t = `never closed\nimport { b } from "./b.ts";\n';
    expect(outsideTemplates(unbalanced)).toBe(unbalanced);
  });

  test("an import inside a template literal is the text of a written file, not an edge; a literal unresolvable one still blocks", () => {
    const root = mkdtempSync(join(tmpdir(), "f017-tpl-"));
    try {
      writeFileSync(join(root, "a.ts"), 'export const shim = (d: string) => `export * from "../../${d}/schemas/builders";\n`;\n');
      expect(auditClosure(root, ["a.ts"], new SiteMemo())).toMatchObject({ files: ["a.ts"] });
      writeFileSync(join(root, "m.ts"), 'export const manifest = () => `import { paper } from "../schema/builders";\nexport default paper({});\n`;\n');
      expect(auditClosure(root, ["m.ts"], new SiteMemo())).toMatchObject({ files: ["m.ts"] });
      writeFileSync(join(root, "b.ts"), 'export * from "./nowhere";\n');
      const c = auditClosure(root, ["b.ts"], new SiteMemo());
      expect("undetermined" in c && c.undetermined).toContain("imports unresolvable ./nowhere");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a closure is memoised per file and re-read after an edit", () => {
    const root = mkdtempSync(join(tmpdir(), "f017-memo-"));
    try {
      writeFileSync(join(root, "a.ts"), "export const a = 1;\n");
      const memo = new SiteMemo();
      expect("files" in auditClosure(root, ["a.ts"], memo)).toBe(true);
      writeFileSync(join(root, "a.ts"), "export const a = Date.now(); // now a site, and longer\n");
      expect("undetermined" in auditClosure(root, ["a.ts"], memo)).toBe(true);
      expect(entryFiles(root, { x: "bun run a.ts" }, "x")).toEqual(["a.ts"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a `declared` load reaches exactly what its source names, kept apart as computed and still audited", () => {
    const root = mkdtempSync(join(tmpdir(), "vgfp-declared-"));
    try {
      const load = "const m = await import(p);";
      writeFileSync(join(root, "a.ts"), `import "./shared.ts";\nexport async function f(p: string) {\n  // input-site: declared kinds #${pinOf(load)} — the modules the kinds name\n  ${load}\n  return m;\n}\n`);
      writeFileSync(join(root, "shared.ts"), "export const s = 1;\n");
      writeFileSync(join(root, "v1.ts"), 'import "./dep.ts";\nimport "./shared.ts";\n');
      writeFileSync(join(root, "dep.ts"), "export const d = 1;\n");
      writeFileSync(join(root, "v2.ts"), "export const v = 2;\n");
      const named: Record<string, string[]> = { kinds: ["v1.ts"] };
      const audit = auditClosure(root, ["a.ts"], new SiteMemo(), undefined, undefined, (src) => named[src]);
      if (!("files" in audit)) throw new Error(audit.undetermined);
      // v2.ts lies beside v1.ts, and no declaration names it.
      expect(audit.files).toEqual(["a.ts", "dep.ts", "shared.ts", "v1.ts"]);
      // shared.ts is imported statically too, so it is not only computed.
      expect(audit.computed).toEqual(["dep.ts", "v1.ts"]);
      // A computed target is audited like any other source.
      writeFileSync(join(root, "dep.ts"), "export const d = Date.now(); // a site now\n");
      isUndetermined(auditClosure(root, ["a.ts"], new SiteMemo(), undefined, undefined, (src) => named[src]) as Fingerprint, "dep.ts:1 (clock)");
      // A source that does not resolve is undetermined.
      isUndetermined(auditClosure(root, ["a.ts"], new SiteMemo()) as Fingerprint, "declaration source kinds");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a module reached statically after a computed load is not computed", () => {
    const root = mkdtempSync(join(tmpdir(), "vgfp-upgrade-"));
    try {
      const load = "const m = await import(p);";
      // The computed load is walked before the static import of v.ts, so v.ts is first seen as computed.
      writeFileSync(join(root, "a.ts"), `import "./z.ts";\nexport async function f(p: string) {\n  // input-site: imports v.ts #${pinOf(load)} — v\n  ${load}\n  return m;\n}\n`);
      writeFileSync(join(root, "z.ts"), 'import "./v.ts";\n');
      writeFileSync(join(root, "v.ts"), 'import "./w.ts";\n');
      writeFileSync(join(root, "w.ts"), "export const w = 1;\n");
      const audit = auditClosure(root, ["a.ts"], new SiteMemo());
      if (!("files" in audit)) throw new Error(audit.undetermined);
      expect(audit.files).toEqual(["a.ts", "v.ts", "w.ts", "z.ts"]);
      expect(audit.computed).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a traced fingerprint does not hash a computed target; an untraced one does", () => {
    const root = mkdtempSync(join(tmpdir(), "vgfp-traced-"));
    try {
      const load = "const m = await import(p);";
      writeFileSync(join(root, "c.ts"), `export async function f(p: string) {\n  // input-site: imports v.ts #${pinOf(load)} — v\n  ${load}\n  return m;\n}\n`);
      writeFileSync(join(root, "v.ts"), "export const v = 1;\n");
      const scripts = { "c:check": "bun run c.ts" };
      const io = { inputs: [], outputs: [] };
      const fp = (treeReplayed: boolean) => checkFingerprint(root, scripts, "c:check", io, new FileDigests(root), undefined, { treeReplayed });
      const [traced, plain] = [hashOf(fp(true)), hashOf(fp(false))];
      writeFileSync(join(root, "v.ts"), "export const v = 2;\n");
      expect(hashOf(fp(true))).toBe(traced);
      expect(hashOf(fp(false))).not.toBe(plain);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a traced fingerprint defers a computed target unscanned; an untraced one still refuses its unreviewed site", () => {
    const root = mkdtempSync(join(tmpdir(), "defer-computed-"));
    try {
      const load = "const m = await import(p);";
      writeFileSync(join(root, "c.ts"), `export async function f(p: string) {\n  // input-site: imports v.ts #${pinOf(load)} — v\n  ${load}\n  return m;\n}\n`);
      writeFileSync(join(root, "v.ts"), "export const v = process.env.SOME_VAR;\n");
      const scripts = { "c:check": "bun run c.ts" };
      const io = { inputs: [], outputs: [] };
      const fp = (treeReplayed: boolean) => checkFingerprint(root, scripts, "c:check", io, new FileDigests(root), undefined, { treeReplayed });
      const traced = fp(true);
      expect("hash" in traced && traced.deferred).toEqual(["v.ts"]);
      const plain = fp(false);
      expect("undetermined" in plain && plain.undetermined).toContain("v.ts");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("every runtime module under schemas/ is input-site annotated after 8lcl (cat-harness-tools#634)", () => {
    // declared-path-literal: the directory of schema modules whose input-site annotations this test audits.
    const schemasRoot = join(TOOLS_ROOT, "schemas");
    const walk = (dir: string): string[] => {
      const out: string[] = [];
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, e.name);
        if (e.isDirectory()) out.push(...walk(full));
        else if (e.name.endsWith(".ts") && !e.name.endsWith(".test.ts") && e.name !== "test-fixture-preload.ts") out.push(full);
      }
      return out;
    };
    const unannotated: string[] = [];
    for (const file of walk(schemasRoot)) {
      const rel = relative(TOOLS_ROOT, file);
      for (const s of scanSource(rel, readFileSync(file, "utf-8"))) {
        if (s.verdicts === undefined || s.verdicts === "stale" || s.malformed) {
          unannotated.push(`${rel}:${s.line} #${s.pin} (${s.risks.join(",")})`);
        }
      }
    }
    expect(unannotated).toEqual([]);
  });
});

describe("the test scratch-dir rule (owner, 2026-11-05)", () => {
  const sites = (file: string, line: string) => scanSource(file, `import { tmpdir, homedir } from "node:os";\nimport { mkdtempSync } from "node:fs";\nimport { join } from "node:path";\n${line}\n`);
  test("tmpdir() in a test file needs no annotation: it is inert", () => {
    const s = sites("x/a.test.ts", 'const root = mkdtempSync(join(tmpdir(), "a-"));');
    expect(s).toHaveLength(1);
    expect(s[0]!.verdicts).toEqual([{ kind: "inert" }]);
  });
  test("the same line outside a test file still needs one", () => {
    expect(sites("x/a.ts", 'const root = mkdtempSync(join(tmpdir(), "a-"));')[0]!.verdicts).toBeUndefined();
  });
  test("homedir(), or tmpdir() beside another risk, still needs one in a test", () => {
    expect(sites("x/a.test.ts", "const h = homedir();")[0]!.verdicts).toBeUndefined();
    expect(sites("x/a.test.ts", "const p = join(tmpdir(), homedir());")[0]!.verdicts).toBeUndefined();
    expect(sites("x/a.test.ts", "const p = join(tmpdir(), process.env.HOME!);")[0]!.verdicts).toBeUndefined();
  });
});

describe("the test git-spawn rule", () => {
  const verdictsOf = (file: string, line: string) => scanSource(file, `${line}\n`).map((s) => s.verdicts);
  test("a spawn of a literal git in a test file is `tree`, which only the cone's replay answers", () => {
    expect(verdictsOf("x/a.test.ts", 'const r = Bun.spawnSync(["git", ...args], { cwd });')).toEqual([[{ kind: "tree" }]]);
    expect(verdictsOf("x/a.test.ts", 'execFileSync("git", ["init", "-q"], { cwd: d });')).toEqual([[{ kind: "tree" }]]);
    expect(verdictsOf("x/a.test.ts", "spawnSync('git', ['add', '-A'], { cwd: d });")).toEqual([[{ kind: "tree" }]]);
  });
  test("outside a test file, beside another spawn, or with any other risk, it still needs one", () => {
    expect(verdictsOf("x/a.ts", 'Bun.spawnSync(["git", "init"]);')).toEqual([undefined]);
    expect(verdictsOf("x/a.test.ts", 'spawnSync("git", ["init"]); spawnSync("sh", ["x"]);')).toEqual([undefined]);
    expect(verdictsOf("x/a.test.ts", "spawnSync(cmd, []);")).toEqual([undefined]);
    expect(verdictsOf("x/a.test.ts", 'spawnSync("gitx", []);')).toEqual([undefined]);
    expect(verdictsOf("x/a.test.ts", 'spawnSync("git", [], { env: process.env });')).toEqual([undefined]);
  });
});

describe("the test bun-spawn rule", () => {
  const verdictsOf = (file: string, line: string) => scanSource(file, `${line}\n`).map((s) => s.verdicts);
  test("a spawn of bun itself in a test file is `spawned`; beside git, also `tree`", () => {
    expect(verdictsOf("x/a.test.ts", 'const r = Bun.spawnSync(["bun", "scripts/x.ts"], { cwd });')).toEqual([[{ kind: "spawned" }]]);
    expect(verdictsOf("x/a.test.ts", 'spawnSync(process.execPath, ["x.ts"]);')).toEqual([[{ kind: "spawned" }]]);
    expect(verdictsOf("x/a.test.ts", 'const r = Bun.spawnSync(["python3", SCRIPT, ...args], { cwd: root });')).toEqual([[{ kind: "spawned" }]]);
    expect(verdictsOf("x/a.test.ts", 'spawnSync("python", [SCRIPT]);')).toEqual([[{ kind: "spawned" }]]);
    expect(verdictsOf("x/a.test.ts", 'spawnSync("bun", ["x.ts"]); spawnSync("git", ["init"]);')).toEqual([[{ kind: "spawned" }, { kind: "tree" }]]);
  });
  test("outside a test file, or beside another program, it still needs one", () => {
    expect(verdictsOf("x/a.ts", 'Bun.spawnSync(["bun", "x.ts"]);')).toEqual([undefined]);
    expect(verdictsOf("x/a.test.ts", 'spawnSync("bun", ["x.ts"]); spawnSync("ruby", []);')).toEqual([undefined]);
    expect(verdictsOf("x/a.test.ts", 'spawnSync("bunx", ["x"]);')).toEqual([undefined]);
  });
});

describe("the test env-write and build-path rules", () => {
  const verdictsOf = (file: string, line: string) => scanSource(file, `${line}\n`).map((s) => s.verdicts);
  test("process.env written, deleted or spread whole into a child is inert in a test", () => {
    for (const line of ['process.env[VAR] = "x";', "delete process.env.CAT_MOUNT_URL_PREFIX;", 'env: { ...process.env, GIT_AUTHOR_NAME: "t" },']) {
      expect(verdictsOf("x/a.test.ts", line), line).toEqual([[{ kind: "inert" }]]);
    }
  });
  test("a value read from process.env still needs one, in a test or not", () => {
    for (const line of ["const prev = process.env.X;", "process.env.A = process.env.B;", 'if (process.env.A === "1") run();']) {
      expect(verdictsOf("x/a.test.ts", line), line).toEqual([undefined]);
    }
    expect(verdictsOf("x/a.ts", 'process.env[VAR] = "x";')).toEqual([undefined]);
  });
  test("a build directory named in a test is inert: the cone's read set records what the test opens there", () => {
    expect(verdictsOf("x/a.test.ts", 'const cache = join(tmp, "build", "derive-cache");')).toEqual([[{ kind: "inert" }]]);
    expect(verdictsOf("x/a.ts", 'const cache = join(tmp, "build", "derive-cache");')).toEqual([undefined]);
  });
});

describe("an explicit `spawned` verdict, in a module", () => {
  const annotated = (verdict: string, line: string): string => `// input-site: ${verdict} #${statementPin([line], 0)} — reviewed\n${line}\n`;
  const site = (line: string, verdict = "spawned") => scanSource("scripts/x.ts", annotated(verdict, line))[0]!;

  test("annotates a python3 or bun child, inline or a script", () => {
    expect(site('const r = Bun.spawnSync(["python3", "-c", py, file]);').verdicts).toEqual([{ kind: "spawned" }]);
    expect(site('spawnSync("bun", [SCRIPT], { cwd });').verdicts).toEqual([{ kind: "spawned" }]);
    expect(site("spawnSync(process.execPath, [SCRIPT]);").verdicts).toEqual([{ kind: "spawned" }]);
  });

  test("is malformed on any other spawn", () => {
    expect(site('spawnSync("curl", [url]);').malformed).toContain("`spawned` is for a spawn of");
    expect(site("spawnSync(argv[0], argv.slice(1));").malformed).toContain("`spawned` is for a spawn of");
    expect(site('spawnSync("python3", [a]) || spawnSync("node", [b]);').malformed).toContain("`spawned` is for a spawn of");
  });

  test("is still implicit nowhere but a test file", () => {
    expect(scanSource("scripts/x.ts", 'spawnSync("python3", [a]);\n')[0]!.verdicts).toBeUndefined();
  });

  test("a git spawn alone is no child spawn", () => {
    expect(isChildSpawn('Bun.spawnSync(["python3", "-c", py]);')).toBe(true);
    expect(isChildSpawn('spawnSync("git", ["log"]);')).toBe(false);
  });
});
