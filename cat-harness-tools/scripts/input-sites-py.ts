/**
 * The input-site audit for Python sources a test's child process ran.
 *
 * @module scripts/input-sites-py
 * @graphNode none — a helper of `ci-cone.ts`, not a gate itself
 *
 * `input-sites.ts` audits the TypeScript a check runs. A test may also run a
 * `python3` child (an implicit `spawned` site, `testSpawnVerdict`), whose
 * source files are in the traced read set, so a change to one reruns the
 * test, but whose reads of the environment, the clock, the network and other
 * programs are not. This scans every `.py` file the run read for those, by
 * the same rule: a line that matches a risk needs a reviewed, pinned
 * annotation, `# input-site: <verdicts> #<pin>`, on the comment lines above
 * it, or the run records nothing (`ci-cone.ts` `childInputsOf`).
 *
 * The verdicts a Python site may carry are the ones the cone can answer from
 * a trace: `env` / `env-unset` (recorded with their values), `inert`, and
 * `tree` / `head` / `refs` for a git command, which the cone replays. The pin
 * is {@link statementPin}'s, so one reviewer's tool serves both languages.
 *
 * Like its TypeScript twin it is a reviewer's aid with a refusal default,
 * not a sandbox: a read spelled to dodge every pattern is not seen.
 */
import { parseVerdicts, statementPin, type SiteVerdict } from "./input-sites.ts";

/** Patterns for a Python line that can read something the trace does not record. */
export const PY_RISKS: Readonly<Record<string, RegExp>> = {
  env: /\bos\.environ\b|\bgetenv\s*\(|\benviron\b/,
  // A call that starts a process; or an import that renames one, whose uses no call pattern sees.
  spawn: /\bsubprocess\.(?:run|call|check_call|check_output|Popen|getoutput|getstatusoutput)\b|\bfrom\s+subprocess\s+import\b|\bimport\s+subprocess\s+as\b|\bos\.(?:system|popen|exec\w*|spawn\w*|fork)\s*\(|\bpty\b/,
  network: /\burllib\b|\brequests\b|\bsocket\b|\bhttp\.client\b|\bhttpx\b|\bftplib\b|\bsmtplib\b|\baiohttp\b/,
  clock: /\btime\.(?:time|time_ns|monotonic|perf_counter|localtime|gmtime|ctime|strftime)\s*\(|\b(?:datetime|date)\.(?:now|utcnow|today)\s*\(/,
  random: /\brandom\.|\buuid\.uuid[14]\s*\(|\bsecrets\.|\bos\.urandom\s*\(/,
  host: /\bexpanduser\s*\(|\bPath\.home\s*\(|\bgetpass\b|\bplatform\.node\s*\(|\bgethostname\s*\(|\bgettempdir\s*\(|\bcpu_count\s*\(|\bgetlogin\s*\(/,
  // Code that no file holds. A module loaded by name (`importlib`, `__import__`)
  // is not here: the interpreter opens its file, so it is in the read set and
  // audited like any other, or, installed, recorded as a package file.
  computed: /(?<![\w.])exec\s*\(|(?<![\w.])eval\s*\(|(?<![\w.])compile\s*\(/,
};

/** The verdicts a Python site may carry: what a trace and the recorded variables can answer. */
const PY_VERDICTS: ReadonlySet<SiteVerdict["kind"]> = new Set(["env", "env-unset", "inert", "tree", "head", "refs"]);

const PY_ANNOTATION_RE = /^\s*#\s*input-site:\s*(.+?)\s*#([0-9a-f]{8})\b/;

/** One risky line of a Python file, and its reviewed verdicts or the problem with them. */
export interface PySite {
  file: string;
  /** 1-based. */
  line: number;
  risks: string[];
  pin: string;
  verdicts: SiteVerdict[] | "stale" | undefined;
  malformed?: string;
}

/**
 * Each line of `text` with its string literals and comments blanked, so a
 * pattern matches code only. Triple-quoted strings (docstrings) span lines.
 */
export function blankPython(text: string): string[] {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const c = text[i]!;
    if (c === "#") {
      while (i < text.length && text[i] !== "\n") {
        out += " ";
        i++;
      }
      continue;
    }
    if (c === '"' || c === "'") {
      const triple = text.startsWith(c.repeat(3), i);
      const close = triple ? c.repeat(3) : c;
      out += triple ? "   " : " ";
      i += close.length;
      while (i < text.length && !text.startsWith(close, i)) {
        if (!triple && text[i] === "\n") break; // an unterminated literal ends with its line
        if (text[i] === "\\" && i + 1 < text.length) {
          out += text[i + 1] === "\n" ? " \n" : "  ";
          i += 2;
          continue;
        }
        out += text[i] === "\n" ? "\n" : " ";
        i++;
      }
      if (text.startsWith(close, i)) {
        out += " ".repeat(close.length);
        i += close.length;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out.split("\n");
}

/** Every risky line of one Python source, with its annotation read and checked. */
export function scanPython(file: string, text: string): PySite[] {
  const lines = text.split("\n");
  const code = blankPython(text);
  const sites: PySite[] = [];
  for (let i = 0; i < lines.length; i++) {
    const c = code[i] ?? "";
    if (c.trim() === "") continue;
    const risks = Object.entries(PY_RISKS)
      .filter(([, re]) => re.test(c))
      .map(([k]) => k);
    if (risks.length === 0) continue;
    const pin = statementPin(lines, i);
    let verdicts: PySite["verdicts"];
    let malformed: string | undefined;
    for (let j = i - 1; j >= 0 && lines[j]!.trim().startsWith("#"); j--) {
      const m = PY_ANNOTATION_RE.exec(lines[j]!);
      if (m === null) continue;
      const parsed = parseVerdicts(m[1]!);
      if ("error" in parsed) malformed = parsed.error;
      else if (parsed.some((v) => !PY_VERDICTS.has(v.kind))) malformed = `a Python site takes only ${[...PY_VERDICTS].join(", ")}`;
      else verdicts = m[2] === pin ? parsed : "stale";
      break;
    }
    sites.push({ file, line: i + 1, risks, pin, verdicts, ...(malformed ? { malformed } : {}) });
  }
  return sites;
}

/** What the Python sources a run read can read from the environment, or the first site nobody reviewed. */
export function auditPython(
  files: readonly { file: string; text: string }[],
): { env: string[]; envUnset: string[] } | { undetermined: string } {
  const env = new Set<string>();
  const envUnset = new Set<string>();
  for (const { file, text } of files) {
    for (const s of scanPython(file, text)) {
      const where = `${s.file}:${s.line} (${s.risks.join(", ")})`;
      if (s.malformed !== undefined) return { undetermined: `malformed input-site annotation at ${where}: ${s.malformed}` };
      if (s.verdicts === undefined) return { undetermined: `unannotated input site at ${where}` };
      if (s.verdicts === "stale") return { undetermined: `stale input-site pin at ${where} — re-read it and re-pin #${s.pin}` };
      for (const v of s.verdicts) {
        if (v.kind === "env") v.names.forEach((n) => env.add(n));
        else if (v.kind === "env-unset") v.names.forEach((n) => envUnset.add(n));
      }
    }
  }
  return { env: [...env].sort(), envUnset: [...envUnset].sort() };
}
