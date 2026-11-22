#!/usr/bin/env bun
/**
 * Plan how to give every bean exactly one home. DRY RUN ONLY: it reads the
 * stores and writes a report; it never writes to a store.
 *
 * ## The defect
 *
 * The same bean file is kept in several stores at once (the
 * `litlfred/folio-assistant` and `litlfred/cat-harness` branch stores, and
 * the layer stores of `cat-harness-tools` and the core content layer
 * (https://github.com/litlfred/folio-assistant-core)), and the copies have
 * drifted in CONTENT, not only in date. "Newest wins" would lose text, so
 * this merges, and lists what it cannot merge for the owner.
 *
 * ## Where each bean belongs
 *
 * 1. `cat-tools-*` → cat-harness-tools; `folio-core-*` → the core content layer (https://github.com/litlfred/folio-assistant-core).
 * 2. A `folio-assistant-*` bean a layer took at separation → that layer. Taken
 *    by BOTH layers → listed for the owner, no home chosen.
 * 3. Every other bean → the `litlfred/folio-assistant` branch store.
 *
 * ## How copies are merged
 *
 * The two branch stores share history from the 2026-10-08 cutover commit.
 * That commit's copy of a bean is the BASE, and the copies are merged three
 * ways against it (`git merge-file --diff3`), the bean's home copy first, so
 * an unresolved hunk keeps the home copy's text. A conflicting hunk is
 * resolved only when the answer is mechanical:
 *
 * - both sides changed only `updated_at` → the later one;
 * - the base had nothing there (both sides appended, typically a dated note) →
 *   keep both, ours first.
 *
 * Every other conflicting hunk keeps our text and is listed, with the other
 * side's, for the owner. A bean with no base copy (created after the cutover)
 * falls back to a section merge: split at `## ` headings, carry over sections
 * only one copy has, keep the longer of two texts where one contains the other.
 *
 * ## Emitting the apply
 *
 * `--emit <dir>` writes, per store, what applying the plan would change:
 * `<dir>/<store>/files/<path>` (each bean's merged text, in its home store)
 * and `<dir>/<store>/delete.txt` (the copies to remove elsewhere), plus
 * `<dir>/<store>/source.txt` naming the commit it was read at. It still
 * writes to no store: a person or session commits the emitted tree. A text
 * conflict loses nothing: the home copy's text stays, and every hunk the
 * other copies disagreed on is appended under a dated "Merged from" section.
 *
 *   bun run cat-harness-tools/scripts/bean-dedupe.ts [--out <dir>] [--emit <dir>] [--stores <file.json>]
 *   bun run cat-harness-tools/scripts/bean-dedupe.ts --check   # exit 1 unless every bean has one home
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

import { DEFAULT_STORES, LAYERS, MAIN_STORE, PREFIX_HOME, oneHomeProblems, type StoreSpec } from "./lib/bean-homes.ts";

export { DEFAULT_STORES, LAYERS, MAIN_STORE, PREFIX_HOME, type StoreSpec };

export type Copy = { store: string; file: string; text: string };

export type Parsed = { fm: Record<string, unknown>; fmText: string; preamble: string; sections: { heading: string; text: string }[] };

export function parse(text: string): Parsed {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const fmText = m ? m[1] : "";
  const body = m ? m[2] : text;
  let fm: Record<string, unknown> = {};
  try {
    fm = (Bun.YAML.parse(fmText) ?? {}) as Record<string, unknown>;
  } catch {
    fm = {};
  }
  const sections: { heading: string; text: string }[] = [];
  const pre: string[] = [];
  let cur: { heading: string; lines: string[] } | null = null;
  let fence = false;
  for (const line of body.split("\n")) {
    if (/^(```|~~~)/.test(line)) fence = !fence;
    if (!fence && /^## /.test(line)) {
      if (cur) sections.push({ heading: cur.heading, text: tidy(cur.lines.join("\n")) });
      cur = { heading: line.trim(), lines: [] };
      continue;
    }
    (cur ? cur.lines : pre).push(line);
  }
  if (cur) sections.push({ heading: cur.heading, text: tidy(cur.lines.join("\n")) });
  return { fm, fmText, preamble: tidy(pre.join("\n")), sections };
}

const tidy = (s: string) => s.replace(/[ \t]+$/gm, "").trim();

/** Which store a bean belongs in, or undefined when the owner must choose. */
export function homeOf(id: string, storesHolding: string[]): { home?: string; why: string } {
  for (const [p, store] of Object.entries(PREFIX_HOME)) if (id.startsWith(p)) return { home: store, why: `prefix ${p}` };
  const layers = LAYERS.filter((l) => storesHolding.includes(l));
  if (layers.length === 1) return { home: layers[0], why: `taken by ${layers[0]} at separation` };
  // Owner, 2026-10-30 (#459, card "A. Apply with safe defaults"): a bean BOTH
  // layers took belongs to neither alone, so it goes where every bean no
  // single layer owns goes.
  if (layers.length > 1) return { home: MAIN_STORE, why: `taken by ${layers.join(" and ")}: main store (owner, 2026-10-30)` };
  return { home: MAIN_STORE, why: "main store" };
}

