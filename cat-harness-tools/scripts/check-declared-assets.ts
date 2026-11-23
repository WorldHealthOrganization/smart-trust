#!/usr/bin/env bun
/**
 * Every declared asset exists, and its links resolve.
 *
 * @module scripts/check-declared-assets
 * @covers cat-harness
 *
 * This checks **whatever a layer declares** as an asset (such as its
 * `AGENTS.md`), not one special-cased file: a file nobody declares is a file
 * no checker looks at. A newly declared markdown asset is covered with no
 * change here. (`readme:audit` verifies `README.md` alone, and
 * `check:agents-xref` citations INTO `AGENTS.md`.)
 *
 * ## Three states
 *
 * - **missing** — declared and not on disk. A finding: somebody asserted this
 *   file is ours (unlike a conventional directory a layer may not use).
 * - **dead link** — a relative target that does not resolve.
 * - **not checked** — a non-markdown asset, a link this cannot resolve
 *   offline (`http(s)`, `mailto`), or a link into one of the layer's own
 *   declared directories that is not on disk in this checkout. Reported as
 *   such and never counted clean.
 *
 * The last case is a site that mounts only some of a layer's directories
 * (an `overrides.<instance>.directories` list in `index.config.json`): the
 * layer's README may link into a directory the site chose not to mount, and
 * that link is not dead, only out of this checkout. Whether a declared
 * directory exists at all is `check:declared-dirs`'s question, not this one.
 *
 * Exit codes: 0 clean · 1 any missing asset or dead link.
 */
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, resolve, sep } from "node:path";

import { declaredAssets, instanceDirectories, layerRootsIn } from "../schemas/kg/cat-harness.js";
import { movesResolver } from "./check-agent-entry-links.ts";

/**
 * Layers whose declarations this repository owns — **discovered, not
 * listed**, via {@link layerRootsIn}.
 *
 * This was a literal `["cat-harness", "bootstrap"]`, and the docstring on it
 * recorded the list being wrong ONCE already: the first entry was `"."`, which
 * named the layer while the layer was the repository, and after the move
 * (bean `wggr`) it named a root carrying no `harness.json`, so `declaredAssets`
 * returned `[]` and this gate reported *"1 declared asset across 2 instances,
 * 0 findings"* over a file it had never opened.
 *
 * The list was then wrong a SECOND time, the same way. Recording that a
 * hardcoded list went stale, and then fixing it by correcting the hardcoded
 * list, buys one release. Asking the filesystem is what stops the third time
 * (bean `6tkl`).
 *
 * **How far it had drifted, measured 2026-09-20 while adding the sixth
 * layer** (the formal-math layer, bean `frs5`): the list still said two while
 * `folio-assist-core`, the IRIS replica, `detangle`, `kg-navigation` and
 * `large-datasets` had all arrived. Five layers the gate had never opened,
 * reported in the same words as a clean run — and the README declared by
 * the formal-math layer's brand-new `harness.json` would have been the sixth.
 * Widening it immediately found a dead link the list had been hiding.
 */
export function declaredInstances(repoRoot: string): string[] {
  return layerRootsIn(repoRoot);
}

export interface AssetFinding {
  instance: string;
  asset: string;
  /** `moved`: resolves only through a declared move in its window — still to switch, not a failure. */
  kind: "missing" | "dead-link" | "moved";
  detail: string;
}

/** Links in a markdown body, excluding fenced code. */
export function markdownLinks(src: string): string[] {
  const body = src.replace(/```[\s\S]*?```/g, "");
  return [...body.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)].map((m) => m[1]!.trim());
}

/** A link this can decide offline — relative, not an anchor, not a URL. */
export function isCheckable(target: string): boolean {
  if (!target || target.startsWith("#")) return false;
  return !/^[a-z][a-z0-9+.-]*:/i.test(target);
}

/**
 * The declared directory of `root` that `abs` falls inside, when that
 * directory is not on disk here (a mount that left it out). `undefined`
 * when `abs` is in no declared directory, or the directory is present.
 */
export function unmountedDirectory(root: string, abs: string): string | undefined {
  for (const d of instanceDirectories(root)) {
    const dir = resolve(root, d.path);
    if (dir === resolve(root)) continue;
    if ((abs === dir || abs.startsWith(dir + sep)) && !existsSync(dir)) return d.id;
  }
  return undefined;
}

export function auditInstance(
  root: string,
  resolveMoved: ReturnType<typeof movesResolver> = movesResolver(root),
): { findings: AssetFinding[]; notChecked: number } {
  const findings: AssetFinding[] = [];
  let notChecked = 0;

  for (const a of declaredAssets(root)) {
    if (!a.exists) {
      findings.push({ instance: root, asset: a.id, kind: "missing", detail: a.src });
      continue;
    }
    if (!a.src.endsWith(".md")) {
      notChecked += 1;
      continue;
    }
    const body = readFileSync(a.absPath, "utf8");
    for (const target of markdownLinks(body)) {
      if (!isCheckable(target)) {
        notChecked += 1;
        continue;
      }
      const path = target.split("#")[0]!;
      if (!path) continue;
      const abs = resolve(dirname(a.absPath), path);
      if (existsSync(abs)) continue;
      if (unmountedDirectory(root, abs) !== undefined) {
        notChecked += 1;
        continue;
      }
      const through = resolveMoved(abs);
      if (through !== undefined) findings.push({ instance: root, asset: a.id, kind: "moved", detail: `${target} (${through.move})` });
      else findings.push({ instance: root, asset: a.id, kind: "dead-link", detail: target });
    }
  }
  return { findings, notChecked };
}

if (import.meta.main) {
  const root = process.cwd();
  let findings: AssetFinding[] = [];
  let notChecked = 0;
  let declared = 0;

  const instances = declaredInstances(root);
  for (const abs of instances) {
    declared += declaredAssets(abs).length;
    const r = auditInstance(abs);
    findings = findings.concat(r.findings);
    notChecked += r.notChecked;
  }

  // A link through a declared move is shown, not failed (sdlc skill `two-phase-move`).
  const moved = findings.filter((f) => f.kind === "moved");
  findings = findings.filter((f) => f.kind !== "moved");
  for (const f of moved) console.log(`  · ${f.instance}/${f.asset}: moved — ${f.detail}, still to switch`);
  for (const f of findings) {
    console.error(`  ✗ ${f.instance}/${f.asset}: ${f.kind} — ${f.detail}`);
  }
  console.log(
    // NAMED, not just counted. This gate twice reported a clean run over
    // layers it had never opened, and a bare count is exactly what made
    // that readable as success — "2 instances" looks fine until you know there
    // were seven. The names are what a reader checks against the repository.
    `${declared} declared asset(s) across ${instances.length} instance(s) ` +
      `(${instances.map((p) => basename(p) || p).sort().join(", ")}); ` +
      `${findings.length} finding(s), ${notChecked} not checked (external, non-markdown or not mounted)`,
  );
  process.exit(findings.length > 0 ? 1 : 0);
}
