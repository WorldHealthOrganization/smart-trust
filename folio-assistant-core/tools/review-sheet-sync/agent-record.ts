/**
 * What the agent writes on a review sheet's Agent tab, made by a tool rather
 * than typed (owner, 2026-10-31: "what can we do to fix process/skills/tools
 * so no broken things like this"). The two slips that day were typed data: a
 * disposition line "Nos. 127 to 135" that took in two comments of another
 * change set, and an Agent completed time left behind after acting.
 *
 *   dispositions <input.json>   the change set's Disposition (change set) cell
 *   brief <input.json> [--look <text>] [--pcs <dashboard url>]   the PR body's
 *                               review brief, the same lines; --pcs links each
 *                               comment number to its row on the dashboard
 *   push --head <sha> [--expect <minutes>]   the cells to write on every push
 *   done                        Agent completed alone, when the agent acted
 *                               with no new commit (nothing to restage)
 *   step <name>                 Agent step (change set): what the agent is doing
 *                               now, with the time (reading, proposing, editing,
 *                               pushing, staging, deploying, qa-review, merging,
 *                               proposed (waiting for Ready for agent), idle)
 *   qa-pass --cs <CS-nnn> (--head <sha> [--summary <text>] | --qa-gate <text>)
 *           [--report <url>] [--decision <text>] [--repo <dir>]
 *           [--blocks <b1,b2>] [--files <f1,f2>] [--since <ref>] [--staged]
 *                               the QA gate cell(s), checked with the sheet's
 *                               own `qaGate`, plus an `editing-hci-validation`
 *                               workflow instance per changed block so
 *                               `check:corpus-gate` passes (#448)
 *
 * dispositions reads which comments are in the change set and the people's
 * Blue Disposition from the sheet's own values (as read, header row
 * included), so the numbers come from the sheet and never from memory. It
 * then runs the sheet's own check (`dispositionProblems`, from the same
 * review-sheet.gs) and exits 1, printing the problems, if any remain: the
 * agent fixes the input and runs it again, and a flagged cell never reaches
 * the sheet. Skill: `review-sheet-script`, "Writing the Agent tab with the tool".
 *
 * Input for dispositions:
 *   {
 *     "cs": "CS-001",
 *     "comments": [["No.", …, "Change-sets"], ["126", …, "CS-001"], …],   // Agent - Comments (drafting: omit)
 *     "blue": [["No.", …, "Disposition"], ["126", …, "Not accepted"], …],  // Review Public Comments
 *     "previous": "<the cell as it stands>",   // its Decided lines are kept, in order
 *     "decided": ["Decided (No. 327, 2026-10-31): A, by …; …"],   // new decisions, appended
 *     "overall": "Editorial and clarity revisions …",
 *     "items": [{ "nos": [136], "word": "Accepted", "why": "DPI-F defined at first use." },
 *               { "rest": true, "word": "Not accepted", "why": "Already reflected." }]
 *   }
 * An item without "word" takes the comment's Blue Disposition; "rest" covers
 * every comment of the change set no other item names, grouped by the Blue
 * word where one is set.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { maskStringsAndComments, parseStringField } from "@litlfred/cat-harness-tools/pipeline/uses-field.js";
import { INSTANCE_SCHEMA, type InstanceState } from "@litlfred/cat-harness-tools/src/workflow/instance.js";
import { instanceId, saveInstance } from "@litlfred/cat-harness-tools/src/workflow/store.js";
import { buildScript } from "./build-review-sheet-script.js";

type Item = { nos?: (number | string)[]; rest?: boolean; word?: string; why?: string };
export type DispositionInput = {
  cs: string;
  comments?: string[][];
  blue?: string[][];
  nos?: (number | string)[];
  previous?: string;
  decided?: string[];
  overall?: string;
  items: Item[];
};

const sheet = new Function(buildScript() + "\nreturn { dispositionProblems, DISPOSITION_WORDS, qaGate };")() as {
  dispositionProblems: (text: string, nos: string[], human: Record<string, string>) => string;
  DISPOSITION_WORDS: string[];
  qaGate: (built: { gate?: string }, prs: Array<{ head?: string }>) => { ok: boolean; text: string };
};

/** A column of a values array by its header, or an error naming what is there. */
function column(values: string[][], header: string): number {
  const h = (values[0] || []).map((x) => String(x).trim().toLowerCase());
  const i = h.indexOf(header.toLowerCase());
  if (i < 0) throw new Error(`no "${header}" column in [${(values[0] || []).join(", ")}]: pass the rows with their header row`);
  return i;
}

