/**
 * Translation adjudication — a person's verdict on a machine translation,
 * carried from the review page to the record by a GitHub issue.
 *
 * @module scripts/lib/translation-adjudication
 * @covers translation-sources
 *
 * ## The round trip
 *
 *   1. The translation status page (`gen-translation-status.ts`) shows every
 *      catalogue × locale. A reviewer ticks the machine translations they
 *      find acceptable, or marks one a mistranslation and suggests a fix per
 *      string, and presses submit.
 *   2. The page opens GitHub's new-issue form, prefilled with
 *      {@link issueBody}: a readable summary, and the same thing as a JSON
 *      block in `translation-adjudication/v1` ({@link ADJUDICATION_SCHEMA}).
 *      The person who files it is the adjudicator: their GitHub login is the
 *      only identity the record carries, and nothing in the body can name
 *      anyone else.
 *   3. `scripts/translation-adjudicate.ts`, run by the reusable workflow
 *      `layer-translation-adjudication.yml`, turns the issue into a PR:
 *      {@link planAdjudication} decides every write, and refuses rather than
 *      guesses.
 *
 * ## What is recorded, and where
 *
 * - **acceptable**: the catalogue's translation node (`<locale>/<cat>.json`,
 *   `translation-node/v1`) gets `status.official: true` with `signedOffBy` /
 *   `signedOffAt` — what a layer's per-catalogue review reader and the status page
 *   read as "reviewed by a person" — and an entry is appended to the audited
 *   `translation-qa` attestation (`qa-attestations/v1`, criterion
 *   {@link ADJUDICATION_CRITERION}) naming the issue and the hash of the
 *   catalogue the person saw.
 * - **mistranslation**: each suggestion replaces its `msgstr` in the `.po`
 *   and is marked `#, fuzzy`: a suggestion is a person's text that nobody
 *   else has reviewed yet, so the catalogue is flagged for review, never
 *   accepted. The attestation records the suggestion, old and new text both.
 *
 * The PO header `X-Folio-Official` and the locale's `status.json` are never
 * touched: locale sign-off stays a separate, deliberate act
 * (`check-translation-officiality.ts`).
 *
 * ## Refusals
 *
 * Nothing is recorded for an author who is not an owner, member or
 * collaborator of the repository. An item is refused when its catalogue
 * changed since the page showed it (`poHash`), when its path leaves the
 * translations directory, or when a suggestion's `current` text is no longer
 * what the catalogue says. A refusal is reported on the issue; it is never a
 * partial record dressed as a whole one.
 *
 * Node-only imports: this module is the part both the page's generator and
 * the workflow's script share, and it is tested without a mounted harness.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, normalize, sep } from "node:path";

/** The issue body's JSON block declares this. */
export const ADJUDICATION_SCHEMA = "translation-adjudication/v1" as const;

/** The issue label the page asks for and the workflow listens on. */
export const ADJUDICATION_LABEL = "translation-adjudication" as const;

/** The issue title's prefix: the workflow's trigger when the label could not be set. */
export const ADJUDICATION_TITLE_PREFIX = "[translation review]" as const;

/** The attestation criterion a human adjudication is filed under. */
export const ADJUDICATION_CRITERION = "human-adjudication" as const;

/** Repository roles whose adjudication is recorded (GitHub `author_association`). */
export const ADJUDICATOR_ASSOCIATIONS = ["OWNER", "MEMBER", "COLLABORATOR"] as const;

/** GitHub refuses a new-issue URL much past this; beyond it the page copies the body instead. */
export const MAX_ISSUE_URL = 7500;

export type Verdict = "acceptable" | "mistranslation";

/** One string's suggested fix. `current` is what the reviewer saw, so a changed catalogue is caught. */
/**
 * Where a candidate translation came from. A reviewer may pick one of several
 * candidates for a string (an agent model, an open machine-translation model,
 * a web service, a person); the source of the one they picked is recorded
 * with their verdict.
 */
export const CANDIDATE_SOURCE_KINDS = ["agent", "open-mt", "web-service", "human"] as const;
export type CandidateSourceKind = (typeof CANDIDATE_SOURCE_KINDS)[number];

