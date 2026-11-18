import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "c-value-terms",
    title: "Rank candidate glossary terms in prose by C-value",
    description:
      "The scoring step of the `automatic-term-extraction` method: count the word n-grams of one or more Markdown or text files (not across punctuation, front matter or code), and rank them by C-value as Frantzi & Ananiadou 1996 define it, so nested multi-word terms are not swamped by the longer phrases that contain them. Tested against the paper's own worked example (Table 2). Every row is a candidate; it writes nothing and promotes nothing.",
    install: { none: true },
    invoke: { shell: "bun run folio-assistant-core/scripts/c-value.ts" },
    io: {
      inputs: [
        { name: "files", schema: t("RepoPath"), required: true, arg: { positional: 0 }, description: "One or more Markdown or text files whose prose is read." },
        { name: "maxLength", schema: t("Count"), required: false, arg: { flag: "--max-length" }, description: "Longest n-gram, in words; 1 or more. Default 5." },
        { name: "minFreq", schema: t("Count"), required: false, arg: { flag: "--min-freq" }, description: "Fewest occurrences an n-gram needs to be scored. Default 3, the paper's cut-off; 1 or more." },
        { name: "top", schema: t("Count"), required: false, arg: { flag: "--top" }, description: "How many candidates to print; 1 or more. Default 50." },
        { name: "edgeStopwords", schema: t("Flag"), required: false, arg: { flag: "--edge-stopwords" }, description: "Drop n-grams that begin or end with a common English function word. Off by default, because the 1996 method has no such filter." },
        { name: "json", schema: t("Flag"), required: false, arg: { flag: "--json" }, description: "Print the candidates as JSON, each with its frequency, nesting counts and C-value." },
      ],
      outputs: [
        { name: "candidates", schema: t("Text"), description: "A ranked table, or JSON with `status: candidate`, of n-grams with a C-value above 0." },
      ],
    },
    satisfies: ["glossary-terms", "ontologist"],
    requires: { runtime: ["bun"], network: false },
    selection: {
      when: "A person or agent wants candidate glossary terms from a body of prose, ranked, to review before writing any definitions.",
      limits: "Statistics only, as the 1996 paper: no part-of-speech filter (the later C-value papers that add one are not held), English word splitting, and no reference corpus. On ordinary prose without --edge-stopwords the top rows are function phrases. A person decides what is a term.",
      cost: "Milliseconds for a chapter; linear in words times --max-length. No network.",
    },
  }),
);
