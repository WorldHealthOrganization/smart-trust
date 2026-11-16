/**
 * Workflow expression injection — free text must not reach a shell.
 *
 * A `${{ }}` expression is substituted into the script **text** before bash
 * parses it, so a value containing a quote closes the surrounding string and
 * the rest executes. The remedy is not quoting: pass the value through `env:`
 * and read `"$VAR"`, where bash sees a value rather than source.
 *
 * | class | example | verdict |
 * |---|---|---|
 * | **free text** | `pull_request.title`, `.body`, `comment.body`, a dispatch input | **FAIL** — unbounded, and a quote is all it takes |
 * | **constrained** | `pull_request.number`, `head_ref`, `repository.name` | reported, baselined; a ref or an integer cannot carry a quote |
 * | **safe** | `github.workspace`, `matrix.*`, `secrets.*` | not reported |
 *
 * `head_ref` is constrained, not safe: git refuses a ref with a space, quote
 * or semicolon, but it is attacker-chosen on a fork PR.
 *
 * ## `steps.*.outputs` inherits its source's class
 *
 * A step output holds whatever the step put in it, so free text written to
 * `$GITHUB_OUTPUT` stays free text. `resolveProvenance` reads each step that
 * writes `$GITHUB_OUTPUT`, takes the worst severity among the expressions that
 * step binds, and a consumption of that output inherits it (keyed by
 * `job.stepId`; a job's `outputs:` block is followed one more hop, so
 * `needs.<job>.outputs.<name>` inherits it too). A sanitised value (e.g. a
 * slug reduced by `sed`) is still graded free text: the gate does not judge
 * sanitisers, and the remedy is one `env:` line either way.
 *
 * ## Two surfaces
 *
 * `actions/github-script` `script:` blocks are JavaScript and are graded by the
 * same bands; there the remedy is `process.env.X`. Inside a template literal
 * `${…}` is evaluated, so a value (even a legal git ref) need not close a
 * quote to run. Position is not modelled; the bands grade the VALUE.
 *
 * Not graded: an expression in `with:`, `env:` or `if:` (`env:` is the
 * remedy), except `script:` under `with:`. Template injection in generated
 * pages and prompt injection are out of scope.
 *
 * @module scripts/check-workflow-injection
 * @covers none — .github/workflows/ is not a declared graph typology
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { declaredInstanceName } from "./lib/roots.ts";

const TOOLS_ROOT = resolve(import.meta.dir, "..");
const ROOT = join(import.meta.dir, "..", "..");
const WORKFLOWS = join(ROOT, ".github", "workflows");
const BASELINE = join(TOOLS_ROOT, "scripts", "workflow-injection-baseline.json");

/**
 * Unbounded, attacker-supplied text. A quote in any of these is a shell break.
 *
 * `inputs.*` and `event.inputs.*` are here because a `workflow_dispatch` input
 * is free text. It needs write access to supply, which lowers the severity —
 * it does not change what the value can contain.
 */
const FREE_TEXT = [
  /\bgithub\.event\.(pull_request|issue|discussion)\.(title|body)\b/,
  /\bgithub\.event\.(comment|review)\.body\b/,
  /\bgithub\.event\.head_commit\.message\b/,
  /\bgithub\.event\.inputs\.[a-z_]+/i,
  /\binputs\.[a-z_]+/i,
];

/**
 * Attacker-CHOSEN but shape-constrained. Reported, never silently trusted.
 *
 * A git ref cannot contain a space, a quote or a semicolon, and a PR number is
 * an integer — so neither carries the payload above. They are listed because
 * "cannot carry THIS payload" is a narrower claim than "safe", and the
 * difference is what a reader needs.
 */
const CONSTRAINED = [
  /\bgithub\.(head_ref|ref_name|ref)\b/,
  /\bgithub\.event\.pull_request\.(number|head|base)\b/,
  /\bgithub\.event\.repository\.name\b/,
  /\bgithub\.event\.issue\.number\b/,
];

export type Severity = "free-text" | "constrained";

/**
 * Where the value lands, which decides the REMEDY rather than the severity.
 *
 * `run:` is a shell (`env:` + `"$VAR"`); `script:` is Node inside
 * `actions/github-script` (`env:` + `process.env.X`). One advice string for both
 * would be wrong for one of them.
 */
export type Surface = "run" | "script";

export interface Injection {
  workflow: string;
  line: number;
  expression: string;
  severity: Severity;
  surface: Surface;
  /** Set when the severity came from the PRODUCING step rather than the expression. */
  via?: string;
}

