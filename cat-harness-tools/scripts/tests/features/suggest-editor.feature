# The suggest editor's site bundle. Each Scenario names the test that executes it.
Feature: Suggest editor bundle

  @test:scripts/tests/suggest-editor.test.ts::suggest-editor::Crepe_and_KaTeX_from_one_build,_their_CSS_in_one_stylesheet,_no_import_left_unresolved
  Scenario: The editor is one self-contained build
    When the suggest editor is installed into a site directory
    Then it lands in the suggest-editor directory with "crepe.js" and "crepe.css"
    And no JS file names the jsdelivr CDN, and every import specifier is relative
    And code-block languages are separate chunks, so the entry does not contain "COBOL"
    And the stylesheet has no "@import", styles ".katex" and ".milkdown", is under 200000 characters
    And KaTeX's fonts are files beside it, not data URLs
