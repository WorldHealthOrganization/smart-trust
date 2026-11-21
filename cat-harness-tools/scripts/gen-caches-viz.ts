#!/usr/bin/env bun
/**
 * Render the `cache` graph: every cache this layer declares, with its key
 * recipe, trust class, location, producer and consumers, and the key today's
 * pins IMPLY, set against the key the cache service holds.
 *
 * @module cat-harness-tools/scripts/gen-caches-viz
 * @covers cache
 *
 * Rule 6 of cache-first CI: staleness is COMPUTED, never claimed. The implied
 * key is computed here, from the recipe, where it can be:
 *
 * - `hashFiles` — the runner's `hashFiles()` over the named files (sha256 over
 *   each file's raw sha256, in path order), relative to the checkout root;
 * - anything else — "could not determine here", with why (a `cache:key`
 *   recipe over "each gate" has one key per gate; a workflow-script recipe is
 *   computed only by the workflow; a run-scoped key has no implied value).
 *
 * The stored key, size, last access, hit rate and last producer run are facts
 * about the cache service, read from the daily cache report (`--stored
 * <file>`: `{ "<id>": { key, sizeBytes, lastAccessedAt, hitRate,
 * lastProducerRun } }`). Without it every one of those cells says where it
 * would come from: never a number nobody measured. So without a report every
 * staleness cell is `undetermined`, which is the honest answer.
 *
 * An inventory snapshot (`cache-inventory/1.0.0`) in `caches/` is listed
 * after the declared caches, with its date and method, never as
 * declarations. A survey of a whole index names the layers above this one,
 * so it is kept by the index that took it, not here (`check:reference-direction`).
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/gen-caches-viz.ts                       # writes VIEW_FILE, the committed viewer page
 *   bun run cat-harness-tools/scripts/gen-caches-viz.ts --out <file> [--stored <report.json>]   # a live page
 *   bun run cat-harness-tools/scripts/gen-caches-viz.ts --check
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import {
  CacheInventorySchema,
  CacheSchema,
  nodeStaleness,
  type Cache,
  type CacheInventory,
  type KeyRecipe,
  type StoredFacts,
} from "../schemas/sdlc/cache.ts";

const LAYER_ROOT = resolve(import.meta.dir, "..");
export const CACHES_DIR = join(LAYER_ROOT, "caches");
export const VIEW_FILE = join(CACHES_DIR, "viewer.md");

/** The runner's `hashFiles()`: sha256 over each file's raw sha256, in path order. */
export function hashFilesOf(root: string, files: readonly string[]): string | { undetermined: string } {
  const abs = [...files].map((f) => resolve(root, f)).sort();
  const outer = createHash("sha256");
  for (const f of abs) {
    if (!existsSync(f) || !statSync(f).isFile()) return { undetermined: `${relative(root, f)} is not a file in this checkout` };
    outer.update(createHash("sha256").update(readFileSync(f)).digest());
  }
  return abs.length > 0 ? outer.digest("hex") : { undetermined: "no file to hash" };
}

/** The key today's pins imply, or why it cannot be computed here. */
export function impliedKey(recipe: KeyRecipe, root: string): string | { undetermined: string } {
  switch (recipe.source) {
    case "hashFiles":
      return hashFilesOf(root, recipe.files ?? []);
    case "cache:key":
    case "cache:key --base":
      return recipe.script?.startsWith("(") === true
        ? { undetermined: `one key per gate (\`${recipe.source} <gate>\`), not one for the cache` }
        : { undetermined: `computed by \`bun run cat ${recipe.source} ${recipe.script}\` in a composed checkout` };
    case "script":
      return { undetermined: `computed only by ${recipe.implementation}` };
    case "per-run":
      return { undetermined: "run-scoped: no key is implied between runs" };
    case "hand-listed":
      return { undetermined: "hand-listed inputs: no derived key to compare (a finding)" };
  }
}

export interface Loaded {
  caches: Cache[];
  inventories: CacheInventory[];
  refused: { file: string; why: string }[];
}

/** Every node in `dir`, validated; a file that does not parse is REFUSED, not skipped silently. */
export function loadCaches(dir = CACHES_DIR): Loaded {
  const out: Loaded = { caches: [], inventories: [], refused: [] };
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".json")).sort()) {
    let json: unknown;
    try {
      json = JSON.parse(readFileSync(join(dir, f), "utf8"));
    } catch (e) {
      out.refused.push({ file: f, why: (e as Error).message });
      continue;
    }
    const tag = (json as { $schema?: unknown }).$schema;
    const r = tag === "cache-inventory/1.0.0" ? CacheInventorySchema.safeParse(json) : CacheSchema.safeParse(json);
    if (!r.success) {
      out.refused.push({ file: f, why: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
      continue;
    }
    if (tag === "cache-inventory/1.0.0") out.inventories.push(r.data as CacheInventory);
    else out.caches.push(r.data as Cache);
  }
  return out;
}

/** A Markdown table cell: backslashes and pipes in one pass (so `\|` cannot be un-escaped by a trailing `\`), then line breaks. */
export const cell = (s: string) => s.replace(/[\\|]/g, "\\$&").replace(/\r?\n/g, " ");
const code = (s: string) => `\`${s.replace(/`/g, "'")}\``;

