#!/usr/bin/env bun
/**
 * A model declared without a checked language list is a FINDING, not a default.
 *
 * @module scripts/check-model-languages
 * @covers models
 *
 * | state | verdict |
 * |---|---|
 * | the registry is missing or unparseable | **exit 2** — could not determine |
 * | a model with `validation: "human-validated"` and no `validatedBy`/`validatedOn` | **exit 1** — the schema refuses it |
 * | a model with `validation: "unverified"` | reported |
 * | a model with `validation: "self-reported"` | reported |
 * | the registry is EMPTY | reported, loudly |
 *
 * An empty registry is reported, not refused: `model-registry/1.0.0` ships
 * empty because an agent is not a valid source for the evidence. Unparseable
 * is exit 2, never "no models", so a broken file is not mistaken for a
 * decision and an agent does not fall back to `defaultLocale`.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/check-model-languages.ts [--instance ROOT]
 */
import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import {
  MODEL_REGISTRY_DIR,
  MODEL_REGISTRY_FILENAME,
  NOT_DISCLOSED,
  parseModelRegistry,
  validatedLanguages,
  type ModelEntry,
} from "@litlfred/bootstrap-tools/schemas/model-registry.js";
import { repoRootFor } from "../schemas/kg/cat-harness.js";
import { gitCorpus } from "../schemas/sdlc/git-corpus.js";
import { HARNESS_ROOT } from "./lib/roots.ts";

const ROOT = HARNESS_ROOT;
/** Bootstrap holds the registry — see the schema's header on why. */
const DEFAULT_INSTANCE = resolve(ROOT, "..", "bootstrap");

export interface ModelLanguageReport {
  readonly models: number;
  /** Entries a determination may actually READ. */
  readonly usable: ModelEntry[];
  /** Declared, but the claim is the model's own. Reported, never acted on. */
  readonly selfReported: ModelEntry[];
  /** Declared, nobody has looked. */
  readonly unverified: ModelEntry[];
  /** `human-validated` whose evidence has gone stale is not this check's job. */
  readonly problems: string[];
}

/**
 * Model ids the corpus RECORDS (`model` / `agent_model` in committed JSON)
 * that the registry does not declare — ADVISORY (#1168 B10c, owner
 * 2026-09-30: "Type + advisory").
 *
 * Advisory rather than failing, because the registry is populated only by
 * people: an agent adding an entry to make this list empty would manufacture
 * the evidence the registry exists to distrust (see its `$comment`). So this
 * says which ids a person has not yet looked at; it never asks an agent to.
 * `not-disclosed` is a declared value, not an id, and is never reported.
 */
export function unregisteredModelIds(
  repoRoot: string,
  registered: ReadonlySet<string>,
): { id: string; count: number }[] {
  // In a composed checkout every layer is a REMOTE MOUNT, laid down from
  // `index.lock.json` and ignored by the index repository's git, so a bare
  // `git ls-files` at the root lists none of their files. `gitCorpus` counts a
  // mount's files as it counted a submodule's, and is tracked-plus-untracked
  // exactly as before everywhere else.
  const files = gitCorpus(repoRoot, ["*.json"]);
  if (files === undefined) throw new Error(`git could not list the files in ${repoRoot}`);
  const counts = new Map<string, number>();
  for (const path of files) {
    if (!existsSync(path)) continue;
    for (const m of readFileSync(path, "utf8").matchAll(/"(?:model|agent_model)":\s*"([^"]+)"/g)) {
      const id = m[1]!;
      if (id === NOT_DISCLOSED || registered.has(id)) continue;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return [...counts].map(([id, count]) => ({ id, count })).sort((x, y) => y.count - x.count || x.id.localeCompare(y.id));
}

export function registryPath(instanceRoot: string): string {
  return join(instanceRoot, MODEL_REGISTRY_DIR, MODEL_REGISTRY_FILENAME);
}

export function checkModelLanguages(instanceRoot = DEFAULT_INSTANCE): ModelLanguageReport {
  const p = registryPath(instanceRoot);
  if (!existsSync(p)) throw new Error(`no model registry at ${p}`);
  const reg = parseModelRegistry(JSON.parse(readFileSync(p, "utf-8")), p);

  const usable: ModelEntry[] = [];
  const selfReported: ModelEntry[] = [];
  const unverified: ModelEntry[] = [];
  const problems: string[] = [];

  for (const m of reg.models) {
    if (validatedLanguages(m) !== undefined) {
      usable.push(m);
      if ((m.preferredLanguages ?? []).length === 0) {
        // A DETERMINED empty — somebody looked and found none notable. Said
        // out loud so a reader does not take it for a missing field.
        problems.push(`${m.id}: human-validated with an EMPTY language list (a determined empty — confirm that is meant)`);
      }
      continue;
    }
    if (m.validation === "self-reported") selfReported.push(m);
    else unverified.push(m);
  }

  return { models: reg.models.length, usable, selfReported, unverified, problems };
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf("--instance");
  const instanceRoot = resolve(i === -1 ? DEFAULT_INSTANCE : argv[i + 1]!);

  let report: ModelLanguageReport;
  try {
    report = checkModelLanguages(instanceRoot);
  } catch (e) {
    // Could not determine is never rendered as clean.
    console.error(`Model languages — COULD NOT DETERMINE\n  ${e instanceof Error ? e.message : String(e)}`);
    process.exit(2);
  }

  const rel = relative(repoRootFor(ROOT), registryPath(instanceRoot));
  console.log(`Model languages — ${rel}\n`);
  console.log(`  models declared            ${String(report.models).padStart(4)}`);
  console.log(`    human-validated          ${String(report.usable.length).padStart(4)}   (the only ones a determination reads)`);
  console.log(`    self-reported            ${String(report.selfReported.length).padStart(4)}   reported, never acted on`);
  console.log(`    unverified               ${String(report.unverified.length).padStart(4)}   nobody has looked`);

  for (const m of report.selfReported) console.log(`  · ${m.id} — the model's own claim; a person has not checked it`);
  for (const m of report.unverified) console.log(`  · ${m.id} — unverified`);
  for (const p of report.problems) console.log(`  ! ${p}`);

  if (report.models === 0) {
    console.log(
      `\n  NO MODEL DECLARES ITS LANGUAGES. Reported rather than refused: an agent is not a\n` +
        `  valid source for the evidence \`validation\` asks for, so this registry ships empty\n` +
        `  and a person adds entries. Until then the communication-language determination has\n` +
        `  three inputs rather than four, and says so.`,
    );
  }
  // Advisory: ids the corpus records that no registry entry declares.
  const known = new Set([...report.usable, ...report.selfReported, ...report.unverified].map((m) => m.id));
  const unregistered = unregisteredModelIds(repoRootFor(ROOT), known);
  if (unregistered.length > 0) {
    console.log(`\n  Model ids recorded in the corpus that the registry does not declare (advisory):`);
    for (const u of unregistered) console.log(`  · ${u.id} — ${u.count} record(s)`);
    console.log(`  A person adds an entry once they have looked; an agent does not (see the registry's $comment).`);
  }
  // Never red on an empty or unverified registry — see the header. Red only
  // on a registry this code could not read, which `parseModelRegistry`
  // already threw for above.
  process.exit(0);
}
