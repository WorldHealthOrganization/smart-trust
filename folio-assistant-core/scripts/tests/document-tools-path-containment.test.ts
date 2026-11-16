/**
 * Path-containment tests for the MCP document/paper tool handlers (bean `folio-core-ho43`).
 *
 * Verifies that every tool accepting a file path, output directory, paper/chapter
 * segment, or stylesheet path refuses `../` traversal (as well as symlink escape
 * and dangerous TeX primitives in `formula_render`).
 */
import { describe, expect, test } from "bun:test";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { autoPaper } from "../../adapters/document/tools/_pipeline.js";
import { registerDocumentAuditTools } from "../../adapters/document/tools/audit.js";
import { registerBibTools } from "../../adapters/document/tools/bib.js";
import { registerPaperQaTools, registerQaTools } from "../../adapters/document/tools/qa.js";
import {
  registerDocumentRenderTools,
  registerLatexRenderTools,
} from "../../adapters/document/tools/render.js";
import { registerTransformTools } from "../../adapters/document/tools/transform.js";
import {
  registerPaperBuildTools,
  registerValidateTools,
} from "../../adapters/document/tools/validate.js";

type ToolResult = {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
};

type ToolHandler = (args: Record<string, unknown>) => Promise<ToolResult>;

function collectHandlers(...registrars: Array<(s: McpServer) => void>): Record<string, ToolHandler> {
  const reg: Record<string, ToolHandler> = {};
  const stub = {
    tool(name: string, _desc: string, _schema: unknown, handler: ToolHandler) {
      reg[name] = handler;
    },
  };
  for (const r of registrars) {
    r(stub as unknown as McpServer);
  }
  return reg;
}

function expectRefused(res: ToolResult): void {
  expect(res.isError).toBe(true);
  expect(res.content[0]?.text).toMatch(/Refused/i);
}

describe("MCP document tools path containment (bean folio-core-ho43)", () => {
  const handlers = collectHandlers(
    registerBibTools,
    registerQaTools,
    registerPaperQaTools,
    registerValidateTools,
    registerPaperBuildTools,
    registerDocumentRenderTools,
    registerLatexRenderTools,
    registerDocumentAuditTools,
    registerTransformTools,
  );

  test("autoPaperRefusesTraversal", () => {
    expect(autoPaper("../etc")).toBeUndefined();
    expect(autoPaper("a/b")).toBeUndefined();
    expect(autoPaper("..")).toBeUndefined();
    expect(autoPaper("valid-paper")).toBe("valid-paper");
  });

  test("bibExportRefuses", async () => {
    const res = await handlers["bib_export"]({ out: "../escaped.bib" });
    expectRefused(res);
  });

  test("contentExportRefuses", async () => {
    const outRes = await handlers["content_export"]({ out: "../../escaped-viewer" });
    expectRefused(outRes);

    const paperRes = await handlers["content_export"]({ paper: "../escaped-paper" });
    expectRefused(paperRes);
  });

  test("paperToolsRefuse", async () => {
    for (const toolName of ["qa_sweep", "glossary_check", "proof_status", "status_sections_audit"]) {
      const res = await handlers[toolName]({ paper: "../escaped" });
      expectRefused(res);
    }
  });

  test("contentValidateRefuses", async () => {
    const paperRes = await handlers["content_validate"]({ paper: "../escaped" });
    expectRefused(paperRes);

    const chapterRes = await handlers["content_validate"]({
      paper: "valid-paper",
      chapter: "../escaped-chapter",
    });
    expectRefused(chapterRes);
  });

  test("profileAndListRefuse", async () => {
    const profRes = await handlers["content_profile_check"]({ document: "../escaped" });
    expectRefused(profRes);

    const listRes = await handlers["content_list"]({ paper: "../escaped" });
    expectRefused(listRes);
  });

  test("contentBuildRefuses", async () => {
    const outRes = await handlers["content_build"]({ output_dir: "../../escaped-chapters" });
    expectRefused(outRes);

    const paperRes = await handlers["content_build"]({ paper: "../escaped" });
    expectRefused(paperRes);
  });

  test("renderToolsRefuse", async () => {
    for (const toolName of ["document_render_md", "document_render_html", "document_render_pdf"]) {
      const docRes = await handlers[toolName]({ document: "../escaped" });
      expectRefused(docRes);
    }

    const htmlCssRes = await handlers["document_render_html"]({
      css: "../../etc/passwd",
      toc: true,
      math_renderer: "katex",
    });
    expectRefused(htmlCssRes);

    const pdfCssRes = await handlers["document_render_pdf"]({
      css: "../outside.css",
      engine: "auto",
    });
    expectRefused(pdfCssRes);

    const absCssRes = await handlers["document_render_html"]({
      css: "/etc/passwd",
      toc: true,
      math_renderer: "katex",
    });
    expectRefused(absCssRes);
  });

  test("paperRenderRefuses", async () => {
    const pdfRes = await handlers["paper_render_pdf"]({
      scope: "chapter",
      target: "../escaped",
      engine: "pdflatex",
      clean: false,
      print_mode: "compact",
      upload_drive: false,
    });
    expectRefused(pdfRes);

    const htmlRes = await handlers["paper_render_html"]({
      scope: "chapter",
      target: "../escaped",
      math_renderer: "katex",
    });
    expectRefused(htmlRes);
  });

  test("formulaRenderRefuses", async () => {
    const pkgRes = await handlers["formula_render"]({
      latex: "x^2",
      display_math: true,
      packages: ["../evil"],
      dpi: 300,
    });
    expectRefused(pkgRes);

    const inputRes = await handlers["formula_render"]({
      latex: "\\input{/etc/passwd}",
      display_math: true,
      packages: ["amsmath"],
      dpi: 300,
    });
    expectRefused(inputRes);

    const write18Res = await handlers["formula_render"]({
      latex: "\\immediate\\write18{id}",
      display_math: true,
      packages: ["amsmath"],
      dpi: 300,
    });
    expectRefused(write18Res);
  });

  test("codemodRefuses", async () => {
    const res = await handlers["codemod"]({
      name: "refterm",
      target: "../escaped",
      apply: false,
    });
    expectRefused(res);
  });
});