export interface CandidateSource {
  kind: CandidateSourceKind;
  /** The model or service: `claude-opus-5-5`, `opus-mt-en-fr`, `deepl`, a GitHub login. */
  id: string;
  version?: string;
  /** ISO 8601, when the candidate was produced. */
  at?: string;
}

/**
 * The candidates sidecar, `translations/<locale>/<catalogue>.candidates.json`:
 * alternative translations per string, from any number of sources, for a
 * reviewer to choose among. The `.po` keeps one `msgstr`; this file keeps the
 * rest. Writers append; a candidate is never a verdict.
 *
 * **Candidates are never a barrier to having a translation** (owner,
 * 2026-11-14). A writer that adds candidates for a string whose `msgstr` is
 * empty also puts the first candidate in the `.po` as its `msgstr`, marked
 * `#, fuzzy`: the page then shows that translation, the status page counts it
 * as needing review, and it stays the default until a person adjudicates the
 * catalogue — accepting it, or choosing another candidate or their own text.
 */
export const CANDIDATES_SCHEMA = "translation-candidates/v1" as const;
export const CANDIDATES_SUFFIX = ".candidates.json" as const;

export interface CandidatesFile {
  $schema: typeof CANDIDATES_SCHEMA;
  locale: string;
  /** Path inside the locale directory, without extension. */
  catalogue: string;
  entries: Array<{
    msgctxt?: string;
    msgid: string;
    /**
     * `text` is the translation; for a plural entry it is form 0, and `forms`
     * holds every `msgstr[n]`, in order (owner, 2026-11-14: plurals are
     * machine-filled, fuzzy).
     */
    candidates: Array<{ text: string; forms?: string[]; source: CandidateSource }>;
  }>;
}

/** Problems with a candidates file; empty means it is a {@link CandidatesFile}. */
export function candidatesProblems(c: unknown): string[] {
  const o = c as Record<string, unknown> | null;
  if (o === null || typeof o !== "object" || Array.isArray(o)) return ["not an object"];
  const out: string[] = [];
  if (o.$schema !== CANDIDATES_SCHEMA) out.push(`$schema must be "${CANDIDATES_SCHEMA}"`);
  if (typeof o.locale !== "string" || !LOCALE_RE.test(o.locale)) out.push("locale is not a locale tag");
  if (!safeCatalogue(o.catalogue)) out.push("catalogue is not a safe relative path");
  if (!Array.isArray(o.entries)) return [...out, "entries must be a list"];
  o.entries.forEach((e0, i) => {
    const e = e0 as Record<string, unknown> | null;
    if (e === null || typeof e !== "object" || typeof e.msgid !== "string") return void out.push(`entries[${i}].msgid is required`);
    if (!Array.isArray(e.candidates)) return void out.push(`entries[${i}].candidates must be a list`);
    e.candidates.forEach((c1, j) => {
      const cc = c1 as Record<string, unknown> | null;
      if (cc === null || typeof cc.text !== "string") out.push(`entries[${i}].candidates[${j}].text is required`);
      if (cc?.forms !== undefined && (!Array.isArray(cc.forms) || cc.forms.length === 0 || !cc.forms.every((x) => typeof x === "string") || cc.forms[0] !== cc.text)) {
        out.push(`entries[${i}].candidates[${j}].forms must be a non-empty list of strings whose first is text`);
      }
      const p = sourceProblem(cc?.source);
      if (p) out.push(`entries[${i}].candidates[${j}].source ${p}`);
    });
  });
  return out;
}

/** `undefined` when `v` is a {@link CandidateSource}, else what is wrong. */
export function sourceProblem(v: unknown): string | undefined {
  const s = v as Record<string, unknown> | null;
  if (s === null || typeof s !== "object" || Array.isArray(s)) return "must be an object";
  if (!(CANDIDATE_SOURCE_KINDS as readonly unknown[]).includes(s.kind)) return `kind must be one of ${CANDIDATE_SOURCE_KINDS.join(", ")}`;
  if (typeof s.id !== "string" || s.id.length === 0 || s.id.length > 200) return "id must name the model or service";
  if (s.version !== undefined && (typeof s.version !== "string" || s.version.length > 200)) return "version must be text";
  if (s.at !== undefined && (typeof s.at !== "string" || s.at.length > 40)) return "at must be a timestamp";
  return undefined;
}

