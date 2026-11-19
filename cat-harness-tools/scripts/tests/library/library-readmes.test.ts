/**
 * `library-readmes` — one README per library item, from its manifest (bean
 * `qgjh`, owner 2026-09-30: "like bootstrap readmes").
 */
import { describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { itemFacts, plan } from "../../library-readmes.ts";
import { splice } from "@litlfred/bootstrap-tools/scripts/subgraph-readmes.ts";

describe("an item's facts come from its manifest", () => {
  const dir = join(mkdtempSync(join(tmpdir(), "libreadme-")), "arxiv-2504.21474v1");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "manifest.jsonld"),
    JSON.stringify({
      title: "A Paper",
      provenance: "ingested",
      meta: { doc_id: "arxiv-2504.21474v1", source_file: "a.pdf", source_sha256: "0123456789abcdef", arxiv: { id: "2504.21474", version: "1" }, doi: null },
    }),
  );

  it("reads the arXiv record as the id arXiv itself cites", () => {
    expect(itemFacts(dir)!.arxiv).toBe("2504.21474v1");
  });

  it("says 'not recorded' as an empty value, never the word null", () => {
    expect(itemFacts(dir)!.doi).toBe("");
  });

  it("has no facts without a manifest", () => {
    expect(itemFacts(join(dir, "..", "nothing-here"))).toBeUndefined();
  });
});

describe("the markers are the platform's, the file is not", () => {
  it("leaves a README without markers alone", () => {
    expect(splice("# Written by a person\n", "# generated")).toBeUndefined();
  });
});

describe("the committed READMEs are current", () => {
  it("and match what the generator produces now", async () => {
    const { writes } = await plan();
    // The premise, asserted: a plan over nothing would pass the loop below.
    expect(writes.size).toBeGreaterThan(0);
    for (const [path, body] of writes) expect(readFileSync(path, "utf-8"), path).toBe(body);
  });
});
