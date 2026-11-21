/**
 * A generic markdown link auditor — parse, classify, resolve, report.
 *
 * @module src/core/markdown-links
 *
 * Bean `cp3l`. This is the half of `pipeline/readme-links.ts` that
 * was never about a README: given some markdown and somewhere to resolve
 * against, it says which links are dead, which resolved, and which it could
 * not check. It works on `AGENTS.md`, a skill, a workflow page or a README,
 * and it knows about none of them.
 *
 * It lived in core because its first caller did, and that cost a wrong
 * direction one layer out — a harness check auditing a harness file had to
 * reach into core to do it. `pipeline/readme-links.ts` keeps what is
 * genuinely README-shaped: the declared-asset lookup, the `README.md`
 * default, the config, and the CLI.
 *
 * ## What "checked" means, and the third state
 *
 * A link is only reported dead when this could actually look. A relative path
 * is resolved against the working tree; a link naming one of the repo's own
 * refs is resolved against a real `git ls-tree` of that ref; a GitHub Pages
 * URL under the configured `pagesBaseUrl` is resolved against the publish
 * ref, because that is the branch the site is served from.
 *
 * Everything else — an external host, a bare `#anchor`, a `mailto:` — is
 * **unchecked**, and so is any repo ref this checkout cannot read. Unchecked
 * is reported separately and never counted as dead: not-looked-at must not
 * read as nothing-found.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { ownerRepo, publishedPaths } from "./git-refs";

// ── Findings ────────────────────────────────────────────────────────────────

export interface LinkRef {
  /** 1-based line in the source file. */
  line: number;
  /** The link text, for identifying the row a reader must fix. */
  text: string;
  /** The raw target as written. */
  target: string;
}

export interface DeadLink extends LinkRef {
  /** What was looked for and where. */
  reason: string;
}

export interface AuditResult {
  checked: number;
  ok: number;
  dead: DeadLink[];
  /**
   * Links to a path a layer has MOVED, resolved at its new place through
   * that layer's declared `moves` (sdlc skill `two-phase-move`). Counted
   * as resolved while the move's window is open; each is still to switch.
   */
  moved: Array<LinkRef & { to: string; move: string }>;
  /** Why links were not checked, and how many of each. */
  unchecked: Record<string, number>;
}

// ── Parsing ─────────────────────────────────────────────────────────────────

/**
 * Blank out fenced code blocks, preserving line count.
 *
 * A README's shell examples are full of brackets and parentheses, and a
 * command is not a link. Blanking rather than deleting keeps every reported
 * line number pointing at the line a reader will actually open.
 */
function stripFences(src: string): string[] {
  const lines = src.split("\n");
  let inFence = false;
  return lines.map((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return "";
    }
    return inFence ? "" : line;
  });
}

/**
 * Every link in the file — Markdown **and HTML**.
 *
 * Markdown: inline `[text](target)`, images `![alt](src)` (a broken image is a
 * broken link, and the one thing a reader cannot miss), and reference
 * definitions `[id]: target`.
 *
 * HTML: `<img src>` and `<a href>`. **These were invisible until 2026-09-19 and
 * that is bean `t373`.** After the site root moved to `docs/<stub>/`, eight
 * README paths were dead; this function saw five of them. The three it missed
 * were the `<img src>` BPMN diagrams at the TOP of the README — so a reader met
 * three broken images on the front page while the tool that exists to prevent
 * exactly that reported the file as having five problems, none of them those.
 *
 * Silent omission is worse than the unwired gate the same bean records, because
 * it survives wiring the gate up: the check goes green and the images stay
 * broken. A whole syntax the checker cannot see is not a `not checked` third
 * state — it is not a state at all, which is the one outcome this repository's
 * conventions never allow.
 *
 * Markdown permits raw HTML, so this is not an exotic case; it is how anybody
 * sets an image width. README carries three such links today (measured
 * 2026-09-19) and zero `<a href>`, but both are parsed — an `<a>` added later
 * must not reintroduce the hole.
 */
