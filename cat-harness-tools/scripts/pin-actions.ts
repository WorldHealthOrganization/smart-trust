/**
 * Pin every third-party GitHub Action to a full commit SHA, keeping the
 * human-readable ref as a trailing comment: `uses: owner/repo@<sha> # v4`.
 *
 * A full-length SHA is the only immutable way to use an action: a tag can be
 * moved, and a branch is moved by design. Dependabot keeps a `@<sha> # <tag>`
 * pair current when the comment is on the same line, so pinning does not
 * freeze a version.
 *
 * ## Which workflows must pin
 *
 * Every workflow pins, except one listed in
 * {@link STAGING_ONLY_WORKFLOWS} that also passes {@link stagingExempt}: no
 * write permission, and no `pull_request_target` trigger. The list is a
 * reviewed one-line change, and the list alone never grants the exemption.
 *
 * **First-party reusable workflows** (`<this repo>/.github/workflows/x.yml@main`)
 * are not third-party code and are left as they are.
 *
 * ## Resolution is by `git ls-remote`, as argv, and it refuses rather than guesses
 *
 * A ref resolves to the PEELED commit of a tag (`refs/tags/v4^{}`) when the
 * tag is annotated, else the tag, else a branch head. A ref that resolves to
 * nothing, or to more than one commit, is REFUSED: the line is left unpinned
 * and reported.
 *
 * Usage:
 *   bun run cat actions:pin            # rewrite workflows in place
 *   bun run cat actions:pin --dry-run  # report what would change
 *   bun run cat actions:pin --verify-refs  # NETWORK: check each SHA is its `# <ref>`'s commit
 *
 * @graphNode tool
 * @covers none — .github/workflows/ is not a declared graph typology
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..", "..");

/**
 * Workflows that only ever build a staging preview: CANDIDATES for the
 * unpinned exemption, never granted it by name alone. See {@link stagingExempt}.
 */
export const STAGING_ONLY_WORKFLOWS: ReadonlySet<string> = new Set(["feature-staging.yml", "folio-staging.yml"]);

/**
 * May this workflow keep its actions unpinned? The owner's two rulings,
 * 2026-10-07: *"when published, make it unpinned on staging"*, and, once the
 * roast (bean `1ygp`, L4.1) showed `feature-staging.yml` holds `contents:
 * write` on `pull_request_target` and pushes to the branch that serves the
 * live site, *"pin write-token workflows"*.
 *
 * So the exemption is decided from what the workflow can DO, never from its
 * name: a listed staging workflow is exempt only when it has no
 * `pull_request_target` trigger (which runs with the base repository's token
 * and secrets) and grants no `write` permission anywhere. A file name is a
 * label anyone can give a publishing step.
 */
export function stagingExempt(file: string, text: string): boolean {
  if (!STAGING_ONLY_WORKFLOWS.has(file)) return false;
  // Anchored at line start, so a comment that mentions the trigger does not count.
  const privilegedTrigger = /^[ \t]*pull_request_target[ \t]*:/m.test(text);
  const writes = /^[ \t]*[a-z-]+[ \t]*:[ \t]*write\b/m.test(text) || /^[ \t]*permissions[ \t]*:[ \t]*write-all\b/m.test(text);
  return !privilegedTrigger && !writes;
}

/** This repository, whose own reusable workflows are first-party. */
export const FIRST_PARTY = "litlfred/folio-assistant";
/** First-party repositories whose reusable workflows are not third-party actions (bean 70lx moved layer-*.yml to cat-harness-tools). */
export const FIRST_PARTY_REPOS: ReadonlySet<string> = new Set([FIRST_PARTY, "litlfred/cat-harness-tools"]);

