/**
 * The Worker half of `slice-sqlite.js`: it owns the database, because the
 * `opfs-sahpool` VFS's synchronous access handles exist only in a Worker.
 * Messages are `{id, op: "open"|"query", ...}` and each one is answered with
 * `{id, ok, result|error}`. Bean `q8ar`.
 */
import { openInScope, runQuery } from "./slice-sqlite.js";

let db = null;

self.onmessage = async (ev) => {
  const { id, op } = ev.data;
  try {
    if (op === "open") {
      const opened = await openInScope(ev.data.manifestUrl, { allowOpfs: true });
      db = opened.db;
      self.postMessage({ id, ok: true, result: opened.info });
    } else if (op === "query") {
      if (!db) throw new Error("slice is not open");
      self.postMessage({ id, ok: true, result: runQuery(db, ev.data.sql, ev.data.params) });
    } else {
      throw new Error(`unknown op ${op}`);
    }
  } catch (e) {
    // `integrity` survives the structured clone where an Error subclass would not.
    self.postMessage({ id, ok: false, error: String(e && e.message ? e.message : e), integrity: !!e && e.name === "SliceIntegrityError" });
  }
};
