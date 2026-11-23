# FOLIO_ROOT and hasFolio in scripts/tests/helpers, over findContentRepoRoot and findPapers in pipeline/repo-root.ts, decide whether a content folio
# is attached, so content assertions neither run against the platform nor pass vacuously. Each Scenario names the test that executes it.
Feature: Folio root detection

  @test:scripts/tests/folio-root.test.ts::FOLIO_ROOT_detection::agrees_with_hasFolio()
  Scenario: hasFolio agrees with FOLIO_ROOT
    Then hasFolio is true exactly when FOLIO_ROOT is defined

  @test:scripts/tests/folio-root.test.ts::FOLIO_ROOT_detection::a_folio_is_exactly_a_root_that_carries_at_least_one_paper
  Scenario: A folio is a content root that carries at least one paper
    Given the content repository root
    Then hasFolio is true exactly when at least one paper is found under it

  @test:scripts/tests/folio-root.test.ts::FOLIO_ROOT_detection::the_platform_alone_is_NOT_a_folio
  Scenario: The platform alone holds no papers
    Given the platform instance root
    When its papers are listed
    Then there are none

  @test:scripts/tests/folio-root.test.ts::no_vacuous_passes_when_no_folio_is_attached::LEAN_DIR_does_not_silently_point_into_the_platform
  Scenario: LEAN_DIR is empty when no folio is attached
    # Skipped: when a folio is attached
    Then LEAN_DIR is the empty string

  @test:scripts/tests/folio-root.test.ts::no_vacuous_passes_when_no_folio_is_attached::QOU_LEAN_DIR_resolves_under_the_platform_but_does_not_exist
  Scenario: QOU_LEAN_DIR falls back under the platform when no folio is attached
    # Skipped: when a folio is attached
    # Gap: that nothing exists at that path is not checked
    Then QOU_LEAN_DIR starts with the platform instance root
