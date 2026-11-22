/**
 * Per-slice SQLite in the browser. Bean `q8ar`; the contract is
 * `skills/kg/kg-core/kg-export.md` §"Per-slice SQLite".
 *
 *   const slice = await openSlice("../assets/slices/beans.sqlite3.json");
 *   const rows = await slice.query("SELECT id, title FROM beans WHERE status = ?", ["todo"]);
 *
 * ## What it does, in order
 *
 * 1. Fetches the MANIFEST (`no-store`, because it is small and is what says
 *    whether the database changed). The manifest is at a FIXED path; the
 *    database is not.
 * 2. Looks in OPFS for `/<slice>-<sha256>.sqlite3`. A hit opens with no
 *    download at all, because a new build has a new sha256 and so a new name.
 *    That is the whole cache-invalidation story.
 * 3. On a miss, it downloads the database BY THE NAME THE MANIFEST GIVES
 *    (`file`, published as `<slice>.<sha256>.sqlite3` — bean `wixl`) and
 *    verifies its sha256 against the manifest. Because the name is the hash,
 *    a CDN cannot pair a fresh manifest with a stale database under one URL;
 *    a stale manifest at worst names an older, self-consistent build. A
 *    mismatch is still REFUSED rather than opened, so a reader never searches
 *    bytes nobody vouched for, and it is a {@link SliceIntegrityError}: every
 *    fallback below re-throws it instead of downloading again, because the
 *    same URL would give the same answer and the page must say so. The file is
 *    then imported into the `opfs-sahpool` VFS and older builds of the same
 *    slice are unlinked.
 * 4. Opens the database. SQLite reads B-tree pages on demand, so there is no
 *    parse step.
 *
 * ## Why `opfs-sahpool` in a Worker, and not the `opfs` VFS
 *
 * The `opfs` VFS needs SharedArrayBuffer, which needs COOP/COEP response
 * headers, and GitHub Pages cannot send them. `opfs-sahpool` needs neither,
 * but its synchronous access handles exist only inside a Worker. So the
 * database lives in `slice-sqlite-worker.js` and this module talks to it.
 *
 * ## Fallback
 *
 * When OPFS is unavailable (no Worker, a private window, an old browser, a
 * locked pool), the same verified bytes are opened IN MEMORY with
 * `sqlite3_deserialize`. That still involves no parsing, but the database is
 * not persisted, so it is downloaded again on the next visit. The mode
 * actually used is reported (`slice.mode`), never assumed.
 *
 * Both paths run the same code: `openInScope` below runs inside the Worker
 * when there is one, and on the main thread when there is not.
 */

const SQLITE_URL = new URL("./vendor/sqlite-wasm/index.mjs", import.meta.url).href;
const POOL = "folio-slices";

