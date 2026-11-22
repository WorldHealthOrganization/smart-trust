/**
 * Where each skill's input and output contracts are — read from the skill.
 *
 * A skill names its own contracts in its front matter:
 *
 * ```yaml
 * input: schemas/skills/content-validate/input.schema.json
 * output: schemas/skills/content-validate/output.schema.json
 * ```
 *
 * The value is either a path relative to the declaring layer's root — a
 * node of this knowledge graph — or an external `https://` IRI. No contract
 * is found by directory name. The JSON Schema files themselves are the
 * contract; how they are authored is not.
 *
 * @module scripts/skill-contracts
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, normalize, relative, resolve, sep } from "node:path";
import { findInstanceRoot } from "../schemas/kg/cat-harness.js";
import { frontMatter } from "./front-matter.js";
import { isSkillMd, skillMdDirs, corpusScopeFor, type CorpusScope } from "./known-skills.js";

export type ContractIo = "input" | "output";

/** One skill's declared contracts, and the file that declares them. */
export interface SkillContract {
  skill: string;
  /** The skill file, relative to the root the contracts were asked of. */
  from: string;
  /**
   * The root of the layer that HOLDS the skill, which its local contract
   * paths are relative to. Not always the root asked: from the checkout a
   * sci skill's `schemas/skills/<skill>/` is sci's (placement PR1, bean
   * `ybwt`), and resolving it against the harness would read a file that is
   * not there — or worse, one that is and belongs to nobody.
   */
  instanceRoot: string;
  input?: string;
  output?: string;
}

/** True for an external IRI; false for a path into this layer. */
export function isExternalContract(ref: string): boolean {
  return /^https:\/\//.test(ref);
}

/**
 * Why a contract ref is malformed, or undefined when its shape is right.
 * Shape only — whether the file exists is {@link contractFile}'s question.
 */
export function contractRefProblem(ref: string): string | undefined {
  if (isExternalContract(ref)) return undefined;
  if (/^[a-z]+:/i.test(ref)) return "an external contract is an https:// IRI";
  if (ref.startsWith("/")) return "a local contract is a path relative to the instance root, not absolute";
  if (normalize(ref).startsWith("..")) return "a local contract must stay inside the instance";
  if (!ref.endsWith(".json")) return "a contract is a JSON Schema file";
  return undefined;
}

/** The absolute path of a local contract ref, or undefined for an external one. */
export function contractFile(root: string, ref: string): string | undefined {
  return isExternalContract(ref) ? undefined : join(root, ref);
}

/**
 * Every skill under `root` that declares a contract, keyed by skill name. A
 * skill declaring none is absent — the common case, and not a defect.
 * `scope` is {@link corpusScopeFor}'s unless the caller says otherwise —
 * `kg-export`'s instance-scoped build does (bean `4ak5` item 2).
 */
export function skillContracts(root: string, scope: CorpusScope = corpusScopeFor(root)): Map<string, SkillContract> {
  const out = new Map<string, SkillContract>();
  for (const dir of skillMdDirs(root, scope)) {
    const abs = join(root, ...dir);
    if (!existsSync(abs)) continue;
    for (const f of readdirSync(abs)) {
      const path = join(abs, f);
      if (!f.endsWith(".md") || !isSkillMd(path)) continue;
      const fm = frontMatter(readFileSync(path, "utf-8"));
      if (fm.input === undefined && fm.output === undefined) continue;
      const skill = f.slice(0, -3);
      if (out.has(skill)) continue; // first package wins, as kg-export's own scan does
      out.set(skill, {
        skill,
        from: relative(root, path),
        instanceRoot: findInstanceRoot(dirname(path)) ?? root,
        input: fm.input,
        output: fm.output,
      });
    }
  }
  return out;
}

