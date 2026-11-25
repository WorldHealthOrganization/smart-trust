#!/usr/bin/env bun
/**
 * The semver bump bootstrap's published schemas REQUIRE, computed from a diff.
 *
 * @module bootstrap-tools/scripts/schema-semver
 *
 * The bump is COMPUTED from the generated schemas, never asserted. The rules
 * are the skill
 * `bootstrap-contract-semver`; this is those rules as code.
 *
 * ## The question is "does anything that validated before now fail?"
 *
 * A published `$id` is a promise about what VALIDATES. So each change is graded
 * by which way it moves the set of accepted documents:
 *
 * - **major** — it can reject a document that validated at the base: a field
 *   removed from a closed object, a new required field, a narrower type, enum
 *   or bound, a pattern or format added, `additionalProperties: false` added,
 *   a conditional (`allOf`) added, a `$id` or dialect changed.
 * - **minor** — it only widens: an optional field added, a required field
 *   relaxed, a bound or enum widened, a new schema published.
 * - **patch** — annotations only: `title`, `description`, `$comment`,
 *   `examples`, `default`, key order and whitespace.
 * - **none** — byte-for-byte or structurally identical.
 *
 * A keyword this classifier does not know is graded **major**, never patch: a
 * change it cannot prove harmless is a change it must not call harmless.
 *
 * ## The fourth answer, and why it is never "patch"
 *
 * When the base cannot be read — no such ref, no git, a file that will not
 * parse — the answer is `could not determine`. Defaulting to patch there would
 * turn "I did not look" into "nothing important changed", which is the one
 * reading this script exists to prevent.
 *
 * Usage:
 *   bun run semver                     # against origin/main
 *   bun run semver -- --base <ref>     # against any commit-ish
 *   bun run semver -- --root <dir>     # the bootstrap checkout at <dir>
 */
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { bootstrapRoot } from "./validate-bootstrap.ts";

export type Bump = "none" | "patch" | "minor" | "major" | "could not determine";

export interface Change {
  bump: Exclude<Bump, "none" | "could not determine">;
  /** JSON-pointer-ish location of the change. */
  at: string;
  why: string;
}

export interface Verdict {
  bump: Bump;
  changes: Change[];
}

const RANK: Record<Change["bump"], number> = { patch: 1, minor: 2, major: 3 };

/** Keywords that annotate and never change what validates. */
const ANNOTATIONS = new Set(["title", "description", "$comment", "examples", "default", "deprecated", "readOnly", "writeOnly"]);

/** Lower bounds: raising one narrows. */
const LOWER = new Set(["minimum", "exclusiveMinimum", "minLength", "minItems", "minProperties"]);
/** Upper bounds: lowering one narrows. */
const UPPER = new Set(["maximum", "exclusiveMaximum", "maxLength", "maxItems", "maxProperties"]);

type Json = unknown;
type Obj = Record<string, Json>;

const isObj = (v: Json): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const same = (a: Json, b: Json): boolean => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
function canon(v: Json): Json {
  if (Array.isArray(v)) return v.map(canon);
  if (isObj(v)) return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]));
  return v;
}
const asSet = (v: Json): string[] => (Array.isArray(v) ? v : v === undefined ? [] : [v]).map((x) => JSON.stringify(x));

function setMove(base: string[], head: string[]): "same" | "wider" | "narrower" | "both" {
  const removed = base.filter((x) => !head.includes(x));
  const added = head.filter((x) => !base.includes(x));
  if (!removed.length && !added.length) return "same";
  if (removed.length && added.length) return "both";
  return removed.length ? "narrower" : "wider";
}

/**
 * A `$id` with its release segment blanked, so two releases of one schema
 * compare equal: the major alone (`/v0/`), which every address carries since
 * the owner's 2026-10-23 ruling, or the full version (`/1.2.3/`) it carried
 * before — so the move from one form to the other is not a change either.
 */