const SHA40 = /^[0-9a-f]{40}$/;
/** `uses:` as the key of a block line (`- uses: x`, `uses: "x"`). Group 1 = everything before the value, 2 = the value. */
const BLOCK_USES = /^(\s*-?\s*["']?uses["']?\s*:\s*["']?)([^\s"'#]+)/;
/**
 * `uses:` as a key INSIDE a flow mapping, `- {uses: owner/x@main, with: {…}}`.
 * The block form is anchored at the start of a line, so this one was
 * invisible to the pin check until bean `1ygp` L4.6. Group 1 = the value.
 */
const FLOW_USES = /[{,]\s*["']?uses["']?\s*:\s*["']?([^\s,}"'#]+)/;
/** `owner/repo[/path]@ref`. */
const ACTION_REF = /^([A-Za-z0-9_.-]+\/[A-Za-z0-9_./-]+)@([A-Za-z0-9_./-]+)$/;
/** The first token of a trailing YAML comment: ` # v4` gives `v4`. */
const COMMENT_REF = /\s#\s*(\S+)/;

/**
 * - `pinned`: a 40-hex SHA WITH a trailing `# <ref>` naming what it pins.
 * - `unpinned-unlabelled`: a 40-hex SHA with no such comment. Nobody can
 *   review which release a bare SHA is, and Dependabot, which reads the
 *   comment, cannot keep it current, so it blocks like an unpinned ref
 *   (bean `1ygp` L4.6). Whether the SHA really is that ref's commit needs the
 *   network: `actions:pin --verify-refs`, never the gate.
 * - `unpinned`: a tag, a branch or a short SHA.
 */
export type PinStatus = "pinned" | "unpinned" | "unpinned-unlabelled";

export interface UsesLine {
  action: string;
  ref: string;
  pinned: boolean;
  status: PinStatus;
  /** The ref the trailing comment names, when there is one. */
  label?: string;
  firstParty: boolean;
  /** Written as a key inside a `{…}` flow mapping. */
  flow: boolean;
}

/** The `uses:` value on one line, block or flow form, its position, and the comment after it. */
function usesValue(line: string): { value: string; start: number; end: number; flow: boolean; label?: string } | undefined {
  let value: string, start: number, flow: boolean;
  const block = BLOCK_USES.exec(line);
  if (block) {
    value = block[2]!;
    start = block[1]!.length;
    flow = false;
  } else {
    const f = FLOW_USES.exec(line);
    if (!f) return undefined;
    value = f[1]!;
    start = f.index + f[0].length - value.length;
    flow = true;
  }
  const end = start + value.length;
  return { value, start, end, flow, label: COMMENT_REF.exec(line.slice(end))?.[1] };
}

export function parseUses(line: string): UsesLine | undefined {
  const v = usesValue(line);
  if (!v) return undefined;
  const m = ACTION_REF.exec(v.value);
  if (!m) return undefined; // `./local`, `docker://…`, or no reference at all
  const action = m[1]!;
  const ref = m[2]!;
  const repo = action.split("/").slice(0, 2).join("/");
  const status: PinStatus = !SHA40.test(ref) ? "unpinned" : v.label ? "pinned" : "unpinned-unlabelled";
  return { action, ref, pinned: status === "pinned", status, label: v.label, firstParty: FIRST_PARTY_REPOS.has(repo), flow: v.flow };
}

export interface DockerUses {
  image: string;
  /** The `sha256:` digest, when the reference carries one. */
  digest?: string;
}

/**
 * A `uses: docker://image[:tag][@sha256:…]` step. A tag moves as easily as an
 * action's tag; only a digest is immutable. The gate reports an undigested
 * image as ADVISORY: none exist in `.github/workflows/` (measured 2026-10-07),
 * and a digest has no `git ls-remote` to resolve it from, so pinning one is
 * not the mechanical rewrite `actions:pin` performs.
 */
export function parseDockerUses(line: string): DockerUses | undefined {
  const v = usesValue(line);
  if (!v || !v.value.startsWith("docker://")) return undefined;
  const ref = v.value.slice("docker://".length);
  const m = /^([^@]+)@(sha256:[0-9a-f]{64})$/.exec(ref);
  return m ? { image: m[1]!, digest: m[2]! } : { image: ref };
}

/** `line` with its `uses:` value replaced by `<action>@<sha>` and its trailing comment by `# <ref>`. */
export function rewriteUses(line: string, action: string, sha: string, ref: string): string {
  const v = usesValue(line);
  if (!v) return line;
  let rest = line.slice(v.end);
  const hash = /\s#/.exec(rest);
  if (hash) rest = rest.slice(0, hash.index);
  return `${line.slice(0, v.start)}${action}@${sha}${rest.trimEnd()} # ${ref}`;
}

/** Resolve `ref` of `owner/repo` to one commit SHA, or explain why not. */
export function resolveRef(repo: string, ref: string, lsRemote = defaultLsRemote): { sha: string } | { refused: string } {
  let out: string;
  try {
    out = lsRemote(repo, ref);
  } catch (e) {
    return { refused: `ls-remote failed: ${String(e).split("\n")[0]}` };
  }
  const rows = out.split("\n").filter(Boolean).map((l) => l.split("\t") as [string, string]);
  const pick = (name: string) => rows.filter(([, r]) => r === name).map(([s]) => s);
  for (const candidate of [`refs/tags/${ref}^{}`, `refs/tags/${ref}`, `refs/heads/${ref}`]) {
    const shas = [...new Set(pick(candidate))];
    if (shas.length === 1 && SHA40.test(shas[0]!)) return { sha: shas[0]! };
    if (shas.length > 1) return { refused: `${candidate} names ${shas.length} commits` };
  }
  return { refused: `no tag or branch named ${ref}` };
}

const REF_LISTS = new Map<string, string>();
/**
 * Every ref of `repo`, fetched once per run. A pattern argument cannot be used:
 * `git ls-remote <url> refs/tags/v5^{}` matches nothing, so a pattern query
 * silently loses the PEELED commit of an annotated tag and pins the tag OBJECT
 * instead. Measured 2026-10-07 on googleapis/release-please-action v5.
 */
function defaultLsRemote(repo: string, _ref: string): string {
  if (!REF_LISTS.has(repo)) {
    REF_LISTS.set(repo, execFileSync("git", ["ls-remote", `https://github.com/${repo}`], { encoding: "utf-8", timeout: 60_000, maxBuffer: 64 * 1024 * 1024 }));
  }
  return REF_LISTS.get(repo)!;
}

export interface PinResult {
  file: string;
  pinned: number;
  refused: string[];
}

export function pinWorkflows(root = ROOT, opts: { dryRun?: boolean; lsRemote?: typeof defaultLsRemote } = {}): PinResult[] {
  const dir = join(root, ".github", "workflows");
  if (!existsSync(dir)) return [];
  const cache = new Map<string, { sha: string } | { refused: string }>();
  const results: PinResult[] = [];
  for (const f of readdirSync(dir).filter((n) => /\.ya?ml$/.test(n)).sort()) {
    const path = join(dir, f);
    const text = readFileSync(path, "utf-8");
    if (stagingExempt(f, text)) continue;
    const lines = text.split("\n");
    const r: PinResult = { file: f, pinned: 0, refused: [] };
    lines.forEach((line, i) => {
      const u = parseUses(line);
      if (!u || u.pinned || u.firstParty) return;
      if (u.status === "unpinned-unlabelled") {
        // The ref this SHA pins is written nowhere, and recovering it from the
        // SHA would be a guess, so the line is reported rather than repaired.
        r.refused.push(`${f}:${i + 1} ${u.action}@${u.ref} — unpinned-unlabelled: add \`# <ref>\` naming the tag or branch this SHA pins`);
        return;
      }
      const repo = u.action.split("/").slice(0, 2).join("/");
      const key = `${repo}@${u.ref}`;
      if (!cache.has(key)) cache.set(key, resolveRef(repo, u.ref, opts.lsRemote));
      const res = cache.get(key)!;
      if ("refused" in res) {
        r.refused.push(`${f}:${i + 1} ${u.action}@${u.ref} — ${res.refused}`);
        return;
      }
      lines[i] = rewriteUses(line, u.action, res.sha, u.ref);
      r.pinned++;
    });
    if (r.pinned > 0 && !opts.dryRun) writeFileSync(path, lines.join("\n"));
    if (r.pinned > 0 || r.refused.length > 0) results.push(r);
  }
  return results;
}

/**
 * Does each pinned SHA really name the commit its `# <ref>` comment says?
 * Opt-in (`--verify-refs`) because it needs the network: the gate checks only
 * that a SHA and a label are present, which a checkout can answer offline.
 * Every pinned third-party line is checked, exempt staging workflows included,
 * since a wrong label there misleads a reviewer as much as anywhere. A ref
 * that cannot be resolved is a finding, never a pass.
 */
export function verifyRefs(root = ROOT, opts: { lsRemote?: typeof defaultLsRemote } = {}): { checked: number; mismatched: string[] } {
  const dir = join(root, ".github", "workflows");
  if (!existsSync(dir)) return { checked: 0, mismatched: [] };
  const cache = new Map<string, { sha: string } | { refused: string }>();
  const mismatched: string[] = [];
  let checked = 0;
  for (const f of readdirSync(dir).filter((n) => /\.ya?ml$/.test(n)).sort()) {
    readFileSync(join(dir, f), "utf-8").split("\n").forEach((line, i) => {
      const u = parseUses(line);
      if (!u || !u.pinned || u.firstParty || !u.label) return;
      checked++;
      const repo = u.action.split("/").slice(0, 2).join("/");
      const key = `${repo}@${u.label}`;
      if (!cache.has(key)) cache.set(key, resolveRef(repo, u.label, opts.lsRemote));
      const res = cache.get(key)!;
      if ("refused" in res) mismatched.push(`${f}:${i + 1} ${u.action}@${u.ref} # ${u.label} — could not verify: ${res.refused}`);
      else if (res.sha !== u.ref) mismatched.push(`${f}:${i + 1} ${u.action}@${u.ref} # ${u.label} — ${u.label} is ${res.sha}`);
    });
  }
  return { checked, mismatched };
}

if (import.meta.main && process.argv.includes("--verify-refs")) {
  const { checked, mismatched } = verifyRefs(ROOT);
  for (const x of mismatched) console.log(`✗ ${x}`);
  console.log(`\nverified ${checked} pinned uses: against their # <ref>; ${mismatched.length} mismatched or unverifiable.`);
  process.exit(mismatched.length > 0 ? 1 : 0);
}

if (import.meta.main) {
  const dryRun = process.argv.includes("--dry-run");
  const results = pinWorkflows(ROOT, { dryRun });
  let pinned = 0;
  const refused: string[] = [];
  for (const r of results) {
    pinned += r.pinned;
    refused.push(...r.refused);
    if (r.pinned) console.log(`${dryRun ? "would pin" : "pinned"} ${r.pinned} in ${r.file}`);
  }
  for (const x of refused) console.log(`✗ refused ${x}`);
  console.log(`\n${dryRun ? "would pin" : "pinned"} ${pinned}; refused ${refused.length}. Exempt (staging-only, no write token, no pull_request_target): ${[...STAGING_ONLY_WORKFLOWS].filter((f) => stagingExempt(f, readFileSync(join(ROOT, ".github", "workflows", f), "utf-8"))).join(", ") || "none"}.`);
  process.exit(refused.length > 0 ? 1 : 0);
}