/** "Nos. 127 to 131, 134, 135, 138 and 139" or "No. 136". Runs of three or more become "a to b". */
export function nosLabel(nos: string[]): string {
  const n = [...new Set(nos.map(Number))].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < n.length; ) {
    let j = i;
    while (j + 1 < n.length && n[j + 1] === n[j] + 1) j++;
    if (j - i >= 2) parts.push(`${n[i]} to ${n[j]}`);
    else for (let k = i; k <= j; k++) parts.push(String(n[k]));
    i = j + 1;
  }
  const list = parts.length > 1 ? parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1] : parts[0];
  return (n.length > 1 ? "Nos. " : "No. ") + list;
}

export function dispositions(input: DispositionInput): { text: string; problems: string } {
  const nos = input.comments
    ? (() => {
        const no = column(input.comments!, "No."), cs = column(input.comments!, "Change-sets");
        return input.comments!.slice(1)
          .filter((r) => String(r[cs] ?? "").split(/[,\s]+/).includes(input.cs))
          .map((r) => String(r[no]).trim()).filter(Boolean);
      })()
    : (input.nos ?? []).map(String);
  const human: Record<string, string> = {};
  if (input.blue?.length) {
    const no = column(input.blue, "No."), d = column(input.blue, "Disposition");
    input.blue.slice(1).forEach((r) => { const n = String(r[no] ?? "").trim(); if (n) human[n] = String(r[d] ?? "").trim(); });
  }
  const set = (w: string) => w && !/^pending$/i.test(w);
  const canon = (w: string) => sheet.DISPOSITION_WORDS.find((x) => x.toLowerCase() === w.toLowerCase()) ?? w;
  const named = new Set(input.items.flatMap((i) => (i.nos ?? []).map(String)));
  const lines: string[] = [];
  for (const item of input.items) {
    const these = item.rest ? nos.filter((n) => !named.has(n)) : (item.nos ?? []).map(String);
    if (!these.length) continue;
    // Group by the word each comment ends up with: the item's, else the people's.
    const by = new Map<string, string[]>();
    for (const n of these) {
      // "rest" defers to the people's word; a named item states its own, and
      // the check below flags it if it differs from theirs.
      const w = canon(item.rest && set(human[n]) ? human[n] : item.word || (set(human[n]) ? human[n] : ""));
      by.set(w, [...(by.get(w) ?? []), n]);
    }
    for (const [w, group] of by) lines.push(`${nosLabel(group)}: ${w || "(no disposition)"}.${item.why ? " " + item.why : ""}`);
  }
  const kept = String(input.previous ?? "").split("\n").filter((l) => /^Decided\b/.test(l.trim())).map((l) => l.trim());
  const history = [...kept, ...(input.decided ?? []).filter((d) => !kept.includes(d.trim()))];
  const text = [
    ...(history.length ? [history.join("\n"), ""] : []),
    ...(input.overall ? [`Overall: ${input.overall}`] : []),
    ...lines,
  ].join("\n");
  // "Not confirmed by the committee" is the committee's step, not a fault in
  // the agent's record, so it never stops the write.
  const problems = sheet.dispositionProblems(text, nos, human).split("\n").filter((l) => l && !/^\u26a0 Not confirmed by the committee/.test(l)).join("\n");
  return { text, problems };
}

/**
 * The PR body's review brief: the staging review page shows only what sits
 * between these markers (cat-harness-tools#1153). The same Overall line and
 * per-comment lines as the Disposition, as Markdown, plus where to look.
 */
