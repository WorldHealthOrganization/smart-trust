import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "check-dsa-hash",
    title: "Verify Data Sharing Agreement hash, citation, and vocabulary terms",
    description:
      "Verify a Data Sharing Agreement (DSA) directory or single version: checks that every JSON-LD term in `agreement.jsonld` and `dcat.jsonld` is defined in the SHA-256-pinned official W3C ODRL 2.2, W3C DCAT 3 (with SPDX 2.2.2 and ADMS), or DCMI Metadata Terms contexts; checks that the ODRL 2.2 Agreement's `uid` is the version's fixed-version URL and its `dcterms:source` cites the DCAT 3 `dcat:Distribution` whose `spdx:checksum` is checked; verifies that the SHA-256 digest of `agreement.md` matches `spdx:checksumValue`; and checks `dcat:previousVersion` and hash distinctness across versions.",
    install: { none: true },
    invoke: { shell: "bun run folio-assistant-core/scripts/check-dsa-hash.ts" },
    io: {
      inputs: [
        {
          name: "dir",
          schema: t("RepoPath"),
          required: false,
          arg: { positional: 0 },
          description:
            "Path to a versioned DSA directory (holding `v1/`, `v2/`, ...) or a single version directory holding `agreement.md`, `dcat.jsonld`, and `agreement.jsonld`. Defaults to `folio-assistant-core/scripts/test-fixtures/dsa`.",
        },
      ],
      outputs: [
        {
          name: "verdict",
          schema: t("Text"),
          description:
            "Per-version verification line (`dcat:version`, `dcat:downloadURL`, `sha256`) on stdout when valid; diagnostic findings on stderr with exit code 1 when any check fails.",
        },
      ],
    },
    // Only the always-on `dsa-checksum`: the other DSA skills are in the opt-in
    // `dsa` sub-graph, and an always-on Tool may not name what a downstream
    // can switch off (owner, 2026-11-13, check:optin-refs).
    satisfies: ["dsa-checksum"],
    requires: { runtime: ["bun"], network: false },
    selection: {
      when:
        "Verifying a Data Sharing Agreement's checksum, ODRL citation, DCAT 3 record and `dcat:previousVersion` chain, or `adms:status`.",
      limits:
        "Checks structural, cryptographic, and vocabulary conformance of `agreement.md`, `dcat.jsonld`, and `agreement.jsonld`; does not evaluate legal prose semantics or sign Verifiable Credentials.",
      cost: "Local file reads and SHA-256 hashing; runs in milliseconds with no network access.",
    },
  }),
);
