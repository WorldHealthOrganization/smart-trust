/**
 * Inline `code` spans that NAME something, linked to that thing's page.
 *
 * Owner, 2026-11-17 (card "Auto-link + Skills hub"): a skill instruction page
 * such as `merge-queue` renders about 248 `code` references and linked one.
 * They name beans (`0qjq`, `bean 0qjq`), cat commands (`merge:guard`,
 * `bun run cat skills:docs`), skills (`merge-conflict-patterns`), process
 * diagrams (`sdlc/processes/merge-train.bpmn`), schemas (`schemas/...`) and
 * repository files, and a reader had to find each by hand.
 *
 * ## Exact, unambiguous, or not at all
 *
 * A span is linked only when the REGISTRIES the caller hands in place it, and
 * place it once. Nothing here composes a URL from a span's shape: a link built
 * from what a name looks like is how a page fills with plausible 404s (bean
 * `hloc`: "rewriting to something plausible is how a broken link becomes an
 * undetectable one"). So:
 *
 * - **one target** → linked;
 * - **two or more different targets** (a skill and a bean of one name, a path
 *   held by two layers) → left as code and reported `ambiguous`;
 * - **none, but the span is SHAPED like a kind** (`x:y`, `bean abcd`, a path
 *   with an extension) → left as code and reported `unresolved`, which is the
 *   QA list the owner asked for;
 * - **none, and no kind's shape** (a date, a branch name, a plain word) →
 *   left exactly as written, and not reported.
 *
 * ## What is never touched
 *
 * Fenced code blocks, headings (a link inside a heading changes nothing a
 * reader needs and risks the heading's anchor), and a span that is already
 * the text of a link.
 *
 * This module is pure: the registries arrive through {@link CodeRefResolver},
 * so the classification and the rewrite are tested without a checkout
 * (`scripts/tests/code-ref-links.test.ts`). `gen-skill-docs.ts` builds the
 * resolver from the knowledge graph.
 *
 * @module scripts/lib/code-ref-links
 */

/** The kinds a code span can name. */
export type CodeRefKind = "skill" | "bean" | "command" | "process" | "schema" | "file";

/** Where a span leads, and as what. */
export interface CodeRefTarget {
  kind: CodeRefKind;
  href: string;
}

/**
 * The registries, as lookups. Each answers only an EXACT key, and `undefined`
 * (or `[]`) when it cannot place it.
 */
export interface CodeRefResolver {
  /** A skill by id. */
  skill(name: string): string | undefined;
  /** A bean by id. */
  bean(id: string): string | undefined;
  /** A `bun run cat` command by key (`merge:guard`). */
  command(key: string): string | undefined;
  /**
   * A path as written (`sdlc/processes/merge-train.bpmn`, `schemas/kg/x.ts`,
   * `merge-train.bpmn`): every DISTINCT place it resolves to. More than one is
   * an ambiguity, and the caller is told so rather than handed the first.
   */
  path(p: string): CodeRefTarget[];
}

/** What one span came to. */
export type CodeRefResolution =
  | { state: "linked"; target: CodeRefTarget }
  | { state: "ambiguous"; targets: CodeRefTarget[] }
  | { state: "unresolved"; kinds: CodeRefKind[] }
  | { state: "plain" };

/** One span that looked like a kind and was not linked. */
export interface CodeRefFinding {
  /** The span's text, without its backticks. */
  code: string;
  /** 1-based line in the markdown handed in. */
  line: number;
  state: "ambiguous" | "unresolved";
  /** The kinds its shape suggested (`unresolved`), or the targets it matched (`ambiguous`). */
  kinds: CodeRefKind[];
  targets?: CodeRefTarget[];
}

/** A key a span offers to one registry, and whether its shape alone claims the kind. */
interface Probe {
  kind: CodeRefKind;
  key: string;
  /** True when the span is SHAPED like this kind, so a miss is a finding. */
  shaped: boolean;
}