export function brief(input: DispositionInput, look?: string, pcs?: string): string {
  const { text } = dispositions(input);
  // The sheet's No. is not the comment's id (on DPI-H, No. 136 is PC-0137), so
  // the ref is read from the Agent - Comments "Comment ref" column, never derived.
  const refOf: Record<string, string> = {};
  if (pcs) {
    if (!input.comments) throw new Error("--pcs needs \"comments\": the Agent - Comments rows with their header, for the Comment ref of each No.");
    const no = column(input.comments, "No."), ref = column(input.comments, "Comment ref");
    input.comments.slice(1).forEach((r) => { const n = String(r[no] ?? "").trim(), f = String(r[ref] ?? "").trim(); if (n && f) refOf[n] = f; });
  }
  const lines = text.split("\n").filter((l) => l && !/^Decided\b/.test(l));
  const md = lines.map((l) => l.replace(/^(Overall|Nos?\. [^:]+):/, (_, h) => `- **${pcs && h !== "Overall" ? linkNos(h, pcs, refOf) : h}:**`));
  return ["<!-- review-brief -->", ...md, ...(look ? [`- **Where to look:** ${look}`] : []), "<!-- /review-brief -->"].join("\n");
}

/**
 * "Nos. 127 to 129 and 134" with each comment linked to its row on the
 * public-comment dashboard (`<dashboard>#<Comment ref>`), so a reader of the
 * review page can open the comment itself. A run is spelled out, since a link
 * to "127 to 129" would hide 128. A number with no known ref stays unlinked.
 */
