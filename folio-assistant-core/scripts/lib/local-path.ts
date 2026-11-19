/**
 * Does a materialisation's `localPath` name bytes that are actually there?
 *
 * @module folio-assistant-core/scripts/lib/local-path
 *
 * Moved from the IRIS catalogue layer's `scripts/lib/` on 2026-09-30 (bean `eayu`, owner:
 * *"dspace scripts generic in folio-assistant"*). It was already generic — it
 * takes the layer directory as a parameter — so only its home changed.
 *
 * ## Why this is a module rather than four lines in the checker
 *
 * `check-catalogue.ts` is imperative top to bottom: importing it RUNS the
 * check against the real layer and may `process.exit(1)`. A test that
 * imported it to reach one helper would run the gate as a side effect of
 * loading, and would then be asserting against whatever the corpus happens to
 * hold today rather than against a case it planted. So the decision lives
 * here, where a test can hand it a directory it built — the same split
 * `lib/bytes.ts` already uses.
 *
 * ## Three states, and the third is the whole reason this is not `existsSync`
 *
 * **Unreadable is not absent.** A permissions fault, a broken symlink chain, a
 * filesystem that errors — reporting any of those as "does not exist" sends a
 * reader looking for bytes that are sitting right there, and reporting them as
 * a pass is worse. `could not determine` is its own answer and it is never
 * rendered as clean, which is the rule `check:ci-health` and the health checks
 * keep one level out.
 *
 * A path that names a DIRECTORY is `missing`, not `ok`: `localPath` is where
 * the bytes landed, and a directory is not bytes.
 */
import { statSync } from "node:fs";
import { join } from "node:path";

/** What one `localPath` claim turned out to be. */
export type LocalPathState = "ok" | "missing" | "unknown";

export interface LocalPathVerdict {
  state: LocalPathState;
  /** Why, where the state alone does not say it. Empty for `ok`. */
  detail: string;
}

/**
 * Resolve one `localPath` against the layer it is relative to.
 *
 * `localPath` is **layer-relative** by the schema's own contract — *"where
 * the bytes landed, layer-relative"* — so this joins it to `instanceDir`
 * and nowhere else. That is deliberate rather than incidental: bean `yl5w`'s
 * three failing claims name bytes that DO exist, one layer over, and a
 * resolver that searched the repository would have called them present and
 * made the contract unenforceable.
 */
export function checkLocalPath(instanceDir: string, localPath: string): LocalPathVerdict {
  try {
    const st = statSync(join(instanceDir, localPath));
    return st.isFile() ? { state: "ok", detail: "" } : { state: "missing", detail: "names a directory, not a file" };
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return { state: "missing", detail: "" };
    return { state: "unknown", detail: (e as Error).message.split("\n")[0] };
  }
}
