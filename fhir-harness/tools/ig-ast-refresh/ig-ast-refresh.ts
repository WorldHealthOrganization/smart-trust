import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

// The ONE writer of `cat/fhir-harness/fhir-ast/<package id>` (owner,
// 2026-10-14: "that should be in fhir-harness then smart-* all use
// that"). A reusable workflow here; each IG repository dispatches it
// through an unchanged copy of templates/ig-repo-site/ig-ast-refresh.yml.
export default toolFactory((t) =>
  defineTool({
    id: "ig-ast-refresh",
    title: "Refresh an IG's AST cache on a runner",
    description:
      "Dispatch an IG repository's `ig-ast-refresh.yml`, which calls fhir-harness's reusable `.github/workflows/ig-ast-refresh.yml`: mount the layers the IG's index.lock.json pins, restore and judge the cache for `ref`, and when it is not valid (or `force`) run the caller's optional `pre-export` overlay command and build the IG with the pinned Publisher AST exporter (the AST is recorded against the clean commit's inputs, the overlay's changes put back), check the new AST is valid for its commit, and seed `cat/fhir-harness/fhir-ast/<package id>` with `ig-cache seed --push` — only from a commit on the default branch with the tip's inputs. Builds no site, writes no gh-pages, dispatches nothing.",
    install: { none: true },
    invoke: { shell: "gh workflow run ig-ast-refresh.yml --repo <owner/repo> --ref main -f ref=main [-f force=true]" },
    io: {
      inputs: [
        { name: "repository", schema: t("RepoFullName"), required: true, description: "The IG repository that carries the caller (`owner/repo`)." },
        { name: "ref", schema: t("Branch"), required: false, description: "What to build; default `main`. Only a commit on the default branch with the tip's inputs is seeded." },
        { name: "force", schema: t("Flag"), required: false, description: "Rebuild even when the cache is valid." },
      ],
      outputs: [{ name: "result", schema: t("Text"), description: "The run's verdict before (`valid`, `stale`, `cannot-tell`, `missing`) and whether it seeded; the AST as a run artifact when it did not." }],
    },
    satisfies: ["ig-build-pipeline", "compiled-artefact-cache"],
    selection: {
      when: "An IG site publish refused a stale or missing AST, or the IG's source changed on its default branch. Dispatched by a person, or by an agent the owner named for that run — never by an agent on its own.",
      limits: "Needs the IG repository to carry the caller and an index.lock.json that mounts fhir-harness. A merge that changes an input during the build leaves the cache unseeded (the run says so). A `pre-export` command is the caller's, in its own workflow file, never a dispatch input; a failing one exports nothing. The no-shrink gate refuses a candidate under 90% of the incumbent.",
      cost: "One GitHub runner for the Publisher build: about 25 minutes cold for a ~700-resource IG, less with the restored txcache.",
    },
    requires: { runtime: ["gh"], network: true },
    remedies: [{ host: "github.com", none: "The Tool IS a workflow dispatch on GitHub, and the build it starts runs on a GitHub runner; offline there is no arm. `ig-cache` restores an AST already seeded." }],
  }),
);