export function parseLinks(src: string): LinkRef[] {
  const out: LinkRef[] = [];
  const lines = stripFences(src);

  lines.forEach((line, i) => {
    // Inline: [text](target) or [text](target "title"). The target stops at
    // whitespace so a title does not become part of the path.
    for (const m of line.matchAll(/!?\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g)) {
      out.push({ line: i + 1, text: m[1], target: m[2] });
    }
    // Reference definition: [id]: target
    const def = line.match(/^\s{0,3}\[([^\]]+)\]:\s*(\S+)/);
    if (def) out.push({ line: i + 1, text: def[1], target: def[2] });

    // `@path` on a line of its own — the CLI IMPORT directive, and the only
    // reference a thin stub carries. `CLAUDE.md` and `GEMINI.md` here are
    // four lines each whose whole content is `@AGENTS.md`; before this, the
    // audit read them as "0 links checked, 0 dead", which is a clean result
    // over a file it had not checked at all. Rename `AGENTS.md` and both
    // stubs point at nothing while the gate stays green — a determined empty
    // and a could-not-determine wearing the same face, which is the failure
    // this repository names everywhere else.
    //
    // WHOLE-LINE and extension-bearing, deliberately narrow: `@handle` in
    // prose, an email, and a decorator are all `@`-prefixed, and a checker
    // that reported those as dead links would be switched off within a day.
    const inc = line.match(/^\s*@([^\s@]+\.[A-Za-z0-9]+)\s*$/);
    if (inc) out.push({ line: i + 1, text: "@import", target: inc[1] });

    // HTML `<img src>` and `<a href>`, single- or double-quoted. Attribute
    // order varies (`<img width="700" src="…">` is the README's own form), so
    // the attribute is matched wherever it sits in the tag rather than
    // positionally.
    for (const m of line.matchAll(/<img\b[^>]*?\bsrc\s*=\s*("([^"]*)"|'([^']*)')/gi)) {
      const target = m[2] ?? m[3] ?? "";
      if (target !== "") out.push({ line: i + 1, text: "<img>", target });
    }
    for (const m of line.matchAll(/<a\b[^>]*?\bhref\s*=\s*("([^"]*)"|'([^']*)')/gi)) {
      const target = m[2] ?? m[3] ?? "";
      if (target !== "") out.push({ line: i + 1, text: "<a>", target });
    }
  });
  return out;
}

// ── Resolution ──────────────────────────────────────────────────────────────

/** Strip the fragment and query, and percent-decode, leaving a repo path. */
function toPath(target: string): string {
  const bare = target.split("#")[0].split("?")[0];
  try {
    return decodeURIComponent(bare);
  } catch {
    return bare;
  }
}

/**
 * Whether `path` names a file or a directory in a flat listing.
 *
 * `git ls-tree -r` lists files only, so a directory exists exactly when
 * something sits under it — which is what a `tree/` link points at.
 */
function inListing(listing: Set<string>, path: string): boolean {
  const clean = path.replace(/^\/+|\/+$/g, "");
  if (clean === "") return true; // the root of the ref
  if (listing.has(clean)) return true;
  if (listing.has(`${clean}/index.html`)) return true;
  const prefix = `${clean}/`;
  for (const entry of listing) if (entry.startsWith(prefix)) return true;
  return false;
}

interface Classified {
  kind: "worktree" | "ref" | "unchecked";
  path?: string;
  ref?: string;
  reason?: string;
}

/**
 * Decide what, if anything, a target can be checked against.
 *
 * Exported because the classification *is* the interesting logic — a test
 * that a Pages URL resolves against the publish ref is worth more than one
 * asserting the reporter's wording.
 */
export function classify(
  target: string,
  opts: { repoUrl?: string; pagesBaseUrl?: string; publishRef: string },
): Classified {
  if (target.startsWith("#")) return { kind: "unchecked", reason: "in-page anchor" };
  if (/^[a-z][a-z0-9+.-]*:/i.test(target) && !/^https?:/i.test(target)) {
    return { kind: "unchecked", reason: "non-http scheme" };
  }

  if (/^https?:/i.test(target)) {
    const repo = opts.repoUrl?.replace(/\/$/, "");
    if (repo) {
      // github.com/<owner>/<repo>/blob|tree|raw/<ref>/<path>
      const esc = repo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const m = target.match(new RegExp(`^${esc}/(?:blob|tree|raw)/([^/]+)/(.*)$`));
      if (m) return { kind: "ref", ref: decodeURIComponent(m[1]), path: toPath(m[2]) };

      const slug = ownerRepo(repo);
      if (slug) {
        const rawM = target.match(
          new RegExp(`^https?://raw\\.githubusercontent\\.com/${slug}/([^/]+)/(.*)$`),
        );
        if (rawM) return { kind: "ref", ref: decodeURIComponent(rawM[1]), path: toPath(rawM[2]) };
      }
    }

    const pages = opts.pagesBaseUrl?.replace(/\/$/, "");
    if (pages && target.startsWith(pages)) {
      // The Pages site is served from the publish ref, so that listing is the
      // authority on whether the URL resolves.
      return { kind: "ref", ref: opts.publishRef, path: toPath(target.slice(pages.length)) };
    }

    return { kind: "unchecked", reason: "external URL (not fetched)" };
  }

  return { kind: "worktree", path: toPath(target) };
}

// ── The audit ───────────────────────────────────────────────────────────────

