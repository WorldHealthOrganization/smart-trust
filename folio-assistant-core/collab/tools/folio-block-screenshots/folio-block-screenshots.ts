import { toolFactory } from "@litlfred/cat-harness-tools/schemas/tools/tool-folders.js";
import { defineTool } from "@litlfred/cat-harness-tools/schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "folio-block-screenshots",
    title: "Folio block screenshots",
    description:
      "Picture each changed figure, diagram, table, equation or simulator block on the published main site and on a staging build, and compare the two pictures pixel by pixel in Chromium's canvas. Writes `visual-diff.json` (`folio-visual-diff/v1`: per block, the share of pixels changed beyond anti-aliasing, and the before, after and diff pictures) and `visual/*.png`, which the review page's visual renderer shows. A side that cannot be pictured (page or anchor missing) is recorded as missing, never drawn blank. Drives Chromium through Playwright.",
    install: { none: true },
    invoke: { shell: "bun run cat block:screenshots" },
    io: {
      inputs: [
        { name: "changeset", schema: t("RepoPath"), required: true, arg: { flag: "--changeset" }, description: "The preview's `changeset.json`: which blocks changed, and their kind on each side." },
        { name: "base", schema: t("RepoPath"), required: false, arg: { flag: "--base" }, description: "The published main site, as a directory (the publish branch's root)." },
        { name: "head", schema: t("RepoPath"), required: false, arg: { flag: "--head" }, description: "The staging build's site directory." },
        { name: "out", schema: t("RepoPath"), required: false, arg: { flag: "--out" }, description: "Where to write `visual-diff.json` and `visual/`: the site root, so the review page finds them." },
        { name: "count", schema: t("Flag"), required: false, arg: { flag: "--count" }, description: "Print how many changed blocks would be pictured, and stop, so a caller installs a browser only when there is work." },
      ],
      outputs: [
        { name: "visual-diff", schema: t("RepoPath"), description: "`<out>/visual-diff.json` and `<out>/visual/*.png`. A per-block summary goes to stderr." },
      ],
    },
    satisfies: ["visual-diff"],
    selection: {
      when: "A staging build changed a figure, diagram, table, equation or simulator, whose markup diff says little, and the reviewer needs to see before and after.",
      limits:
        "The number is how MUCH changed, never whether the change is right. A block's picture is its anchor down to the next anchor, so a page whose anchors are missing or misplaced pictures the wrong region. Pictures are of the light theme.",
      cost: "A Chromium launch and two page loads, one screenshot and one canvas compare per visual block. Nothing when no visual block changed.",
    },
    requires: { runtime: ["bun", "chromium"], network: false },
  }),
);