export interface Suggestion {
  msgctxt?: string;
  msgid: string;
  current: string;
  suggested: string;
  /** The candidate's source when the reviewer picked one rather than typing their own. */
  source?: CandidateSource;
  note?: string;
}

/** One (catalogue, locale) verdict. */
export interface AdjudicationItem {
  /** The catalogue's path inside the locale directory, without extension: `start/contributing`. */
  catalogue: string;
  locale: string;
  verdict: Verdict;
  /** {@link poHash} of the catalogue the reviewer saw. */
  poHash: string;
  suggestions?: Suggestion[];
  note?: string;
}

/** The issue body's JSON block. */
export interface AdjudicationPayload {
  $schema: typeof ADJUDICATION_SCHEMA;
  /** `owner/name` of the repository holding the catalogues. */
  repository: string;
  /** The layer's declared name. */
  layer: string;
  /** The `translation-sources` directory, relative to the layer root. */
  translations: string;
  items: AdjudicationItem[];
}

// ── Hashes ───────────────────────────────────────────────────────────────

/** The hash a reviewer's verdict is pinned to: SHA-256 of the catalogue's bytes, 16 hex. */
export function poHash(text: string): string {
  return createHash("sha256").update(text, "utf-8").digest("hex").slice(0, 16);
}

// ── Validation ───────────────────────────────────────────────────────────

const LOCALE_RE = /^[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})*$/;
const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const HASH_RE = /^[0-9a-f]{16}$/;

/** A catalogue path is relative, POSIX, and cannot climb out. */
export function safeCatalogue(c: unknown): c is string {
  if (typeof c !== "string" || c.length === 0 || c.length > 300) return false;
  if (c.includes("\\") || c.includes("\0") || isAbsolute(c) || c.startsWith("/")) return false;
  return c.split("/").every((seg) => seg !== "" && seg !== "." && seg !== "..");
}

const str = (v: unknown, max = 20000): v is string => typeof v === "string" && v.length <= max;

/**
 * Validate an untrusted payload. Returns the problems; an empty list means
 * `p` is an {@link AdjudicationPayload}. Every field is checked, because the
 * body is whatever the issue's author typed.
 */
export function payloadProblems(p: unknown): string[] {
  const out: string[] = [];
  const o = p as Record<string, unknown> | null;
  if (o === null || typeof o !== "object" || Array.isArray(o)) return ["the JSON block is not an object"];
  if (o.$schema !== ADJUDICATION_SCHEMA) out.push(`$schema must be "${ADJUDICATION_SCHEMA}"`);
  if (typeof o.repository !== "string" || !REPO_RE.test(o.repository)) out.push("repository must be owner/name");
  if (!str(o.layer, 200) || o.layer.length === 0) out.push("layer must be a name");
  if (!safeCatalogue(o.translations)) out.push("translations must be a relative directory");
  if (!Array.isArray(o.items) || o.items.length === 0) {
    out.push("items must be a non-empty list");
    return out;
  }
  if (o.items.length > 2000) out.push("at most 2000 items per issue");
  o.items.forEach((raw, i) => {
    const it = raw as Record<string, unknown> | null;
    const at = `items[${i}]`;
    if (it === null || typeof it !== "object") return void out.push(`${at} is not an object`);
    if (!safeCatalogue(it.catalogue)) out.push(`${at}.catalogue is not a safe relative path`);
    if (typeof it.locale !== "string" || !LOCALE_RE.test(it.locale)) out.push(`${at}.locale is not a locale tag`);
    if (it.verdict !== "acceptable" && it.verdict !== "mistranslation") out.push(`${at}.verdict must be acceptable or mistranslation`);
    if (typeof it.poHash !== "string" || !HASH_RE.test(it.poHash)) out.push(`${at}.poHash must be 16 hex characters`);
    if (it.note !== undefined && !str(it.note, 2000)) out.push(`${at}.note is too long`);
    if (it.verdict === "acceptable" && it.suggestions !== undefined && (!Array.isArray(it.suggestions) || it.suggestions.length > 0)) {
      out.push(`${at}: an acceptable verdict carries no suggestions`);
    }
    if (it.verdict === "mistranslation") {
      if (!Array.isArray(it.suggestions) || it.suggestions.length === 0) {
        out.push(`${at}: a mistranslation needs at least one suggestion`);
      } else {
        it.suggestions.forEach((s0, j) => {
          const s = s0 as Record<string, unknown> | null;
          const sat = `${at}.suggestions[${j}]`;
          if (s === null || typeof s !== "object") return void out.push(`${sat} is not an object`);
          if (!str(s.msgid) || s.msgid.length === 0) out.push(`${sat}.msgid is required`);
          if (s.msgctxt !== undefined && !str(s.msgctxt, 2000)) out.push(`${sat}.msgctxt is not text`);
          if (!str(s.current)) out.push(`${sat}.current is required (the text you saw)`);
          if (!str(s.suggested) || s.suggested.trim().length === 0) out.push(`${sat}.suggested is required`);
          if (s.note !== undefined && !str(s.note, 2000)) out.push(`${sat}.note is too long`);
          if (s.source !== undefined) {
            const sp = sourceProblem(s.source);
            if (sp) out.push(`${sat}.source ${sp}`);
          }
        });
      }
    }
  });
  return out;
}

