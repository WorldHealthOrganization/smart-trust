import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "fhir-package-mirror",
    title: "Mirror FHIR packages from packages.fhir.org into a git repository",
    description:
      "On a machine that reaches packages.fhir.org, fetch exactly a missing list (from `fhir-cache-seed-npm --missing-out`), check each tarball names itself exactly, record SHA512SUMS, and commit and push to a git repository that an environment without packages.fhir.org reads with `--mirror`. The person running it is the trust anchor for what it adds.",
    install: { cli: "git clone -b claude/ast-export https://github.com/litlfred/fhir-ig-publisher" },
    invoke: { shell: "fhir-ig-publisher/ast-export/scripts/mirror-fhir-packages.sh <mirror-repo-dir> <missing.txt | name#version ...>" },
    io: {
      inputs: [
        { name: "mirror-repo-dir", schema: t("FilesystemPath"), required: true, description: "A git checkout to fill; committed and pushed when it is one." },
        { name: "missing", schema: t("FilesystemPath"), required: true, description: "The seeder's `--missing-out` file, so nothing unneeded is mirrored." },
      ],
      outputs: [{ name: "mirrored", schema: t("Count"), description: "Exit non-zero when any could not be fetched or named itself differently." }],
    },
    satisfies: ["ig-publisher-fork"],
    selection: {
      when: "The seeder reports missing packages and the environment that needs them cannot reach packages.fhir.org.",
      limits: "Run where packages.fhir.org is reachable. It mirrors exact versions only; a wildcard in the list is resolved by the seeder first.",
      cost: "One download per package; terminology packages are megabytes each.",
    },
    requires: { runtime: ["bash", "curl", "python3", "git"], network: true },
    remedies: [
      {
        host: "packages.fhir.org",
        none:
          "It exists to run where packages.fhir.org IS reachable. A GitHub Actions runner is such a place, and one a cloud session can drive by itself: in litlfred/fhir-package-mirror, push a `claude/mirror-*` branch that edits `packages.txt` (`name#version`, `name#1.2.x` or `name#latest`), and `.github/workflows/mirror.yml` fetches each package with its dependencies, checks it names itself, records SHA512SUMS and commits back to the branch. Merge the branch, then `fhir-cache-seed-npm --mirror` reads it here. A local networked agent works too.",
      },
    ],
  }),
);
