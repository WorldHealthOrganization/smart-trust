#!/usr/bin/env bun
/**
 * A guide's personas and business processes → the vocabulary JSON that
 * `l1-recommendation-scenarios.ts` resolves a mapping against. Bean `kvd2`.
 *
 * Owner, 2026-10-10: *"skill is to reuse existing vocabulary if possible"*.
 * A scenario can only reuse a persona or a process if the reuse is CHECKED,
 * and it can only be checked against a list. This writes that list, from the
 * pages the guide publishes, and never adds to it.
 *
 * ## Two readers, one shape
 *
 * - `--guide <checkout>`: a SMART guideline's IG checkout. Its processes are
 *   the markdown table in `input/pagecontent/business-processes.md`, and its
 *   personas the HTML tables in `input/pagecontent/personas.md` — the DAK page
 *   conventions every SMART guideline shares. A guide that holds no
 *   ActorDefinition and no BPMN (bean `96y4`) has these pages as its persona
 *   and process vocabulary. tier `guide`.
 * - `--fsh-actors <dir>`: smart-base's own generic personas,
 *   `input/fsh/actors/DAK.Persona.*.fsh` (ISCO / CDHI). tier `generic`, the
 *   second rung of the precedence; it holds no processes.
 *
 * ## The guide's own identity — read from the checkout, never named here
 *
 * `guide`, `namespace` and `source.repository` come from the checkout's own
 * declarations (`guideIdentity`): the harness declaration `<name>.json` at its
 * root or one directory down (`name`, `repository`), and `sushi-config.yaml`
 * `canonical` (or the DAK declaration's `canonicalUrl`) for the namespace, in the
 * `dakNamespace` form. Without a declaration the name is the repository's.
 *
 * ## Identity — read, never improved
 *
 * personas.md prints no persona ids, so a persona's id is `slug(title)`, which
 * is what smart-kg `kgid.mjs` `personaId` mints a persona IRI from. A generic
 * persona's id is its FSH instance id (`DAK.Persona.HealthcareProvider`),
 * because that is what a `Canonical()` reference resolves against. A
 * process's id is the printed Process ID (e.g. `IMMZ.D`). Every entry keeps the
 * file and the row it was read from, and the file records the commit.
 *
 *   bun run smart-base/scripts/l1-scenario-vocabulary.ts --guide <guide checkout> --out <file> [--check]
 *   bun run smart-base/scripts/l1-scenario-vocabulary.ts --fsh-actors <dir> --out <file> [--check]
 *
 * @module smart-base/scripts/l1-scenario-vocabulary
 * @covers scenarios
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { z } from "zod";

import { readIgDakMetadata } from "./ig-dak-metadata.ts";

/**
 * Kept in the always-on `scripts/` (and re-exported by `L1/scripts/l1-kgid.ts`)
 * so `l1-scenario-vocabulary.ts`, `l1-recommendation-scenarios.ts` and
 * `terminology-lookup.ts` never import into the opt-in `L1/` subgraph, which is
 * omitted when a downstream mounts `smart-base` without `smart-base.smart-base-L1`.
 */
export const slug = (s: unknown): string =>
  String(s)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** The DAK namespace a file belongs to: trailing format segment dropped, smart.who.int on https. */
export const dakNamespace = (raw: unknown): string =>
  String(raw ?? "urn:unknown")
    .replace(/\/$/, "")
    .replace(/\/(bpmn|dmn|cql|fsh)$/i, "")
    .replace(/^http:\/\/(smart\.who\.int\b)/, "https://$1");

export const L1_NAMESPACE = "https://smart.who.int/kg/l1";

export const VOCABULARY_SCHEMA_TAG = "l1-scenario-vocabulary/v1" as const;

const SourceRef = z.object({ path: z.string().min(1), locator: z.string().min(1) }).strict();

