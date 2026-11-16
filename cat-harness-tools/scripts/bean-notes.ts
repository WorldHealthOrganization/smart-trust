#!/usr/bin/env bun
/**
 * Bean notes — add one, and keep their generated index current.
 *
 * A pull request that has something to add to a bean it does not own writes
 * a NOTE, in a file of its own, instead of appending to the bean. The naming
 * rule is in `schemas/sdlc/bean-note.ts`; the convention is in the
 * `bean-coordination` skill, §"Adding to a bean — a note, not an append".
 *
 * Three commands:
 *
 *   bun run cat beans:note <bean-id> --title "…" [--body-file f | --body "…"]
 *   bun run cat beans:notes          # rewrite the index from the notes on disk
 *   bun run cat beans:notes:check    # fail if a note is malformed or the index is stale
 *
 * ## The index is a README with one generated region
 *
 * The index is a `README.md` whose rows all sit inside
 * `<!-- bean-notes:begin -->`…`<!-- bean-notes:end -->`. Two pull requests
 * adding notes conflict only there, and the declared
 * `readme-generated-regions` pattern in `merge-conflict-patterns.ts` resolves
 * that (take the base's side, then regenerate). The bean itself is never
 * rewritten, so the `beans: refuse` rule is not widened.
 *
 * ## What the check judges
 *
 * Each `.md` in the notes directory other than the index must parse as a
 * `folio-bean-note/v1` note, name a bean the store holds, and carry exactly the
 * file name its own front matter derives (so no two pull requests write one
 * path).
 *
 * Exit: 0 clean, 1 a malformed note or a stale index, 2 could not check (no
 * bean graph, or it declares no `bean-notes` directory).
 *
 * @module cat-harness/scripts/bean-notes
 * @covers bean-notes, beans
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { parse as parseYaml } from "yaml";

import { corpusDirectoriesForGraph } from "../schemas/kg/harness-config.ts";
import { BEAN_GRAPH_FILE, DEFAULT_BEAN_GRAPH_ROOT, parseBeanGraph } from "../schemas/sdlc/bean-graph.ts";
import {
  BEAN_NOTE_TAG,
  BeanNoteFrontMatterSchema,
  noteFileName,
  type BeanNoteFrontMatter,
} from "../schemas/sdlc/bean-note.ts";
import { resolveBeanDefs } from "./beans.ts";
import { exitNotApplicable } from "./lib/not-applicable.ts";

export const ROOT = resolve(import.meta.dir, "..", "..");

/** The index's file name inside the notes directory. */
export const NOTES_INDEX = "README.md";

const REGION = "bean-notes";
const BEGIN = `<!-- ${REGION}:begin -->`;
const END = `<!-- ${REGION}:end -->`;

interface Dirs {
  notes: string;
  defs: string[];
}

/**
 * The declared directories: where notes live, and every directory holding
 * bean definitions (the store and its archive). Every segment comes from the
 * bean graph, never a literal — `check:declared-paths` refuses the literal.
 */
export function noteDirs(root = ROOT): Dirs {
  const graphRoot = join(root, DEFAULT_BEAN_GRAPH_ROOT);
  const graph = parseBeanGraph(JSON.parse(readFileSync(join(graphRoot, BEAN_GRAPH_FILE), "utf-8")));
  const notes = graph.directories.find((d) => d.graphTypologies.includes("bean-notes"));
  if (!notes) throw new Error("bean graph declares no `bean-notes` directory — bean `m61r`");
  const defs = graph.directories.filter((d) => d.graphTypologies.includes("bean-defs")).map((d) => join(graphRoot, d.path));
  for (const dir of corpusDirectoriesForGraph(root, "beans")) {
    const abs = resolve(dir);
    if (abs === resolve(graphRoot) || !existsSync(join(abs, BEAN_GRAPH_FILE))) continue;
    try {
      const g = parseBeanGraph(JSON.parse(readFileSync(join(abs, BEAN_GRAPH_FILE), "utf-8")));
      for (const d of g.directories) {
        if (d.graphTypologies.includes("bean-defs")) defs.push(join(abs, d.path));
      }
    } catch {
      // Malformed secondary bean graph is check:harness-dirs' finding, not this one's.
    }
  }
  return { notes: join(graphRoot, notes.path), defs };
}

export interface Note {
  file: string;
  meta: BeanNoteFrontMatter;
  headings: string[];
}

export interface Finding {
  file: string;
  why: string;
}

function splitFrontMatter(text: string): { fm: string; body: string } | undefined {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  return m ? { fm: m[1]!, body: m[2]! } : undefined;
}