/** The page, deterministic: no clock, no environment, sorted. */
export function render(loaded: Loaded, root: string, stored: Readonly<Record<string, StoredFacts>> | undefined): string {
  const lines: string[] = [];
  lines.push("# Caches", "");
  lines.push(
    "Every cache this layer declares (`cache/1.0.0`, `caches/`), and the key today's pins imply against the key the cache service holds. " +
      "Staleness is computed, never claimed: a key that cannot be computed here, or a stored key nobody has read, is `undetermined`. " +
      "Stored key, size, age and hit rate come from the daily cache report; without it those cells say so. " +
      "Generated by `scripts/gen-caches-viz.ts`; do not edit.",
    "",
  );
  if (loaded.refused.length > 0) {
    lines.push("## Refused", "", "| file | why |", "|---|---|");
    for (const r of loaded.refused) lines.push(`| ${code(r.file)} | ${cell(r.why)} |`);
    lines.push("");
  }
  lines.push("## Declared caches", "");
  lines.push("| cache | kind | trust | location | key recipe | implied key | stored key | staleness | size · last access · hit rate |");
  lines.push("|---|---|---|---|---|---|---|---|---|");
  for (const c of [...loaded.caches].sort((a, b) => a.id.localeCompare(b.id))) {
    const implied = impliedKey(c.keyRecipe, root);
    const facts = stored?.[c.id];
    const st = nodeStaleness(c, implied, facts);
    const stCell = st.state === "current" ? "current" : st.state === "stale" ? `**stale** (holds ${code(st.stored.slice(0, 24))}…)` : `undetermined — ${st.why}`;
    const recipe = `${c.keyRecipe.source}${c.keyRecipe.expression ? `: ${code(c.keyRecipe.expression)}` : ""}`;
    const facts3 = facts === undefined
      ? "from the daily report (not read)"
      : [facts.sizeBytes !== undefined ? `${(facts.sizeBytes / 1048576).toFixed(1)} MiB` : "size not reported", facts.lastAccessedAt ?? "access not reported", facts.hitRate !== undefined ? `${Math.round(facts.hitRate * 100)}%` : "hit rate not reported"].join(" · ");
    lines.push(
      `| [${c.id}](#${c.id}) | ${c.kind} | ${c.trustClass} | ${code(c.location)} | ${cell(recipe)} | ${typeof implied === "string" ? code(implied.slice(0, 16)) + "…" : `undetermined — ${cell(implied.undetermined)}`} | ${facts?.key ? code(facts.key.slice(0, 24)) + "…" : "from the daily report (not read)"} | ${cell(stCell)} | ${facts3} |`,
    );
  }
  lines.push("");
  for (const c of [...loaded.caches].sort((a, b) => a.id.localeCompare(b.id))) {
    lines.push(`### ${c.id}`, "", `**${cell(c.title)}** — ${c.instance}, trust class ${c.trustClass}${c.owner ? `, owner ${c.owner}` : ""}.`, "");
    lines.push(`- **Holds:** ${cell(c.holds)}`);
    lines.push(`- **Derived inputs:** ${cell(c.derivedInputs)}`);
    lines.push(`- **Producer:** ${cell(c.producer)}`);
    lines.push(`- **Consumers:** ${c.consumers.map(cell).join("; ")}`);
    lines.push(`- **Save policy:** ${cell(c.savePolicy)}`);
    lines.push(`- **Verify:** ${cell(c.verify)}`);
    if (c.budget) lines.push(`- **Budget:** ${c.budget.maxBytes ? `${c.budget.maxBytes} bytes` : ""}${c.budget.note ? ` ${cell(c.budget.note)}` : ""}`);
    lines.push(`- **Uses:** ${c.uses.map(code).join(", ")}`);
    if (c.notes) lines.push(`- **Notes:** ${cell(c.notes)}`);
    lines.push("");
  }
  for (const inv of loaded.inventories) {
    lines.push(`## Inventory snapshot, ${inv.takenAt}`, "", cell(inv.method), "");
    lines.push(`Repositories searched: ${inv.repositories.map(code).join(", ")}. ${inv.entries.length} caches found.`, "");
    const byRepo = new Map<string, number>();
    for (const e of inv.entries) byRepo.set(e.repo, (byRepo.get(e.repo) ?? 0) + 1);
    lines.push("| repository | caches |", "|---|---:|");
    for (const [r, n] of [...byRepo].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) lines.push(`| ${code(r)} | ${n} |`);
    lines.push("", "| repository | cache | kind | uses | key | key derivation |", "|---|---|---|---:|---|---|");
    for (const e of [...inv.entries].sort((a, b) => a.repo.localeCompare(b.repo) || a.id.localeCompare(b.id))) {
      lines.push(`| ${code(e.repo)} | ${code(e.id)} | ${e.kind} | ${e.locations.length} | ${e.key ? code(e.key.slice(0, 80)) : "—"} | ${cell(e.keyDerivation ?? "—")} |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

/** One entry of the daily cache report (folio-assistant `cache-report.sh --json`, schema `cache-report/1`). */
export interface ReportEntry {
  key: string;
  ref: string;
  sizeBytes: number;
  lastAccessedAt: string;
  createdAt?: string;
}
export interface CacheReport {
  schema: "cache-report/1";
  entries: ReportEntry[];
  hitRate?: Record<string, number>;
}

/**
 * The stored facts of each cache, from a raw daily report. The report names no
 * node: an Actions-cache node owns the entries whose key starts with its
 * `location`, and its stored key is the newest one saved on `main` (what every
 * branch reads), else the newest at all. A node of another kind (a ref, an
 * image) gets nothing from this report, so its cells stay undetermined. The
 * hit rate is the one `cached-step` reported under the node's id, if any.
 * An already-resolved map (`Record<id, StoredFacts>`) passes through.
 */
export function storedFromReport(report: unknown, caches: readonly Cache[]): Record<string, StoredFacts> {
  const r = report as Partial<CacheReport> | undefined;
  if (r?.schema !== "cache-report/1" || !Array.isArray(r.entries)) return (report ?? {}) as Record<string, StoredFacts>;
  const out: Record<string, StoredFacts> = {};
  const newest = (a: ReportEntry, b: ReportEntry) => ((b.createdAt ?? b.lastAccessedAt) > (a.createdAt ?? a.lastAccessedAt) ? b : a);
  for (const c of caches) {
    const facts: StoredFacts = {};
    if (c.kind === "actions-cache" && c.location.length > 0) {
      const mine = r.entries.filter((e) => e.key.startsWith(c.location));
      const onMain = mine.filter((e) => e.ref === "refs/heads/main");
      const pick = (onMain.length > 0 ? onMain : mine).reduce<ReportEntry | undefined>((a, b) => (a === undefined ? b : newest(a, b)), undefined);
      if (pick !== undefined) {
        facts.key = pick.key;
        facts.sizeBytes = mine.reduce((n, e) => n + e.sizeBytes, 0);
        facts.lastAccessedAt = pick.lastAccessedAt;
      }
    }
    const rate = r.hitRate?.[c.id];
    if (typeof rate === "number") facts.hitRate = rate;
    if (Object.keys(facts).length > 0) out[c.id] = facts;
  }
  return out;
}

function main(argv: string[]): number {
  const at = (f: string) => (argv.indexOf(f) >= 0 ? argv[argv.indexOf(f) + 1] : undefined);
  const storedFile = at("--stored");
  const out = at("--out") ?? VIEW_FILE;
  // The checkout root, for `hashFiles` recipes: the composed checkout when this layer is mounted in one.
  const root = existsSync(join(LAYER_ROOT, "..", "index.lock.json")) ? resolve(LAYER_ROOT, "..") : LAYER_ROOT;
  const loaded = loadCaches();
  const stored = storedFile ? storedFromReport(JSON.parse(readFileSync(storedFile, "utf8")), loaded.caches) : undefined;
  // The COMMITTED page (no --out) is rendered with the layer as root and no
  // report, so it does not depend on where the layer is mounted or on a
  // report, and `--check` can hold it current. A live page, with a report and
  // the composed checkout's root, goes to `--out` (the site build, CI).
  const live = out !== VIEW_FILE;
  const page = render(loaded, live ? root : LAYER_ROOT, live ? stored : undefined) + "\n";
  if (argv.includes("--check")) {
    const have = existsSync(VIEW_FILE) ? readFileSync(VIEW_FILE, "utf8") : "";
    if (have !== page) {
      console.error(`caches:viz:check: ${relative(process.cwd(), VIEW_FILE)} is stale; run \`bun run cat caches:viz\``);
      return 1;
    }
    if (loaded.refused.length > 0) {
      console.error(`caches:viz:check: ${loaded.refused.length} node(s) refused: ${loaded.refused.map((r) => r.file).join(", ")}`);
      return 1;
    }
    console.log(`caches:viz:check: ${loaded.caches.length} cache(s), ${loaded.inventories.length} inventory snapshot(s); the page is current`);
    return 0;
  }
  if (!existsSync(dirname(out))) throw new Error(`${out}: no such directory`);
  writeFileSync(out, page);
  console.log(`caches:viz: wrote ${relative(process.cwd(), out)} (${loaded.caches.length} caches, ${loaded.refused.length} refused)`);
  return 0;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
