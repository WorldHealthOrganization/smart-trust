Feature: the MCP document tools keep paths inside the folio

  @test:scripts/tests/document-tools-path-containment.test.ts::MCP_document_tools_path_containment_(bean_folio-core-ho43)::autoPaperRefusesTraversal
  Scenario: autoPaper refuses ../ traversal segments
    When autoPaper is given ../etc, a/b, .. and valid-paper
    Then only valid-paper is accepted

  @test:scripts/tests/document-tools-path-containment.test.ts::MCP_document_tools_path_containment_(bean_folio-core-ho43)::bibExportRefuses
  Scenario: bib_export refuses ../ output path
    When bib_export is given a ../ output
    Then it is refused

  @test:scripts/tests/document-tools-path-containment.test.ts::MCP_document_tools_path_containment_(bean_folio-core-ho43)::contentExportRefuses
  Scenario: content_export refuses ../ output directory and ../ paper
    When content_export is given a ../ output and a ../ paper
    Then both are refused

  @test:scripts/tests/document-tools-path-containment.test.ts::MCP_document_tools_path_containment_(bean_folio-core-ho43)::paperToolsRefuse
  Scenario: qa_sweep, glossary_check, proof_status, and status_sections_audit refuse ../ paper
    When qa_sweep, glossary_check, proof_status and status_sections_audit are given a ../ paper
    Then each is refused

  @test:scripts/tests/document-tools-path-containment.test.ts::MCP_document_tools_path_containment_(bean_folio-core-ho43)::contentValidateRefuses
  Scenario: content_validate refuses ../ paper and ../ chapter
    When content_validate is given a ../ paper and a ../ chapter
    Then both are refused

  @test:scripts/tests/document-tools-path-containment.test.ts::MCP_document_tools_path_containment_(bean_folio-core-ho43)::profileAndListRefuse
  Scenario: content_profile_check and content_list refuse ../ segment
    When content_profile_check and content_list are given ../ segments
    Then both are refused

  @test:scripts/tests/document-tools-path-containment.test.ts::MCP_document_tools_path_containment_(bean_folio-core-ho43)::contentBuildRefuses
  Scenario: content_build refuses ../ output_dir and ../ paper
    When content_build is given a ../ output directory and a ../ paper
    Then both are refused

  @test:scripts/tests/document-tools-path-containment.test.ts::MCP_document_tools_path_containment_(bean_folio-core-ho43)::renderToolsRefuse
  Scenario: document_render_md, document_render_html, and document_render_pdf refuse ../ document and ../ css
    When the document render tools are given a ../ document, and a ../ or absolute stylesheet
    Then each is refused

  @test:scripts/tests/document-tools-path-containment.test.ts::MCP_document_tools_path_containment_(bean_folio-core-ho43)::paperRenderRefuses
  Scenario: paper_render_pdf and paper_render_html refuse ../ target
    When paper_render_pdf and paper_render_html are given a ../ target
    Then both are refused

  @test:scripts/tests/document-tools-path-containment.test.ts::MCP_document_tools_path_containment_(bean_folio-core-ho43)::formulaRenderRefuses
  Scenario: formula_render refuses ../ in package names and file/shell TeX primitives in latex
    When formula_render is given a ../ package, an \input and a \write18
    Then each is refused

  @test:scripts/tests/document-tools-path-containment.test.ts::MCP_document_tools_path_containment_(bean_folio-core-ho43)::codemodRefuses
  Scenario: codemod refuses ../ target
    When codemod is given a ../ target
    Then it is refused
