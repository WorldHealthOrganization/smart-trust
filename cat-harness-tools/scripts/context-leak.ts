/**
 * **The context-leak check**: does what a bean-blind agent is given say
 * anything about beans, the work plan or the harness's process engine? A
 * guideline's graph must not teach the agent under test about them.
 *
 * It scans what an agent would read — the files of a built context, the live
 * tool list, the fixed prompt — for the vocabulary below. It does **not**
 * match *process*, *BPMN* or *business process*: a DAK holds business
 * processes as content (L2), so those words are the subject, not a leak.
 *
 * "Could not determine" is never clean: an unreadable input, or nothing to
 * read at all, is its own answer.
 *
 * @module scripts/context-leak
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

/** One term of the vocabulary: what it matches, and why it is a leak. */
export interface LeakTerm {
  id: string;
  pattern: RegExp;
  why: string;
}

/**
 * The words that teach an agent it is in the harness's work plan. Kept here
 * until the `sdlc` sub-graph declares them as a code list (proposal §4.13,
 * step 23); the runner takes any list.
 */
export const LEAK_VOCABULARY: readonly LeakTerm[] = [
  { id: "bean", pattern: /\bbeans?\b/i, why: "names the work-plan item" },
  { id: "provenance-id", pattern: /\bbean `[a-z0-9-]{4,}`/i, why: "cites a work-plan item as provenance" },
  { id: "beans-path", pattern: /(^|[\s"'`(/])\.?beans(\/|\.yml\b)/, why: "a path into the work plan" },
  { id: "beans-branch", pattern: /\bcat\/[^\s/]+\/beans\b/, why: "the work plan's state branch" },
  { id: "work-plan", pattern: /\bwork[ -]plan\b/i, why: "names the work plan" },
  { id: "work-order", pattern: /\bwork[ -]order\b/i, why: "names the harness's hand-over to an agent" },
  { id: "workflow-tool", pattern: /\bworkflow_(start|next|complete|gate|list)\b/, why: "a process-engine tool" },
  { id: "work-plan-tool", pattern: /\bwork_plan_[a-z_]+\b/, why: "a work-plan tool" },
  { id: "bean-process", pattern: /\bProcess_Bean[A-Za-z]*\b/, why: "a work-plan process" },
  { id: "bean-markup", pattern: /cat-harness\.processes:bean\b/, why: "work-plan markup in a diagram" },
];

export interface LeakFinding {
  where: string;
  line: number;
  term: string;
  excerpt: string;
}

/** Every vocabulary match in one text, one finding per term per line. */
export function findLeaks(where: string, text: string, vocabulary: readonly LeakTerm[] = LEAK_VOCABULARY): LeakFinding[] {
  const out: LeakFinding[] = [];
  text.split("\n").forEach((line, i) => {
    for (const t of vocabulary) {
      const m = t.pattern.exec(line);
      if (!m) continue;
      const start = Math.max(0, m.index - 40);
      out.push({ where, line: i + 1, term: t.id, excerpt: line.slice(start, m.index + m[0].length + 40).trim() });
    }
  });
  return out;
}

const TEXT = new Set([".md", ".markdown", ".txt", ".json", ".jsonld", ".yml", ".yaml", ".xml", ".bpmn", ".dmn", ".html", ".csv", ".toml", ""]);
const SKIP_DIRS = new Set([".git", "node_modules"]);
const MAX_BYTES = 2_000_000;

export interface ScanResult {
  findings: LeakFinding[];
  read: number;
  /** Inputs that could not be read: never clean. */
  unreadable: string[];
}

/** Every text file under `dir`, scanned. Binary and very large files are counted as not read, by name. */
export function scanDir(dir: string, vocabulary: readonly LeakTerm[] = LEAK_VOCABULARY): ScanResult {
  const res: ScanResult = { findings: [], read: 0, unreadable: [] };
  const walk = (d: string): void => {
    let names: string[];
    try {
      names = readdirSync(d);
    } catch {
      res.unreadable.push(relative(dir, d) || ".");
      return;
    }
    for (const n of names.sort()) {
      const p = join(d, n);
      let st;
      try {
        st = statSync(p);
      } catch {
        res.unreadable.push(relative(dir, p));
        continue;
      }
      if (st.isDirectory()) {
        if (!SKIP_DIRS.has(n)) walk(p);
        continue;
      }
      if (!TEXT.has(extname(n).toLowerCase()) || st.size > MAX_BYTES) {
        res.unreadable.push(relative(dir, p));
        continue;
      }
      res.read++;
      res.findings.push(...findLeaks(relative(dir, p), readFileSync(p, "utf8"), vocabulary));
    }
  };
  walk(dir);
  return res;
}

/** A tool list as an MCP `tools/list` answers it: each tool's name, description and input schema. */
export function scanToolList(tools: ReadonlyArray<{ name: string; description?: string; inputSchema?: unknown }>, vocabulary = LEAK_VOCABULARY): LeakFinding[] {
  return tools.flatMap((t) => findLeaks(`tool ${t.name}`, `${t.name}\n${t.description ?? ""}\n${JSON.stringify(t.inputSchema ?? {})}`, vocabulary));
}

// ---------------------------------------------------------------------------

function main(argv: string[]): number {
  const arg = (k: string): string | undefined => {
    const i = argv.indexOf(k);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const enforce = argv.includes("--enforce");
  const dir = arg("--dir");
  const tools = arg("--tools");
  const prompt = arg("--prompt");
  if (!dir && !tools && !prompt) {
    console.error("check:context-leak: nothing to scan — give --dir <built context>, --tools <tools/list JSON> or --prompt <file>. Nothing read is not clean.");
    return 2;
  }
  const findings: LeakFinding[] = [];
  const unreadable: string[] = [];
  let read = 0;
  if (dir) {
    const r = scanDir(dir);
    findings.push(...r.findings);
    unreadable.push(...r.unreadable);
    read += r.read;
  }
  for (const [flag, path] of [["--tools", tools], ["--prompt", prompt]] as const) {
    if (!path) continue;
    let text: string;
    try {
      text = readFileSync(path, "utf8");
    } catch {
      unreadable.push(`${flag} ${path}`);
      continue;
    }
    read++;
    if (flag === "--tools") {
      const parsed = JSON.parse(text) as { tools?: unknown[] } | unknown[];
      const list = (Array.isArray(parsed) ? parsed : (parsed.tools ?? [])) as Array<{ name: string; description?: string; inputSchema?: unknown }>;
      findings.push(...scanToolList(list));
    } else findings.push(...findLeaks(`prompt ${path}`, text));
  }

  for (const f of findings) console.log(`${f.where}:${f.line}  ${f.term}  ${f.excerpt}`);
  console.log(`\ncheck:context-leak: ${read} input(s) read, ${findings.length} finding(s), ${unreadable.length} not read${enforce ? "" : " (report mode)"}`);
  for (const u of unreadable.slice(0, 20)) console.log(`  not read: ${u}`);
  if (read === 0) return 2;
  if (!enforce) return 0;
  return findings.length || unreadable.length ? 1 : 0;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
