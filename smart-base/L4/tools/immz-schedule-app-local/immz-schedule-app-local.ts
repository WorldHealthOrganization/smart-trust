import { defineTool, toolFactory } from "../../../platform/index.js";

export default toolFactory((t) =>
  defineTool({
    id: "immz-schedule-app-local",
    title: "Run the immunization schedule-check app locally on a WHO or country IG",
    description:
      "Start litlfred/awho-mcp's schedule-check web form on this machine: a HAPI FHIR server in Docker, the WHO SMART Immunizations IG loaded, then optionally a country adaptation IG (its decision-logic tables replace WHO's; its country profile is generated from its `input/l2/dependencies.yaml`), the CQL cache warmed, and the form served. Both listen on 127.0.0.1. Unbuilt IGs are built with SUSHI first, and each Library's CQL is embedded from `input/cql/` as the IG Publisher would. A re-run reuses a server loaded from the same commits; `--down` stops both.",
    install: { cli: "git clone https://github.com/litlfred/awho-mcp && cd awho-mcp && python3 -m pip install -e ." },
    invoke: { shell: "awho-mcp/scripts/local_up.sh --who-ig <dir> [--country-ig <dir>] [--fhir-port <n>] [--web-port <n>] [--down]" },
    io: {
      inputs: [
        { name: "who-ig", schema: t("RepoPath"), required: true, arg: { flag: "--who-ig" }, description: "A WHO SMART Immunizations IG checkout, relative to the working directory (the folder holding the checkouts, e.g. `~/space_cats`)." },
        { name: "country-ig", schema: t("RepoPath"), required: false, arg: { flag: "--country-ig" }, description: "A country adaptation IG checkout, e.g. `smart-immunizations-uganda`, relative to the working directory. Without it the app follows WHO's own schedule." },
        { name: "fhir-port", schema: t("Port"), required: false, arg: { flag: "--fhir-port" }, description: "The HAPI port on 127.0.0.1. Default 8081." },
        { name: "web-port", schema: t("Port"), required: false, arg: { flag: "--web-port" }, description: "The form's port on 127.0.0.1. Default 8090." },
        { name: "down", schema: t("Flag"), required: false, arg: { flag: "--down" }, description: "Stop the form and the server." },
      ],
      outputs: [
        { name: "url", schema: t("Url"), description: "The form on 127.0.0.1. It stores nothing; each check is one inline `$apply` round.", render: { as: "url", reason: "a reader opens the running app; the scheme is checked before it reaches an href" } },
      ],
    },
    satisfies: ["l4-application-run-local"],
    selection: {
      when: "Trying or demonstrating the immunizations L4 app on a clean IG build, before anything is hosted, on the viewer's own machine.",
      limits:
        "Immunizations only (awho-mcp's catalog is the WHO SMART Immunizations IG). One country per server, because a country IG reuses WHO's PlanDefinition ids. Local only: nothing is published and the URL does not open from another machine.",
      cost: "Docker and about 4 GB of memory. First run: the HAPI image pull, about a minute to load and warm, and a SUSHI build of any unbuilt IG. A re-run on the same commits restarts only the form.",
    },
    requires: { runtime: ["docker", "python3", "git"], network: true },
    remedies: [
      { host: "docker.io", none: "The HAPI image comes from Docker Hub; with it refused, set `HAPI_IMAGE` to an image already pulled." },
      { host: "github.com", none: "awho-mcp is installed from GitHub; with it refused, install from a copy already on the machine." },
    ],
  }),
);
