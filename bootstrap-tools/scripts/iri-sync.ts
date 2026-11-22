#!/usr/bin/env bun
/**
 * iri-sync.ts — keep every literal copy of a layer's release IRIs at the
 * major version its declaration states.
 *
 * ## Why a sync, when everything else is derived
 *
 * `release-iri.ts` derives a layer's addresses from `iriBase` and
 * `version`, and every generator and template asks it rather than spelling
 * one out. Some copies cannot ask: an `xmlns` attribute in a BPMN file, a
 * value in a code list, a fixture string in a test. Those are literal by
 * nature. This keeps them at the declared major, so a breaking release — or
 * moving the address, in a fork — is ONE edit to the declaration and one run.
 * A minor or patch release changes no address at all (`release-iri.ts`).
 *
 * ## The rewrites
 *
 * For each layer declaring `iriBase` (see `releaseIris`):
 *
 * - `<iriBase><any semver>/` → `<iriBase>v<major>/` — a full-version form,
 *   the declared version's own included: no address carries a full version
 * - `<iriBase>v<other major>/` → `<iriBase>v<major>/`
 * - with `--from <old base>` (a one-time move): `<old base><path>` →
 *   `<iriBase>v<major>/<path>`. Only for a move; `--check` never needs it.
 *
 * `beans/` is left alone: a bean records what was true when it was written,
 * and rewriting history to today's address would make it say something it
 * never said.
 *
 * ```sh
 * bun run iri:sync                     # rewrite stale copies
 * bun run iri:sync:check               # fail on any (CI, gates)
 * bun run iri:sync -- --from https://old.example/base/   # move the base
 * ```
 *
 * @module scripts/iri-sync
 * @covers computed — every declared Knowledge Graph's text files that carry an instance's release IRI (`knowledgeGraphsIn`)
 */
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { knowledgeGraphsIn } from "../schemas/declaration.ts";
import { gitFiles } from "./git-files.ts";
import { gateOwnsFile } from "./gate-own.ts";
import { type ReleaseIris, releaseIris } from "../schemas/release-iri.ts";

/** Text a person or program reads; binaries and lockfiles are never IRI carriers here. */
const TEXT = /\.(bpmn|dmn|json|jsonld|ts|md|xml|svg|liquid|html|ya?ml|pot|po|ttl|txt)$/;
/** Paths never rewritten, with the reason in the module header. */
const SKIP = [/^beans\//, /(^|\/)node_modules\//];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** One file's text rewritten to `r`, and how many copies changed. */
export function rewrite(text: string, r: ReleaseIris, from?: string): { text: string; changes: number } {
  let changes = 0;
  const base = esc(r.iriBase);
  // A full version is never current: the address carries the major alone.
  let out = text.replace(new RegExp(`${base}\\d+\\.\\d+\\.\\d+/`, "g"), () => {
    changes++;
    return r.agent;
  });
  out = out.replace(new RegExp(`${base}v(\\d+)/`, "g"), (m, v: string) => {
    if (Number(v) === r.major) return m;
    changes++;
    return r.agent;
  });
  if (from) {
    const old = from.endsWith("/") ? from : `${from}/`;
    // Only an old address followed by a path: the bare base, a page to read,
    // is not an identifier, and where it should now point is a person's call.
    out = out.replace(new RegExp(`${esc(old)}(?=[A-Za-z0-9_])`, "g"), () => {
      changes++;
      return r.agent;
    });
  }
  return { text: out, changes };
}

/** Every layer that declares an `iriBase`, with its release. */
export function releases(repoRoot: string): { root: string; release: ReleaseIris }[] {
  const out: { root: string; release: ReleaseIris }[] = [];
  for (const { root, decl } of knowledgeGraphsIn(repoRoot)) {
    const r = releaseIris(decl);
    if (r) out.push({ root, release: r });
  }
  return out;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const fromAt = args.indexOf("--from");
  const from = fromAt >= 0 ? args[fromAt + 1] : undefined;
  // `--repo <dir>`: the checkout to keep in step; this one by default.
  const repoAt = args.indexOf("--repo");
  const repo = repoAt >= 0 && args[repoAt + 1] ? args[repoAt + 1]! : join(import.meta.dir, "..", "..");
  const rels = releases(repo);
  if (rels.length === 0) {
    console.log("No instance declares an iriBase; nothing to keep in step.");
    process.exit(0);
  }
  if (from && rels.length !== 1) {
    console.error(`--from moves ONE instance's base, and ${rels.length} declare one. Name it by editing only that declaration first.`);
    process.exit(2);
  }
  // The whole checkout when it is one repository (the monorepo, where
  // a harness's literal citations of bootstrap's IRIs are kept in step too);
  // otherwise each declaring layer's own repository — the standalone case,
  // where bootstrap and bootstrap-tools are sibling clones in a directory that
  // is not itself a repository (found by `rehearse-standalone`).
  const perRoot = () => {
    const each = rels.map(({ root }) => gitFiles(root));
    return each.every((f) => f !== undefined) ? [...new Set(each.flat() as string[])] : undefined;
  };
  const files = gitFiles(repo) ?? perRoot();
  if (!files) {
    console.error("git could not list the corpus, so nothing was checked — that is not a pass.");
    process.exit(2);
  }
  const stale: string[] = [];
  let total = 0;
  // In a layer's PR checks, only the caller's own files (owner ruling
  // 2026-11-05, "Move the checks"; `gate-own.ts`): a mounted layer's stale
  // copy is that layer's to rewrite, in its own CI. Counted, never charged.
  let others = 0;
  for (const abs of files) {
    const rel = relative(repo, abs);
    if (!TEXT.test(rel) || SKIP.some((re) => re.test(rel))) continue;
    let st;
    try {
      st = statSync(abs);
    } catch {
      continue;
    }
    if (!st.isFile() || st.size > 8_000_000) continue;
    const before = readFileSync(abs, "utf-8");
    let text = before;
    let n = 0;
    for (const { release } of rels) {
      const r = rewrite(text, release, from);
      text = r.text;
      n += r.changes;
    }
    if (n === 0) continue;
    if (check && gateOwnsFile(rel) === false) {
      others++;
      continue;
    }
    if (!check) {
      total += n;
      stale.push(`${rel} (${n})`);
      writeFileSync(abs, text);
      continue;
    }
    total += n;
    stale.push(`${rel} (${n})`);
  }
  for (const { root, release } of rels) {
    console.log(`${relative(repo, root) || "."}: ${release.agent} (${release.version})`);
  }
  if (others > 0) console.log(`· ${others} file(s) of other layers carry a stale IRI — not this caller's; their own CI judges them`);
  if (stale.length === 0) {
    console.log("✓ every literal release IRI is at its declared major.");
    process.exit(0);
  }
  console.log(`${check ? "✗ stale" : "rewrote"}: ${total} IRI(s) in ${stale.length} file(s)`);
  for (const s of stale.sort()) console.log(`  · ${s}`);
  if (check) {
    console.log("Run `bun run iri:sync` and commit.");
    process.exit(1);
  }
}
