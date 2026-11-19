Feature: The QA report finds markdown an artefact page shows as text

  @test:scripts/ig-markdown-qa.test.ts::ig-markdown-qa::drawnMarkdownLeavesNothing
  Scenario: markdown the page renderer draws leaves nothing behind
    Given a description with bold, emphasis, code, a link, an inline picture and both kinds of list
    When the pages' own renderer draws it
    Then no markup is left as text
    And markup inside a code span, or a "<data set>" placeholder, is not a finding

  @test:scripts/ig-markdown-qa.test.ts::ig-markdown-qa::undrawnMarkupIsNamed
  Scenario: markup the renderer leaves as text is named
    Given a renderer that draws only links, and markdown with bold and a list
    Then the bold and the list marker are named
    And headings, tables and HTML tags the renderer does not draw are named too
    And an image is named when the renderer leaves it as text, not when it draws it

  @test:scripts/ig-markdown-qa.test.ts::ig-markdown-qa::scanAstAndReport
  Scenario: the AST is scanned and the QA report lists each field
    Given an AST with a Basic carrying a markdown heading in an extension, a clean ValueSet, and a manifest
    When the AST is scanned
    Then two resources are scanned and the one field is reported with its path, what was left and how it starts
    And the narrative is not scanned
    And the QA section lists it in a table, a backslash and a pipe escaped, or says "none" when there are no findings
