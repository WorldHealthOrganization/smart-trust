#!/usr/bin/env bun
/**
 * A FILED REQUIREMENT IS A VALID REQUIREMENT, AND NO TWO DOCUMENTS SHARE A NAME.
 *
 * @covers proposals, requirements
 *
 * When a harness feature ships, its proposal moves from `docs/proposals/` to
 * `docs/requirements/` and is filed against the bootstrap `Requirement`
 * schema. Checked:
 *
 * 1. **Every requirement page's front matter parses as a `Requirement`.** The
 *    page's own Jekyll keys (`layout`, `nav_order`, `summary`, …) ride beside
 *    it; only the schema's fields are checked, and the schema refuses what it
 *    must (a non-functional statement with a `capability`, a duplicate key, a
 *    superseded requirement that names no successor).
 * 2. **The id is the file name.** `req:<slug>` in `<slug>.md` — so a test
 *    run's `req:<slug>#<key>` resolves by path, with no index to keep.
 * 3. **No slug is in both sub-graphs**, so a filed proposal cannot overwrite
 *    an existing requirement or leave a copy behind.
 *
 * WARNED, never failed: **a statement with no `successCriteria`** (optional
 * while existing statements, including the `req:*` JSON files, are migrated).
 *
 * Every **requirement set** in the two sub-graphs (a `*.requirement-set.json`
 * file, or a page whose front matter carries `requirementSet:`) is judged:
 *
 * - its shape against the bootstrap `RequirementSetSchema`;
 * - its STAGE against its sign-offs, read from the set itself AND from the
 *   `requirement-signoff` family of the `attestations` graph, as one union
 *   (`requirementSetProblems`): `approved`/`accepted` with no human sign-off,
 *   `planned` with no beans and `cancelled` with no reason are refused;
 * - a set is `accepted` only when every member it APPROVED is `in-force`
 *   (otherwise set stage and member status are independent).
 *
 * `--signoff-facts <reqset:slug>` prints the two facts the requirement-signoff
 * DMN reads (`signoffRecorded`, `signoffOutcome`), computed from the record.
 *
 * The directories are READ FROM THE DECLARATION (the `requirements` and
 * `proposals` graph typologies, at the root or within `docs/`), never
 * hardcoded. A declared kind with no directory on disk is a failure.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { parse as parseYaml } from "yaml";

import { RequirementFields, RequirementSchema } from "@litlfred/bootstrap-tools/schemas/requirement.ts";
import {
  RequirementSetFields,
  requirementSetProblems,
  type RequirementSet,
  type SignOff,
} from "@litlfred/bootstrap-tools/schemas/requirement-set.ts";
import {
  attestationsHomeFor,
  requirementSignoffPath,
  RequirementSignoffAttestationsSchema,
} from "../schemas/sdlc/qa-attestations.ts";
import { defaultEnabledSubgraphs, nestedDirectories, readDeclaration } from "../schemas/kg/cat-harness.ts";
import { isSubgraphEnabled, qualifiedSubgraphId } from "../schemas/kg/opt-in-subgraphs.ts";
import { leftOutByMount, mountScopeFor } from "../schemas/kg/remote-mount.ts";
import { kgRoots } from "./known-skills.ts";

const REPO = join(import.meta.dir, "..", "..");
const INSTANCE = join(REPO, "cat-harness");

/** The front matter of a markdown file, or null when it has none. */
export function frontMatter(text: string): Record<string, unknown> | null {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m) return null;
  const v = parseYaml(m[1]);
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

/** Only the schema's own fields: a page's layout keys are not the requirement's business. */
export function requirementPart(fm: Record<string, unknown>): Record<string, unknown> {
  const keys = Object.keys(RequirementFields.shape);
  return Object.fromEntries(Object.entries(fm).filter(([k]) => keys.includes(k)));
}

export interface Problem { file: string; message: string }

/** Check one requirement page. */
export function checkRequirementPage(file: string, text: string): Problem[] {
  const fm = frontMatter(text);
  if (!fm) return [{ file, message: "has no front matter, so it carries no requirement" }];
  const out: Problem[] = [];
  const r = RequirementSchema.safeParse(requirementPart(fm));
  if (!r.success) {
    for (const i of r.error.issues) out.push({ file, message: `${i.path.join(".") || "(root)"}: ${i.message}` });
    return out;
  }
  const slug = basename(file, ".md");
  if (r.data.id !== `req:${slug}`) {
    out.push({ file, message: `id is \`${r.data.id}\` but the file is \`${slug}.md\` — the id is the file name, \`req:${slug}\`` });
  }
  return out;
}

