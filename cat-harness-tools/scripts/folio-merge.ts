/**
 * The folio page's two sources, merged: the PUBLISHED folio graph and the
 * READER'S folio in this browser.
 *
 * Owner, 2026-11-13: *"https://litlfred.github.io/who-iris/en/cat-harness/folio/who-iris/
 * and wants in browser cache dont agree. update js to load both dynamically"*.
 * The page drew only the projection the site publishes
 * (`assets/folio/<instance>/index.json`), while the folio glass draws what
 * the reader pulled out or pinned, held in `localStorage` under
 * `fa-folio-assets` (docs-ui.js, R30 `j2if`). The two lists never met, so a
 * reader saw one sticky on the page and a glass full of cards above it, with
 * nothing to say which was which.
 *
 * ## The rule
 *
 * A UNION keyed by the item's id. Neither side is ever dropped.
 *
 * | field | wins |
 * |---|---|
 * | content: title, summary, links, href, anchor, theme, declaredIn, chars | the PUBLISHED copy |
 * | the reader's own state: shown, geom, zoom, window | the LOCAL copy |
 * | kind, nodeKind, avatar, source | local (published nodes do not carry them) |
 *
 * Each row says where it came from: `synced` (in both), `published` (on the
 * site, not in this browser's folio), `unsynced` (in this browser only, not
 * published — kept, and marked so).
 *
 * A local key matches a published node when it IS the node's id, or the
 * library form `<instance>/<id>`, or either of those behind a `pin:` or
 * `bookmark:` prefix (docs-ui's `pinKeyOf`). Nothing else is guessed.
 *
 * ONE self-contained function on purpose, as `word-diff.ts`: `gen-folio-viz`
 * embeds it in the page with `mergeFolio.toString()`, so the function the
 * tests exercise is the one the reader's browser runs. No backticks, no
 * imports, no helpers outside it.
 */

/** A node of the published projection, as far as the merge reads it. */
export interface PublishedFolioNode {
  id: string;
  summary?: string;
  theme?: string | null;
  anchor?: string | null;
  declaredIn?: string | null;
  links?: Array<{ label: string; href: string }>;
  chars?: number;
  file?: string;
}

/** One entry of `fa-folio-assets`, as docs-ui writes it. */
export interface LocalFolioEntry {
  shown?: boolean;
  title?: string;
  href?: string;
  avatar?: string;
  kind?: string;
  nodeKind?: string;
  source?: string;
  geom?: { left: number; top: number; width: number; height: number };
  [field: string]: unknown;
}

export type FolioMergeStatus = "synced" | "published" | "unsynced";

export interface FolioMergeRow {
  /** The published id, or the local store key for an unsynced item. */
  id: string;
  /** The local store key, or null when this browser holds none. */
  key: string | null;
  status: FolioMergeStatus;
  title: string;
  summary: string;
  href: string;
  /** Where `href` came from: a published link is site-rooted, a local one is the page's own address. */
  hrefFrom: "published" | "local" | "";
  links: Array<{ label: string; href: string }>;
  anchor: string | null;
  theme: string | null;
  declaredIn: string | null;
  chars: number | null;
  kind: string;
  nodeKind: string;
  avatar: string;
  source: string;
  /** true on the glass, false in the folio but shelved, null not in this browser. */
  shown: boolean | null;
  geom: LocalFolioEntry["geom"] | null;
  /** The reader's other per-item state (zoom, window, ...), untouched. */
  layout: Record<string, unknown>;
}

export interface FolioMerge {
  rows: FolioMergeRow[];
  counts: { published: number; local: number; synced: number; unsynced: number; publishedOnly: number };
}