// ── The issue ────────────────────────────────────────────────────────────

/** The info string of the issue body's fenced JSON block. */
export const ADJUDICATION_FENCE_INFO = "json translation-adjudication" as const;
const FENCE_OPEN = "```" + ADJUDICATION_FENCE_INFO;

/** The issue's title. */
export function issueTitle(p: AdjudicationPayload): string {
  const acc = p.items.filter((i) => i.verdict === "acceptable").length;
  const mis = p.items.length - acc;
  const parts = [acc ? `${acc} acceptable` : "", mis ? `${mis} mistranslation${mis === 1 ? "" : "s"}` : ""].filter(Boolean);
  return `${ADJUDICATION_TITLE_PREFIX} ${p.layer}: ${parts.join(", ")}`;
}

/** Inline code that survives backticks in the text. */
function code(s: string): string {
  const t = s.replace(/\n/g, "⏎");
  return t.includes("`") ? `\`\` ${t} \`\`` : `\`${t}\``;
}

/**
 * The issue's body: a summary a person reads, then the JSON block the
 * workflow reads. Only the block is authoritative; the summary is rendered
 * from it and says so.
 */
export function issueBody(p: AdjudicationPayload): string {
  const lines: string[] = [
    `Translation review of **${p.layer}** (\`${p.translations}\`), filed from the translation status page.`,
    "",
    "By filing this issue, I (its author) adjudicate the machine translations below. The workflow records my GitHub login as the reviewer and opens a pull request; nothing is recorded in anyone else's name.",
    "",
  ];
  const acc = p.items.filter((i) => i.verdict === "acceptable");
  const mis = p.items.filter((i) => i.verdict === "mistranslation");
  if (acc.length > 0) {
    lines.push("### Acceptable", "");
    for (const i of acc) lines.push(`- [x] \`${i.locale}\` ${code(i.catalogue)}${i.note ? ` — ${i.note}` : ""}`);
    lines.push("");
  }
  if (mis.length > 0) {
    lines.push("### Mistranslations, with suggestions", "");
    for (const i of mis) {
      lines.push(`- \`${i.locale}\` ${code(i.catalogue)}${i.note ? ` — ${i.note}` : ""}`);
      for (const s of i.suggestions ?? []) {
        lines.push(`  - ${code(s.msgid)}${s.msgctxt ? ` (context ${code(s.msgctxt)})` : ""}: ${code(s.current)} → ${code(s.suggested)}${s.source ? ` (candidate from ${s.source.kind} ${code(s.source.id)})` : ""}${s.note ? ` — ${s.note}` : ""}`);
      }
    }
    lines.push("");
  }
  lines.push(
    "<details><summary>Machine-readable record (what the workflow reads; please don't edit)</summary>",
    "",
    FENCE_OPEN,
    JSON.stringify(p, null, 1),
    "```",
    "",
    "</details>",
  );
  return lines.join("\n");
}

