#!/usr/bin/env bun
/**
 * Write `$schema: bean/1.0.0` back into every bean that lacks it, or, with
 * `--check`, fail on one that still lacks it.
 *
 * ## Why the tag is restored rather than trusted
 *
 * A bean is a node kind (`bean/1.0.0`, `schemas/sdlc/bean-graph.ts#BeanKind`)
 * and says so in its own front matter. But the `beans` CLI owns that front
 * matter: `beans update` drops every key it does not know, `$schema`
 * included, and `beans create` never writes one. So the tag is put back
 * after the CLI has had its turn: at session start, before each commit, and
 * by `state:push` before it splices the store onto its branch. `--check` is
 * the gate that says when none of those ran.
 *
 * ## What it changes
 *
 * One line of front matter, inserted after the `# <id>` comment the CLI writes
 * first, so a retag is a one-line diff per bean. A bean that already carries
 * some OTHER `$schema` is reported and left alone (a newer major, or a
 * mistake).
 *
 * ## Which store
 *
 * The one this checkout resolves, read the way every bean gate reads it
 * (`bean-store-read.ts`): `beans/defs/` and its `archive/`. Where the graph is
 * kept on its branch, that is the MOUNT, so a retag writes into the mount and
 * `state:push` carries it to the branch. An unmounted store is "could not
 * check", never a clean run. `--dir <path>` names a `defs/` directory directly,
 * for a worktree of the branch or a store in another checkout.
 *
 * `--quiet` prints only when something changed or went wrong. `--print-paths`
 * prints the absolute path of each file it tagged, one per line and nothing
 * else, so the pre-commit hook can tell which of them git tracks.
 *
 * Exit codes follow the bean gates: 0 every bean tagged, 1 a defect (untagged
 * under `--check`, or a foreign tag), 2 could not check.
 *
 * @module scripts/beans-retag
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { BEAN_SCHEMA_TAG, BeanKind } from "../schemas/sdlc/bean-graph.ts";
import { repoRootFor } from "../schemas/kg/cat-harness.js";
import { acceptsSchemaTag } from "../schemas/kg/node-kind.ts";

import { NOT_BEANS, readBeanStore } from "./bean-store-read.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { exitNotApplicable } from "./lib/not-applicable.ts";

/**
 * The command a person runs to fix what `--check` finds, named once.
 *
 * Bean `ujiv` asked for `bun run beans:retag` word for word. That spelling was
 * written before the scripts left the root `package.json` (`ar1s` phase 4):
 * `bun run <name>` now finds only the root's own few scripts, and declaring
 * `beans:retag` at the root as well would make `bun run cat` refuse every name
 * (`scriptTable` throws on a name declared twice). So the remedy is spelled
 * the way every other gate here spells one, through the runner.
 */
export const RETAG_COMMAND = "bun run cat beans:retag";

/** What one bean file needs. */
export type RetagOutcome =
  /** Carries a tag the bean kind accepts. Nothing to do. */
  | "tagged"
  /** Had no `$schema`; the tag was (or, under `--check`, would be) added. */
  | "added"
  /** Carries a `$schema` the bean kind does not accept. Reported, never overwritten. */
  | "foreign"
  /** No `---` fence, so not front matter this script will edit. */
  | "unfenced";

export interface RetagResult {
  outcome: RetagOutcome;
  /** The file text after the retag. Equal to the input unless `outcome` is `added`. */
  text: string;
  /** The tag found, for `foreign`. */
  tag?: string;
}

const FENCE = /^---\n([\s\S]*?)\n---(\n|$)/;
const SCHEMA_LINE = /^\$schema:[ \t]*(.*)$/m;

/**
 * Tag one bean file's text.
 *
 * Pure: it returns the new text and never writes. The insertion point is right
 * after the CLI's `# <id>` comment when the front matter opens with one, and the
 * top of the front matter otherwise.
 */