export type FieldDiff = { field: string; values: Record<string, string> };
export type Conflict = { where: string; kept: string; other: string; otherStore: string };
export type Merged = {
  chosen: string;
  text: string;
  carried: { heading: string; from: string }[];
  widened: { heading: string; from: string }[];
  conflicts: Conflict[];
  fieldDiffs: FieldDiff[];
};

const IGNORED_FIELDS = new Set(["updated_at", "$schema"]);
const show = (v: unknown) => (v === undefined ? "∅" : typeof v === "string" ? v : JSON.stringify(v));

export function merge(copies: Copy[], home?: string): Merged {
  const parsed = copies.map((c) => ({ c, p: parse(c.text) }));
  const upd = (x: (typeof parsed)[number]) => String(x.p.fm.updated_at ?? "");
  parsed.sort((a, b) => upd(b).localeCompare(upd(a)) || (a.c.store === home ? -1 : b.c.store === home ? 1 : 0));
  const base = parsed[0];

  const fields = new Set(parsed.flatMap((x) => Object.keys(x.p.fm)));
  const fieldDiffs: FieldDiff[] = [];
  for (const f of [...fields].sort()) {
    if (IGNORED_FIELDS.has(f)) continue;
    const vals = Object.fromEntries(parsed.map((x) => [x.c.store, show(x.p.fm[f])]));
    if (new Set(Object.values(vals)).size > 1) fieldDiffs.push({ field: f, values: vals });
  }

  let preamble = base.p.preamble;
  const sections = base.p.sections.map((s) => ({ ...s }));
  const carried: Merged["carried"] = [];
  const widened: Merged["widened"] = [];
  const conflicts: Conflict[] = [];

  const reconcile = (where: string, mine: string, theirs: string, from: string): string => {
    if (mine === theirs || mine.includes(theirs)) return mine;
    if (theirs.includes(mine)) {
      widened.push({ heading: where, from });
      return theirs;
    }
    conflicts.push({ where, kept: mine, other: theirs, otherStore: from });
    return mine;
  };

  for (const other of parsed.slice(1)) {
    preamble = reconcile("(text before the first heading)", preamble, other.p.preamble, other.c.store);
    for (const s of other.p.sections) {
      const at = sections.find((x) => x.heading === s.heading);
      if (!at) {
        sections.push({ ...s });
        carried.push({ heading: s.heading, from: other.c.store });
      } else at.text = reconcile(s.heading, at.text, s.text, other.c.store);
    }
  }

  const body = [preamble, ...sections.map((s) => `${s.heading}\n\n${s.text}`)].filter(Boolean).join("\n\n");
  return { chosen: base.c.store, text: `---\n${base.p.fmText}\n---\n\n${body}\n`, carried, widened, conflicts, fieldDiffs };
}


/**
 * How far along a status is. A stale copy (a layer's copy taken at separation,
 * or a branch store a session stopped writing to) lags; it never moves a bean
 * backwards. Measured 2026-10-30: 9rq1, hf2q, nytj, q2wm and v49e were
 * `completed` in both branch stores, and keeping the home copy's text on a
 * status conflict would have reopened them.
 */
const STATUS_RANK: Record<string, number> = { draft: 0, todo: 0, "in-progress": 1, completed: 2, scrapped: 2 };

/**
 * When the copies disagree on `status`, the merged bean takes the one furthest
 * along. Two different statuses at the same rank (`completed` and `scrapped`)
 * go to the copy updated last. Returns the text unchanged when nothing differs
 * or a status is unknown.
 */
