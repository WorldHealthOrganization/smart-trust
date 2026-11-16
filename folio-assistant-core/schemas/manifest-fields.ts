/**
 * A block manifest's fields, read from its TEXT: the object literal passed to
 * its builder (`persona({ ... })`), flattened to `path → value`. Bean
 * `folio-assistant-f327`.
 *
 * ## Why read, not run
 *
 * The ChangeSet reads both sides of a pull request as text and executes
 * neither (`changeset.ts`): the base side is a tree the reviewer has not
 * vetted, and running a manifest runs whatever it imports. A field diff of a
 * DAK block — a persona's type, a requirement's priority, a data element's
 * code — needs the fields, so they are parsed out of the literal here.
 *
 * ## What it reads, and what it does not
 *
 * Object literals, arrays, strings (single, double, and backtick without
 * `${}`), numbers, `true`/`false`/`null`, with identifier or quoted keys.
 * Anything else — a variable, a call, a template with a substitution, a
 * spread — is kept as its source text, verbatim, under its key. A value it
 * cannot read is said as source, never dropped and never guessed.
 *
 * @module folio-assistant-core/schemas/manifest-fields
 * @graphNode none — a text parser for block manifests' fields: it defines no schema
 */

/** A field path (`meta.source.file`, `uses[0]`) → its value as a reader sees it. */
export type ManifestFields = Record<string, string>;

/** Fields that are the block's identity, compared by the ChangeSet itself. */
const IDENTITY = new Set(["label", "renamedFrom"]);

type Value = { kind: "object"; entries: Array<[string, Value]> } | { kind: "array"; items: Value[] } | { kind: "scalar"; text: string } | { kind: "raw"; text: string };

class Reader {
  i = 0;
  constructor(readonly s: string) {}
  ws(): void {
    for (;;) {
      while (this.i < this.s.length && /\s/.test(this.s[this.i]!)) this.i++;
      if (this.s.startsWith("//", this.i)) {
        const n = this.s.indexOf("\n", this.i);
        this.i = n < 0 ? this.s.length : n;
      } else if (this.s.startsWith("/*", this.i)) {
        const n = this.s.indexOf("*/", this.i + 2);
        this.i = n < 0 ? this.s.length : n + 2;
      } else return;
    }
  }
  string(): string | undefined {
    const q = this.s[this.i];
    if (q !== '"' && q !== "'" && q !== "`") return undefined;
    let out = "";
    let j = this.i + 1;
    for (; j < this.s.length; j++) {
      const c = this.s[j]!;
      if (c === "\\") {
        const n = this.s[++j] ?? "";
        out += n === "n" ? "\n" : n === "t" ? "\t" : n;
        continue;
      }
      if (q === "`" && c === "$" && this.s[j + 1] === "{") return undefined; // a substitution: not a literal
      if (c === q) break;
      out += c;
    }
    this.i = j + 1;
    return out;
  }
  /** Skip one value of any shape, string- and bracket-aware, and return its source. */
  skip(): string {
    const start = this.i;
    let depth = 0;
    while (this.i < this.s.length) {
      const c = this.s[this.i]!;
      if (c === '"' || c === "'" || c === "`") {
        const q = c;
        this.i++;
        while (this.i < this.s.length && this.s[this.i] !== q) this.i += this.s[this.i] === "\\" ? 2 : 1;
        this.i++;
        continue;
      }
      if ("{[(".includes(c)) depth++;
      else if ("}])".includes(c)) {
        if (depth === 0) break;
        depth--;
      } else if (c === "," && depth === 0) break;
      this.i++;
    }
    return this.s.slice(start, this.i).trim();
  }
  value(): Value {
    this.ws();
    const c = this.s[this.i];
    const start = this.i;
    if (c === "{") {
      const o = this.object();
      if (o) return o;
    } else if (c === "[") {
      const a = this.array();
      if (a) return a;
    } else {
      const str = this.string();
      if (str !== undefined) {
        this.ws();
        if (this.s[this.i] === "," || this.s[this.i] === "}" || this.s[this.i] === "]") return { kind: "scalar", text: str };
      } else {
        const m = /^(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)\b/.exec(this.s.slice(this.i));
        if (m) {
          this.i += m[0].length;
          this.ws();
          if (this.s[this.i] === "," || this.s[this.i] === "}" || this.s[this.i] === "]") return { kind: "scalar", text: m[0] };
        }
      }
    }
    this.i = start;
    return { kind: "raw", text: this.skip() };
  }
  object(): Value | undefined {
    const start = this.i;
    this.i++;
    const entries: Array<[string, Value]> = [];
    for (;;) {
      this.ws();
      if (this.s[this.i] === "}") {
        this.i++;
        return { kind: "object", entries };
      }
      let key = this.string();
      if (key === undefined) {
        const m = /^[A-Za-z_$][\w$]*/.exec(this.s.slice(this.i));
        if (!m) break; // a spread or a computed key: not a plain literal
        key = m[0];
        this.i += key.length;
      }
      this.ws();
      if (this.s[this.i] !== ":") break; // shorthand `{ a }`: its value is elsewhere
      this.i++;
      entries.push([key, this.value()]);
      this.ws();
      if (this.s[this.i] === ",") this.i++;
    }
    this.i = start;
    return undefined;
  }
  array(): Value | undefined {
    const start = this.i;
    this.i++;
    const items: Value[] = [];
    for (;;) {
      this.ws();
      if (this.s[this.i] === "]") {
        this.i++;
        return { kind: "array", items };
      }
      if (this.i >= this.s.length) break;
      items.push(this.value());
      this.ws();
      if (this.s[this.i] === ",") this.i++;
      else if (this.s[this.i] !== "]") break;
    }
    this.i = start;
    return undefined;
  }
}

function flatten(v: Value, path: string, out: ManifestFields): void {
  if (v.kind === "object") {
    if (v.entries.length === 0) out[path] = "{}";
    for (const [k, x] of v.entries) flatten(x, path ? `${path}.${k}` : k, out);
  } else if (v.kind === "array") {
    // An array of scalars is one field, read as a list; anything nested is
    // indexed, so a change inside the third entry names the third entry.
    if (v.items.every((x) => x.kind === "scalar")) out[path] = v.items.map((x) => (x as { text: string }).text).join(", ") || "(none)";
    else v.items.forEach((x, i) => flatten(x, `${path}[${i}]`, out));
    if (v.items.length === 0) out[path] = "(none)";
  } else out[path] = v.text;
}

/**
 * The fields of the manifest `src`: the object literal passed to its default
 * export's builder call, flattened. `undefined` when there is no such call.
 */
export function manifestFields(src: string): ManifestFields | undefined {
  const m = /export\s+default\s+[A-Za-z_$][\w$.]*\s*\(\s*\{/.exec(src);
  if (!m) return undefined;
  const r = new Reader(src);
  r.i = m.index + m[0].length - 1;
  const v = r.value();
  if (v.kind !== "object") return undefined;
  const out: ManifestFields = {};
  for (const [k, x] of v.entries) if (!IDENTITY.has(k)) flatten(x, k, out);
  return out;
}
