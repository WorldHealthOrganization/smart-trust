/**
 * The Pages-address check of THIS repository's configuration, moved here from
 * `cat-harness-tools/scripts/tests/conduct/getting-started.test.ts` (owner, 2026-10-06:
 * "Throwaway repository, plus moving the real-repo checks"). It expects this
 * checkout's `origin` to derive `https://litlfred.github.io/folio-assistant/`,
 * which is a fact about this repository rather than about the derivation:
 * standing alone, cat-harness has no `origin`, and the derivation itself is
 * asserted in that file over a throwaway repository. The path is composed from
 * ORIGIN_DIR, the directory the test was written in, so nothing it reads
 * changed.
 */
import { describe, expect, test } from "bun:test";
import { join, resolve } from "node:path";

import { derivePagesUrl } from "../../scripts/pages-bootstrap.js";

/** The directory this test was written in (`cat-harness/scripts/tests/`). */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

const INSTANCE_ROOT = resolve(ORIGIN_DIR, "..", "..");

describe("pages-bootstrap — deriving the address", () => {
  test("this repo's own address is derived from the remote", () => {
    const r = derivePagesUrl(INSTANCE_ROOT);
    expect(r.url).toBe("https://litlfred.github.io/folio-assistant/");
    expect(r.urlSource).toBe("git remote");
  });
});