async function sha256Hex(buf) {
  const d = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * The manifest and the database it names disagree. Not an OPFS failure, so no
 * fallback retries it: it is reported, never silently accepted.
 */
export class SliceIntegrityError extends Error {
  constructor(message) {
    super(message);
    this.name = "SliceIntegrityError";
  }
}

/** True for an integrity failure, including one that crossed the Worker boundary as text. */
const isIntegrity = (e) => !!e && (e.name === "SliceIntegrityError" || e.integrity === true);

/** `<slice>.<sha256>.sqlite3` — the name a content-addressed build is published under. */
const contentAddressed = (manifest) => manifest.file === `${manifest.slice}.${manifest.sha256}.sqlite3`;

async function fetchVerified(dbUrl, manifest) {
  // A content-addressed name is immutable, so the HTTP cache may answer it.
  const r = await fetch(dbUrl);
  if (!r.ok) {
    throw new Error(`slice ${manifest.slice}: ${manifest.file} answered ${r.status}` +
      (r.status === 404 && contentAddressed(manifest)
        ? " — the manifest names a build no longer published; reload to fetch the current manifest"
        : ""));
  }
  const buf = await r.arrayBuffer();
  const got = await sha256Hex(buf);
  if (got !== manifest.sha256) {
    throw new SliceIntegrityError(
      `slice ${manifest.slice}: the manifest and the database disagree — ${manifest.file} hashes to ${got}, ` +
      `the manifest promises ${manifest.sha256}. Refused, not opened.`,
    );
  }
  return new Uint8Array(buf);
}

/**
 * Open a slice in THIS scope (a Worker or the window). `allowOpfs` is false on
 * the main thread, where sync access handles do not exist.
 */
export async function openInScope(manifestUrl, { allowOpfs }) {
  const t0 = performance.now();
  const { default: sqlite3InitModule } = await import(SQLITE_URL);
  const sqlite3 = await sqlite3InitModule();
  const mr = await fetch(manifestUrl, { cache: "no-store" });
  if (!mr.ok) throw new Error(`slice manifest ${manifestUrl} answered ${mr.status}`);
  const manifest = await mr.json();
  const dbUrl = new URL(manifest.file, new URL(manifestUrl, location.href)).href;
  const name = `/${manifest.slice}-${manifest.sha256}.sqlite3`;

  let db = null;
  let mode = "memory";
  let downloaded = false;
  let opfsError = null;
  if (allowOpfs && typeof sqlite3.installOpfsSAHPoolVfs === "function") {
    try {
      const pool = await sqlite3.installOpfsSAHPoolVfs({ name: POOL });
      if (!pool.getFileNames().includes(name)) {
        const bytes = await fetchVerified(dbUrl, manifest);
        downloaded = true;
        await pool.reserveMinimumCapacity(pool.getFileCount() + 1);
        pool.importDb(name, bytes);
        // Older builds of THIS slice go; other slices are not ours to touch.
        for (const f of pool.getFileNames()) {
          if (f !== name && f.startsWith(`/${manifest.slice}-`)) pool.unlink(f);
        }
      }
      db = new pool.OpfsSAHPoolDb(name, "r");
      mode = "opfs-sahpool";
    } catch (e) {
      if (isIntegrity(e)) throw e;
      opfsError = String(e && e.message ? e.message : e);
      db = null;
    }
  }
  if (!db) {
    const bytes = await fetchVerified(dbUrl, manifest);
    downloaded = true;
    const p = sqlite3.wasm.allocFromTypedArray(bytes);
    db = new sqlite3.oo1.DB();
    const rc = sqlite3.capi.sqlite3_deserialize(
      db.pointer, "main", p, bytes.byteLength, bytes.byteLength,
      sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE | sqlite3.capi.SQLITE_DESERIALIZE_READONLY,
    );
    db.checkRc(rc);
    mode = "memory";
  }
  return {
    db,
    info: {
      mode,
      downloaded,
      // False only for a manifest written before bean `wixl` (a fixed `file`):
      // still verified by sha256, but a CDN can pair it with stale bytes.
      contentAddressed: contentAddressed(manifest),
      opfsError,
      ms: Math.round(performance.now() - t0),
      manifest,
      sqliteVersion: sqlite3.version.libVersion,
    },
  };
}

export function runQuery(db, sql, params) {
  return db.exec({ sql, bind: params && params.length ? params : undefined, rowMode: "object", returnValue: "resultRows" });
}

/**
 * Open a slice and return `{ mode, info, query(sql, params) }`. It prefers a
 * Worker with OPFS and falls back to the main thread in memory.
 */
export async function openSlice(manifestUrl) {
  const abs = new URL(manifestUrl, location.href).href;
  if (typeof Worker === "function") {
    try {
      const worker = new Worker(new URL("./slice-sqlite-worker.js", import.meta.url), { type: "module" });
      let seq = 0;
      const pending = new Map();
      worker.onmessage = (ev) => {
        const { id, ok, result, error, integrity } = ev.data;
        const p = pending.get(id);
        if (!p) return;
        pending.delete(id);
        if (ok) p.resolve(result);
        else p.reject(integrity ? new SliceIntegrityError(error) : new Error(error));
      };
      // A Worker that fails to LOAD sends no message, only an error event. Without
      // this the open would hang forever instead of falling back.
      worker.onerror = (ev) => {
        ev.preventDefault();
        for (const p of pending.values()) p.reject(new Error(ev.message || "slice worker failed to load"));
        pending.clear();
      };
      const call = (op, args) =>
        new Promise((resolve, reject) => {
          const id = ++seq;
          pending.set(id, { resolve, reject });
          worker.postMessage({ id, op, ...args });
        });
      const info = await call("open", { manifestUrl: abs });
      return { mode: info.mode, info, query: (sql, params = []) => call("query", { sql, params }) };
    } catch (e) {
      // A manifest/database mismatch is the answer, not a Worker problem.
      if (isIntegrity(e)) throw e;
      // A Worker that cannot start or cannot open falls through to the main
      // thread. The reason is kept, so the page can say why it is in memory.
      const { db, info } = await openInScope(abs, { allowOpfs: false });
      info.workerError = String(e && e.message ? e.message : e);
      return { mode: info.mode, info, query: async (sql, params = []) => runQuery(db, sql, params) };
    }
  }
  const { db, info } = await openInScope(abs, { allowOpfs: false });
  return { mode: info.mode, info, query: async (sql, params = []) => runQuery(db, sql, params) };
}
