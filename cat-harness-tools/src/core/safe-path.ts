/**
 * Path containment — the one place a value from outside becomes a path.
 *
 * Bean `6bhf`. This module exists because the correct answer was already in the
 * repository and stranded: `scripts/serve-rendering.ts` carried `resolveWithin`
 * and `resolveFile`, documented down to the test that caught a symlink escape,
 * while three HTTP handlers in `adapters/mcp-server/server.ts` hand-rolled
 * `join(base, externalValue)`. That is `1wef`'s shape exactly — *"somebody had
 * understood this hazard exactly. Nothing checked it, so the correctness was one
 * edit from gone."*
 *
 * ## Two functions because there are two questions
 *
 * They look similar and are not interchangeable, so collapsing them is a defect
 * rather than a tidy-up:
 *
 * | you have | you want | use |
 * |---|---|---|
 * | a **URL path** (`/a/b/c.html`), possibly percent-encoded | the file it names inside a root | `resolveWithin` / `resolveFile` |
 * | a **single identifier** (`paperId`, a slug, a bean id) | one path segment, or a refusal | `safeSegment` |
 *
 * `resolveWithin` leans on a URL pathname beginning with `/`, so `normalize`
 * absorbs leading `..` against the root. An identifier has no such leading
 * slash, and `a/b` passed to it resolves to a perfectly contained *nested* path
 * — which is wrong when the caller meant one directory. `safeSegment` refuses
 * it instead.
 *
 * ## Refuse, never repair
 *
 * Every function here returns `undefined` on a bad value rather than sanitising
 * it. Sanitising is what produced `fuzm`: the staging slug pipeline REPLACES
 * disallowed characters, so input `..` survives as output `..`, and input `---`
 * collapses to the empty string. A repair silently changes which artefact is
 * named; a refusal makes the caller decide, and the caller is the only one who
 * knows whether that is a 400, an exit 1, or a skip.
 */
import { realpathSync, statSync } from "node:fs";
import { join, normalize, resolve, sep } from "node:path";

/**
 * `id` as a single safe path segment, or `undefined`.
 *
 * **The check `paperId` needed and did not have.** Measured 2026-09-25: three
 * routes in the MCP server took an external `paperId` straight into `join()`,
 * giving a write primitive outside the uploads and feedback stores.
 *
 * Refused, and each for its own reason rather than as one blanket rule:
 *
 * - **empty** — names nothing, and `join(base, "")` is `base` itself, so an
 *   empty id makes a per-item operation act on the whole store. This is the
 *   `plj1` shape one layer down: `rm -rf "pages/branches/$SLUG"` with an empty
 *   slug deleted every preview.
 * - **`.` and `..`** — name a directory rather than an item, and `..` escapes.
 * - **a separator** (`/` or `\`) — `a/b` is contained but is not ONE segment,
 *   and Windows accepts `\` where POSIX does not, so both are refused
 *   regardless of host.
 * - **NUL** — truncates the path for some syscalls, so what the check sees and
 *   what the kernel opens differ. No legitimate identifier carries one.
 *
 * Leading dots are otherwise allowed: `.beans.yml` and `.github` are real names
 * here, and a blanket dot ban would refuse them while catching nothing `..`
 * does not already cover.
 */
export function safeSegment(id: string | null | undefined): string | undefined {
  if (typeof id !== "string") return undefined;
  if (id.length === 0 || id === "." || id === "..") return undefined;
  if (id.includes("/") || id.includes("\\") || id.includes("\0")) return undefined;
  return id;
}

/**
 * `join(root, ...segments)` where every segment is checked, or `undefined`.
 *
 * The convenience the three defective call sites wanted: one call that cannot
 * be got wrong by forgetting the check on the second argument. `feedbackPath`
 * took TWO external values — `paperId` and `rootName` — and validated neither.
 */
export function joinSegments(root: string, ...segments: (string | null | undefined)[]): string | undefined {
  const safe: string[] = [];
  for (const s of segments) {
    const ok = safeSegment(s);
    if (ok === undefined) return undefined;
    safe.push(ok);
  }
  return join(root, ...safe);
}

/**
 * Resolve a URL path to a path inside `root`, or `undefined` if it cannot be.
 *
 * **Lexical containment only — this is half the check, and the weaker half.**
 * A URL pathname always begins with `/`, so `normalize` absorbs leading `..`
 * segments against the root and `%2e%2e` decodes to the same thing before it
 * is normalised. Traversal by spelling therefore cannot escape here; what it
 * produces is a path inside the root that usually does not exist.
 *
 * It does NOT catch a symlink, because `resolve` is pure string arithmetic and
 * never touches the filesystem. `resolveFile` does that part, and the split is
 * deliberate: this function is total and testable without a disk, and the check
 * that needs a disk is where the disk is already being read.
 *
 * Moved here from `scripts/serve-rendering.ts` unchanged.
 */
export function resolveWithin(root: string, urlPath: string): string | undefined {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    // A malformed percent-escape is a bad request, not a traversal attempt,
    // but either way there is no file it can name.
    return undefined;
  }
  // A NUL byte truncates the path for some syscalls; no legitimate URL has one.
  if (decoded.includes("\0")) return undefined;
  const base = resolve(root);
  const target = resolve(join(base, normalize(decoded)));
  if (target !== base && !target.startsWith(base + sep)) return undefined;
  return target;
}

/**
 * The real path of `candidate` if it is inside `root` after following links,
 * or `undefined`.
 *
 * **The `realpath` half, and the one an escape actually needs.** The comment on
 * `serve-rendering.ts`'s `resolveFile` records that its own test got **200**
 * from the first version by pointing a link inside the root at a file outside
 * it: the lexical check sees a clean path and the escape happens entirely in
 * the filesystem.
 *
 * Returns `undefined` when nothing is there, so the caller owns the 404 — a
 * resolver that invented an error response would be two things.
 */
export function realPathWithin(root: string, candidate: string): string | undefined {
  let real: string;
  let base: string;
  try {
    real = realpathSync(candidate);
    base = realpathSync(resolve(root));
  } catch {
    return undefined;
  }
  if (real !== base && !real.startsWith(base + sep)) return undefined;
  return real;
}

/**
 * Whether `candidate` is a directory inside `root` after following links.
 *
 * For the case where a path is about to be written INTO rather than read: the
 * target may not exist yet, so `realPathWithin` on it would fail for the wrong
 * reason. The nearest existing ancestor is what carries the symlink risk.
 */
export function writableWithin(root: string, candidate: string): boolean {
  const lexical = resolve(candidate);
  const base = resolve(root);
  if (lexical !== base && !lexical.startsWith(base + sep)) return false;
  // Walk up to the nearest ancestor that exists and check THAT for links: a
  // path whose parent is a symlink out of the root is outside it, however
  // contained the string looks.
  let probe = lexical;
  for (;;) {
    try {
      statSync(probe);
      break;
    } catch {
      const parent = resolve(probe, "..");
      if (parent === probe) return false;
      probe = parent;
    }
  }
  return realPathWithin(root, probe) !== undefined;
}