export const unversioned = (id: string): string =>
  id.replace(/\/(?:\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?|v\d+)\//, "/{version}/");

/** Is an object schema CLOSED — does it reject keys it does not list? */
const closed = (s: Obj): boolean => s.additionalProperties === false;

/** Every change between two schema nodes, graded. */
export function diffSchema(base: Json, head: Json, at = ""): Change[] {
  const out: Change[] = [];
  const add = (bump: Change["bump"], where: string, why: string) => out.push({ bump, at: where || "/", why });

  if (same(base, head)) return out;
  if (!isObj(base) || !isObj(head)) {
    // `true`/`false` schemas, or a node replaced by a non-object.
    if (base === true && isObj(head)) add("major", at, "an unconstrained schema gained constraints");
    else if (isObj(base) && head === true) add("minor", at, "a constrained schema became unconstrained");
    else add("major", at, "the schema node was replaced by one of a different shape");
    return out;
  }

  const keys = new Set([...Object.keys(base), ...Object.keys(head)]);
  for (const k of keys) {
    const b = base[k];
    const h = head[k];
    if (same(b, h)) continue;
    const here = `${at}/${k}`;

    if (ANNOTATIONS.has(k)) {
      add("patch", here, `annotation \`${k}\` changed`);
    } else if (k === "$id" && typeof b === "string" && typeof h === "string" && unversioned(b) === unversioned(h)) {
      // A release IRI moving to the next version is the bump being PUBLISHED,
      // not a change to what validates: bootstrap mints each `$id` from its
      // declared iriBase and version, so every release changes this segment
      // and the previous release stays at its own address.
      continue;
    } else if (k === "$id" || k === "$schema") {
      add("major", here, `\`${k}\` changed — every consumer following the old one is repointed`);
    } else if (k === "type" || k === "enum") {
      const m = setMove(asSet(b), asSet(h));
      if (b === undefined) add("major", here, `\`${k}\` added — values of any other ${k === "type" ? "type" : "value"} now fail`);
      else if (h === undefined) add("minor", here, `\`${k}\` removed — widens`);
      else if (m === "wider") add("minor", here, `\`${k}\` widened`);
      else add("major", here, `\`${k}\` ${m === "narrower" ? "narrowed" : "changed incompatibly"}`);
    } else if (k === "const") {
      add(h === undefined ? "minor" : "major", here, h === undefined ? "`const` removed — widens" : "`const` added or changed");
    } else if (k === "required") {
      const m = setMove(asSet(b), asSet(h));
      if (m === "wider" ) add("major", here, `required field(s) added: ${asSet(h).filter((x) => !asSet(b).includes(x)).join(", ")}`);
      else if (m === "narrower") add("minor", here, "required field(s) relaxed to optional");
      else add("major", here, "required fields both added and removed");
    } else if (k === "additionalProperties") {
      if (h === false) add("major", here, "`additionalProperties: false` added — a key the schema does not list now fails (strictness tightened)");
      else if (b === false) add("minor", here, "`additionalProperties: false` removed — unlisted keys now pass");
      else if (b === undefined || b === true) out.push(...diffSchema(true, h, here));
      else if (h === undefined || h === true) out.push(...diffSchema(b, true, here));
      else out.push(...diffSchema(b, h, here));
    } else if (k === "properties") {
      const bp = isObj(b) ? b : {};
      const hp = isObj(h) ? h : {};
      for (const p of new Set([...Object.keys(bp), ...Object.keys(hp)])) {
        const pw = `${here}/${p}`;
        if (!(p in hp)) {
          // Removing a definition from a CLOSED object rejects the key; from an
          // open one it only drops the constraint on it.
          if (closed(head)) add("major", pw, `field \`${p}\` removed from a closed object — documents carrying it now fail`);
          else add("minor", pw, `field \`${p}\` removed from an open object — its constraint no longer applies`);
        } else if (!(p in bp)) {
          // Required-ness is graded by `required` above; the field itself is a widening.
          add("minor", pw, `field \`${p}\` added`);
        } else {
          out.push(...diffSchema(bp[p], hp[p], pw));
        }
      }
    } else if (k === "$defs" || k === "definitions" || k === "patternProperties") {
      const bd = isObj(b) ? b : {};
      const hd = isObj(h) ? h : {};
      for (const d of new Set([...Object.keys(bd), ...Object.keys(hd)])) {
        const dw = `${here}/${d}`;
        if (!(d in hd)) add("major", dw, `\`${k}\` entry \`${d}\` removed — anything referencing it breaks`);
        else if (!(d in bd)) add("minor", dw, `\`${k}\` entry \`${d}\` added`);
        else out.push(...diffSchema(bd[d], hd[d], dw));
      }
    } else if (LOWER.has(k) || UPPER.has(k)) {
      if (b === undefined) add("major", here, `bound \`${k}\` added`);
      else if (h === undefined) add("minor", here, `bound \`${k}\` removed`);
      else {
        const tighter = LOWER.has(k) ? (h as number) > (b as number) : (h as number) < (b as number);
        add(tighter ? "major" : "minor", here, `bound \`${k}\` ${tighter ? "tightened" : "loosened"} (${String(b)} → ${String(h)})`);
      }
    } else if (k === "pattern" || k === "format" || k === "uniqueItems") {
      if (h === undefined || h === false) add("minor", here, `\`${k}\` removed`);
      else add("major", here, `\`${k}\` ${b === undefined ? "added" : "changed"}`);
    } else if (k === "items" || k === "not" || k === "if" || k === "then" || k === "else" || k === "contains" || k === "propertyNames") {
      if (b === undefined) add("major", here, `\`${k}\` added`);
      else if (h === undefined) add("minor", here, `\`${k}\` removed`);
      else if (k === "not" || k === "if") add("major", here, `\`${k}\` changed — its direction cannot be graded by structure`);
      else out.push(...diffSchema(b, h, here));
    } else if (k === "allOf" || k === "anyOf" || k === "oneOf") {
      const ba = Array.isArray(b) ? b : [];
      const ha = Array.isArray(h) ? h : [];
      // allOf conjoins, so an added branch narrows; anyOf/oneOf disjoin, so an
      // added branch widens. oneOf's exclusivity makes even that uncertain, so
      // it is graded like allOf in the adding direction.
      const addNarrows = k !== "anyOf";
      const n = Math.max(ba.length, ha.length);
      for (let i = 0; i < n; i++) {
        const iw = `${here}/${i}`;
        if (i >= ba.length) add(addNarrows ? "major" : "minor", iw, `\`${k}\` branch added`);
        else if (i >= ha.length) add(k === "allOf" ? "minor" : "major", iw, `\`${k}\` branch removed`);
        else out.push(...diffSchema(ba[i], ha[i], iw));
      }
    } else {
      add("major", here, `unrecognised keyword \`${k}\` changed — graded breaking because it cannot be proved harmless`);
    }
  }
  return out;
}

/** Fold a change list into the one bump it requires. */
export function requiredBump(changes: readonly Change[]): Exclude<Bump, "could not determine"> {
  let best: Exclude<Bump, "could not determine"> = "none";
  for (const c of changes) if (best === "none" || RANK[c.bump] > RANK[best as Change["bump"]]) best = c.bump;
  return best;
}

/**
 * Classify one document, given the base TEXT (or why it could not be read) and
 * the head text. `baseText === null` means the file did not exist at the base.
 */
export function classify(baseText: string | null | { unreadable: string }, headText: string | null): Verdict {
  if (baseText !== null && typeof baseText === "object") {
    return { bump: "could not determine", changes: [] };
  }
  let base: Json;
  let head: Json;
  try {
    base = baseText === null ? undefined : JSON.parse(baseText);
  } catch {
    return { bump: "could not determine", changes: [] };
  }
  try {
    head = headText === null ? undefined : JSON.parse(headText);
  } catch {
    return { bump: "could not determine", changes: [] };
  }
  if (base === undefined && head === undefined) return { bump: "could not determine", changes: [] };
  if (base === undefined) return { bump: "minor", changes: [{ bump: "minor", at: "/", why: "a new schema is published" }] };
  if (head === undefined) return { bump: "major", changes: [{ bump: "major", at: "/", why: "a published schema was removed" }] };
  const changes = diffSchema(base, head);
  return { bump: requiredBump(changes), changes };
}

/** Read `path` (repo-relative) at `ref`: text, `null` if absent there, or why it could not be read. */
export function readAtRef(repo: string, ref: string, path: string): string | null | { unreadable: string } {
  const verify = spawnSync("git", ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], { cwd: repo, encoding: "utf8" });
  if (verify.error || verify.status !== 0) return { unreadable: `base \`${ref}\` does not resolve to a commit` };
  const ls = spawnSync("git", ["ls-tree", "--name-only", ref, "--", path], { cwd: repo, encoding: "utf8" });
  if (ls.error || ls.status !== 0) return { unreadable: `could not list \`${path}\` at \`${ref}\`` };
  if (ls.stdout.trim() === "") return null;
  const show = spawnSync("git", ["show", `${ref}:${path}`], { cwd: repo, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (show.error || show.status !== 0) return { unreadable: `could not read \`${path}\` at \`${ref}\`` };
  return show.stdout;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const bi = args.indexOf("--base");
  const ref = bi !== -1 ? args[bi + 1] : "origin/main";
  if (!ref) {
    console.error("--base needs a ref");
    process.exit(2);
  }
  const ri = args.indexOf("--root");
  const rootArg = ri !== -1 ? args[ri + 1] : undefined;
  let dir: string;
  let repo: string;
  try {
    const root = bootstrapRoot(rootArg);
    // The git repository the bootstrap checkout lives in, which is where `--base` resolves.
    const top = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: root, encoding: "utf8" });
    if (top.error || top.status !== 0) throw new Error(`${root} is not inside a git checkout, so there is no base to read`);
    repo = top.stdout.trim();
    // declared-path-literal: the published documents' directory, the same tail the generator writes into.
    dir = join(root, "schemas");
  } catch (err) {
    console.error(`could not determine: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(2);
  }
  const headFiles = readdirSync(dir).filter((f) => f.endsWith(".schema.json"));
  const relDir = relative(repo, dir);
  const ls = spawnSync("git", ["ls-tree", "--name-only", `${ref}:${relDir}`], { cwd: repo, encoding: "utf8" });
  const baseFiles = ls.status === 0 ? ls.stdout.split("\n").filter((f) => f.endsWith(".schema.json")) : [];
  const files = [...new Set([...headFiles, ...baseFiles])].sort();

  console.log(`Bootstrap contract semver — ${files.length} published schema(s), against \`${ref}\`\n`);
  let overall: Bump = "none";
  let undetermined = 0;
  for (const f of files) {
    const rel = `${relDir}/${f}`;
    const baseText = readAtRef(repo, ref, rel);
    let headText: string | null = null;
    try {
      headText = readFileSync(join(dir, f), "utf8");
    } catch {
      headText = null;
    }
    const v = classify(baseText, headText);
    console.log(`  ${v.bump.padEnd(20)} ${rel}`);
    if (v.bump === "could not determine") {
      undetermined++;
      if (baseText !== null && typeof baseText === "object") console.log(`      ${baseText.unreadable}`);
    }
    for (const c of v.changes.slice(0, 20)) console.log(`      ${c.bump.padEnd(6)} ${c.at}  ${c.why}`);
    if (v.bump !== "could not determine" && v.bump !== "none" && (overall === "none" || RANK[v.bump] > RANK[overall as Change["bump"]])) {
      overall = v.bump;
    }
  }
  if (undetermined > 0) {
    console.log(`\nrequired bump: could not determine — ${undetermined} schema(s) had no readable base. Not "patch".`);
    process.exit(2);
  }
  console.log(`\nrequired bump: ${overall}`);
}