/**
 * The statements of one requirement that carry no success criterion — each as
 * `req:<id>#<key>`. A WARNING, not a problem: see the module docblock.
 */
export function statementsWithoutCriteria(req: unknown): string[] {
  if (!req || typeof req !== "object") return [];
  const r = req as { id?: unknown; statements?: unknown };
  if (!Array.isArray(r.statements)) return [];
  const id = typeof r.id === "string" ? r.id : "req:?";
  return r.statements
    .filter((s): s is { key?: unknown; successCriteria?: unknown } => !!s && typeof s === "object")
    .filter((s) => !Array.isArray(s.successCriteria) || s.successCriteria.length === 0)
    .map((s) => `${id}#${String(s.key)}`);
}

// ── Requirement sets (FR-010 to FR-012) ──────────────────────────────────

/** Sign-offs kept in the attestations graph for one set; [] when none. Throws on a corrupt file. */
export function storedSignOffs(attestationsHome: string, setId: string): SignOff[] {
  const path = requirementSignoffPath(attestationsHome, setId);
  if (!existsSync(path)) return [];
  const r = RequirementSignoffAttestationsSchema.safeParse(JSON.parse(readFileSync(path, "utf8")));
  if (!r.success) throw new Error(`${path}: ${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  if (r.data.subject.id !== setId) throw new Error(`${path} names ${r.data.subject.id}, not ${setId}`);
  return r.data.signoffs;
}

/** The set's own sign-offs and the stored ones, de-duplicated (same signer, time, scope, outcome). */
export function unionSignOffs(own: SignOff[] = [], stored: SignOff[] = []): SignOff[] {
  const key = (o: SignOff) => [o.id, o.at, o.scope, o.outcome, o.stage ?? ""].join("|");
  const seen = new Set<string>();
  return [...own, ...stored].filter((o) => (seen.has(key(o)) ? false : (seen.add(key(o)), true)));
}

/** Member statuses by requirement id, for the accepted-set rule; undefined = not found. */
export type StatusOf = (reqId: string) => string | undefined;

/**
 * Judge one set. `stored` are its sign-offs from the attestations graph;
 * `statusOf` resolves a member requirement's `status`.
 */
export function checkRequirementSet(file: string, raw: unknown, stored: SignOff[], statusOf: StatusOf): Problem[] {
  // The shape first; the stage rules are then judged over the UNION of sign-offs,
  // so a set whose sign-offs are kept in the attestations graph is not refused
  // for not repeating them inline.
  const shape = RequirementSetFields.safeParse(raw);
  if (!shape.success) {
    return shape.error.issues.map((i) => ({ file, message: `${i.path.join(".") || "(root)"}: ${i.message}` }));
  }
  const set = shape.data as RequirementSet;
  const all = { ...set, signOffs: unionSignOffs(set.signOffs, stored) };
  const out: Problem[] = requirementSetProblems(all).map((p) => ({ file, message: `${p.path.join(".")}: ${p.message}` }));
  if (set.stage === "accepted") {
    for (const m of set.members.filter((x) => x.decision === "approved" || x.decision === "amended")) {
      const id = m.ref.split("#")[0];
      const st = statusOf(id);
      if (st !== "in-force") {
        out.push({ file, message: `accepted, but member \`${m.ref}\` it approved is ${st === undefined ? "not found" : `\`${st}\``}, not \`in-force\`` });
      }
    }
  }
  return out;
}

/** The facts the requirement-signoff DMN reads, from the set's recorded sign-offs. */
export function signoffFacts(setId: string, signOffs: SignOff[]): { signoffRecorded: "yes" | "no"; signoffOutcome: string } {
  const own = signOffs.filter((o) => o.scope === setId);
  if (own.length === 0) return { signoffRecorded: "no", signoffOutcome: "none" };
  const latest = [...own].sort((a, b) => a.at.localeCompare(b.at)).at(-1)!;
  return { signoffRecorded: "yes", signoffOutcome: latest.outcome };
}

/** Requirement sets in a directory: `*.requirement-set.json`, and `.md` pages carrying `requirementSet:`. */
export function setsIn(dir: string): { file: string; raw: unknown }[] {
  const out: { file: string; raw: unknown }[] = [];
  for (const n of readdirSync(dir).sort()) {
    const file = join(dir, n);
    if (n.endsWith(".requirement-set.json")) out.push({ file, raw: JSON.parse(readFileSync(file, "utf8")) });
    else if (n.endsWith(".md")) {
      const fm = frontMatter(readFileSync(file, "utf8"));
      if (fm && fm["requirementSet"] !== undefined) out.push({ file, raw: fm["requirementSet"] });
    }
  }
  return out;
}