export const VocabPersonaSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1).optional(),
  otherNames: z.array(z.string().min(1)).optional(),
  iscoCode: z.array(z.string().min(1)).optional(),
  personaType: z.string().min(1).optional(),
  source: SourceRef,
}).strict();
export type VocabPersona = z.infer<typeof VocabPersonaSchema>;

export const VocabProcessSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  objectives: z.string().min(1).optional(),
  /** The Personas column, verbatim: names, not ids, because the table prints names. */
  personasNamed: z.array(z.string().min(1)).optional(),
  source: SourceRef,
}).strict();
export type VocabProcess = z.infer<typeof VocabProcessSchema>;

export const VocabularySchema = z.object({
  $schema: z.literal(VOCABULARY_SCHEMA_TAG),
  _comment: z.string().optional(),
  /** Which rung of the precedence this list is: the target guide's own, or smart-base's generic. */
  tier: z.enum(["guide", "generic"]),
  guide: z.string().min(1),
  /** The namespace node IRIs are minted under (smart-kg `dakNamespace` form). */
  namespace: z.string().url(),
  source: z.object({
    repository: z.string().min(1),
    commit: z.string().regex(/^[0-9a-f]{40}$/),
    paths: z.array(z.string().min(1)).min(1),
  }).strict(),
  personas: z.array(VocabPersonaSchema),
  processes: z.array(VocabProcessSchema),
}).strict().superRefine((v, ctx) => {
  for (const [what, list] of [["persona", v.personas], ["process", v.processes]] as const) {
    const seen = new Set<string>();
    for (const e of list) {
      if (seen.has(e.id)) ctx.addIssue({ code: "custom", message: `duplicate ${what} id "${e.id}"` });
      seen.add(e.id);
    }
  }
});
export type Vocabulary = z.infer<typeof VocabularySchema>;

// ── readers ─────────────────────────────────────────────────────────────────

const clean = (s: string): string =>
  s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

/** Rows of the first markdown pipe table whose header names every column given. */
export function markdownTable(text: string, columns: string[]): { line: number; cells: Record<string, string> }[] {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim().startsWith("|")) continue;
    const header = lines[i].split("|").slice(1, -1).map((c) => c.trim());
    if (!columns.every((c) => header.includes(c))) continue;
    const rows: { line: number; cells: Record<string, string> }[] = [];
    for (let j = i + 2; j < lines.length && lines[j].trim().startsWith("|"); j++) {
      const cells = lines[j].split("|").slice(1, -1).map((c) => c.trim());
      rows.push({ line: j + 1, cells: Object.fromEntries(header.map((h, k) => [h, cells[k] ?? ""])) });
    }
    return rows;
  }
  throw new Error(`no markdown table with columns ${columns.join(", ")}`);
}

/** Every `<tr>` of every HTML table: its `<td>` cells, cleaned, with the line it starts on. */
export function htmlRows(text: string): { line: number; cells: string[] }[] {
  const rows: { line: number; cells: string[] }[] = [];
  const re = /<tr>([\s\S]*?)<\/tr>/g;
  for (let m; (m = re.exec(text)); ) {
    const cells = [...m[1].matchAll(/<td>([\s\S]*?)<\/td>/g)].map((c) => clean(c[1]));
    if (cells.length) rows.push({ line: text.slice(0, m.index).split("\n").length, cells });
  }
  return rows;
}

const splitNames = (s: string): string[] => s.split(",").map((x) => x.trim()).filter(Boolean);

/** `3221 Nursing associate professional` → `3221`; `N/A` → none. */
const isco = (s: string): string[] | undefined => {
  const codes = [...s.matchAll(/\b(\d{4})\b/g)].map((m) => m[1]);
  return codes.length ? codes : undefined;
};

