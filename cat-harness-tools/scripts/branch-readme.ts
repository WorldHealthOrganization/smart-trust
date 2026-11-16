#!/usr/bin/env bun
/**
 * Every special branch's README, RENDERED from what declares it.
 *
 * A hand-written README drifts from the facts it restates, so this renders
 * one from two KG sources:
 *
 * - the **declaration** — every layer directory whose `storage`/`source`
 *   names the branch, with its id, path, graph typologies and description.
 *   Each harness (or layer) declares its own; this reads the declarations
 *   where they are, never a central table of branches;
 * - the branch's own root **`manifest.json`** (`state-manifest/v1`, schema in
 *   `@litlfred/cat-harness/schemas/kg/state-manifest.ts`) — status, the seed
 *   commit, when, the writer and gate of a rendered branch.
 *
 * Status, provenance and write discipline are what tell a live branch from an
 * abandoned one.
 *
 * ## Families
 *
 * A `branchPrefix` declaration names a family, one branch per key, and the
 * members are not known until a key is published. **Each member carries its
 * own README**, rendered from the family's declaration and the member's own
 * manifest. This command lists a family as `family` and does not enumerate
 * its members.
 *
 * ## Three states
 *
 * `--check` reports a branch `current`, `stale` (README absent or different
 * from the rendering), or `unknown` (the branch or its manifest could not be
 * read, or the manifest does not parse). Unknown exits 2, stale exits 1.
 *
 * Usage:
 *   bun run cat branch:readme --check              every declared branch
 *   bun run cat branch:readme --print <branch>     the rendering, to stdout
 *   bun run cat branch:readme --push <branch>      replace the branch's README (a describing write)
 *
 * @module scripts/branch-readme
 */
import { readFileSync } from "node:fs";
import { basename, join, relative } from "node:path";

import { findDeclarationFile, layerRootsIn } from "../schemas/kg/instance-roots.ts";
import { StateManifestSchema, type StateManifest } from "../schemas/kg/state-manifest.ts";

import { BranchStore, storeOptionsFor, tipLocations, type BranchKeying, type FileRead } from "./branch-store.ts";
import { gateOwnInstances } from "./lib/gate-own.ts";
import { REPO_ROOT } from "./lib/roots.ts";

/** One layer directory kept on a branch. */
export interface BranchDeclaration {
  instance: string;
  id: string;
  path: string;
  graphTypologies: string[];
  description?: string;
  keyedBy: string;
  /** Set when the declaration names a FAMILY by prefix. */
  family?: boolean;
  /** The Tool that publishes it, when the declaration names one — then the Tool owns the branch, not the store. */
  tool?: string;
  /** The repository the branch is kept in, when it is not this checkout's `origin` (`TipLocation.repository`). */
  repository?: string;
}