/** Slugs present in both sub-graphs. */
export function collisions(proposals: string[], requirements: string[]): string[] {
  const req = new Set(requirements);
  return proposals.filter((p) => req.has(p)).sort();
}

/**
 * The requirement (or proposal) slugs in a directory.
 *
 * `index.md` and `README.md` are the directory's OWN page, not a node in it.
 * `index.md` was excluded from the start; `README.md` was not, and the gate went
 * red on `main` the day one appeared under `docs/requirements/` — twice over, as
 * "has no front matter, so it carries no requirement" AND as "is in BOTH
 * proposals and requirements", the second because both directories carry a
 * README and the collision check compares basenames.
 *
 * A README is written for a reader of the directory. Holding it to the
 * Requirement schema asks a different document to be this one.
 */
function slugsIn(dir: string): string[] {
  const own = new Set(["index.md", "README.md"]);
  return readdirSync(dir).filter((n) => n.endsWith(".md") && !own.has(n)).map((n) => basename(n, ".md"));
}

/**
 * The directory the layer declares for `kind` — at its root, or FROM WITHIN
 * a declared directory (`docs/docs.json`, issue #1164). Throws when it
 * declares none or several, or the directory is missing.
 */
export function declaredDirFor(instanceRoot: string, kind: string): string {
  const r = judgedDirFor(instanceRoot, kind);
  if ("notJudged" in r) throw new Error(`\`${kind}\` is not judged here: ${r.notJudged}`);
  return r.dir;
}

/**
 * {@link declaredDirFor}, with the third state a consumer needs: the
 * directory is in an opt-in sub-graph the root that MOUNTED this layer has
 * switched off (a layer no mount placed judges what is on disk) (owner, 2026-11-12, card Q-OPTIN-DIRS A), or the mount left
 * it out (`leftOutByMount`). Then nothing here is judged — the layer that
 * switches it on judges it — and that is said, not thrown. A directory that
 * is switched on (or placed by no mount) and missing still throws.
 */
export function judgedDirFor(instanceRoot: string, kind: string): { dir: string } | { notJudged: string } {
  const decl = readDeclaration(instanceRoot);
  if (!decl) throw new Error(`no declaration could be read at ${instanceRoot}`);
  const all = [...(decl.directories ?? []), ...nestedDirectories(instanceRoot, decl)];
  const hits = all.filter((e) => (e.graphTypologies ?? []).includes(kind));
  if (hits.length !== 1) {
    throw new Error(`the instance declares ${hits.length} directories of kind \`${kind}\`; exactly one is expected`);
  }
  const hit = hits[0] as { id: string; path: string; optIn?: boolean };
  const dir = join(instanceRoot, hit.path);
  // Only for a MOUNTED layer: there the root that mounted it decides. A layer
  // no mount placed is its own checkout and judges what it has on disk, as
  // before — cat-harness does not list its own `proposals`, and its CI still
  // checks them.
  if (hit.optIn === true && mountScopeFor(instanceRoot) !== undefined) {
    const q = qualifiedSubgraphId(decl.name, hit.id);
    if (!isSubgraphEnabled(defaultEnabledSubgraphs(instanceRoot), q)) return { notJudged: `opt-in \`${q}\` is switched off by this checkout's root` };
  }
  if (!existsSync(dir)) {
    if (leftOutByMount(instanceRoot, dir)) return { notJudged: `${hit.path} is left out by the mount that placed this layer` };
    throw new Error(`\`${kind}\` is declared at ${hit.path}, which does not exist`);
  }
  return { dir };
}