/** The JSON block of an issue body, parsed; `undefined` when there is none or it will not parse. */
export function parseIssueBody(body: string): unknown {
  const start = body.indexOf(FENCE_OPEN);
  if (start < 0) return undefined;
  const from = body.indexOf("\n", start) + 1;
  const end = body.indexOf("\n```", from);
  if (from <= 0 || end < 0) return undefined;
  try {
    return JSON.parse(body.slice(from, end));
  } catch {
    return undefined;
  }
}

/** GitHub's new-issue URL, prefilled; `undefined` when it would be too long to open. */
export function newIssueUrl(p: AdjudicationPayload): string | undefined {
  const q = new URLSearchParams({ title: issueTitle(p), labels: ADJUDICATION_LABEL, body: issueBody(p) });
  const url = `https://github.com/${p.repository}/issues/new?${q.toString()}`;
  return url.length <= MAX_ISSUE_URL ? url : undefined;
}

// ── PO catalogues ────────────────────────────────────────────────────────

/** One entry of a `.po`, located by line. */
export interface PoEntry {
  msgctxt?: string;
  msgid: string;
  msgidPlural?: string;
  /** `msgstr`, or `msgstr[0]` for a plural entry. */
  msgstr: string;
  /** Every `msgstr[n]` of a plural entry, in order; `[msgstr]` for a singular one. */
  forms: string[];
  fuzzy: boolean;
  /** `#:` source references: where the string comes from. */
  references: string[];
  /** Line range `[start, end)` of the whole entry, comments included. */
  start: number;
  end: number;
  /** Line range `[start, end)` of the `msgstr` keyword and its continuations. */
  msgstrStart: number;
  msgstrEnd: number;
  /** End of the last `msgstr[n]` and its continuations (`msgstrEnd` for a singular entry). */
  formsEnd: number;
  /** The `#,` flags line, when there is one. */
  flagsLine?: number;
}

function unquote(line: string): string {
  const m = /"(.*)"\s*$/.exec(line);
  if (!m) return "";
  return m[1]!.replace(/\\(.)/g, (_, c: string) => (c === "n" ? "\n" : c === "t" ? "\t" : c === "r" ? "\r" : c));
}

function quote(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\t/g, "\\t").replace(/\r/g, "\\r").replace(/\n/g, "\\n")}"`;
}

/** Parse a catalogue into its entries, header (`msgid ""`) and obsolete (`#~`) entries excluded. */
export function poEntries(text: string): PoEntry[] {
  const lines = text.split("\n");
  const out: PoEntry[] = [];
  let i = 0;
  while (i < lines.length) {
    while (i < lines.length && lines[i]!.trim() === "") i++;
    if (i >= lines.length) break;
    const start = i;
    while (i < lines.length && lines[i]!.trim() !== "") i++;
    const end = i;
    const e: Partial<PoEntry> & { references: string[] } = { references: [], fuzzy: false, start, end };
    let field: "msgctxt" | "msgid" | "msgidPlural" | "msgstr" | "other" | undefined;
    const acc: Record<string, string> = {};
    const forms: string[] = [];
    let formsEnd: number | undefined;
    let obsolete = false;
    for (let k = start; k < end; k++) {
      const l = lines[k]!;
      if (l.startsWith("#~")) { obsolete = true; continue; }
      if (l.startsWith("#:")) { e.references.push(...l.slice(2).trim().split(/\s+/).filter(Boolean)); continue; }
      if (l.startsWith("#,")) { e.flagsLine = k; e.fuzzy = /\bfuzzy\b/.test(l); continue; }
      if (l.startsWith("#")) continue;
      const kw = /^(msgctxt|msgid_plural|msgid|msgstr(?:\[(\d+)\])?)\s/.exec(l);
      if (kw) {
        const name = kw[1]!;
        if (name === "msgctxt") field = "msgctxt";
        else if (name === "msgid") field = "msgid";
        else if (name === "msgid_plural") field = "msgidPlural";
        else if (name === "msgstr" || kw[2] === "0") { field = "msgstr"; e.msgstrStart = k; }
        else { field = "other"; if (e.msgstrEnd === undefined && e.msgstrStart !== undefined) e.msgstrEnd = k; }
        if (field !== "other") acc[field] = unquote(l);
        if (name.startsWith("msgstr")) { forms.push(unquote(l)); formsEnd = k + 1; }
        continue;
      }
      if (l.trimStart().startsWith('"') && field) {
        if (field !== "other") acc[field] = (acc[field] ?? "") + unquote(l);
        if (formsEnd === k) { forms[forms.length - 1] += unquote(l); formsEnd = k + 1; }
      }
    }
    if (obsolete || acc.msgid === undefined || e.msgstrStart === undefined) continue;
    if (e.msgstrEnd === undefined) {
      let k = e.msgstrStart + 1;
      while (k < end && lines[k]!.trimStart().startsWith('"')) k++;
      e.msgstrEnd = k;
    }
    if (acc.msgid === "" && acc.msgctxt === undefined) continue; // the header
    out.push({
      ...(acc.msgctxt !== undefined ? { msgctxt: acc.msgctxt } : {}),
      msgid: acc.msgid,
      ...(acc.msgidPlural !== undefined ? { msgidPlural: acc.msgidPlural } : {}),
      msgstr: acc.msgstr ?? "",
      forms,
      fuzzy: e.fuzzy!,
      references: e.references,
      start,
      end,
      msgstrStart: e.msgstrStart,
      msgstrEnd: e.msgstrEnd,
      formsEnd: formsEnd ?? e.msgstrEnd,
      ...(e.flagsLine !== undefined ? { flagsLine: e.flagsLine } : {}),
    });
  }
  return out;
}

