# pipeline/po-resolve.ts resolves the .po files that translate a block, from the
# block, chapter, folio and dependency levels, merges them, and lists a block's
# locales. Each Scenario names the test that executes it.
Feature: PO source resolution

  @test:pipeline/po-resolve.test.ts::resolvePoSources::resolves_block-level_PO
  Scenario: A block's own .po resolves at block level
    Given a folio with "translations/fr/my-block.po"
    When PO sources are resolved for block "my-block" in "fr"
    Then one source has resolution "block"
    And its path names "my-block.po"

  @test:pipeline/po-resolve.test.ts::resolvePoSources::resolves_chapter-level_PO
  Scenario: A chapter's .po resolves at chapter level
    Given a folio with "translations/fr/chapter-01.po"
    When PO sources are resolved for block "my-block" in chapter "chapter-01" in "fr"
    Then one source has resolution "chapter"

  @test:pipeline/po-resolve.test.ts::resolvePoSources::resolves_folio-level_global_PO
  Scenario: The folio's global .po resolves at folio level
    Given a folio with "translations/fr/global.po"
    When PO sources are resolved for block "my-block" in "fr"
    Then one source has resolution "folio"

  @test:pipeline/po-resolve.test.ts::resolvePoSources::resolves_dependency_PO
  Scenario: A dependency's .po resolves at dependency level
    Given a folio whose dependency "dep-folio" has its own "translations/fr/my-block.po"
    When PO sources are resolved for block "my-block" in "fr"
    Then one source has resolution "dependency"
    And that source's dependency name is "dep-folio"

  @test:pipeline/po-resolve.test.ts::resolvePoSources::returns_all_4_levels_in_order
  Scenario: All four levels resolve, block first
    # Gap: only the block level's first place is checked, not the order of the other three
    Given a folio with block, chapter, global and dependency .po files in "fr"
    When PO sources are resolved for block "my-block" in chapter "chapter-01" in "fr"
    Then the resolutions include "block", "chapter", "folio" and "dependency"
    And the first resolution is "block"

  @test:pipeline/po-resolve.test.ts::resolvePoSources::returns_empty_when_no_PO_found
  Scenario: No .po for the locale or block resolves nothing
    When PO sources are resolved for block "nonexistent" in "ar"
    Then no sources are returned

  @test:pipeline/po-resolve.test.ts::resolvePoSources::uses_explicit_poSources_when_provided_(no_fallback)
  Scenario: Explicit PO sources replace the level fallback
    When PO sources are resolved for block "my-block" in "fr" with an explicit absolute path to "global.po"
    Then exactly one source is returned
    And its resolution is "explicit" and its path is the given one

  @test:pipeline/po-resolve.test.ts::resolvePoSources::handles_relative_poSources_paths
  Scenario: A relative explicit PO source resolves against the folio root
    When PO sources are resolved with the explicit relative path "translations/fr/global.po"
    Then exactly one source is returned, with resolution "explicit"

  @test:pipeline/po-resolve.test.ts::resolvePoSources::skips_nonexistent_explicit_poSources
  Scenario: A missing explicit PO source is skipped
    When PO sources are resolved with the explicit path "translations/fr/nonexistent.po"
    Then no sources are returned

  @test:pipeline/po-resolve.test.ts::mergePoSources::merges_PO_files_with_block_overriding_global
  Scenario: Merged PO sources let the block override the global file
    Given block "my-block" translates "Hello" as "Bonjour" and the global .po as "Hé"
    When the "fr" sources for "my-block" are merged
    Then "Hello" is "Bonjour"
    And "Global term" is "Terme global" from the global .po
    And "World" is "Monde" from the block .po

  @test:pipeline/po-resolve.test.ts::mergePoSources::merges_with_chapter_PO_in_the_middle
  Scenario: A chapter .po merges beneath the block
    Given "Hello" is "Bonjour" in the block, "Salut" in the chapter and "Hé" globally
    When the "fr" sources for "my-block" in "chapter-01" are merged
    Then "Hello" is "Bonjour"
    And "Chapter title" is "Titre du chapitre" from the chapter .po

  @test:pipeline/po-resolve.test.ts::availableLocales::finds_fr_and_es_for_my-block
  Scenario: The locales of a block are those holding its .po
    Given "my-block.po" exists under "fr" and "es"
    When the available locales for "my-block" are listed
    Then they are exactly "fr" and "es"

  @test:pipeline/po-resolve.test.ts::availableLocales::returns_sorted
  Scenario: Available locales are sorted
    When the available locales for "my-block" are listed
    Then they are "es", "fr" in that order

  @test:pipeline/po-resolve.test.ts::availableLocales::returns_empty_for_nonexistent_stem
  Scenario: A stem with no .po has no available locales
    When the available locales for "nonexistent" are listed
    Then the list is empty

  @test:pipeline/po-resolve.test.ts::availableLocales::finds_only_fr_for_chapter-01
  Scenario: A chapter .po only in French has only "fr"
    When the available locales for "chapter-01" are listed
    Then they are exactly "fr"