export function linkNos(label: string, dashboard: string, refOf: Record<string, string>): string {
  const base = dashboard.replace(/#.*$/, "");
  const link = (n: string) => (refOf[n] ? `[${n}](${base}#${refOf[n]})` : n);
  const expanded = label.replace(/(\d+) to (\d+)/g, (_, a, b) => {
    const out: number[] = [];
    for (let i = Number(a); i <= Number(b); i++) out.push(i);
    return out.join(", ");
  });
  return expanded.replace(/\d+/g, link);
}

/** The cells to write on every push, with the time from the clock, never typed. */
export function push(head: string, expectMinutes: number, now = new Date()): Record<string, string> {
  if (!/^[0-9a-f]{40}$/i.test(head)) throw new Error("--head takes the full 40-character commit sha (git rev-parse HEAD)");
  const fmt = (d: Date) => d.toISOString().slice(0, 16).replace("T", " ") + "Z";
  return {
    "PR head (change set)": head,
    "Staging deploy (change set)": `building, expected ${fmt(new Date(now.getTime() + expectMinutes * 60000))}`,
    "Agent completed (UTC, change set)": fmt(now),
  };
}

/** Agent completed alone: acted on Ready for agent, but no new commit, so no restage. */
export function done(now = new Date()): Record<string, string> {
  const t = now.toISOString().slice(0, 16).replace("T", " ") + "Z";
  // The pass is over, so the step says so too: a row left on an old step, or
  // with Agent completed before the Ready time, reads as waiting for ever.
  return { "Agent completed (UTC, change set)": t, "Agent step (change set)": `idle ${t}` };
}

/** Agent step (change set): the step the agent starts now, from the sheet's own list. */
export const STEPS = ["reading", "proposing", "editing", "pushing", "staging", "deploying", "qa-review", "merging", "proposed", "idle"];
export function step(name: string, now = new Date()): Record<string, string> {
  if (!STEPS.includes(name)) throw new Error(`step is one of ${STEPS.join(", ")}`);
  return { "Agent step (change set)": `${name} ${now.toISOString().slice(0, 16).replace("T", " ")}Z` };
}

/** Non-block manifest builders (`chapter`, `section`, `paper`, `document`, `folio`) and tool wrappers. */
const NON_BLOCK_BUILDERS = new Set(["chapter", "section", "paper", "document", "folio", "defineTool", "toolFactory"]);
const CONTENT_SIBLINGS = [".ts", ".md", ".lean"];
const EDITING_PROCESS_ID = "Process_Editing";
const EDITING_PROCESS_SOURCE = "editing-hci-validation.bpmn";

/**
 * Extract the block label from a `.ts` block manifest, or `undefined` when the
 * file is not a block manifest (e.g. a chapter/paper manifest or helper).
 * Covers both built-in block builders (`prose`, `remark`, `table`, …) and
 * contributed DAK builders (`functionalRequirement`, `genericPersona`, …).
 */
export function blockLabelFor(tsPath: string): string | undefined {
  if (!existsSync(tsPath) || !tsPath.endsWith(".ts")) return undefined;
  const src = readFileSync(tsPath, "utf8");
  const masked = maskStringsAndComments(src);
  const m = /\bexport\s+default\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(\s*\{/.exec(masked);
  if (!m || NON_BLOCK_BUILDERS.has(m[1]!)) return undefined;
  const label = parseStringField(src, "label");
  if (!label || /^(chap|sec):/.test(label)) return undefined;
  return label;
}

/**
 * Discover block labels changed in `repoRoot`, from explicit `files` or from
 * `git diff` (staged, `--since <ref>`, or `origin/main...HEAD` / `HEAD~1...HEAD`).
 */
export function changedBlockLabels(
  repoRoot: string,
  opts: { files?: string[]; since?: string; staged?: boolean } = {},
): string[] {
  const root = resolve(repoRoot);
  const files = opts.files ?? (() => {
    const git = (args: string[]): string[] | undefined => {
      try {
        return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);
      } catch {
        return undefined;
      }
    };
    if (opts.staged) return git(["diff", "--cached", "--name-only", "--diff-filter=d"]) ?? [];
    if (opts.since) return git(["diff", "--name-only", "--diff-filter=d", `${opts.since}...HEAD`]) ?? [];
    for (const ref of ["origin/main", "HEAD~1"]) {
      const diff = git(["diff", "--name-only", "--diff-filter=d", `${ref}...HEAD`]);
      if (diff !== undefined) return diff;
    }
    return git(["diff", "--cached", "--name-only", "--diff-filter=d"]) ?? [];
  })();

  const labels: string[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    const abs = resolve(root, file);
    const dot = abs.lastIndexOf(".");
    if (dot === -1 || !CONTENT_SIBLINGS.includes(abs.slice(dot))) continue;
    const ts = `${abs.slice(0, dot)}.ts`;
    if (seen.has(ts) || !existsSync(ts)) continue;
    seen.add(ts);
    const label = blockLabelFor(ts);
    if (label && !labels.includes(label)) labels.push(label);
  }
  return labels;
}

export type QaPassOptions = {
  /** Change-set id on the review sheet, e.g. `"CS-001"`. */
  cs?: string;
  /** Commit sha reviewed (7–40 hex characters), or read from `qaGate`. */
  head?: string;
  /** Full `QA gate (change set)` text, e.g. `"Passed b20534f: dispositions match Blue and the diff"`. */
  qaGate?: string;
  /** One-line summary when `head` is given without `qaGate`. */
  summary?: string;
  /** Optional link for `QA report (change set)`. */
  report?: string;
  /** Editor's review-sheet decision note (default `"Ready for merge on review sheet"`). */
  decision?: string;
  /** Folio repository root where the workflow store and block manifests live. */
  repo?: string;
  /** Explicit block labels to write `editing-hci-validation` instances for. */
  blocks?: string[];
  /** Explicit repo-relative changed files to resolve block labels from. */
  files?: string[];
  /** Git base ref for discovering changed block files (e.g. `"origin/main"`). */
  since?: string;
  /** Discover changed block files from `git diff --cached`. */
  staged?: boolean;
  now?: Date;
};

/**
 * Build an `editing-hci-validation` (`Process_Editing`) workflow instance for
 * `label` recording the review-sheet change set, the independent QA review, and
 * the editor's decision through `Task_Commit` (#448).
 */
export function editingWorkflowInstance(
  label: string,
  opts: { cs: string; qaGate: string; decision?: string; now?: Date },
): InstanceState {
  const at = (opts.now ?? new Date()).toISOString();
  const cs = opts.cs.trim() || "change-set";
  const decision = (opts.decision ?? "Ready for merge on review sheet").trim();
  const qa = opts.qaGate.split("\n")[0]!.trim();
  return {
    $schema: INSTANCE_SCHEMA,
    id: instanceId(EDITING_PROCESS_ID, label),
    processId: EDITING_PROCESS_ID,
    source: EDITING_PROCESS_SOURCE,
    subject: label,
    bean: cs,
    carriedBeans: [cs],
    tokens: ["Task_Commit"],
    arrivals: {},
    history: [
      { at, node: "StartEvent_EditRequested", note: "instance started" },
      { at, node: "Task_DescribeChange", actor: "editor", note: `${cs}: change set on review sheet` },
      { at, node: "Task_ClaimBean", note: "subprocess Process_BeanOpen completed" },
      { at, node: "GW_BeanYours", outcome: "claimed" },
      { at, node: "CallActivity_Evidence", note: "subprocess Process_EvidenceRetrieval completed" },
      { at, node: "Task_DraftEdit", actor: "authoring-agent", note: `${cs}: drafted on change-set pull request` },
      { at, node: "Task_SchemaValidate" },
      { at, node: "Task_SyntaxSpell" },
      { at, node: "Task_BuildGates" },
      { at, node: "Gateway_ReviewerKind", outcome: "no" },
      { at, node: "Task_AgentReview", actor: "qa-reviewer", note: qa },
      { at, node: "Task_CollateFindings" },
      { at, node: "Task_LogFindings", note: `${cs}: QA gate recorded on review sheet (${qa})` },
      { at, node: "Task_ReviewFindings", actor: "editor", note: `${cs}: ${decision}` },
      { at, node: "Call_OptionsAnalysis", note: "subprocess Process_OptionsAnalysis completed" },
      { at, node: "Task_RecordDecision", actor: "editor", note: `${cs}: ${decision}; QA gate: ${qa}` },
      { at, node: "Gateway_EditorDecision", outcome: "accept" },
      {
        at,
        node: "Task_Commit",
        actor: "authoring-agent",
        note: `${cs}: authorised by review-sheet QA gate (${qa}) and editor decision (${decision})`,
      },
    ],
    status: "completed",
    startedAt: at,
    updatedAt: at,
  };
}

/**
 * Validate a review-sheet QA pass with the sheet's own `qaGate` check and write
 * one `editing-hci-validation` workflow instance (`editing--<block>.json`) per
 * changed block so `check:corpus-gate` passes (#448).
 */
export function qaPass(opts: QaPassOptions): {
  cells: Record<string, string>;
  blocks: string[];
  instances: string[];
} {
  const cs = (opts.cs ?? "CS-001").trim();
  const rawHead = opts.head?.trim();
  if (rawHead && !/^[0-9a-f]{7,40}$/i.test(rawHead)) {
    throw new Error("--head takes a 7 to 40-character commit sha");
  }
  const gateText = opts.qaGate?.trim()
    ? opts.qaGate.trim()
    : rawHead
      ? `Passed ${rawHead.slice(0, 7)}${opts.summary?.trim() ? `: ${opts.summary.trim()}` : ""}`
      : "";
  if (!gateText) {
    throw new Error("qa-pass requires --qa-gate \"Passed <sha>: <summary>\" or --head <sha> [--summary <text>]");
  }
  const parsedSha = /^(?:pass|fail)\w*\s*:?\s*([0-9a-f]{7,40})\b/i.exec(gateText.split("\n")[0]!.trim())?.[1];
  const verifyHead = rawHead ?? parsedSha ?? "";
  const verdict = sheet.qaGate({ gate: gateText }, verifyHead ? [{ head: verifyHead }] : [{ head: "0000000" }]);
  if (!verdict.ok) {
    throw new Error(verdict.text || "QA gate did not pass");
  }

  const repoRoot = resolve(opts.repo ?? process.cwd());
  const explicitBlocks = (opts.blocks ?? []).map((b) => b.trim()).filter(Boolean);
  const discovered =
    opts.files !== undefined || !explicitBlocks.length || opts.since !== undefined || opts.staged
      ? changedBlockLabels(repoRoot, { files: opts.files, since: opts.since, staged: opts.staged })
      : [];
  const blocks = [...new Set([...explicitBlocks, ...discovered])];
  const instances = blocks.map((label) =>
    saveInstance(repoRoot, editingWorkflowInstance(label, { cs, qaGate: gateText, decision: opts.decision, now: opts.now })),
  );

  const cells: Record<string, string> = {
    "QA gate (change set)": gateText,
    ...(opts.report?.trim() ? { "QA report (change set)": opts.report.trim() } : {}),
  };
  return { cells, blocks, instances };
}

if (import.meta.main) {
  const [cmd, ...rest] = process.argv.slice(2);
  const flag = (f: string) => { const i = rest.indexOf(f); return i >= 0 ? rest[i + 1] : undefined; };
  const listFlag = (f: string) => {
    const v = flag(f);
    return v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
  };
  if (cmd === "dispositions" && rest[0]) {
    const { text, problems } = dispositions(JSON.parse(readFileSync(rest[0], "utf8")));
    if (problems) { console.error(problems); console.error("\nNothing to write: fix the input and run again."); process.exit(1); }
    console.log(text);
  } else if (cmd === "brief" && rest[0]) {
    const input = JSON.parse(readFileSync(rest[0], "utf8"));
    const { problems } = dispositions(input);
    if (problems) { console.error(problems); process.exit(1); }
    console.log(brief(input, flag("--look"), flag("--pcs")));
  } else if ((cmd === "qa-pass" || cmd === "qa") || (cmd !== "push" && cmd !== "done" && flag("--qa-gate"))) {
    const out = qaPass({
      cs: flag("--cs"),
      head: flag("--head"),
      qaGate: flag("--qa-gate"),
      summary: flag("--summary"),
      report: flag("--report"),
      decision: flag("--decision"),
      repo: flag("--repo"),
      blocks: listFlag("--blocks"),
      files: listFlag("--files"),
      since: flag("--since"),
      staged: rest.includes("--staged"),
    });
    console.log(JSON.stringify(out, null, 2));
  } else if (cmd === "push" && flag("--head")) {
    const cells = push(flag("--head")!, Number(flag("--expect") ?? 20));
    if (flag("--qa-gate")) {
      const qa = qaPass({
        cs: flag("--cs"),
        head: flag("--head"),
        qaGate: flag("--qa-gate"),
        report: flag("--report"),
        decision: flag("--decision"),
        repo: flag("--repo"),
        blocks: listFlag("--blocks"),
        files: listFlag("--files"),
        since: flag("--since"),
        staged: rest.includes("--staged"),
      });
      Object.assign(cells, qa.cells);
    }
    console.log(JSON.stringify(cells, null, 2));
  } else if (cmd === "done") {
    const cells = done();
    if (flag("--qa-gate")) {
      const qa = qaPass({
        cs: flag("--cs"),
        head: flag("--head"),
        qaGate: flag("--qa-gate"),
        report: flag("--report"),
        decision: flag("--decision"),
        repo: flag("--repo"),
        blocks: listFlag("--blocks"),
        files: listFlag("--files"),
        since: flag("--since"),
        staged: rest.includes("--staged"),
      });
      Object.assign(cells, qa.cells);
    }
    console.log(JSON.stringify(cells, null, 2));
  } else if (cmd === "step" && rest[0]) {
    console.log(JSON.stringify(step(rest[0]), null, 2));
  } else {
    console.error("usage: agent-record.ts dispositions <input.json> | brief <input.json> [--look <text>] [--pcs <dashboard url>] | push --head <full sha> [--expect <minutes>] | done | step <name> | qa-pass --cs <CS-nnn> (--head <sha> [--summary <text>] | --qa-gate <text>) [--report <url>] [--decision <text>] [--repo <dir>] [--blocks <b1,b2>] [--since <ref>]");
    process.exit(2);
  }
}
