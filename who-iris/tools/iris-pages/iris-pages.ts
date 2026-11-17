import { defineTool, toolFactory } from "../../platform.ts";

export default toolFactory((t) =>
  defineTool({
    id: "iris-pages",
    title: "who-iris catalogue and docs pages",
    description:
      "Render who-iris's docs pages, the catalogue visualiser at its declared route (what the catalogue knows, and what it records that it does not know), the library's withheld list, and the IRIS replica's home page.",
    install: { none: true },
    invoke: { shell: "bun run cat iris:pages" },
    io: {
      inputs: [
        { name: "check", schema: t("Flag"), required: false, arg: { flag: "--check" }, description: "Fail if a page is stale, instead of writing." },
        { name: "site", schema: t("RepoPath"), required: false, arg: { flag: "--catalogue-into" }, description: "A site being built (the tree `compose-docs --shell` wrote): write only the catalogue page into it, at its route in who-iris's own site, plus a forwarding page at the declared route. A site build passes it (`visualiser-writers.ts`)." },
      ],
      outputs: [{ name: "pages", schema: t("RepoPath"), description: "The replica's home page at `site/index.html` (and its translations), the docs under `docs/`, and the catalogue page under the published site directory." }],
    },
    satisfies: ["graph-rendering"],
    renders: ["catalogue"],
    requires: { runtime: ["bun"], network: false },
  }),
);