/** The source files a catalogue's strings come from (`#:` references, line numbers dropped), sorted. */
export function sourceFilesOf(text: string): string[] {
  const files = new Set<string>();
  for (const e of poEntries(text)) for (const r of e.references) files.add(r.replace(/:\d+$/, ""));
  return [...files].sort();
}

/**
 * Replace one entry's `msgstr` and mark it `#, fuzzy`. Returns the new text,
 * or a reason when the entry is not there, is plural, or no longer says
 * `current`.
 */
export function applySuggestion(text: string, s: Suggestion): { text: string } | { refused: string } {
  const entries = poEntries(text).filter((e) => e.msgid === s.msgid && (e.msgctxt ?? undefined) === (s.msgctxt || undefined));
  if (entries.length === 0) return { refused: `no entry for msgid ${JSON.stringify(s.msgid.slice(0, 80))}` };
  const e = entries[0]!;
  if (e.msgidPlural !== undefined) return { refused: `msgid ${JSON.stringify(s.msgid.slice(0, 80))} is a plural entry; suggest plural forms by hand` };
  if (e.msgstr !== s.current) return { refused: `msgid ${JSON.stringify(s.msgid.slice(0, 80))} no longer says what the reviewer saw` };
  const lines = text.split("\n");
  return { text: markFuzzy([...lines.slice(0, e.msgstrStart), `msgstr ${quote(s.suggested)}`, ...lines.slice(e.msgstrEnd)], e).join("\n") };
}

/**
 * Fill an EMPTY plural entry's `msgstr[0..n-1]` and mark it `#, fuzzy`. Every
 * form must be empty (a plural a person has started is theirs), and `forms`
 * must have as many forms as the entry, or as the catalogue's plural count
 * when the entry lists fewer.
 */
export function applyForms(text: string, f: { msgctxt?: string; msgid: string; forms: string[] }): { text: string } | { refused: string } {
  const e = poEntries(text).find((x) => x.msgid === f.msgid && (x.msgctxt ?? undefined) === (f.msgctxt || undefined));
  const what = `msgid ${JSON.stringify(f.msgid.slice(0, 80))}`;
  if (!e) return { refused: `no entry for ${what}` };
  if (e.msgidPlural === undefined) return { refused: `${what} is not a plural entry` };
  if (e.forms.some((x) => x !== "")) return { refused: `${what} already has a form; plural forms are left for a person` };
  if (f.forms.length === 0 || f.forms.length < e.forms.length) return { refused: `${what} has ${e.forms.length} forms; ${f.forms.length} given` };
  const lines = text.split("\n");
  const fresh = f.forms.map((v, n) => `msgstr[${n}] ${quote(v)}`);
  return { text: markFuzzy([...lines.slice(0, e.msgstrStart), ...fresh, ...lines.slice(e.formsEnd)], e).join("\n") };
}

