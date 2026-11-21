/**
 * BagIt (RFC 8493) manifests for the IRIS CDN export, written so that an
 * unchanged payload produces byte-identical tag files.
 *
 * The churn rule (owner, 2026-10-30: "minimize/avoid churn of content that
 * hasn't changed") is enforced here, not hoped for:
 *  - manifest lines are sorted by path, with LF endings and no trailing space;
 *  - `bag-info.txt` carries NO `Bagging-Date` (RFC 8493 §2.2.2 makes it
 *    optional), because a date would change the tag manifest, and so the
 *    signature, on a night when nothing else did;
 *  - a file is identified by its SHA-256, so the diff between two manifests
 *    is the exact set of bytes a publish has to move.
 *
 * @see https://www.rfc-editor.org/rfc/rfc8493
 */
import { createHash } from "node:crypto";

/** One payload file: its path inside `data/` and its SHA-256, lower-case hex. */
export interface PayloadEntry {
  path: string;
  sha256: string;
  bytes: number;
}

export const sha256Hex = (bytes: Uint8Array | string): string =>
  createHash("sha256").update(bytes).digest("hex");

const SHA256 = /^[0-9a-f]{64}$/;

/** RFC 8493 §2.1.1: `bagit.txt`. Fixed bytes. */
export const BAGIT_TXT = "BagIt-Version: 1.0\nTag-File-Character-Encoding: UTF-8\n";

function checkEntry(e: PayloadEntry): void {
  if (!SHA256.test(e.sha256)) throw new Error(`not a lower-case SHA-256: ${e.sha256} (${e.path})`);
  if (e.path.startsWith("/") || e.path.split("/").includes("..")) throw new Error(`unsafe payload path: ${e.path}`);
  if (/[\r\n]/.test(e.path)) throw new Error(`payload path holds a line break: ${JSON.stringify(e.path)}`);
  if (!Number.isInteger(e.bytes) || e.bytes < 0) throw new Error(`bad byte count for ${e.path}: ${e.bytes}`);
}

/** Sorted by path, byte order, so the order never depends on how files were found. */
export function sortEntries(entries: readonly PayloadEntry[]): PayloadEntry[] {
  const seen = new Set<string>();
  for (const e of entries) {
    checkEntry(e);
    if (seen.has(e.path)) throw new Error(`duplicate payload path: ${e.path}`);
    seen.add(e.path);
  }
  return [...entries].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** RFC 8493 §2.1.3: `manifest-sha256.txt`, one `<digest> data/<path>` per line. */
export function payloadManifest(entries: readonly PayloadEntry[]): string {
  return sortEntries(entries).map((e) => `${e.sha256} data/${e.path}\n`).join("");
}

/**
 * RFC 8493 §2.2.2: `bag-info.txt`. Only fields that are a function of the
 * payload — `Payload-Oxum` is `<octets>.<file count>` — plus the caller's
 * fixed labels. Never a date.
 */
export function bagInfo(entries: readonly PayloadEntry[], labels: Readonly<Record<string, string>> = {}): string {
  const sorted = sortEntries(entries);
  const octets = sorted.reduce((n, e) => n + e.bytes, 0);
  const fields: [string, string][] = Object.entries(labels).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  for (const [k] of fields) {
    if (/date/i.test(k)) throw new Error(`bag-info label "${k}" would put a date in the signed bytes`);
  }
  fields.push(["Payload-Oxum", `${octets}.${sorted.length}`]);
  return fields.map(([k, v]) => `${k}: ${v}\n`).join("");
}

/** The tag files of a bag, keyed by name. */
export interface TagFiles {
  "bagit.txt": string;
  "bag-info.txt": string;
  "manifest-sha256.txt": string;
  "tagmanifest-sha256.txt": string;
}

/** RFC 8493 §2.2.1: the tag manifest covers every other tag file. This is the signed payload. */
export function tagFiles(entries: readonly PayloadEntry[], labels: Readonly<Record<string, string>> = {}): TagFiles {
  const tags = {
    "bag-info.txt": bagInfo(entries, labels),
    "bagit.txt": BAGIT_TXT,
    "manifest-sha256.txt": payloadManifest(entries),
  };
  const tagmanifest = Object.keys(tags)
    .sort()
    .map((name) => `${sha256Hex(tags[name as keyof typeof tags])} ${name}\n`)
    .join("");
  return { ...tags, "tagmanifest-sha256.txt": tagmanifest };
}

/** Parse `manifest-sha256.txt` back to `path → sha256` (paths without `data/`). */
export function parsePayloadManifest(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of text.split("\n")) {
    if (line === "") continue;
    const m = /^([0-9a-f]{64})[ \t]+data\/(.+)$/.exec(line);
    if (!m) throw new Error(`not a manifest-sha256 line: ${JSON.stringify(line)}`);
    out.set(m[2], m[1]);
  }
  return out;
}

export interface ManifestDiff {
  added: string[];
  changed: string[];
  removed: string[];
  unchanged: number;
}

/**
 * What a publish must move. `added` and `changed` are uploaded; `removed` is
 * dropped from the manifest (bytes already published stay addressable —
 * content-addressed objects are never deleted by a nightly run).
 */
export function diffManifests(previous: ReadonlyMap<string, string>, next: ReadonlyMap<string, string>): ManifestDiff {
  const added: string[] = [];
  const changed: string[] = [];
  const removed: string[] = [];
  let unchanged = 0;
  for (const [path, digest] of next) {
    const was = previous.get(path);
    if (was === undefined) added.push(path);
    else if (was !== digest) changed.push(path);
    else unchanged++;
  }
  for (const path of previous.keys()) if (!next.has(path)) removed.push(path);
  return { added: added.sort(), changed: changed.sort(), removed: removed.sort(), unchanged };
}

export const isEmptyDiff = (d: ManifestDiff): boolean =>
  d.added.length === 0 && d.changed.length === 0 && d.removed.length === 0;

/**
 * One library item's own manifest (owner, 2026-10-30, Q4 A: a signature on
 * each library item): the `manifest-sha256.txt` lines of its record and of
 * every file under it, nothing else. It lives in the payload at
 * `items/<handle>/manifest-sha256.txt`, its detached JWS beside it, so the
 * release manifest covers both. Same item content, same bytes — so an
 * unchanged item's manifest digest does not move and it is never re-signed.
 */
export const itemManifestPath = (handle: string): string => `items/${handle}/manifest-sha256.txt`;

export function itemManifest(handle: string, entries: Iterable<PayloadEntry>): string {
  const record = `records/${handle}.json`;
  const files = `bitstreams/${handle}/`;
  const mine = [...entries].filter((e) => e.path === record || e.path.startsWith(files));
  if (!mine.some((e) => e.path === record)) throw new Error(`item ${handle} has no record in the payload`);
  return payloadManifest(mine);
}
