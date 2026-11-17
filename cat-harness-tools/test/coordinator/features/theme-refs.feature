# Specifies that every theme reference the checkout's declarations make (in
# directories, tiles and stickies, and in cat-harness/folio contributions)
# resolves by reference through themeByRef.
Feature: Every declared theme reference resolves to an installed theme

  @test:test/coordinator/theme-refs.test.ts::declared_theme_references_resolve::the_corpus_is_non-empty,_so_the_assertion_below_is_not_vacuous
  Scenario: There are theme references to check
    Given every instance declaration and every cat-harness/folio contribution
    When their theme references are collected
    Then there is at least one

  @test:test/coordinator/theme-refs.test.ts::declared_theme_references_resolve::every_reference_is_a_ThemeRef_naming_an_installed_theme
  Scenario: Every reference is a ThemeRef that resolves
    Given the collected theme references
    When each is resolved with its citing instance
    Then every one is an object and resolves
