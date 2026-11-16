/**
 * List the paths one GitLab merge request changes, one per line.
 *
 * The implementation of the `gitlab-mr-files` Tool. `glab` has no
 * `--name-only` (`gh pr diff --name-only` is the GitHub twin), so this runs
 * `glab mr diff --raw` with an argument array and reads the paths out of the
 * diff: the `+++ b/` side of each file, the `--- a/` side when the file was
 * deleted, and the `diff --git` header when a file has no hunks (a pure
 * rename, a mode change, a binary file). Git's quoted form of an unusual path
 * (`"b/a\tb"`) is unquoted.
 *
 * The merge request number is parsed as a positive integer before `glab` runs.
 *
 * Usage: bun run cat gitlab:mr-files [<number>]
 *
 * @module scripts/gitlab-mr-files
 */
import { spawnSync } from "node:child_process";

/** The `glab` argument array. Absent number: the merge request of the current branch. */
export function mrFilesArgv(number?: string): string[] {
  if (number === undefined) return ["mr", "diff", "--raw", "--color", "never"];
  if (!/^[1-9][0-9]{0,9}$/.test(number)) throw new Error(`not a merge request number: ${JSON.stringify(number)}`);
  return ["mr", "diff", number, "--raw", "--color", "never"];
}

const ESCAPES: Record<string, string> = { n: "\n", t: "\t", '"': '"', "\\": "\\", a: "\x07", b: "\b", f: "\f", r: "\r", v: "\v" };

/** A path as git writes it in a diff: bare, or C-quoted with octal bytes for non-ASCII. */
export function unquote(p: string): string {
  if (!(p.startsWith('"') && p.endsWith('"') && p.length >= 2)) return p;
  const bytes: number[] = [];
  const body = p.slice(1, -1);
  for (let i = 0; i < body.length; i++) {
    const c = body[i]!;
    if (c !== "\\") {
      bytes.push(...Buffer.from(c, "utf-8"));
      continue;
    }
    const n = body[i + 1] ?? "";
    const oct = /^[0-7]{3}/.exec(body.slice(i + 1));
    if (oct) {
      bytes.push(parseInt(oct[0], 8));
      i += 3;
    } else {
      bytes.push(...Buffer.from(ESCAPES[n] ?? n, "utf-8"));
      i += 1;
    }
  }
  return Buffer.from(bytes).toString("utf-8");
}

/** Strip a diff side's `a/` or `b/` prefix; null for /dev/null. */
function side(raw: string, prefix: "a/" | "b/"): string | null {
  const p = unquote(raw.replace(/\t.*$/, ""));
  if (p === "/dev/null") return null;
  return p.startsWith(prefix) ? p.slice(prefix.length) : p;
}

/** The b-side path of a `diff --git a/X b/Y` header, for a file with no hunks. */
function headerPath(rest: string): string | null {
  const quoted = /^(?:"(?:[^"\\]|\\.)*"|\S+) ("(?:[^"\\]|\\.)*")$/.exec(rest);
  if (quoted) return side(quoted[1]!, "b/");
  // Unquoted: a/X b/X. When the two halves match, the split is unambiguous.
  const half = (rest.length - 1) / 2;
  if (Number.isInteger(half) && rest.slice(2, half) === rest.slice(half + 3)) return rest.slice(half + 3);
  const at = rest.lastIndexOf(" b/");
  return at >= 0 ? rest.slice(at + 3) : null;
}

/** The changed paths of a raw unified diff, in order, each once. */
export function diffPaths(diff: string): string[] {
  const out: string[] = [];
  let header: string | null = null;
  let minus: string | null = null;
  let found = false;
  // Inside a hunk, a removed line "-- x" reads "--- x": only the lines before
  // a file's first "@@" are its ---/+++ header.
  let inHunk = false;
  const flush = () => {
    if (header !== null && !found) {
      const p = headerPath(header);
      if (p !== null) out.push(p);
    }
  };
  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git ")) {
      flush();
      header = line.slice("diff --git ".length);
      minus = null;
      found = false;
      inHunk = false;
    } else if (line.startsWith("@@")) {
      inHunk = true;
    } else if (inHunk) {
      continue;
    } else if (line.startsWith("--- ")) {
      minus = side(line.slice(4), "a/");
    } else if (line.startsWith("+++ ")) {
      const plus = side(line.slice(4), "b/");
      const p = plus ?? minus;
      if (p !== null) out.push(p);
      found = true;
      if (header === null) header = "";
    }
  }
  flush();
  return [...new Set(out)];
}

if (import.meta.main) {
  if (process.argv.length > 3) {
    console.error("usage: bun run cat gitlab:mr-files [<number>]");
    process.exit(2);
  }
  let argv: string[];
  try {
    argv = mrFilesArgv(process.argv[2]);
  } catch (e) {
    console.error((e as Error).message);
    process.exit(2);
  }
  const r = spawnSync("glab", argv, { encoding: "utf-8", maxBuffer: 256 * 1024 * 1024 });
  if (r.error) {
    console.error(`could not run glab: ${r.error.message}`);
    process.exit(127);
  }
  if (r.status !== 0) {
    process.stderr.write(r.stderr ?? "");
    process.exit(r.status ?? 1);
  }
  for (const p of diffPaths(r.stdout)) console.log(p);
}
