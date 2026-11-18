# scripts/folio-shim.ts and scripts/lib/folio-shim.ts keep a folio's builders shim re-exporting each vocabulary module its profile uses,
# such as the science layer's mathpaper vocabulary for a paper. Each Scenario names the test that executes it.
Feature: A folio's builders shim re-exports its vocabularies

  @test:scripts/tests/folio-shim.test.ts::the_shim's_vocabulary_re-exports::the_platform_path_is_read_off_the_cat-harness_re-export
  Scenario: The platform path is read off the shim's cat-harness re-export
    Given a shim re-exporting "../../.folio-assistant/cat-harness/schemas/builders"
    Then its platform path is ".folio-assistant"
    And a shim re-exporting from cat-harness-tools/schemas/builders also reads ".folio-assistant"
    And a shim re-exporting "./elsewhere" has no platform path
    And the re-export line for "folio-assistant-sci/schemas/mathpaper-vocabulary" under ".folio-assistant" is the matching export-star line

  @test:scripts/tests/folio-shim.test.ts::the_shim's_vocabulary_re-exports::a_paper_gets_every_module_typing_a_math_kind,_a_document_none_of_them,_anything_else_nothing
  Scenario: Vocabulary modules follow the folio profile
    # Gap: for a paper only the count is compared with the math-kind vocabularies, not which modules they are
    Given the vocabulary modules this checkout holds
    Then a paper gets as many modules as there are vocabularies typing "theorem"
    And a document gets no mathpaper-vocabulary module
    And a "dak" gets no module

  @test:scripts/tests/folio-shim.test.ts::the_shim's_vocabulary_re-exports::what_is_missing_is_exactly_the_lines_the_shim_lacks,_and_nothing_once_they_are_there
  Scenario: Missing re-exports are exactly the lines the shim lacks
    Given a shim with only the cat-harness re-export
    Then as many lines are missing for a paper as the paper has vocabulary modules
    And once those lines are appended nothing is missing

  @test:scripts/tests/folio-shim.test.ts::the_shim's_vocabulary_re-exports::a_folio_with_no_shim_is_undetermined,_never_reported_current
  Scenario: A folio with no usable shim is undetermined
    Given a folio root with no builders shim
    Then checking the shim reports "undetermined"
    And with a folio/schema/builders.ts that has no cat-harness re-export it still reports "undetermined"
    And that file is left unchanged