/** Add `fuzzy` to an entry's flags line, or add one after its other comments, before `msgctxt`/`msgid`. */
function markFuzzy(lines: string[], e: PoEntry): string[] {
  if (e.flagsLine !== undefined) {
    if (!e.fuzzy) lines[e.flagsLine] = `${lines[e.flagsLine]!}, fuzzy`;
    return lines;
  }
  let k = e.start;
  while (k < e.end && lines[k]!.startsWith("#")) k++;
  lines.splice(k, 0, "#, fuzzy");
  return lines;
}

// ── Planning the record ──────────────────────────────────────────────────

/** Who filed the issue, from the GitHub event (never from the body). */
export interface IssueAuthor {
  login: string;
  /** GitHub's `author_association`. */
  association: string;
}

export interface PlanInput {
  /** The layer's root on disk. */
  layerRoot: string;
  /** The layer's `owner/name`, from its declaration. */
  repository: string;
  /** The layer's `translation-sources` directory, relative to its root. */
  translations: string;
  payload: AdjudicationPayload;
  author: IssueAuthor;
  issueUrl: string;
  /** ISO 8601, the issue's creation time. */
  at: string;
  /** Where a catalogue's `translation-qa` attestation lives, relative to the layer root. */
  attestationPath: (catalogueFromRoot: string, locale: string) => string;
  /** The subject id an attestation names. */
  attestationSubject: (catalogueFromRoot: string) => string;
}

export interface Plan {
  /** Layer-relative path → new contents. */
  writes: Map<string, string>;
  applied: string[];
  refused: string[];
}