export function readGuidePages(root: string, rel: (p: string) => string): Pick<Vocabulary, "personas" | "processes"> {
  const bpPath = join(root, "input/pagecontent/business-processes.md");
  const peoplePath = join(root, "input/pagecontent/personas.md");
  const processes: VocabProcess[] = markdownTable(readFileSync(bpPath, "utf8"), ["Process Name", "Process ID", "Personas", "Objectives"])
    .map(({ line, cells }) => ({
      id: cells["Process ID"],
      title: cells["Process Name"],
      objectives: cells["Objectives"],
      personasNamed: splitNames(cells["Personas"]),
      source: { path: rel(bpPath), locator: `line ${line}` },
    }));
  const personas: VocabPersona[] = htmlRows(readFileSync(peoplePath, "utf8")).map(({ line, cells }) => {
    if (cells.length !== 4) throw new Error(`${rel(peoplePath)}:${line}: a persona row has ${cells.length} cells, not 4`);
    const [title, description, names, code] = cells;
    return {
      id: slug(title),
      title,
      description,
      ...(names ? { otherNames: splitNames(names) } : {}),
      ...(isco(code) ? { iscoCode: isco(code) } : {}),
      source: { path: rel(peoplePath), locator: `line ${line}` },
    };
  });
  return { personas, processes };
}

export function readFshActors(dir: string, rel: (p: string) => string): VocabPersona[] {
  return readdirSync(dir)
    .filter((f) => /^DAK\.Persona\..+\.fsh$/.test(f))
    .sort()
    .map((f) => {
      const text = readFileSync(join(dir, f), "utf8");
      const id = /^Instance:\s*(\S+)/m.exec(text)?.[1];
      const title = /^\*\s*title\s*=\s*"([^"]+)"/m.exec(text)?.[1];
      if (!id || !title) throw new Error(`${f}: no Instance or title`);
      const description = /^\*\s*description\s*=\s*"""\n?([\s\S]*?)"""/m.exec(text)?.[1]?.trim().split(/\n\s*\n/)[0]?.replace(/\s+/g, " ");
      const isoLine = /\*\*ISCO-08\*\*:([\s\S]*?)(\n\s*\n|$)/.exec(text)?.[1] ?? "";
      const type = /^\*\s*type\s*=\s*#(\S+)/m.exec(text)?.[1];
      return {
        id,
        title,
        ...(description ? { description } : {}),
        ...(isco(isoLine) ? { iscoCode: isco(isoLine) } : {}),
        ...(type ? { personaType: type } : {}),
        source: { path: rel(join(dir, f)), locator: `Instance: ${id}` },
      };
    });
}

const git = (cwd: string, ...args: string[]): string =>
  execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();

const repoName = (cwd: string): string => {
  try {
    return git(cwd, "remote", "get-url", "origin").replace(/^.*github\.com[/:]/, "").replace(/\.git$/, "");
  } catch {
    return basename(git(cwd, "rev-parse", "--show-toplevel"));
  }
};

/** The `canonical:` of a `sushi-config.yaml` — a top-level scalar, so no YAML parser is needed. */
export const sushiCanonical = (text: string): string | undefined =>
  /^canonical:\s*["']?([^\s"'#]+)["']?\s*(#.*)?$/m.exec(text)?.[1];

/**
 * A guide checkout's name, namespace and repository, from its own declarations.
 * The harness declaration is the `<name>.json` whose `$schema` is a
 * `cat-harness-declaration`, at the root or one directory down; the namespace
 * is the IG's canonical (`sushi-config.yaml`, else the DAK declaration's `canonicalUrl`).
 */
export function guideIdentity(root: string, fallbackRepository: () => string): { guide: string; namespace: string; repository: string } {
  const candidates = [
    ...readdirSync(root).filter((f) => f.endsWith(".json")).map((f) => join(root, f)),
    ...readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith(".") && d.name !== "node_modules")
      .flatMap((d) => readdirSync(join(root, d.name)).filter((f) => f.endsWith(".json")).map((f) => join(root, d.name, f))),
  ];
  const declarations = new Map<string, { name: string; repository?: string }>();
  for (const f of candidates) {
    try {
      const j = JSON.parse(readFileSync(f, "utf8"));
      if (typeof j?.$schema === "string" && j.$schema.startsWith("cat-harness-declaration") && typeof j.name === "string")
        declarations.set(j.name, { name: j.name, ...(typeof j.repository === "string" ? { repository: j.repository } : {}) });
    } catch { /* not JSON we read */ }
  }
  if (declarations.size > 1)
    throw new Error(`${root}: ${declarations.size} harness declarations (${[...declarations.keys()].join(", ")}); cannot tell which is the guide`);
  const declared = [...declarations.values()][0];
  const sushi = join(root, "sushi-config.yaml");
  const dakUrl = readIgDakMetadata(root)?.data.canonicalUrl;
  const canonical = (existsSync(sushi) ? sushiCanonical(readFileSync(sushi, "utf8")) : undefined)
    ?? (typeof dakUrl === "string" ? dakUrl : undefined);
  if (!canonical) throw new Error(`${root}: neither sushi-config.yaml \`canonical\` nor a DAK declaration \`canonicalUrl\` — is this a guide checkout?`);
  const repository = declared?.repository ?? fallbackRepository();
  return { guide: declared?.name ?? basename(repository), namespace: dakNamespace(canonical), repository };
}