if (import.meta.main) {
  const factsAt = process.argv.indexOf("--signoff-facts");
  if (factsAt >= 0) {
    // The facts GW_SignoffRecorded reads, computed from the record — never typed.
    const setId = process.argv[factsAt + 1] ?? "";
    if (!/^reqset:[a-z0-9][a-z0-9-]*$/.test(setId)) {
      console.error("usage: check:requirements --signoff-facts reqset:<slug>");
      process.exit(2);
    }
    const home = attestationsHomeFor(INSTANCE, REPO).root;
    let inline: SignOff[] = [];
    try {
      for (const kind of ["requirements", "proposals"]) {
        const at = judgedDirFor(INSTANCE, kind);
        if ("notJudged" in at) continue;
        for (const s of setsIn(at.dir)) {
          const v = s.raw as { id?: string; signOffs?: SignOff[] };
          if (v.id === setId) inline = v.signOffs ?? [];
        }
      }
      process.stdout.write(JSON.stringify(signoffFacts(setId, unionSignOffs(inline, storedSignOffs(home, setId)))) + "\n");
      process.exit(0);
    } catch (e) {
      console.error(`  ✗ ${(e as Error).message}`);
      process.exit(2);
    }
  }
  let reqDir: string, propDir: string | undefined;
  try {
    reqDir = declaredDirFor(INSTANCE, "requirements");
    const prop = judgedDirFor(INSTANCE, "proposals");
    if ("notJudged" in prop) console.log(`  · proposals not judged here: ${prop.notJudged}; the layer that switches them on judges them`);
    else propDir = prop.dir;
  } catch (e) {
    console.error(`  ✗ ${(e as Error).message}`);
    process.exit(1);
  }
  const reqSlugs = slugsIn(reqDir);
  const propSlugs = propDir === undefined ? [] : slugsIn(propDir);
  console.log(`Requirements — ${reqSlugs.length} filed in ${relative(REPO, reqDir)}/, ` +
    (propDir === undefined ? "proposals not judged here" : `${propSlugs.length} proposal(s) in ${relative(REPO, propDir)}/`));
  const problems: Problem[] = [];
  for (const slug of reqSlugs) {
    const file = join(reqDir, `${slug}.md`);
    problems.push(...checkRequirementPage(relative(REPO, file), readFileSync(file, "utf8")));
  }
  // The warning half: every statement, filed page or knowledge-graph JSON,
  // that has no success criterion yet.
  const missing: string[] = [];
  for (const slug of reqSlugs) {
    const fm = frontMatter(readFileSync(join(reqDir, `${slug}.md`), "utf8"));
    if (fm) missing.push(...statementsWithoutCriteria(requirementPart(fm)));
  }
  // declared-path-literal: `requirements/` inside the declared kg root is the
  // convention `kg-audit` and `validate-skills` read it by.
  const kgReqDir = join(kgRoots(INSTANCE)[0] ?? join(INSTANCE, "skills"), "requirements");
  let kgReqFiles = 0;
  if (existsSync(kgReqDir)) {
    for (const f of readdirSync(kgReqDir).filter((n) => n.endsWith(".json")).sort()) {
      kgReqFiles++;
      missing.push(...statementsWithoutCriteria(JSON.parse(readFileSync(join(kgReqDir, f), "utf8"))));
    }
  }
  if (missing.length > 0) {
    console.warn(`  ⚠ ${missing.length} statement(s) carry no successCriteria (read ${reqSlugs.length} filed page(s) and ` +
      `${kgReqFiles} file(s) in ${relative(REPO, kgReqDir)}/) — a warning while the migration runs (#2405 decision 3):`);
    for (const m of missing) console.warn(`      ${m}`);
  }
  // Requirement sets, in either sub-graph, judged over the union of their
  // inline sign-offs and the `requirement-signoff` attestations.
  const home = attestationsHomeFor(INSTANCE, REPO).root;
  const statusOf: StatusOf = (id) => {
    const slug = id.replace(/^req:/, "");
    const page = join(reqDir, `${slug}.md`);
    if (existsSync(page)) {
      const fm = frontMatter(readFileSync(page, "utf8"));
      return typeof fm?.["status"] === "string" ? (fm["status"] as string) : "in-force";
    }
    const json = join(kgReqDir, `${slug}.json`);
    if (existsSync(json)) {
      const j = JSON.parse(readFileSync(json, "utf8")) as { status?: string };
      return j.status ?? "in-force";
    }
    return undefined;
  };
  let setCount = 0;
  for (const dir of propDir === undefined ? [reqDir] : [reqDir, propDir]) {
    for (const s of setsIn(dir)) {
      setCount++;
      const id = (s.raw as { id?: unknown })?.id;
      let stored: SignOff[] = [];
      try {
        stored = typeof id === "string" ? storedSignOffs(home, id) : [];
      } catch (e) {
        problems.push({ file: relative(REPO, s.file), message: (e as Error).message });
      }
      problems.push(...checkRequirementSet(relative(REPO, s.file), s.raw, stored, statusOf));
    }
  }
  console.log(`  ${setCount} requirement set(s) judged against their sign-offs`);
  for (const c of collisions(propSlugs, reqSlugs)) {
    problems.push({ file: `${c}.md`, message: "is in BOTH proposals and requirements — a proposal is MOVED when filed, never copied" });
  }
  if (problems.length === 0) {
    // A DETERMINED empty is still an answer, and said as one.
    console.log(reqSlugs.length === 0
      ? "  ✓ none filed yet — the directory was read and holds only its index"
      : "  ✓ every filed requirement is valid, and no name is used twice");
    process.exit(0);
  }
  for (const p of problems) console.error(`  ✗ ${p.file}: ${p.message}`);
  process.exit(1);
}