/**
 * What each step output and job output CARRIES, keyed `job.stepId` / `job.outputName`.
 *
 * Empty is a perfectly good answer and means every output in the file is built
 * from values this gate does not grade — not that the question went unasked.
 */
export type Provenance = Map<string, Severity>;

/** `constrained` loses to `free-text`: an output carries the worst thing in it. */
function worse(a: Severity | null, b: Severity | null): Severity | null {
  if (a === "free-text" || b === "free-text") return "free-text";
  if (a === "constrained" || b === "constrained") return "constrained";
  return null;
}

/**
 * Does this expression yield only quoted LITERALS, whatever the input holds?
 *
 * `${{ inputs.force_rerender == true && '--force' || '' }}` is a comparison
 * whose branches are constants: the shell receives `--force` or nothing, and
 * the input's own text never reaches it. That is a legitimate and common
 * idiom — a gate that flagged it would be training people to route around
 * itself, which is how a gate gets disabled.
 *
 * The test is deliberately narrow: an expression qualifies only when it
 * contains a comparison AND every value it can produce is a quoted literal.
 * `${{ inputs.a == 'x' && inputs.b || '' }}` does NOT qualify — one branch is
 * an input — and is still reported.
 *
 * Caught on the first run of this gate, on `discussions-maintain.yml`. Without
 * it the gate's first act would have been a false alarm on correct code.
 */
export function yieldsOnlyLiterals(expression: string): boolean {
  if (!/(==|!=|>=|<=|>|<)/.test(expression)) return false;
  // Everything after the first `&&` is the value side: each branch must be a
  // quoted literal, `true`/`false`/a number, and nothing else.
  const valueSide = expression.split("&&").slice(1).join("&&");
  if (valueSide.trim() === "") return false;
  const branches = valueSide.split("||").map((b) => b.trim());
  return branches.every((b) => /^'[^']*'$/.test(b) || /^"[^"]*"$/.test(b) || /^(true|false|\d+)$/.test(b));
}

/**
 * Classify one expression, resolving `steps.*`/`needs.*` through `prov` when given.
 *
 * With no `prov` a step output is unclassified, which is what it is on its own:
 * the expression text says nothing about what the step wrote. The caller that
 * HAS read the file supplies provenance; the two-argument form is the honest
 * one and the one the scanner uses.
 */
export function classify(expression: string, prov?: Provenance, job = ""): Severity | null {
  // A comparison yielding constants never puts the value in the script text.
  if (yieldsOnlyLiterals(expression)) return null;
  if (FREE_TEXT.some((re) => re.test(expression))) return "free-text";
  if (CONSTRAINED.some((re) => re.test(expression))) return "constrained";
  if (prov) {
    for (const [key, sev] of resolveReferences(expression, prov, job)) {
      void key;
      return sev;
    }
  }
  return null;
}

/**
 * Which producers an expression reads, and what each of them carries.
 *
 * Returned as pairs rather than one severity so a finding can name the STEP
 * that leaked — "free text via `job.version`" is actionable where "free text"
 * alone sends the reader looking at the wrong line.
 */
export function resolveReferences(
  expression: string,
  prov: Provenance,
  job: string,
): Array<[string, Severity]> {
  const out: Array<[string, Severity]> = [];
  for (const m of expression.matchAll(/\bsteps\.([A-Za-z0-9_-]+)\.outputs\.[A-Za-z0-9_-]+/g)) {
    const sev = prov.get(`${job}.${m[1]}`);
    if (sev) out.push([`${job}.${m[1]}`, sev]);
  }
  for (const m of expression.matchAll(/\bneeds\.([A-Za-z0-9_-]+)\.outputs\.([A-Za-z0-9_-]+)/g)) {
    const sev = prov.get(`${m[1]}.${m[2]}`);
    if (sev) out.push([`${m[1]}.${m[2]}`, sev]);
  }
  return out;
}

/**
 * Read one workflow's step and job outputs, and say what each one carries.
 *
 * Indentation-scoped for the same reason `scanWorkflows` is: this gate's output
 * is "this file, this line", and a YAML parser hands back a resolved tree with
 * the line numbers gone.
 *
 * A step counts as a PRODUCER when it writes `$GITHUB_OUTPUT` at all — the
 * alternative is matching which variable reaches which `echo`, and a guard that
 * has to parse shell to be right is a guard that is wrong quietly. Over-tainting
 * costs an `env:` line; under-tainting costs what `release-folio-assistant.yml`
 * cost.
 */