/** Every branch the layers in `root` declare, grouped by branch (or family prefix). */
export function declaredBranches(root: string): Map<string, BranchDeclaration[]> {
  const out = new Map<string, BranchDeclaration[]>();
  // Where each branch is KEPT, as the store resolves it: a layer mounted
  // from another repository keeps its branches there, not in this `origin`.
  const kept = new Map<string, string>();
  // ...and where each directory IS, as the store resolves it: a
  // repository-scoped directory (`beans`) sits at the top of the checkout,
  // not under the layer that declares it.
  const at = new Map<string, string>();
  try {
    for (const l of tipLocations(root, "any")) {
      if (l.repository) kept.set(l.branch, l.repository);
      at.set(`${l.branch}\0${l.id}`, l.path);
    }
  } catch {
    // An unresolvable location is reported per branch by the read, not here.
  }
  for (const inst of layerRootsIn(root)) {
    const file = findDeclarationFile(inst);
    if (!file) continue;
    let decl: { name?: string; directories?: Array<Record<string, unknown>> };
    try {
      decl = JSON.parse(readFileSync(join(inst, file), "utf8"));
    } catch {
      continue;
    }
    for (const d of decl.directories ?? []) {
      const src = (d.storage ?? d.source) as Record<string, unknown> | undefined;
      if (!src || typeof src !== "object") continue;
      const branch = typeof src.branch === "string" ? src.branch : typeof src.branchPrefix === "string" ? src.branchPrefix : undefined;
      if (!branch || typeof src.keyedBy !== "string") continue;
      const entry: BranchDeclaration = {
        instance: decl.name ?? basename(inst),
        id: String(d.id),
        path: at.get(`${branch}\0${String(d.id)}`) ?? relative(root, join(inst, String(d.path))).split("\\").join("/").replace(/\/+$/, ""),
        graphTypologies: Array.isArray(d.graphTypologies) ? (d.graphTypologies as string[]) : [],
        ...(typeof d.description === "string" ? { description: d.description } : {}),
        keyedBy: src.keyedBy,
        ...(typeof src.branchPrefix === "string" ? { family: true } : {}),
        ...(typeof src.tool === "string" ? { tool: src.tool } : {}),
        ...(kept.has(branch) ? { repository: kept.get(branch)! } : {}),
      };
      out.set(branch, [...(out.get(branch) ?? []), entry]);
    }
  }
  for (const v of out.values()) v.sort((a, b) => (a.instance + a.id < b.instance + b.id ? -1 : 1));
  return new Map([...out.entries()].sort(([a], [b]) => (a < b ? -1 : 1)));
}

export const GENERATED_MARK =
  "<!-- branch-readme: generated by `bun run cat branch:readme` (cat-harness-tools/scripts/branch-readme.ts) from this branch's manifest.json and the declarations below. Do not edit; change those and regenerate. -->";

const WRITES: Record<string, string> = {
  tip:
    "Spliced onto the tip through `scripts/branch-store.ts` (`bun run cat state:mount`, then `bun run cat state:push`). A change carries the blob its author read, so two writers of one file conflict instead of overwriting. Never force-pushed, never merged into `main`.",
  route:
    "Replaced route by route by its one writer; the newer generation wins, so a write carries no `expect`. Never force-pushed, never merged into `main`.",
  commit:
    "Published per commit by `scripts/qa-store.ts` (`bun run cat qa:publish`): `main/<sha>/` and `pr/<n>/<sha>/`, with `index.json` naming the newest per ref. Never force-pushed, never merged into `main`.",
};

const KIND: Record<string, string> = {
  tip: "a **state branch** — one live copy whose tip is the current state",
  route: "a **rendered-output branch** — one entry per published route, each replaced wholesale by its generator",
  commit: "a **QA results branch** — one entry per commit, read against a baseline",
};

function cell(s: string): string {
  return s.replace(/[\\|]/g, "\\$&").replace(/\n+/g, " ");
}

/**
 * The README for one branch. Deterministic in its inputs: no clock, no tip
 * sha, no file count that a write changes — so `--check` compares like with
 * like and a README goes stale only when its sources do.
 */
