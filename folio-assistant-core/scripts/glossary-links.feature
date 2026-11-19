Feature: glossary links that do not resolve

  @test:scripts/glossary-links.test.ts::glossary-links_(folio-assistant-core#498,_warn-only)::missingSourceReported
  Scenario: a source missing from a mounted layer is reported; an unmounted layer is not judged
    When terms with present, missing and unmounted sources are checked
    Then only the missing source in a mounted layer is reported

  @test:scripts/glossary-links.test.ts::glossary-links_(folio-assistant-core#498,_warn-only)::unknownDefinesReported
  Scenario: a block that defines an id no scheme holds is reported
    When a block defines an id no scheme holds
    Then it is reported as defines-unknown

  @test:scripts/glossary-links.test.ts::glossary-links_(folio-assistant-core#498,_warn-only)::unusedOnlyWithAll
  Scenario: an unused term is listed only with --all
    When an unused term is checked without and with --all
    Then it is listed only with --all, and not when it is used