const EXT = /\.(?:bpmn|dmn|ts|tsx|js|mjs|cjs|json|jsonld|md|py|sh|ya?ml|feature|puml|mmd|html|css|svg|csv|txt|toml)$/;
const PATH = /^[\w@.~-][\w@.~/-]*$/;
const DATE = /^\d{4}-\d{2}(?:-\d{2})?(?:[T ].*)?$/;
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
/** `merge:guard`, `skills:docs:check` — the cat script table's key shape. */
const COMMAND = /^[a-z][a-z0-9-]*(?::[a-z0-9][a-z0-9-]*)+$/;
/** A bare bean id: four lower-case alphanumerics, at least one a digit (`0qjq`, `oe98`), optionally prefixed (`cat-tools-sm8r`). */
const BEAN_SHAPED = /^(?:[a-z][a-z0-9]*-)*(?=[a-z0-9]{0,3}\d)(?=[a-z0-9]{0,3}[a-z])[a-z0-9]{4}$/;
/** Any token a bean id could be, digit or not (`tdmg` is a real bean). */
const BEAN_TOKEN = /^(?:[a-z][a-z0-9]*-)*[a-z0-9]{4}$/;
/** A skill id, or a slash command naming one. */
const SKILL = /^\/?[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/**
 * The registries a span is offered to, by its shape alone. Pure, and the one
 * place the shapes are written.
 */
export function probesFor(code: string): Probe[] {
  const t = code.trim();
  if (t === "" || DATE.test(t) || URL_SCHEME.test(t)) return [];

  const cat = /^bun run cat ([a-z][\w:.-]*)(?:\s.*)?$/.exec(t);
  if (cat) return [{ kind: "command", key: cat[1]!, shaped: true }];
  const bean = /^bean ([a-z0-9][a-z0-9-]*)$/i.exec(t);
  if (bean) return [{ kind: "bean", key: bean[1]!, shaped: true }];
  if (/\s/.test(t)) return [];

  if (COMMAND.test(t)) return [{ kind: "command", key: t, shaped: true }];

  if (PATH.test(t) && (EXT.test(t) || (t.includes("/") && t.endsWith("/")))) {
    const kind: CodeRefKind = /\.(?:bpmn|dmn)$/.test(t)
      ? "process"
      : /^(?:\.\/)?schemas\//.test(t)
        ? "schema"
        : "file";
    // A bare filename with no directory is shaped like a file only when it
    // could be nothing else: `README.md` yes, but `x.md` alone is still
    // looked up, and reported if it fails, because the extension is the claim.
    return [{ kind, key: t, shaped: true }];
  }

  const out: Probe[] = [];
  if (SKILL.test(t)) out.push({ kind: "skill", key: t.replace(/^\//, ""), shaped: false });
  if (BEAN_TOKEN.test(t)) out.push({ kind: "bean", key: t, shaped: BEAN_SHAPED.test(t) });
  return out;
}

/** What `code` comes to against `resolver`. */
export function resolveCodeRef(code: string, resolver: CodeRefResolver): CodeRefResolution {
  const probes = probesFor(code);
  if (probes.length === 0) return { state: "plain" };
  const found: CodeRefTarget[] = [];
  for (const p of probes) {
    if (p.kind === "skill") {
      const h = resolver.skill(p.key);
      if (h !== undefined) found.push({ kind: "skill", href: h });
    } else if (p.kind === "bean") {
      const h = resolver.bean(p.key);
      if (h !== undefined) found.push({ kind: "bean", href: h });
    } else if (p.kind === "command") {
      const h = resolver.command(p.key);
      if (h !== undefined) found.push({ kind: "command", href: h });
    } else {
      found.push(...resolver.path(p.key));
    }
  }
  const distinct = [...new Map(found.map((f) => [f.href, f])).values()];
  if (distinct.length === 1) return { state: "linked", target: distinct[0]! };
  if (distinct.length > 1) return { state: "ambiguous", targets: distinct };
  const shaped = probes.filter((p) => p.shaped).map((p) => p.kind);
  return shaped.length > 0 ? { state: "unresolved", kinds: [...new Set(shaped)] } : { state: "plain" };
}

/** An href safe inside `](…)`: no space, no unbalanced parenthesis. */
function linkSafe(href: string): string {
  return href.replace(/ /g, "%20").replace(/\(/g, "%28").replace(/\)/g, "%29");
}

/**
 * Is the span starting at `start` and ending at `end` (exclusive) already the
 * text of a link — inside `[ … ]` that is followed by `(` or `[`?
 */
function insideLinkText(line: string, start: number, end: number): boolean {
  let depth = 0;
  for (let i = 0; i < start; i++) {
    if (line[i] === "\\") {
      i++;
      continue;
    }
    if (line[i] === "[") depth++;
    else if (line[i] === "]" && depth > 0) depth--;
  }
  if (depth === 0) return false;
  for (let i = end; i < line.length; i++) {
    if (line[i] === "[") return false;
    if (line[i] === "]") return line[i + 1] === "(" || line[i + 1] === "[";
  }
  return false;
}

/** Options for {@link linkInlineCode}. */
export interface LinkInlineCodeOptions {
  /** Hrefs that are the page itself: a span resolving to one is left as code. */
  self?: ReadonlySet<string>;
  /** Called once per span that looked like a kind and was not linked. */
  onFinding?: (f: CodeRefFinding) => void;
}

/**
 * Every inline code span in `markdown` that resolves to exactly one target,
 * wrapped in a link to it: `` `merge:guard` `` becomes
 * `` [`merge:guard`](href) ``. Fenced blocks, headings and spans already in a
 * link are left alone.
 */
export function linkInlineCode(markdown: string, resolver: CodeRefResolver, opts: LinkInlineCodeOptions = {}): string {
  const lines = markdown.split("\n");
  let fence: string | undefined;
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n]!;
    const f = /^\s*(`{3,}|~{3,})/.exec(line);
    if (fence !== undefined) {
      if (f && f[1]![0] === fence[0] && f[1]!.length >= fence.length && line.trim() === f[1]) fence = undefined;
      continue;
    }
    if (f) {
      fence = f[1]!;
      continue;
    }
    if (/^ {0,3}#{1,6}(?:\s|$)/.test(line) || !line.includes("`")) continue;

    let out = "";
    let i = 0;
    while (i < line.length) {
      if (line[i] === "\\" && line[i + 1] === "`") {
        out += line.slice(i, i + 2);
        i += 2;
        continue;
      }
      if (line[i] !== "`") {
        out += line[i];
        i++;
        continue;
      }
      let run = 0;
      while (line[i + run] === "`") run++;
      const ticks = "`".repeat(run);
      // The closing run: the same length, not part of a longer one.
      let close = -1;
      for (let j = line.indexOf(ticks, i + run); j !== -1; j = line.indexOf(ticks, j + 1)) {
        if (line[j - 1] !== "`" && line[j + run] !== "`") {
          close = j;
          break;
        }
        while (line[j + 1] === "`") j++;
      }
      if (close === -1) {
        out += ticks;
        i += run;
        continue;
      }
      const end = close + run;
      const span = line.slice(i, end);
      const inner = line.slice(i + run, close);
      const code = run > 1 && inner.startsWith(" ") && inner.endsWith(" ") && inner.trim() !== "" ? inner.slice(1, -1) : inner;
      if (insideLinkText(line, i, end)) {
        out += span;
      } else {
        const r = resolveCodeRef(code, resolver);
        if (r.state === "linked" && !(opts.self?.has(r.target.href) ?? false)) {
          out += `[${span}](${linkSafe(r.target.href)})`;
        } else {
          out += span;
          if (r.state === "ambiguous") {
            opts.onFinding?.({ code, line: n + 1, state: "ambiguous", kinds: [...new Set(r.targets.map((t) => t.kind))], targets: r.targets });
          } else if (r.state === "unresolved") {
            opts.onFinding?.({ code, line: n + 1, state: "unresolved", kinds: r.kinds });
          }
        }
      }
      i = end;
    }
    lines[n] = out;
  }
  return lines.join("\n");
}