export function settleStatus(text: string, copies: Copy[]): string {
  const seen = copies.map((c) => parse(c.text).fm).filter((fm) => typeof fm.status === "string");
  const statuses = new Set(seen.map((fm) => fm.status as string));
  if (statuses.size < 2 || [...statuses].some((s) => !(s in STATUS_RANK))) return text;
  const top = Math.max(...[...statuses].map((s) => STATUS_RANK[s]));
  const best = seen
    .filter((fm) => STATUS_RANK[fm.status as string] === top)
    .sort((a, b) => String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")))[0].status as string;
  const m = text.match(/^(---\r?\n)([\s\S]*?)(\r?\n---)/);
  if (!m || !/^status:/m.test(m[2])) return text;
  return m[1] + m[2].replace(/^status:.*$/m, `status: ${best}`) + text.slice(m[1].length + m[2].length);
}

/** A fence longer than any backtick run in `text`, so the text cannot close it. */
function fenceFor(text: string): string {
  const longest = Math.max(2, ...(text.match(/`+/g) ?? []).map((r) => r.length));
  return "`".repeat(longest + 1);
}

/**
 * The home copy's text with every conflicting hunk the other copies held
 * appended, so applying the plan loses no text (owner, 2026-10-30, #459).
 */
export function withConflictNotes(text: string, conflicts: Conflict[], date: string): string {
  const real = conflicts.filter((c) => c.otherStore !== "-" && c.other.trim() !== "");
  if (real.length === 0) return text;
  const byStore = new Map<string, Conflict[]>();
  for (const c of real) byStore.set(c.otherStore, [...(byStore.get(c.otherStore) ?? []), c]);
  const parts: string[] = [text.replace(/\s+$/, "")];
  for (const [store, cs] of byStore) {
    parts.push("", `## Merged from the ${store} copy (bean dedupe, ${date})`, "");
    parts.push("These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.");
    for (const c of cs) {
      const fence = fenceFor(c.other);
      parts.push("", `Where: ${c.where}`, "", `${fence}text`, c.other, fence);
    }
  }
  return parts.join("\n") + "\n";
}

/** A merged bean must still open with front matter that parses and names its status. */
export function headerOk(text: string): boolean {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return false;
  const keys = m[1].split("\n").map((l) => l.match(/^([A-Za-z_$][\w$]*):/)?.[1]).filter(Boolean);
  if (new Set(keys).size !== keys.length) return false;
  try {
    const fm = Bun.YAML.parse(m[1]) as Record<string, unknown>;
    return !!fm && typeof fm.status === "string" && typeof fm.title === "string";
  } catch {
    return false;
  }
}

export type Hunk = { ours: string[]; base: string[]; theirs: string[] };

/** Resolve `git merge-file --diff3` output; return the text and the hunks left over. */
export function resolveDiff3(out: string): { text: string; open: Hunk[]; resolved: number } {
  const lines = out.split("\n");
  const res: string[] = [];
  const open: Hunk[] = [];
  let resolved = 0;
  let i = 0;
  while (i < lines.length) {
    if (!lines[i].startsWith("<<<<<<< ")) {
      res.push(lines[i++]);
      continue;
    }
    const h: Hunk = { ours: [], base: [], theirs: [] };
    let part: keyof Hunk = "ours";
    for (i++; i < lines.length && !lines[i].startsWith(">>>>>>> "); i++) {
      if (lines[i].startsWith("||||||| ")) part = "base";
      else if (lines[i] === "=======") part = "theirs";
      else h[part].push(lines[i]);
    }
    i++;
    const onlyUpd = (xs: string[]) => xs.every((l) => /^updated_at:/.test(l) || !l.trim());
    if (onlyUpd(h.ours) && onlyUpd(h.theirs) && onlyUpd(h.base)) {
      const all = [...h.ours, ...h.theirs].filter((l) => l.trim()).sort();
      res.push(all[all.length - 1] ?? "");
      resolved++;
    } else if (h.base.every((l) => !l.trim())) {
      res.push(...h.ours, ...(h.ours.length && h.theirs.length ? [""] : []), ...h.theirs);
      resolved++;
    } else {
      res.push(...h.ours);
      open.push(h);
    }
  }
  return { text: res.join("\n"), open, resolved };
}

function mergeFile(ours: string, base: string, theirs: string): string {
  const d = join(tmpdir(), `bean-dedupe-${process.pid}`);
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, "o"), ours);
  writeFileSync(join(d, "b"), base);
  writeFileSync(join(d, "t"), theirs);
  const r = spawnSync("git", ["merge-file", "-p", "--diff3", "-L", "ours", "-L", "base", "-L", "theirs", join(d, "o"), join(d, "b"), join(d, "t")], { encoding: "utf8", maxBuffer: 1 << 26 });
  if (r.status === null || r.status < 0) throw new Error(`git merge-file failed: ${r.stderr}`);
  return r.stdout;
}

export type ThreeWay = { text: string; resolved: number; conflicts: Conflict[] };

/** Fold every copy into one, three ways against `base`. */
export function merge3(copies: Copy[], base: string): ThreeWay {
  let text = copies[0].text;
  let resolved = 0;
  const conflicts: Conflict[] = [];
  for (const c of copies.slice(1)) {
    if (c.text === text) continue;
    const r = resolveDiff3(mergeFile(text, base, c.text));
    text = r.text;
    resolved += r.resolved;
    for (const h of r.open) conflicts.push({ where: "(three-way hunk)", kept: h.ours.join("\n"), other: h.theirs.join("\n"), otherStore: c.store });
  }
  return { text, resolved, conflicts };
}

function git(argv: string[], cwd?: string) {
  const r = spawnSync("git", argv, { cwd, encoding: "utf8", maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`git ${argv.join(" ")}: ${(r.stderr ?? "").trim()}`);
  return r.stdout;
}

function readStore(s: StoreSpec, cache: string): { copies: Map<string, Copy>; commit: string } {
  const dir = join(cache, s.name + ".git");
  if (!existsSync(dir)) git(["init", "--bare", "-q", dir]);
  git(["fetch", "-q", "--depth", "1", `https://github.com/${s.repo}.git`, `refs/heads/${s.branch}`], dir);
  const commit = git(["rev-parse", "FETCH_HEAD"], dir).trim();
  const copies = new Map<string, Copy>();
  for (const file of git(["ls-tree", "-r", "--name-only", "FETCH_HEAD", "--", s.path], dir).split("\n")) {
    if (!file.endsWith(".md") || /(^|\/)README\.md$/.test(file)) continue;
    const id = file.split("/").pop()!.split("--")[0];
    copies.set(id, { store: s.name, file, text: git(["show", `FETCH_HEAD:${file}`], dir) });
  }
  return { copies, commit };
}

function summarise(cs: Conflict[]): string {
  const n = new Map<string, number>();
  for (const c of cs) {
    const k = c.otherStore === "-" ? c.where : `${c.where === "(three-way hunk)" ? "hunk" : c.where} vs ${c.otherStore}`;
    n.set(k, (n.get(k) ?? 0) + 1);
  }
  return [...n].map(([k, v]) => (v > 1 ? `${v}× ${k}` : k)).join("; ").replace(/[\\|]/g, "\\$&");
}

/** The common ancestor of the two branch stores, and its copy of every bean. */
function readBase(stores: StoreSpec[], cache: string): { commit: string; subject: string; copies: Map<string, string> } {
  const [a, b] = stores.filter((s) => s.branch.startsWith("cat/"));
  const copies = new Map<string, string>();
  if (!a || !b) return { commit: "none", subject: "no two branch stores", copies };
  const dir = join(cache, "base.git");
  if (!existsSync(dir)) git(["init", "--bare", "-q", dir]);
  git(["fetch", "-q", "--depth", "1000", `https://github.com/${a.repo}.git`, `+refs/heads/${a.branch}:refs/a`], dir);
  git(["fetch", "-q", "--depth", "1000", `https://github.com/${b.repo}.git`, `+refs/heads/${b.branch}:refs/b`], dir);
  const commit = git(["merge-base", "refs/a", "refs/b"], dir).trim();
  const subject = git(["log", "-1", "--format=%cs %s", commit], dir).trim();
  for (const file of git(["ls-tree", "-r", "--name-only", commit, "--", a.path], dir).split("\n")) {
    if (!file.endsWith(".md") || /(^|\/)README\.md$/.test(file)) continue;
    copies.set(file.split("/").pop()!.split("--")[0], git(["show", `${commit}:${file}`], dir));
  }
  return { commit, subject, copies };
}

function main() {
  const argv = process.argv.slice(2);
  const opt = (k: string) => {
    const i = argv.indexOf(k);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const stores: StoreSpec[] = opt("--stores") ? JSON.parse(readFileSync(resolve(opt("--stores")!), "utf8")) : DEFAULT_STORES;
  const out = opt("--out");
  const cache = join(tmpdir(), "bean-dedupe-cache");
  mkdirSync(cache, { recursive: true });

  const read = Object.fromEntries(stores.map((s) => [s.name, readStore(s, cache)]));
  if (argv.includes("--check")) {
    // #459 step 4: every bean in exactly one store, none in a retired one.
    const problems = oneHomeProblems(Object.fromEntries(stores.map((s) => [s.name, read[s.name].copies.keys()])));
    for (const s of stores) console.log(`${s.name}: ${s.repo} ${s.branch} @ ${read[s.name].commit.slice(0, 7)}, ${read[s.name].copies.size} beans`);
    if (problems.length) {
      for (const p of problems) console.error(`  ${p}`);
      console.error(`check:bean-one-home: ${problems.length} bean(s) without one home. Fix with \`bun run cat beans:dedupe --emit <dir>\` and commit the emitted tree.`);
      process.exit(1);
    }
    console.log("check:bean-one-home: every bean has one home");
    return;
  }
  const base = readBase(stores, cache);
  const ids = new Set(Object.values(read).flatMap((r) => [...r.copies.keys()]));

  type Row = { id: string; holders: string[]; home?: string; why: string; kind: string; merged?: Merged; copies: Copy[] };
  const rows: Row[] = [];
  for (const id of [...ids].sort()) {
    const copies = stores.map((s) => read[s.name].copies.get(id)).filter((c): c is Copy => !!c);
    const holders = copies.map((c) => c.store);
    const { home, why } = homeOf(id, holders);
    if (copies.length === 1) {
      rows.push({ id, holders, home, why, kind: home === holders[0] ? "single, in place" : "single, moves", copies });
      continue;
    }
    const merged = merge(copies, home);
    const identical = new Set(copies.map((c) => c.text)).size === 1;
    const baseText = base.copies.get(id);
    let kind: string;
    if (identical) {
      kind = "identical copies";
      merged.text = copies[0].text;
      merged.conflicts = [];
    } else if (baseText !== undefined) {
      // The home copy goes first, so a conflict keeps the home's text.
      const ordered = [...copies].sort((x, y) => (x.store === home ? -1 : y.store === home ? 1 : 0));
      const m3 = merge3(ordered, baseText);
      merged.conflicts = m3.conflicts;
      merged.text = m3.text;
      merged.chosen = ordered[0].store;
      kind = m3.conflicts.length ? "conflict (three-way)" : m3.resolved ? "merged three-way, mechanical fixes" : "merged three-way, clean";
      if (!headerOk(m3.text)) {
        kind = "conflict (merged header invalid)";
        // Keep the home copy whole; the others' text goes in the notes.
        merged.text = ordered[0].text;
        for (const c of ordered.slice(1)) merged.conflicts.push({ where: "(the whole copy: the merged header did not parse)", kept: "", other: c.text, otherStore: c.store });
        merged.conflicts.push({ where: "(merged header does not parse, or repeats a key)", kept: "", other: "", otherStore: "-" });
      }
    } else
      kind = merged.conflicts.length
        ? "conflict (no base)"
        : merged.carried.length || merged.widened.length
          ? "merged by section, text carried"
          : "merged by section, header only";
    merged.text = settleStatus(merged.text, copies);
    rows.push({ id, holders, home, why, kind, merged, copies });
  }

  const emit = opt("--emit");
  if (emit) {
    const date = new Date().toISOString().slice(0, 10);
    const deletes = new Map<string, string[]>(stores.map((s) => [s.name, []]));
    let written = 0;
    for (const r of rows) {
      if (r.home === undefined) continue;
      const homeSpec = stores.find((s) => s.name === r.home)!;
      const homeCopy = r.copies.find((c) => c.store === r.home);
      if (r.copies.length === 1 && homeCopy) continue; // single, in place
      const text = r.merged ? withConflictNotes(r.merged.text, r.merged.conflicts, date) : r.copies[0].text;
      const file = homeCopy?.file ?? join(homeSpec.path, r.copies[0].file.split("/").pop()!);
      if (!homeCopy || homeCopy.text !== text) {
        const dest = join(emit, r.home, "files", file);
        mkdirSync(dirname(dest), { recursive: true });
        writeFileSync(dest, text);
        written++;
      }
      for (const c of r.copies) if (c.store !== r.home) deletes.get(c.store)!.push(c.file);
    }
    for (const s of stores) {
      mkdirSync(join(emit, s.name), { recursive: true });
      writeFileSync(join(emit, s.name, "delete.txt"), deletes.get(s.name)!.sort().join("\n") + (deletes.get(s.name)!.length ? "\n" : ""));
      writeFileSync(join(emit, s.name, "source.txt"), `${s.repo} ${s.branch} ${read[s.name].commit}\n`);
    }
    console.log(`emitted ${written} bean file(s) to write and ${[...deletes.values()].reduce((n, d) => n + d.length, 0)} copies to delete under ${emit}`);
  }

  const count = (f: (r: Row) => boolean) => rows.filter(f).length;
  const kinds = [...new Set(rows.map((r) => r.kind))].sort();
  const homes = [...new Set(rows.map((r) => r.home ?? "(owner to choose)"))].sort();
  const lines: string[] = [];
  lines.push("# Bean dedupe plan (dry run)", "");
  lines.push("Nothing has been written to any store. Sources:", "");
  lines.push(`- **base**: the merge-base of the two branch stores, \`${base.commit.slice(0, 7)}\` (${base.subject}), ${base.copies.size} bean files`);
  for (const s of stores) lines.push(`- **${s.name}**: \`${s.repo}\` \`${s.branch}\` @ \`${read[s.name].commit.slice(0, 7)}\`, ${read[s.name].copies.size} bean files`);
  lines.push("", `**${rows.length} distinct beans**, ${count((r) => r.holders.length > 1)} held in more than one store.`, "");
  lines.push("## By outcome", "", "| Outcome | Beans |", "|---|--:|");
  for (const k of kinds) lines.push(`| ${k} | ${count((r) => r.kind === k)} |`);
  lines.push("", "## Where they end up", "", "| Home | Beans | Copies removed elsewhere |", "|---|--:|--:|");
  for (const h of homes) {
    const rs = rows.filter((r) => (r.home ?? "(owner to choose)") === h);
    lines.push(`| ${h} | ${rs.length} | ${rs.reduce((n, r) => n + r.holders.filter((x) => x !== r.home).length, 0)} |`);
  }
  const ownerCalls = rows.filter((r) => !r.home);
  if (ownerCalls.length) {
    lines.push("", "## Owner to choose a home", "", "| Bean | Held by | Why |", "|---|---|---|");
    for (const r of ownerCalls) lines.push(`| ${r.id} | ${r.holders.join(", ")} | ${r.why} |`);
  }
  const statusSplits = rows.filter((r) => r.merged?.fieldDiffs.some((d) => d.field === "status"));
  if (statusSplits.length) {
    lines.push("", "## Copies that disagree on status", "", "Check these: the merged status is what the apply step would write. It is the status furthest along (todo, in-progress, then completed or scrapped), so a stale copy never reopens a bean.", "", "| Bean | Status per store | Merged status |", "|---|---|---|");
    for (const r of statusSplits) {
      const d = r.merged!.fieldDiffs.find((x) => x.field === "status")!;
      const after = String(parse(r.merged!.text).fm.status ?? "?");
      lines.push(`| ${r.id} | ${Object.entries(d.values).map(([s, v]) => `${s}: ${v}`).join("; ")} | ${after} |`);
    }
  }
  const conflicts = rows.filter((r) => r.kind.startsWith("conflict"));
  if (conflicts.length) {
    lines.push("", "## Text conflicts", "", "The kept copy's text stays; the other is listed in `plan.json` under `conflicts`.", "", "| Bean | Home copy (text kept) | Conflicts |", "|---|---|---|");
    for (const r of conflicts)
      lines.push(`| ${r.id} | ${r.merged!.chosen} | ${summarise(r.merged!.conflicts)} |`);
  }
  const report = lines.join("\n") + "\n";

  const summary = kinds.map((k) => `${k}: ${count((r) => r.kind === k)}`).join(", ");
  console.log(`${rows.length} beans. ${summary}. Owner calls: ${ownerCalls.length}.`);
  if (out) {
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "report.md"), report);
    const plan = rows.map((r) => ({
      id: r.id,
      holders: r.holders,
      home: r.home ?? null,
      why: r.why,
      kind: r.kind,
      chosenHeader: r.merged?.chosen,
      carried: r.merged?.carried,
      widened: r.merged?.widened,
      fieldDiffs: r.merged?.fieldDiffs,
      conflicts: r.merged?.conflicts,
    }));
    writeFileSync(join(out, "plan.json"), JSON.stringify({ $schema: "bean-dedupe-plan/v1", stores: stores.map((s) => ({ ...s, commit: read[s.name].commit })), beans: plan }, null, 2) + "\n");
    console.log(`wrote ${join(out, "report.md")} and plan.json`);
  } else process.stdout.write("\n" + report);
}

if (import.meta.main) main();
