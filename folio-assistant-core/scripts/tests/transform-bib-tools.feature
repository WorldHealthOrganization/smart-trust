Feature: the bibliography and transform tools

  @test:scripts/tests/transform-bib-tools.test.ts::registerBibTools::registersBibTools
  Scenario: registers bib tools with handlers
    When the bibliography tools are registered
    Then bib_validate, references_validate and bib_export each have a handler and a description

  @test:scripts/tests/transform-bib-tools.test.ts::registerTransformTools::migrateLeanRefsPaperOnly
  Scenario: migrate_lean_refs is paper-only
    When the document and paper transform tools are registered
    Then migrate_lean_refs is only among the paper tools

  @test:scripts/tests/transform-bib-tools.test.ts::registerTransformTools::registersTransformTools
  Scenario: registers transform tools with handlers
    When all transform tools are registered
    Then codemod, prune_deps and migrate_lean_refs each have a handler

  @test:scripts/tests/transform-bib-tools.test.ts::registerTransformTools::codemodGraceful
  Scenario: codemod degrades gracefully when no target resolves
    When codemod runs with no target
    Then it answers with text that mentions the target