function readJson(path: string): Record<string, unknown> | null | undefined {
  if (!existsSync(path)) return undefined;
  try {
    const v = JSON.parse(readFileSync(path, "utf-8"));
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const json = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;

/**
 * Decide every write an issue makes. Pure apart from reading the layer's
 * files: the caller writes {@link Plan.writes}, so a test can inspect the
 * plan without a checkout.
 */
export function planAdjudication(input: PlanInput): Plan {
  const plan: Plan = { writes: new Map(), applied: [], refused: [] };
  const { payload: p, author } = input;
  if (!(ADJUDICATOR_ASSOCIATIONS as readonly string[]).includes(author.association)) {
    plan.refused.push(
      `@${author.login} is not an owner, member or collaborator of ${input.repository} (association ${author.association}); ` +
        "nothing is recorded. A maintainer can file the same review under their own name.",
    );
    return plan;
  }
  const problems = payloadProblems(p);
  if (problems.length > 0) {
    plan.refused.push(...problems.map((x) => `invalid record: ${x}`));
    return plan;
  }
  if (p.repository.toLowerCase() !== input.repository.toLowerCase()) {
    plan.refused.push(`the record is for ${p.repository}, but this is ${input.repository}`);
    return plan;
  }
  if (normalize(p.translations) !== normalize(input.translations)) {
    plan.refused.push(`the record names translations directory ${p.translations}, but this layer declares ${input.translations}`);
    return plan;
  }
  const seen = new Set<string>();
  for (const item of p.items) {
    const key = `${item.locale}/${item.catalogue}`;
    if (seen.has(key)) {
      plan.refused.push(`${key}: listed twice; only the first is recorded`);
      continue;
    }
    seen.add(key);
    const catFromRoot = join(input.translations, item.locale, item.catalogue).split(sep).join("/");
    const poRel = `${catFromRoot}.po`;
    const nodeRel = `${catFromRoot}.json`;
    const poAbs = join(input.layerRoot, poRel);
    const current = plan.writes.get(poRel) ?? (existsSync(poAbs) ? readFileSync(poAbs, "utf-8") : undefined);
    if (current === undefined) {
      plan.refused.push(`${key}: there is no catalogue ${poRel}`);
      continue;
    }
    if (poHash(current) !== item.poHash) {
      plan.refused.push(`${key}: the catalogue changed since the page showed it (hash ${item.poHash}, now ${poHash(current)}); reload the page and review it again`);
      continue;
    }

    let poText = current;
    const appliedSuggestions: Suggestion[] = [];
    if (item.verdict === "mistranslation") {
      for (const s of item.suggestions ?? []) {
        const r = applySuggestion(poText, s);
        if ("refused" in r) plan.refused.push(`${key}: ${r.refused}`);
        else {
          poText = r.text;
          appliedSuggestions.push(s);
        }
      }
      if (appliedSuggestions.length === 0) continue;
      plan.writes.set(poRel, poText);
    }

    // The translation node: what pageReview and the status page read.
    const nodeAbs = join(input.layerRoot, nodeRel);
    const node0 = plan.writes.has(nodeRel) ? (JSON.parse(plan.writes.get(nodeRel)!) as Record<string, unknown>) : readJson(nodeAbs);
    if (node0 === null) {
      plan.refused.push(`${key}: ${nodeRel} will not parse; recorded nothing for this catalogue`);
      plan.writes.delete(poRel);
      continue;
    }
    const node: Record<string, unknown> = node0 ?? {
      $schema: "translation-node/v1",
      label: `trans:${item.locale}/${item.catalogue}`,
      locale: item.locale,
      sourceFile: sourceFilesOf(current)[0] ?? "",
      ...(existsSync(join(input.layerRoot, `${catFromRoot}.pot`)) ? { potFile: `${catFromRoot}.pot` } : {}),
      poFile: poRel,
    };
    const status: Record<string, unknown> = { locale: item.locale, official: false, ...((node.status as Record<string, unknown>) ?? {}) };
    if (item.verdict === "acceptable") {
      status.official = true;
      status.signedOffBy = author.login;
      status.signedOffAt = input.at;
      status.level = "block";
      delete status.flaggedForReview;
      delete status.flagReason;
    } else {
      status.official = false;
      delete status.signedOffBy;
      delete status.signedOffAt;
      delete status.level;
      status.flaggedForReview = true;
      status.flagReason = `mistranslation reported by ${author.login} in ${input.issueUrl}; the suggested text awaits review`;
    }
    node.status = status;
    plan.writes.set(nodeRel, json(node));

    // The audited record: append-only.
    const attRel = input.attestationPath(catFromRoot, item.locale);
    const att0 = plan.writes.has(attRel) ? JSON.parse(plan.writes.get(attRel)!) : readJson(join(input.layerRoot, attRel));
    if (att0 === null) {
      plan.refused.push(`${key}: the attestation ${attRel} will not parse; it is never overwritten, so nothing is recorded for this catalogue`);
      plan.writes.delete(poRel);
      plan.writes.delete(nodeRel);
      continue;
    }
    const att = (att0 as Record<string, unknown> | undefined) ?? {
      $schema: "qa-attestations/v1",
      family: "translation-qa",
      subject: { kind: "block", id: input.attestationSubject(catFromRoot), path: input.attestationSubject(catFromRoot) },
      locale: item.locale,
      criteria: {},
    };
    const criteria = (att.criteria as Record<string, unknown[]>) ?? {};
    const entry: Record<string, unknown> = {
      reviewer: { kind: "human", id: `github:${author.login}` },
      verdict: item.verdict,
      at: input.at,
      issue: input.issueUrl,
      po_hash: item.poHash,
      ...(item.verdict === "mistranslation" ? { po_hash_after: poHash(poText) } : {}),
      ...(item.note ? { note: item.note } : {}),
      ...(appliedSuggestions.length > 0 ? { suggestions: appliedSuggestions } : {}),
    };
    criteria[ADJUDICATION_CRITERION] = [...(criteria[ADJUDICATION_CRITERION] ?? []), entry];
    att.criteria = criteria;
    plan.writes.set(attRel, json(att));
    plan.applied.push(
      item.verdict === "acceptable"
        ? `${key}: accepted`
        : `${key}: ${appliedSuggestions.length} suggestion(s) applied, marked fuzzy and flagged for review`,
    );
  }
  return plan;
}