export const serialise = (v: Vocabulary): string => JSON.stringify(v, null, 2) + "\n";

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (k: string): string | undefined => {
    const i = args.indexOf(k);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const out = opt("--out");
  const guideRoot = opt("--guide");
  const actors = opt("--fsh-actors");
  if (!out || (!guideRoot === !actors)) {
    console.error("usage: l1-scenario-vocabulary.ts (--guide <guide checkout> | --fsh-actors <dir>) --out <file> [--check]");
    process.exit(2);
  }
  let vocab: Vocabulary;
  if (guideRoot) {
    const root = resolve(guideRoot);
    const rel = (p: string) => relative(root, p);
    const { guide, namespace, repository } = guideIdentity(root, () => repoName(root));
    vocab = {
      $schema: VOCABULARY_SCHEMA_TAG,
      _comment: "GENERATED by smart-base/scripts/l1-scenario-vocabulary.ts --guide from the two pages named in source.paths at source.commit. Never hand-edit: re-run it. Persona ids are slug(title) because personas.md prints none; process ids are the printed Process ID.",
      tier: "guide",
      guide,
      namespace,
      source: { repository, commit: git(root, "rev-parse", "HEAD"), paths: ["input/pagecontent/business-processes.md", "input/pagecontent/personas.md"] },
      ...readGuidePages(root, rel),
    };
  } else {
    const dir = resolve(actors!);
    const top = git(dir, "rev-parse", "--show-toplevel");
    const rel = (p: string) => relative(top, p);
    vocab = {
      $schema: VOCABULARY_SCHEMA_TAG,
      _comment: "GENERATED by smart-base/scripts/l1-scenario-vocabulary.ts --fsh-actors from smart-base's DAK.Persona.* ActorDefinitions at source.commit (the last commit to touch them). Never hand-edit: re-run it. Generic personas only; smart-base holds no domain process catalogue.",
      tier: "generic",
      guide: "smart-base",
      namespace: "https://smart.who.int/base",
      source: { repository: repoName(dir), commit: git(dir, "log", "-1", "--format=%H", "--", "."), paths: [rel(dir)] },
      personas: readFshActors(dir, rel),
      processes: [],
    };
  }
  VocabularySchema.parse(vocab);
  const text = serialise(vocab);
  if (args.includes("--check")) {
    if (!existsSync(out) || readFileSync(out, "utf8") !== text) {
      console.error(`✗ ${out} is stale — re-run without --check`);
      process.exit(1);
    }
    console.log(`✓ ${out} is current`);
    process.exit(0);
  }
  writeFileSync(out, text);
  console.log(`wrote ${out}: ${vocab.personas.length} personas, ${vocab.processes.length} processes (${vocab.tier}, ${vocab.source.repository}@${vocab.source.commit.slice(0, 7)})`);
}