/**
 * Where a layer's contracts are published, keyed per skill: `skills/<skill>/<io>.schema.json`
 * under its schema base (`skillIoIri`).
 *
 * The identity comes from the PATH when it ends in the conventional
 * `schemas/skills/<skill>/<io>.schema.json` — at the layer root or inside a
 * subgraph such as `L2/schemas/skills/<skill>/…` — and otherwise from the
 * skill naming it and the front-matter key (`input`/`output`). Taking it from
 * the tail rather than the whole path is what lets a contract move into a
 * subgraph beside its skill (bean `cat-tools-st4q`) without its published IRI
 * changing: the address names the skill, not the folder it sits in.
 */
export function contractIdentity(ref: string, skill: string, key: ContractIo): { skill: string; io: string } {
  const m = /(?:^|\/)schemas\/skills\/([^/]+)\/([^/]+)\.schema\.json$/.exec(ref.split(sep).join("/"));
  return m ? { skill: m[1]!, io: m[2]! } : { skill, io: key };
}

/** One local contract file a layer holds, and the identity it publishes under. */
export interface LayerContract {
  skill: string;
  io: string;
  /** Path relative to the layer root, `/`-separated — the form a skill's ref takes. */
  source: string;
}

/**
 * Every local contract file the layer at `root` holds, wherever it sits.
 *
 * Two sources, unioned and keyed by file:
 *
 * 1. **The refs.** Each skill held by THIS layer (`instanceRoot` is `root`)
 *    names its contracts in front matter; every local ref whose file exists is
 *    one. This is the binding since #1168 B3b, and it is what finds a contract
 *    a subgraph keeps beside its skills (`L2/schemas/skills/…`).
 * 2. **`<root>/schemas/skills/<skill>/*.schema.json` on disk.** Kept so a
 *    contract no skill names yet is still published exactly as before (the
 *    `skill-contract-claimed` audit reports it; publishing is not where that is
 *    judged), and so a layer that has not moved anything publishes the same
 *    bytes.
 *
 * Two files claiming one published identity cannot both publish; the one
 * whose source sorts first wins and the other is returned in `collisions`,
 * never dropped silently.
 */
export function layerContracts(
  root: string,
  scope?: CorpusScope,
): { contracts: LayerContract[]; collisions: Array<LayerContract & { kept: string }> } {
  const abs = resolve(root);
  const bySource = new Map<string, LayerContract>();
  for (const c of skillContracts(root, scope ?? corpusScopeFor(root)).values()) {
    if (resolve(c.instanceRoot) !== abs) continue;
    for (const key of ["input", "output"] as const) {
      const ref = c[key];
      if (ref === undefined || isExternalContract(ref) || contractRefProblem(ref) !== undefined) continue;
      if (!ref.endsWith(".schema.json") || !existsSync(join(abs, ref))) continue;
      const source = normalize(ref).split(sep).join("/");
      if (!bySource.has(source)) bySource.set(source, { ...contractIdentity(source, c.skill, key), source });
    }
  }
  // declared-path-literal: the root contract folder every layer has used; see the note above.
  const legacy = join(abs, "schemas", "skills");
  if (existsSync(legacy)) {
    for (const e of readdirSync(legacy, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      for (const f of readdirSync(join(legacy, e.name))) {
        if (!f.endsWith(".schema.json")) continue;
        const source = ["schemas", "skills", e.name, f].join("/");
        if (!bySource.has(source)) bySource.set(source, { skill: e.name, io: f.slice(0, -".schema.json".length), source });
      }
    }
  }
  const contracts: LayerContract[] = [];
  const collisions: Array<LayerContract & { kept: string }> = [];
  const taken = new Map<string, string>();
  for (const c of [...bySource.values()].sort((a, b) => a.source.localeCompare(b.source))) {
    const id = `${c.skill}/${c.io}`;
    const kept = taken.get(id);
    if (kept !== undefined) {
      collisions.push({ ...c, kept });
      continue;
    }
    taken.set(id, c.source);
    contracts.push(c);
  }
  return { contracts, collisions };
}