export function mergeFolio(
  published: PublishedFolioNode[] | null | undefined,
  local: Record<string, LocalFolioEntry> | null | undefined,
  instance?: string,
): FolioMerge {
  const CONTENT = { title: 1, summary: 1, href: 1, links: 1, anchor: 1, theme: 1, declaredIn: 1, chars: 1, file: 1, id: 1 } as Record<string, number>;
  const DESCRIBE = { kind: 1, nodeKind: 1, avatar: 1, source: 1, shown: 1, geom: 1 } as Record<string, number>;
  const pub = Array.isArray(published) ? published.filter(function (n) { return n && typeof n.id === "string" && n.id; }) : [];
  const loc = local && typeof local === "object" && !Array.isArray(local) ? local : {};
  const str = function (v: unknown): string { return v == null ? "" : String(v); };
  const bare = function (k: string): string { return k.replace(/^(pin|bookmark):/, ""); };
  const byId: Record<string, string> = {};
  for (let i = 0; i < pub.length; i++) {
    byId[pub[i]!.id] = pub[i]!.id;
    if (instance) byId[instance + "/" + pub[i]!.id] = pub[i]!.id;
  }
  // Which local key each published id took. The FIRST key in store order wins;
  // a second key naming the same id stays its own unsynced row rather than
  // being folded away (never drop a side).
  const claimed: Record<string, string> = {};
  const localKeys = Object.keys(loc);
  for (let j = 0; j < localKeys.length; j++) {
    const lk = localKeys[j]!;
    const e = loc[lk];
    if (!e || typeof e !== "object") continue;
    const pid = Object.prototype.hasOwnProperty.call(byId, lk) ? byId[lk]! :
      Object.prototype.hasOwnProperty.call(byId, bare(lk)) ? byId[bare(lk)]! : "";
    if (pid && !Object.prototype.hasOwnProperty.call(claimed, pid)) claimed[pid] = lk;
  }
  const layoutOf = function (en: LocalFolioEntry | null): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (!en) return out;
    const ks = Object.keys(en);
    for (let m = 0; m < ks.length; m++) if (!CONTENT[ks[m]!] && !DESCRIBE[ks[m]!]) out[ks[m]!] = en[ks[m]!];
    return out;
  };
  const row = function (id: string, key: string | null, n: PublishedFolioNode | null, en: LocalFolioEntry | null): FolioMergeRow {
    const links = n && Array.isArray(n.links) ? n.links : [];
    const title = n ? str(n.summary) || (en && str(en.title)) || n.id : str(en && en.title) || id;
    const pubHref = links.length ? str(links[0]!.href) : "";
    const locHref = en ? str(en.href) : "";
    return {
      id: id,
      key: key,
      status: n && en ? "synced" : n ? "published" : "unsynced",
      title: title,
      summary: n ? str(n.summary) : "",
      href: pubHref || locHref,
      hrefFrom: pubHref ? "published" : locHref ? "local" : "",
      links: links,
      anchor: n && n.anchor != null ? str(n.anchor) : null,
      theme: n && n.theme != null ? str(n.theme) : null,
      declaredIn: n && n.declaredIn != null ? str(n.declaredIn) : null,
      chars: n && typeof n.chars === "number" ? n.chars : null,
      kind: en ? str(en.kind) : "",
      nodeKind: en ? str(en.nodeKind) : "",
      avatar: en ? str(en.avatar) : "",
      source: en ? str(en.source) : "",
      shown: en ? en.shown === true : null,
      geom: en && en.geom && typeof en.geom === "object" ? en.geom : null,
      layout: layoutOf(en),
    };
  };
  const rows: FolioMergeRow[] = [];
  const used: Record<string, number> = {};
  for (let p = 0; p < pub.length; p++) {
    const nd = pub[p]!;
    const ck = Object.prototype.hasOwnProperty.call(claimed, nd.id) ? claimed[nd.id]! : null;
    if (ck !== null) used[ck] = 1;
    rows.push(row(nd.id, ck, nd, ck !== null ? loc[ck]! : null));
  }
  for (let q = 0; q < localKeys.length; q++) {
    const k2 = localKeys[q]!;
    if (used[k2] || !loc[k2] || typeof loc[k2] !== "object") continue;
    rows.push(row(k2, k2, null, loc[k2]!));
  }
  const c = { published: pub.length, local: 0, synced: 0, unsynced: 0, publishedOnly: 0 };
  for (let r = 0; r < rows.length; r++) {
    if (rows[r]!.status === "synced") { c.synced++; c.local++; }
    else if (rows[r]!.status === "unsynced") { c.unsynced++; c.local++; }
    else c.publishedOnly++;
  }
  return { rows: rows, counts: c };
}