/** Bean id → title, from every declared definitions directory. */
export function beanTitles(dirs: Dirs): Map<string, { title: string; path: string }> {
  const out = new Map<string, { title: string; path: string }>();
  for (const dir of dirs.defs) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".md")) continue;
      const id = name.replace(/\.md$/, "").split("--")[0]!;
      const split = splitFrontMatter(readFileSync(join(dir, name), "utf-8"));
      let title = id;
      try {
        const fm = split ? (parseYaml(split.fm) as { title?: unknown }) : undefined;
        if (typeof fm?.title === "string") title = fm.title;
      } catch {
        // An unparseable bean is check:bean-front-matter's finding, not this one's.
      }
      if (!out.has(id)) out.set(id, { title, path: join(dir, name) });
    }
  }
  return out;
}

/** Every note on disk, and every file that should be one and is not. */
export function readNotes(dirs: Dirs, beans = beanTitles(dirs)): { notes: Note[]; findings: Finding[] } {
  const notes: Note[] = [];
  const findings: Finding[] = [];
  if (!existsSync(dirs.notes)) return { notes, findings };
  for (const name of readdirSync(dirs.notes).sort()) {
    if (name === NOTES_INDEX || !name.endsWith(".md")) continue;
    const split = splitFrontMatter(readFileSync(join(dirs.notes, name), "utf-8"));
    if (!split) {
      findings.push({ file: name, why: `no front matter — a note declares \`$schema: ${BEAN_NOTE_TAG}\`` });
      continue;
    }
    let raw: unknown;
    try {
      raw = parseYaml(split.fm);
    } catch (e) {
      findings.push({ file: name, why: `front matter does not parse: ${(e as Error).message.split("\n")[0]}` });
      continue;
    }
    const parsed = BeanNoteFrontMatterSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0]!;
      findings.push({ file: name, why: `front matter: ${issue.path.join(".") || "(root)"}: ${issue.message}` });
      continue;
    }
    const meta = parsed.data;
    const expected = noteFileName(meta.bean, meta.created, meta.branch);
    if (name !== expected) {
      findings.push({
        file: name,
        why: `named by hand — its front matter derives \`${expected}\`. The name is what keeps two pull requests' notes on different paths.`,
      });
      continue;
    }
    if (!beans.has(meta.bean)) {
      findings.push({ file: name, why: `names bean \`${meta.bean}\`, which no declared definitions directory holds` });
      continue;
    }
    const headings = split.body
      .split("\n")
      .filter((l) => l.startsWith("## "))
      .map((l) => l.slice(3).trim());
    notes.push({ file: name, meta, headings });
  }
  return { notes, findings };
}

/** The whole index file. Only the region between the markers varies. */
export function renderIndex(dirs: Dirs, notes: readonly Note[], beans = beanTitles(dirs)): string {
  const byBean = new Map<string, Note[]>();
  for (const n of notes) byBean.set(n.meta.bean, [...(byBean.get(n.meta.bean) ?? []), n]);
  const region: string[] = [];
  if (byBean.size === 0) region.push("_No notes yet._ (A determined empty: the directory was read and holds none.)");
  for (const bean of [...byBean.keys()].sort()) {
    const b = beans.get(bean);
    const link = b ? `[${b.title.replace(/[[\]]/g, "")}](${relative(dirs.notes, b.path)})` : bean;
    if (region.length) region.push("");
    region.push(`## ${bean}`, "", link, "");
    const rows = [...byBean.get(bean)!].sort((x, y) => (x.meta.created + x.file).localeCompare(y.meta.created + y.file));
    for (const n of rows) {
      const what = n.headings.length ? n.headings.join("; ") : "(no `##` heading)";
      region.push(`- ${n.meta.created} · [\`${n.meta.branch}\`](${n.file}) — ${what}`);
    }
  }
  return [
    "# Bean notes",
    "",
    "One file per pull request per bean, so two pull requests adding to one bean never edit the same file.",
    'Add one with `bun run cat beans:note <bean-id> --title "…"`. The convention is in the `bean-coordination`',
    'skill, §"Adding to a bean — a note, not an append"; the naming rule is in `cat-harness/schemas/sdlc/bean-note.ts`.',
    "",
    "Everything between the markers is generated by `bun run cat beans:notes` and checked by `beans:notes:check`.",
    "",
    BEGIN,
    ...region,
    END,
    "",
  ].join("\n");
}

function git(args: readonly string[], cwd: string): string | undefined {
  const r = spawnSync("git", args, { cwd, encoding: "utf-8" });
  return r.status === 0 ? r.stdout.trim() : undefined;
}

export interface AddOptions {
  bean: string;
  title: string;
  body?: string;
  /** Defaults to the checked-out branch. */
  branch?: string;
  /** Defaults to today, UTC. Used only when this branch has no note on this bean yet. */
  date?: string;
}

/**
 * Add a note: append a section to this branch's note on the bean, or start
 * one under the derived name. Rewrites the index. Returns the note's path.
 */