export function resolveProvenance(lines: string[]): Provenance {
  const prov: Provenance = new Map();
  let job = "";
  let stepId = "";
  let stepIndent = -1;
  let writesOutput = false;
  let carried: Severity | null = null;
  let outputsIndent = -1;
  // A value can be bound ABOVE the step that writes it out: a workflow-level
  // `env:` is in scope for every step in the file, a job-level one for every
  // step in the job. Measured 2026-09-26: no such binding carries free text in
  // this corpus — which is precisely the sort of "true today" this gate was just
  // caught RECORDING rather than closing, so it is closed. Applied in a post-pass
  // because an `env:` block may sit below the steps it reaches.
  let workflowEnv: Severity | null = null;
  const jobEnv = new Map<string, Severity>();
  const producers: Array<[string, string]> = [];
  let envIndent = -1;
  let envScope: "workflow" | "job" | null = null;

  const flush = () => {
    // Recorded whatever it carries, because a job-level `env:` may taint it and
    // that is not known yet. The map still gets the step's OWN severity now, so
    // a chained producer read later in the walk resolves.
    if (stepId && writesOutput) {
      producers.push([job, stepId]);
      if (carried) prov.set(`${job}.${stepId}`, carried);
    }
    stepId = "";
    writesOutput = false;
    carried = null;
  };

  // A job's `outputs:` block conventionally sits ABOVE its `steps:`, so its
  // referents are unknown on the pass that reads them. Collected here, resolved
  // after. Two passes rather than one, because guessing the file's order is how
  // a resolver reads clean over a file written the other way round.
  const jobOutputs: Array<[string, string, string]> = [];

  lines.forEach((line) => {
    const stripped = line.trimStart();
    if (stripped === "" || stripped.startsWith("#")) return;
    const indent = line.length - stripped.length;

    // A job header: two spaces in, under `jobs:`.
    const jobHeader = indent === 2 ? /^([A-Za-z0-9_-]+):\s*$/.exec(stripped) : null;
    if (jobHeader) {
      flush();
      job = jobHeader[1];
      outputsIndent = -1;
      stepIndent = -1;
      envIndent = -1;
      envScope = null;
      return;
    }

    // An `env:` block ABOVE the steps — workflow-wide at indent 0, job-wide at 4.
    if (stripped === "env:" && (indent === 0 || indent === 4)) {
      flush();
      envIndent = indent;
      envScope = indent === 0 ? "workflow" : "job";
      return;
    }
    if (envIndent >= 0) {
      if (indent <= envIndent) {
        envIndent = -1;
        envScope = null;
      } else {
        for (const m of line.matchAll(/\$\{\{([^}]*)\}\}/g)) {
          const sev = classify(m[1].trim(), prov, job);
          if (envScope === "workflow") workflowEnv = worse(workflowEnv, sev);
          else {
            const merged = worse(jobEnv.get(job) ?? null, sev);
            if (merged) jobEnv.set(job, merged);
          }
        }
        return;
      }
    }

    // A job-level `outputs:` block maps a name onto a step output.
    if (indent === 4 && /^outputs:\s*$/.test(stripped)) {
      flush();
      outputsIndent = indent;
      return;
    }
    if (outputsIndent >= 0) {
      if (indent <= outputsIndent) outputsIndent = -1;
      else {
        const kv = /^([A-Za-z0-9_-]+):\s*(.+)$/.exec(stripped);
        if (kv) jobOutputs.push([job, kv[1], kv[2]]);
        return;
      }
    }

    // A new step, or the end of the one we were in.
    if (/^- /.test(stripped)) {
      flush();
      stepIndent = indent;
    } else if (stepIndent >= 0 && indent <= stepIndent) {
      flush();
      stepIndent = -1;
      return;
    }
    if (stepIndent < 0) return;

    const idLine = /^(?:- )?id:\s*(\S+)\s*$/.exec(stripped);
    if (idLine) stepId = idLine[1].replace(/^["']|["']$/g, "");
    if (line.includes("$GITHUB_OUTPUT")) writesOutput = true;
    for (const m of line.matchAll(/\$\{\{([^}]*)\}\}/g)) {
      carried = worse(carried, classify(m[1].trim(), prov, job));
    }
  });
  flush();

  // Fold in what was bound above each producing step, now that every `env:` in
  // the file has been read.
  for (const [owner, id] of producers) {
    const inherited = worse(worse(prov.get(`${owner}.${id}`) ?? null, jobEnv.get(owner) ?? null), workflowEnv);
    if (inherited) prov.set(`${owner}.${id}`, inherited);
  }

  for (const [owner, name, value] of jobOutputs) {
    let sev: Severity | null = null;
    for (const m of value.matchAll(/\$\{\{([^}]*)\}\}/g)) {
      sev = worse(sev, classify(m[1].trim(), prov, owner));
    }
    // One map holds both step ids and job output names, so `job.x` is ambiguous
    // if a job has a step `id: x` AND an output `x`. Merged with `worse` rather
    // than overwritten: an ambiguous key may over-report, never under-report.
    const merged = worse(prov.get(`${owner}.${name}`) ?? null, sev);
    if (merged) prov.set(`${owner}.${name}`, merged);
  }
  return prov;
}