export function auditLinks(
  root: string,
  src: string,
  opts: {
    repoUrl?: string;
    pagesBaseUrl?: string;
    publishRef: string;
    fetch?: boolean;
    /**
     * What a relative link is relative TO — the directory holding the file
     * being audited. Defaults to `root`, which is what it meant while the
     * README sat in the layer.
     *
     * The two parted at the move (bean `wggr`): this layer's README is
     * declared `scope: "repository"` and sits one directory above `root`, so
     * every worktree link in it was resolved one level too deep and 25 of 25
     * came back dead. `root` still answers the OTHER question this function
     * asks — which checkout to run `git ls-tree` in — which is why they are
     * two parameters rather than one renamed.
     */
    base?: string;
    /**
     * Where a worktree path that does not exist resolves through a declared
     * move whose window is open, or `undefined` — `resolveThroughMove` over
     * `declaredMoves`, in `scripts/check-subgraphs.ts`. Absent: no move is
     * honoured.
     */
    resolveMoved?: (abs: string) => { resolved: string; move: string } | undefined;
  },
): AuditResult {
  const base = opts.base ?? root;
  const dead: DeadLink[] = [];
  const moved: AuditResult["moved"] = [];
  const unchecked: Record<string, number> = {};
  let ok = 0;
  let checked = 0;

  // One listing per ref, computed on first use: `git ls-tree` over a published
  // site is expensive enough that doing it per link would dominate the run.
  const listings = new Map<string, Set<string> | undefined>();
  const listingFor = (ref: string): Set<string> | undefined => {
    if (!listings.has(ref)) listings.set(ref, publishedPaths(root, ref, opts.fetch ?? false));
    return listings.get(ref);
  };

  const note = (reason: string) => {
    unchecked[reason] = (unchecked[reason] ?? 0) + 1;
  };

  for (const link of parseLinks(src)) {
    const c = classify(link.target, opts);

    if (c.kind === "unchecked") {
      note(c.reason ?? "unchecked");
      continue;
    }

    if (c.kind === "worktree") {
      checked++;
      const here = existsSync(join(base, c.path!));
      const through = here ? undefined : opts.resolveMoved?.(resolve(base, c.path!));
      if (here) ok++;
      else if (through !== undefined) {
        ok++;
        moved.push({ ...link, to: through.resolved, move: through.move });
      } else dead.push({ ...link, reason: `no such path in the working tree: ${c.path}` });
      continue;
    }

    const listing = listingFor(c.ref!);
    if (!listing) {
      // The ref is not readable here — a shallow clone that never fetched
      // `gh-pages`, most often. Reporting these as dead would turn a clone
      // detail into a wall of false findings.
      note(`ref '${c.ref}' not readable in this checkout`);
      continue;
    }
    checked++;
    if (inListing(listing, c.path!)) ok++;
    else dead.push({ ...link, reason: `not published at ${c.ref}: ${c.path}` });
  }

  return { checked, ok, dead, moved, unchecked };
}

/**
 * Audit one markdown file and format the result.
 *
 * The generic entry point: a path, and where to resolve against. No config
 * is read here — a caller that has publish targets passes them, and one that
 * does not gets Pages URLs reported as unchecked rather than as dead.
 *
 * Exit code 1 means a dead link; 2 means the file could not be read, which
 * is neither a pass nor a finding and must not be folded into either.
 */
export function auditMarkdownFile(opts: {
  /** The checkout, for `git ls-tree`. */
  root: string;
  /** The file to audit. Relative links resolve against ITS directory. */
  file: string;
  repoUrl?: string;
  pagesBaseUrl?: string;
  publishRef: string;
  fetch?: boolean;
  /** As {@link auditLinks}'s option of the same name. */
  resolveMoved?: (abs: string) => { resolved: string; move: string } | undefined;
}): { text: string; exitCode: number } {
  if (!existsSync(opts.file)) return { text: `No file at ${opts.file}.`, exitCode: 2 };

  const result = auditLinks(opts.root, readFileSync(opts.file, "utf-8"), {
    base: dirname(opts.file),
    repoUrl: opts.repoUrl,
    pagesBaseUrl: opts.pagesBaseUrl,
    publishRef: opts.publishRef,
    fetch: opts.fetch,
    resolveMoved: opts.resolveMoved,
  });

  const lines: string[] = [];
  for (const d of result.dead) {
    lines.push(`${opts.file}:${d.line}  [${d.text}](${d.target})`);
    lines.push(`    ${d.reason}`);
  }
  const uncheckedTotal = Object.values(result.unchecked).reduce((a, b) => a + b, 0);
  const summary =
    `${result.checked} link(s) checked, ${result.ok} resolved, ${result.dead.length} dead; ` +
    `${uncheckedTotal} not checked` +
    (result.moved.length ? `; ${result.moved.length} through a declared move, still to switch` : "");
  for (const m of result.moved) lines.push(`${opts.file}:${m.line}  [${m.text}](${m.target})  moved (${m.move})`);
  lines.push(result.dead.length ? `\n${summary}` : summary);
  for (const [reason, count] of Object.entries(result.unchecked).sort()) {
    lines.push(`    ${count} \u00d7 ${reason}`);
  }

  return { text: lines.join("\n"), exitCode: result.dead.length > 0 ? 1 : 0 };
}