export function addNote(opts: AddOptions, root = ROOT): string {
  const dirs = noteDirs(root);
  const beans = beanTitles(dirs);
  if (!beans.has(opts.bean)) throw new Error(`no bean \`${opts.bean}\` in the store`);
  const branch = opts.branch ?? git(["rev-parse", "--abbrev-ref", "HEAD"], root);
  if (!branch || branch === "HEAD") {
    throw new Error("cannot tell which branch this is (detached HEAD?) — pass --branch; the branch is the note's key");
  }
  const { notes } = readNotes(dirs, beans);
  const section = `## ${opts.title.trim()}\n\n${(opts.body ?? "").trim()}\n`.replace(/\n\n\n$/, "\n");
  const mine = notes.find((n) => n.meta.bean === opts.bean && n.meta.branch === branch);
  let path: string;
  if (mine) {
    path = join(dirs.notes, mine.file);
    const prev = readFileSync(path, "utf-8").replace(/\n*$/, "\n");
    writeFileSync(path, `${prev}\n${section}`);
  } else {
    const created = opts.date ?? new Date().toISOString().slice(0, 10);
    const meta = BeanNoteFrontMatterSchema.parse({ $schema: BEAN_NOTE_TAG, bean: opts.bean, branch, created });
    path = join(dirs.notes, noteFileName(meta.bean, meta.created, meta.branch));
    if (existsSync(path)) {
      // Only reachable when two branch names slug alike (`a/b`, `a-b`): the
      // file is another branch's, and appending would merge two writers.
      throw new Error(`${relative(root, path)} exists and belongs to another branch — rename this branch`);
    }
    mkdirSync(dirs.notes, { recursive: true });
    const fm = [
      "---",
      `# note on ${meta.bean} from ${meta.branch}`,
      `$schema: ${meta.$schema}`,
      `bean: ${meta.bean}`,
      `branch: ${JSON.stringify(meta.branch)}`,
      `created: "${meta.created}"`,
      "---",
      "",
    ].join("\n");
    writeFileSync(path, `${fm}${section}`);
  }
  writeIndex(root);
  return path;
}

/** Rewrite the index. Returns the malformed notes, which are left out of it. */
export function writeIndex(root = ROOT): Finding[] {
  const dirs = noteDirs(root);
  const beans = beanTitles(dirs);
  const { notes, findings } = readNotes(dirs, beans);
  mkdirSync(dirs.notes, { recursive: true });
  writeFileSync(join(dirs.notes, NOTES_INDEX), renderIndex(dirs, notes, beans));
  return findings;
}

/** Findings plus whether the committed index matches what would be written. */
export function checkNotes(root = ROOT): { findings: Finding[]; stale: boolean } {
  const dirs = noteDirs(root);
  const beans = beanTitles(dirs);
  const { notes, findings } = readNotes(dirs, beans);
  const index = join(dirs.notes, NOTES_INDEX);
  const current = existsSync(index) ? readFileSync(index, "utf-8") : undefined;
  return { findings, stale: current !== renderIndex(dirs, notes, beans) };
}

function flag(argv: readonly string[], k: string): string | undefined {
  const i = argv.indexOf(k);
  return i >= 0 ? argv[i + 1] : undefined;
}

function report(findings: readonly Finding[]): void {
  for (const f of findings) console.error(`  ✗ ${f.file}: ${f.why}`);
}

function main(argv: string[]): number {
  try {
    if (argv[0] === "add") {
      const bean = argv[1];
      const title = flag(argv, "--title");
      if (!bean || !title) {
        console.error('usage: beans:note <bean-id> --title "…" [--body-file f | --body "…"] [--branch b]');
        return 2;
      }
      const bodyFile = flag(argv, "--body-file");
      const body = bodyFile ? readFileSync(bodyFile, "utf-8") : flag(argv, "--body");
      const path = addNote({ bean, title, body, branch: flag(argv, "--branch") });
      console.log(`note: ${relative(ROOT, path)} (index rewritten — commit both)`);
      return 0;
    }
    if (argv.includes("--check")) {
      // An instance with no bean store has no notes to check (smart-ips-pilgrimage#13).
      const where = resolveBeanDefs(ROOT);
      if (where.absent) exitNotApplicable("beans:notes:check", `this checkout has no bean store (${where.unreachable})`);
      const { findings, stale } = checkNotes();
      report(findings);
      if (stale) console.error("  ✗ the bean-notes index is stale — run `bun run cat beans:notes`");
      if (findings.length || stale) return 1;
      console.log("beans:notes:check — every note is well-formed and the index is current.");
      return 0;
    }
    const findings = writeIndex();
    report(findings);
    console.log(`beans:notes — index written${findings.length ? `; ${findings.length} malformed note(s) left out` : ""}.`);
    return findings.length ? 1 : 0;
  } catch (e) {
    console.error(`bean-notes: could not check — ${(e as Error).message}`);
    return 2;
  }
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