/**
 * Every `${{ }}` inside a `run:` block.
 *
 * Indentation-scoped rather than YAML-parsed on purpose: a parser resolves the
 * block into a string and loses the line numbers a finding has to name, and
 * this gate's whole output is "this file, this line".
 */
export function scanWorkflows(dir: string = WORKFLOWS): Injection[] {
  const out: Injection[] = [];
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    if (!/\.ya?ml$/.test(f)) continue;
    const lines = readFileSync(join(dir, f), "utf-8").split("\n");
    // Provenance first: a consumption cannot be graded before its producer is
    // known, and a producer may sit below its consumer in the file.
    const prov = resolveProvenance(lines);
    let job = "";
    // One walker for both surfaces: the block shapes are identical and only the
    // key differs, so a second copy of this loop would be a second place for the
    // indentation rule to be wrong.
    let inBlock: Surface | null = null;
    let blockIndent = 0;
    lines.forEach((line, i) => {
      const stripped = line.trimStart();
      const indent = line.length - stripped.length;
      if (indent === 2 && /^[A-Za-z0-9_-]+:\s*$/.test(stripped)) job = stripped.replace(/:\s*$/, "");
      if (inBlock && stripped !== "" && indent <= blockIndent) inBlock = null;
      const opens: Surface | null = /^-?\s*run:\s*\|?/.test(stripped) && stripped.includes("run:")
        ? "run"
        : /^-?\s*script:\s*\|?/.test(stripped) && stripped.includes("script:")
          ? "script"
          : null;
      const haystack = opens ? stripped.split(`${opens}:`)[1] ?? "" : inBlock ? line : "";
      const surface = opens ?? inBlock;
      if (opens) {
        inBlock = opens;
        blockIndent = indent;
      }
      if (surface === null) return;
      for (const m of haystack.matchAll(/\$\{\{([^}]*)\}\}/g)) {
        const expression = m[1].trim();
        const severity = classify(expression, prov, job);
        if (!severity) continue;
        const via = resolveReferences(expression, prov, job)[0]?.[0];
        out.push({ workflow: f, line: i + 1, expression, severity, surface, ...(via ? { via } : {}) });
      }
    });
  }
  return out;
}

/**
 * Keyed by workflow, SURFACE and expression — never line, which moves when a
 * step is added above.
 *
 * The surface is in the key because the same expression in a `run:` and in a
 * `script:` block is two decisions with two different remedies, so baselining
 * one must not silently baseline the other.
 */
export function baselineKey(i: Injection): string {
  return `${i.workflow} (${i.surface}): ${i.expression}`;
}

/**
 * Stale baseline entries that are not THIS root's to judge, each with why
 * (cat-harness-tools#1701).
 *
 * The baseline describes the workflows of the root it is written in: the
 * platform index, whose root declares no instance of its own (decision (b)).
 * A content instance's joined checkout (smart-ips-pilgrimage) scans ITS OWN
 * `.github/workflows/`, has no `feature-staging.yml` or `publish.yml`, and
 * every line was reported stale. An entry is excused only when both hold:
 * the root declares an instance of its own (so it is not the index the
 * baseline was written in), and the workflow file the entry names is absent
 * from this root. A root that has the file is judged as before, and so is the
 * index, so a really stale line there still fails.
 */
export function staleNotThisRoots(
  stale: readonly string[],
  root: string = ROOT,
  workflows: string = join(root, ".github", "workflows"),
): Map<string, string> {
  const out = new Map<string, string>();
  const self = declaredInstanceName(root);
  if (self === undefined) return out;
  for (const k of stale) {
    const file = k.split(" (")[0] ?? "";
    if (file === "" || existsSync(join(workflows, file))) continue;
    out.set(k, `${self} has no .github/workflows/${file}; the line describes the platform index's workflow`);
  }
  return out;
}