export function renderBranchReadme(branch: string, decls: BranchDeclaration[], manifest: StateManifest | undefined): string {
  const keyedBy = manifest?.keyedBy ?? decls[0]?.keyedBy ?? "unknown";
  const lines: string[] = [GENERATED_MARK, "", `# ${branch}`, ""];
  const subgraph = manifest && manifest.keyedBy === "tip" ? manifest.subgraph : undefined;
  lines.push(
    `This is ${KIND[keyedBy] ?? `a branch keyed by \`${keyedBy}\``}${subgraph ? ` of the \`${subgraph}\` subgraph` : ""}. ` +
      "It is an orphan branch, never merged into `main`.",
    "",
  );

  lines.push("## Status", "");
  if (!manifest) {
    lines.push(
      keyedBy === "commit"
        ? "- **Derived and regenerable.** No `manifest.json`: every entry is the output of a QA run, so the branch has no seed and no single status."
        : "- **Unknown.** The branch carries no `manifest.json`, so its status and provenance are not recorded.",
    );
  } else {
    lines.push(
      `- **${manifest.status}** — ${manifest.authoritative ? "authoritative: readers look here, not on `main`." : "not authoritative: `main` is still the source."}`,
    );
    const m = manifest as Record<string, unknown>;
    if (typeof m.retiredAt === "string") {
      lines.push(`- **Retired** ${m.retiredAt}${typeof m.retiredReason === "string" ? `: ${cell(m.retiredReason)}` : "."}`);
    }
    if (m.supersededBy && typeof m.supersededBy === "object") {
      for (const [path, to] of Object.entries(m.supersededBy as Record<string, string>)) lines.push(`- \`${path}\` is now on \`${to}\`.`);
    }
  }
  lines.push("");

  if (manifest) {
    lines.push("## Provenance", "");
    if (manifest.keyedBy === "tip") {
      lines.push(`- **Seeded**${manifest.seededAt ? ` ${manifest.seededAt}` : ""} from \`${manifest.source.ref}\` at \`${manifest.source.sha}\`.`);
      if (manifest.refreshedAt) lines.push(`- **Refreshed** ${manifest.refreshedAt}.`);
      lines.push(`- **Holds:** ${manifest.graphs.map((g) => `\`${g.path}\``).join(", ")}.`);
    } else {
      lines.push(`- **Seeded** ${manifest.seededAt} from \`${manifest.seededFrom}\`.`);
      lines.push(`- **Writer:** \`${manifest.writer}\`. **Gate:** \`${manifest.gate}\`.`);
      if (manifest.bean) lines.push(`- **Bean:** \`${manifest.bean}\`.`);
      lines.push(`- **Holds:** ${manifest.directories.map((d) => `\`${d.path}\` (\`${d.id}\`)`).join(", ")}.`);
    }
    lines.push("");
  }

  lines.push("## Writes", "", WRITES[keyedBy] ?? `No write discipline is recorded for keying \`${keyedBy}\`.`, "");

  lines.push("## Declared by", "", "| instance | directory | path | holds | what it is |", "|---|---|---|---|---|");
  for (const d of decls) {
    lines.push(`| \`${d.instance}\` | \`${d.id}\` | \`${d.path}\` | ${d.graphTypologies.map((k) => `\`${k}\``).join(", ")} | ${cell(d.description ?? "")} |`);
  }
  if (decls.length === 0) lines.push("| — | — | — | — | no declaration in this checkout names this branch |");
  lines.push("");

  const note = (manifest as { note?: unknown } | undefined)?.note;
  if (typeof note === "string" && note) lines.push("## Note", "", note, "");
  return `${lines.join("\n").replace(/\n+$/, "")}\n`;
}

export type BranchVerdict =
  | { branch: string; state: "current" }
  | { branch: string; state: "stale"; reason: string; rendered: string }
  | { branch: string; state: "family"; reason: string }
  | { branch: string; state: "tool"; reason: string }
  | { branch: string; state: "unknown"; reason: string };

/** Reads a root file of a branch. Injected for tests; defaults to the branch store. */
export type RootReader = (branch: string, keyedBy: string, path: string) => FileRead;

/** The store a branch is kept in: this checkout's `origin`, or the repository its declaration resolves to. */
function storeFor(root: string, branch: string, d: BranchDeclaration | undefined): BranchStore {
  const k: BranchKeying = d?.keyedBy === "route" || d?.keyedBy === "route-family" ? (d.keyedBy as BranchKeying) : "tip";
  return BranchStore.open(branch, storeOptionsFor({ repository: d?.repository }, root, { repoRoot: root, keyedBy: k }));
}

export function storeReader(root: string, decls: Map<string, BranchDeclaration[]>): RootReader {
  return (branch, _keyedBy, path) => storeFor(root, branch, decls.get(branch)?.[0]).readUnverified(path);
}

export function verdictFor(branch: string, decls: BranchDeclaration[], read: RootReader): BranchVerdict {
  if (decls.some((d) => d.family)) {
    return { branch, state: "family", reason: "a family prefix: each member carries its own README, rendered from this declaration and the member's manifest; members are not enumerated here" };
  }
  const tool = decls.find((d) => d.tool)?.tool;
  if (tool) {
    return { branch, state: "tool", reason: `published by the \`${tool}\` Tool, which owns what the branch carries; not a branch-store branch` };
  }
  const keyedBy = decls[0]?.keyedBy ?? "tip";
  let manifest: StateManifest | undefined;
  if (keyedBy !== "commit") {
    const m = read(branch, keyedBy, "manifest.json");
    if (m.state !== "hit") return { branch, state: "unknown", reason: `manifest.json: ${m.state} — ${m.reason}` };
    let json: unknown;
    try {
      json = JSON.parse(m.text);
    } catch (e) {
      return { branch, state: "unknown", reason: `manifest.json does not parse: ${(e as Error).message}` };
    }
    const p = StateManifestSchema.safeParse(json);
    if (!p.success) {
      return { branch, state: "unknown", reason: `manifest.json is not state-manifest/v1: ${p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}` };
    }
    manifest = p.data;
  }
  const rendered = renderBranchReadme(branch, decls, manifest);
  const r = read(branch, keyedBy, "README.md");
  if (r.state === "unknown") return { branch, state: "unknown", reason: `README.md: ${r.reason}` };
  if (r.state !== "hit") return { branch, state: "stale", reason: "README.md is absent", rendered };
  if (r.text !== rendered) {
    return { branch, state: "stale", reason: r.text.startsWith(GENERATED_MARK) ? "README.md differs from its sources" : "README.md is hand-written", rendered };
  }
  return { branch, state: "current" };
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const root = REPO_ROOT ?? process.cwd();
  const all = declaredBranches(root);
  const at = (f: string) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : undefined);
  const one = at("--print") ?? at("--push");
  if (one) {
    const decls = all.get(one);
    if (!decls) {
      console.error(`no instance in ${root} declares ${one}`);
      process.exit(2);
    }
    const v = verdictFor(one, decls, storeReader(root, all));
    if (v.state === "unknown" || v.state === "family" || v.state === "tool") {
      console.error(`${one}: ${v.state} — ${v.reason}`);
      process.exit(2);
    }
    if (v.state === "current") {
      console.error(`${one}: README is current`);
      process.exit(0);
    }
    if (argv.includes("--print")) {
      process.stdout.write(v.rendered);
      process.exit(0);
    }
    const store = storeFor(root, one, decls[0]);
    const w = store.write([{ path: "README.md", content: v.rendered }], `branch-readme: render README.md from the manifest and declarations (bean esz4)`, { describe: true });
    console.log(`${one}: ${w.state} — ${w.reason}`);
    process.exit(w.state === "pushed" || w.state === "unchanged" ? 0 : 1);
  }
  // In a layer's PR checks, only branches the caller's own layers declare
  // (owner ruling 2026-11-05, "Move the checks", generator checks included; `lib/gate-own.ts`).
  const own = gateOwnInstances();
  const judged = [...all.entries()].filter(([, d]) => !own || d.some((x) => own.has(x.instance)));
  if (own && judged.length === 0 && all.size > 0) {
    console.log(`✓ branch:readme --check: none of the ${all.size} declared branch(es) is the caller's; their declaring layers' CI judges them.`);
    process.exit(0);
  }
  const verdicts = judged.map(([b, d]) => verdictFor(b, d, storeReader(root, all)));
  for (const v of verdicts) console.log(`${{ current: "✓", stale: "✗", family: "·", tool: "·", unknown: "?" }[v.state]} ${v.branch} — ${v.state}${"reason" in v ? `: ${v.reason}` : ""}`);
  const unknown = verdicts.filter((v) => v.state === "unknown").length;
  const stale = verdicts.filter((v) => v.state === "stale").length;
  const current = verdicts.filter((v) => v.state === "current").length;
  console.log(`\n${verdicts.length} declared branch(es): ${current} current, ${stale} stale, ${unknown} could not be determined, ${verdicts.length - current - stale - unknown} family or Tool-owned.`);
  process.exit(unknown ? 2 : stale ? 1 : 0);
}
