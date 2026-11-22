# pipeline/po-resolve.ts poResolveContext builds the folio-level half of PO
# resolution once; passing it in must change nothing about what resolves.
# Each Scenario names the test that executes it.
Feature: PO resolution context built once

  @test:pipeline/po-resolve-context.test.ts::poResolveContext::names_the_folio's_own_directory_and_only_the_dependencies_that_provide_translations
  Scenario: The context names the folio's translation directory and only translating dependencies
    Given a folio with translation directory "tr"
    And a dependency "dep-folio" with translation directory "translations"
    And a dependency "silent-dep" that provides only "skills" though it holds a .po
    When the PO resolve context is built for the folio
    Then its translation directory is the folio's "tr"
    And its dependencies are only "dep-folio" with its "translations" directory

  @test:pipeline/po-resolve-context.test.ts::poResolveContext::resolves_%s/%s/%s_exactly_as_without_a_context
  Scenario: Resolving with a context gives exactly what resolving without one gives
    Given the folio and dependencies with .po files for "my-block", "chapter-01" and "global"
    When PO sources are resolved for a block, chapter and locale with and without a built context
    Then both results are equal
    And this holds for my-block/chapter-01/fr, my-block/-/fr, absent/chapter-01/fr and my-block/chapter-01/es

  @test:pipeline/po-resolve-context.test.ts::poResolveContext::only_the_folio-level_half_is_fixed_—_a_.po_added_after_the_context_was_built_is_still_found
  Scenario: A .po added after the context was built is still found
    Given a PO resolve context built for the folio
    When "late.po" is then added to the folio's French translations
    Then resolving block "late" in "fr" with the earlier context includes a "block" resolution
    And resolving it without a context also includes a "block" resolution