function readBaseline(): string[] {
  if (!existsSync(BASELINE)) return [];
  return (JSON.parse(readFileSync(BASELINE, "utf-8")) as { known: string[] }).known;
}

if (import.meta.main) {
  if (!existsSync(WORKFLOWS)) {
    console.log("  ? could not determine — .github/workflows is absent from this checkout");
    process.exit(2);
  }
  const found = scanWorkflows();
  const free = found.filter((i) => i.severity === "free-text");
  const constrained = found.filter((i) => i.severity === "constrained");

  if (process.argv.includes("--write-baseline")) {
    const known = [...new Set(constrained.map(baselineKey))].sort();
    writeFileSync(
      BASELINE,
      JSON.stringify(
        {
          _comment:
            "Attacker-CHOSEN but shape-constrained expressions inside a `run:` or `script:` block — refs, PR " +
            "numbers, repository names. A git ref cannot contain a space, a quote or a semicolon and a PR number " +
            "is an integer, so none carries a shell break; they are listed because 'cannot carry THIS payload' is " +
            "a narrower claim than 'safe'. FREE TEXT is never baselined: a quote is all it takes, and the remedy " +
            "is one line — `env:` plus \"$VAR\" in a `run:` block, `env:` plus process.env.VAR in a `script:` " +
            "one, which is Node. Keyed by workflow, SURFACE and expression, never line: a line moves when a step " +
            "is added above, and the same expression in the two surfaces is two decisions with two different " +
            "remedies. Refresh with --write-baseline.",
          known,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(`  ✓ baseline written — ${known.length} constrained expression(s)`);
    process.exit(0);
  }

  const known = new Set(readBaseline());
  const keys = new Set(constrained.map(baselineKey));
  const novel = [...keys].filter((k) => !known.has(k));
  const stale = [...known].filter((k) => !keys.has(k));

  // Counted PER SURFACE, because one total over two surfaces cannot be checked
  // against either. Both numbers are printed even when one is zero — a surface
  // that is scanned and finds nothing must not read like a surface nobody looked at.
  const bySurface = (x: Surface) => found.filter((i) => i.surface === x).length;
  console.log(
    `Workflow expression injection (${found.length} attacker-influenced expression(s): ` +
      `${bySurface("run")} in \`run:\` blocks, ${bySurface("script")} in \`script:\` blocks)`,
  );

  let bad = false;
  for (const i of free) {
    console.log(`  ✗ ${i.workflow}:${i.line} — FREE TEXT in a \`${i.surface}:\` block: \`${i.expression}\``);
    if (i.via) {
      // Naming the producer matters more here than anywhere else: the
      // expression on this line looks harmless, and the leak is elsewhere.
      console.log(`      It CARRIES free text — written by \`${i.via}\`, which binds a free-text value.`);
    }
    if (i.surface === "run") {
      console.log("      A quote closes the surrounding string and the rest executes.");
      console.log("      Pass it through `env:` and read \"$VAR\" — bash then sees a value, not source.");
    } else {
      // Deliberately a different sentence, not a reworded one: the mechanism
      // and the remedy are both different, and `"$VAR"` is not valid advice here.
      console.log("      A quote closes the string — and inside a template literal `${…}` is EVALUATED,");
      console.log("      so the value need not close anything to become program.");
      console.log("      Pass it through the step's `env:` and read `process.env.VAR` — this block is Node.");
    }
    bad = true;
  }
  for (const k of novel) {
    // The key already names the surface, so the message must not name it again
    // — and certainly not name `run:` for a `script:` finding, which it did for
    // one commit.
    console.log(`  ✗ NEW constrained expression: ${k}`);
    console.log("      Shape-constrained, so not a break today — but decide it rather than inherit it.");
    bad = true;
  }
  const notHere = staleNotThisRoots(stale);
  for (const k of stale) {
    const why = notHere.get(k);
    if (why !== undefined) {
      console.log(`  · ${k} not applicable here — ${why}`);
      continue;
    }
    console.log(`  ✗ stale baseline entry, remove it: ${k}`);
    bad = true;
  }

  if (!bad) {
    console.log(
      // "a shell" was the whole claim until `script:` was added, and a green
      // line that names one of two surfaces is a green line about half the run.
      `  ✓ no free text reaches a shell or a \`script:\` block; ` +
        `${constrained.length} constrained expression(s) baselined`,
    );
    process.exit(0);
  }
  process.exit(1);
}