export function retagBeanText(text: string): RetagResult {
  const m = FENCE.exec(text);
  if (!m) return { outcome: "unfenced", text };
  const fm = m[1]!;
  const found = SCHEMA_LINE.exec(fm);
  if (found) {
    const tag = found[1]!.trim().replace(/^['"]|['"]$/g, "");
    return acceptsSchemaTag(BeanKind, tag) ? { outcome: "tagged", text } : { outcome: "foreign", text, tag };
  }
  const lines = fm.split("\n");
  const at = lines[0]!.startsWith("#") ? 1 : 0;
  lines.splice(at, 0, `$schema: ${BEAN_SCHEMA_TAG}`);
  const rest = text.slice(m[0].length);
  return { outcome: "added", text: `---\n${lines.join("\n")}\n---${m[2]}${rest}` };
}

export interface RetagReport {
  dir: string;
  /** Bean files examined, the archive included. */
  files: number;
  tagged: number;
  /** Files that had no tag: written under `write`, only counted otherwise. */
  added: string[];
  foreign: { file: string; tag: string }[];
  /** `.md` files with no fence that {@link NOT_BEANS} does not excuse. */
  unfenced: string[];
}

/**
 * Retag every bean under `dir` (a `defs/` directory) and its `archive/`.
 *
 * With `write: false` it changes nothing and reports what it would add.
 */
export function retagDir(dir: string, opts: { write: boolean }): RetagReport {
  const report: RetagReport = { dir, files: 0, tagged: 0, added: [], foreign: [], unfenced: [] };
  const sources = [dir];
  const archive = join(dir, "archive");
  if (existsSync(archive)) sources.push(archive);
  for (const src of sources) {
    const prefix = src === dir ? "" : "archive/";
    for (const name of readdirSync(src).sort()) {
      if (!name.endsWith(".md") || NOT_BEANS.has(name)) continue;
      const path = join(src, name);
      const before = readFileSync(path, "utf-8");
      const r = retagBeanText(before);
      report.files++;
      if (r.outcome === "tagged") report.tagged++;
      else if (r.outcome === "foreign") report.foreign.push({ file: prefix + name, tag: r.tag! });
      else if (r.outcome === "unfenced") report.unfenced.push(prefix + name);
      else {
        report.added.push(prefix + name);
        if (opts.write) writeFileSync(path, r.text);
      }
    }
  }
  return report;
}

/** Where the store is, or why it cannot be reached. */
export type StoreLocation = { dir: string } | { absent: true } | { notHere: string } | { cannot: string };

/** The `defs/` directory this checkout's bean graph resolves to. */
export function locateStore(root: string): StoreLocation {
  const store = readBeanStore(root);
  switch (store.state) {
    case "read":
      return { dir: store.dir };
    case "absent":
      return { absent: true };
    case "declared-but-absent":
      return { cannot: `the bean graph declares ${store.dir} and it is not there` };
    case "unreachable":
      // Determined absent from this checkout (an instance with no bean store):
      // not applicable, never "could not determine" (smart-ips-pilgrimage#13).
      if (store.absent) return { notHere: store.reason };
      return { cannot: `${store.reason} Run \`bun run cat state:mount\`` };
  }
}

function argValue(argv: readonly string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  if (i >= 0) return argv[i + 1];
  const eq = argv.find((a) => a.startsWith(`${flag}=`));
  return eq?.slice(flag.length + 1);
}

function main(argv: readonly string[]): void {
  const check = argv.includes("--check");
  const paths = argv.includes("--print-paths");
  const quiet = paths || argv.includes("--quiet");
  const dirArg = argValue(argv, "--dir");
  let dir: string;
  if (dirArg !== undefined) {
    dir = resolve(dirArg);
    if (!existsSync(dir)) {
      console.error(`::error::beans-retag: ${dir} does not exist. NOT a pass — nothing was checked`);
      process.exit(2);
    }
  } else {
    // Anchored on the harness, never the CWD, as `check-bean-front-matter`
    // is and for the same reason (`a6kl`).
    const where = locateStore(repoRootFor(HARNESS_ROOT));
    if ("absent" in where) {
      if (!quiet) console.log("Bean tags — no bean store in this repository, nothing to check");
      process.exit(0);
    }
    if ("notHere" in where) exitNotApplicable("beans:retag", `this checkout has no bean store (${where.notHere})`);
    if ("cannot" in where) {
      console.error(`::error::beans-retag: ${where.cannot}. NOT a pass — nothing was checked`);
      process.exit(2);
    }
    dir = where.dir;
  }

  const r = retagDir(dir, { write: !check });
  // An empty store is nothing to tag, but under `--check` a pass over it would
  // be vacuous, so it fails there as `check-bean-front-matter` does.
  if (r.files === 0) {
    if (check) {
      console.error(`::error::beans-retag: ${dir} holds no bean files, so a pass here would be vacuous`);
      process.exit(1);
    }
    if (!quiet) console.log(`Bean tags — ${dir} holds no beans, nothing to tag`);
    process.exit(0);
  }
  for (const f of r.foreign) {
    console.error(`::error::beans-retag: ${f.file} carries \`$schema: ${f.tag}\`, which ${BEAN_SCHEMA_TAG} does not accept. Left as it is; fix it by hand`);
  }
  if (r.unfenced.length > 0 && !quiet) {
    console.log(`Skipped ${r.unfenced.length} file(s) with no front-matter fence (check-bean-front-matter reports them): ${r.unfenced.slice(0, 5).join(", ")}${r.unfenced.length > 5 ? ", …" : ""}`);
  }
  if (check) {
    if (r.added.length > 0) {
      const shown = r.added.slice(0, 10).join(", ");
      console.error(
        `::error::beans-retag: ${r.added.length} of ${r.files} bean(s) carry no \`$schema: ${BEAN_SCHEMA_TAG}\` ` +
          `(${shown}${r.added.length > 10 ? ", …" : ""}). Run \`${RETAG_COMMAND}\``,
      );
      process.exit(1);
    }
    if (!quiet) console.log(`Bean tags — all ${r.tagged} of ${r.files} bean(s) carry ${BEAN_SCHEMA_TAG}${r.foreign.length ? `, ${r.foreign.length} foreign` : ""}`);
    process.exit(r.foreign.length > 0 ? 1 : 0);
  }
  if (paths) {
    for (const f of r.added) console.log(join(dir, f));
  } else if (!quiet || r.added.length > 0) {
    console.log(`Bean tags — added ${BEAN_SCHEMA_TAG} to ${r.added.length} bean(s); ${r.tagged} already carried it (${dir})`);
  }
  process.exit(r.foreign.length > 0 ? 1 : 0);
}

if (import.meta.main) main(process.argv.slice(2));
