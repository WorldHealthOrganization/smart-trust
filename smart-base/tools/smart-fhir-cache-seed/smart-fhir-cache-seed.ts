import { defineTool, toolFactory } from "../../platform/index.js";
import { smartSiteRepoArgs } from "../lib.ts";

export default toolFactory((t) =>
  defineTool({
    id: "smart-fhir-cache-seed",
    title: "Seed the FHIR package cache, with WHO's published site as a source",
    description:
      "Run fhir-harness's `fhir-cache-seed-npm` with smart-base's publisher-site rules (`SMART_PUBLISHER_SITE_REPOS`), so `smart.who.int.*` packages can also be read from WHO's published-site repository, each fetch verified against the tarball's own package.json. All other sources and checks are the seeder's.",
    install: { none: true },
    invoke: {
      shell: `bun run fhir-harness/scripts/fhir-cache-seed-npm.ts ${smartSiteRepoArgs().join(" ")} [--cache <dir>] [--sushi-config <file>] [--mirror <dir|git-url>] [--template-repo <name=owner/repo>] [--missing-out <file>] [--dry-run] [name#version ...]`,
    },
    io: {
      inputs: [
        { name: "sushi-config", schema: t("FilesystemPath"), required: false, description: "Seed what this IG pins: its `dependencies:` and the core package for its `fhirVersion`." },
        { name: "cache", schema: t("FilesystemPath"), required: false, description: "Default `~/.fhir/packages`, which SUSHI and the IG Publisher read." },
      ],
      outputs: [
        { name: "installed", schema: t("Count") },
        { name: "missing", schema: t("Count"), description: "Exit 1 when any is missing, each listed with why." },
      ],
    },
    satisfies: ["ig-publisher-fork"],
    selection: {
      when: "Seeding the cache for a WHO SMART IG where packages.fhir.org is unreachable.",
      limits: "The site rule only adds a source; the seeder's trust checks, exact-version rule and missing list are unchanged.",
      cost: "As `fhir-cache-seed-npm`, plus one `git ls-remote` and one download per `smart.who.int.*` package.",
    },
    requires: { runtime: ["bun", "npm", "git"], network: true },
    remedies: [
      { host: "github.com", none: "WHO's published-site repository is read from GitHub; with it refused, only npm and `--mirror` remain." },
    ],
  }),
);
