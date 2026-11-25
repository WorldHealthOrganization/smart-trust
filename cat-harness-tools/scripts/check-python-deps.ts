#!/usr/bin/env bun
/**
 * Every third-party Python import is declared, and nothing declared is dead.
 *
 * The declaration is `schemas/sdlc/python-deps.ts`; the import set is DERIVED
 * from the source and compared against it.
 *
 * A name is third-party only when it is not in `sys.stdlib_module_names`, not
 * underscore-prefixed (this repo's convention for its own helpers —
 * `_tech_meta`, `_pdf_doc_id`, `_pypdf_compat`), and **not a `.py` beside the
 * file importing it** (e.g. the flat imports inside `scripts/translation/`).
 *
 * Both directions are findings: an UNDECLARED import, and a DECLARED package
 * nothing imports. A package needed only by another dependency (e.g.
 * `Pillow`) is declared `transitive: true` and is not reported.
 *
 * @covers code
 */
import { spawnSync } from "node:child_process";
import { TOOLS_ROOT } from "./lib/roots.ts";

import { PYTHON_DEPS, importNameOf, type PythonDep } from "../schemas/sdlc/python-deps.ts";

// THE LAYER root — this module scans `scripts/**/*.py`, and those scripts
// are the layer's. Distinct from the root `gen-python-deps.ts` uses for
// `requirements.txt`, which lives in this layer's `python/` directory (bean
// `ar1s`), though CI installs it from the checkout root. One constant answered both while the two roots were one
// directory; pointing it at the repository made the glob match nothing and
// the scan report 0 imports — a vacuous pass the neighbouring guard caught.
const ROOT = TOOLS_ROOT;  // bean 70lx: the scripts moved here; the declaration they answer to stayed

export interface PythonImport {
  module: string;
  files: string[];
}

/**
 * Third-party modules imported anywhere under `scripts/`, with their files.
 *
 * Parsed with Python's own `ast`, not a regex: a regex over `import` lines
 * cannot tell a real import from one inside a docstring or a comment, and this
 * repository has several scripts whose docstrings quote their own usage.
 */
export function scanImports(root = ROOT): PythonImport[] {
  const py = `
import ast, json, pathlib, sys
root = pathlib.Path(sys.argv[1])
std = set(sys.stdlib_module_names)
files = sorted(root.glob("scripts/**/*.py"))
local = {}
for p in files:
    local.setdefault(p.parent, set()).add(p.stem)
found = {}
for p in files:
    try:
        tree = ast.parse(p.read_text(encoding="utf-8", errors="replace"))
    except SyntaxError:
        continue
    siblings = local.get(p.parent, set())
    for n in ast.walk(tree):
        mods = []
        if isinstance(n, ast.Import):
            mods = [a.name.split(".")[0] for a in n.names]
        elif isinstance(n, ast.ImportFrom) and n.level == 0 and n.module:
            mods = [n.module.split(".")[0]]
        for m in mods:
            if m in std or m.startswith("_") or m in siblings:
                continue
            found.setdefault(m, set()).add(str(p.relative_to(root)))
print(json.dumps(sorted(({"module": m, "files": sorted(f)} for m, f in found.items()), key=lambda d: d["module"])))
`;
  const r = spawnSync("python3", ["-c", py, root], { encoding: "utf-8" });
  if (r.status !== 0) {
    // Refused rather than returning an empty list. A scan that silently found
    // nothing would report a clean repository — the vacuity defect this file's
    // own sibling gate exists to prevent.
    throw new Error(`could not scan Python imports: ${r.stderr.trim() || "python3 failed"}`);
  }
  return JSON.parse(r.stdout) as PythonImport[];
}

export interface DepCheck {
  /** Imported by a script and named by no declaration. */
  undeclared: PythonImport[];
  /** Declared, imported by nothing, and not marked `transitive`. */
  unused: PythonDep[];
  declared: number;
  imported: number;
}

export function checkPythonDeps(root = ROOT): DepCheck {
  const imports = scanImports(root);
  const byImportName = new Map(PYTHON_DEPS.map((d) => [importNameOf(d), d]));
  const importedNames = new Set(imports.map((i) => i.module));
  return {
    undeclared: imports.filter((i) => !byImportName.has(i.module)),
    unused: PYTHON_DEPS.filter((d) => d.transitive !== true && !importedNames.has(importNameOf(d))),
    declared: PYTHON_DEPS.length,
    imported: imports.length,
  };
}

if (import.meta.main) {
  const r = checkPythonDeps();
  console.log(`Python dependencies: ${r.declared} declared, ${r.imported} third-party import(s) found.\n`);
  for (const d of PYTHON_DEPS) {
    const mark = d.transitive ? "(transitive)" : "";
    console.log(`  ${d.distribution.padEnd(16)} ${d.tier.padEnd(9)} ${mark}`);
  }

  let bad = false;
  if (r.undeclared.length > 0) {
    bad = true;
    console.error(`\n✗ ${r.undeclared.length} import(s) no declaration covers:`);
    for (const u of r.undeclared) console.error(`    ${u.module}  — ${u.files.join(", ")}`);
    console.error("    Add it to PYTHON_DEPS in schemas/sdlc/python-deps.ts, with its tier and why.");
  }
  if (r.unused.length > 0) {
    bad = true;
    console.error(`\n✗ ${r.unused.length} declared package(s) nothing imports:`);
    for (const u of r.unused) console.error(`    ${u.distribution}`);
    console.error("    Remove it, or mark `transitive: true` and say what requires it.");
  }
  if (bad) process.exit(1);
  console.log("\n✓ every third-party import is declared; every declaration is imported or transitive");
}
