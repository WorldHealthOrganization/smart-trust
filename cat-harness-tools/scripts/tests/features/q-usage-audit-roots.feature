# Paper discovery for the pipeline audits: no paper privileged by name, only
# folio/<name>/<name>.ts manifests count. Each Scenario names the test that
# executes it.
Feature: Papers are discovered by their same-named manifest

  Background:
    Given a root whose folio/ holds papers "alpha-paper" and "beta-paper", each with a same-named manifest
    And directories "pipeline", "schema" and "values" with only an index.ts, and a ".cache" directory

  @test:scripts/tests/q-usage-audit-roots.test.ts::findPapers::discovers_every_paper_by_its_same-named_manifest
  Scenario: Every paper is discovered by its manifest
    When the papers are found
    Then they are exactly "alpha-paper" and "beta-paper"

  @test:scripts/tests/q-usage-audit-roots.test.ts::findPapers::does_not_privilege_any_paper_by_name
  Scenario: No paper is privileged by name
    When the papers are found
    Then "quantum-observable-universe" is not among them

  @test:scripts/tests/q-usage-audit-roots.test.ts::findPapers::ignores_sibling_directories_that_carry_no_manifest
  Scenario: Directories without a manifest are not papers
    When the papers are found
    Then none of "pipeline", "schema", "values" or ".cache" is among them

  @test:scripts/tests/q-usage-audit-roots.test.ts::findPapers::returns_[]_for_a_root_with_no_folio/_at_all
  Scenario: A root with no folio/ has no papers
    When the papers are found under a directory that does not exist
    Then the list is empty

  @test:scripts/tests/q-usage-audit-roots.test.ts::soleFolioPaper::is_undefined_when_the_folio_holds_several_papers
  Scenario: No sole paper when the folio holds several
    When the sole folio paper is asked for
    Then it is undefined

  @test:scripts/tests/q-usage-audit-roots.test.ts::soleFolioPaper::names_the_paper_when_there_is_exactly_one
  Scenario: The sole paper is named when there is exactly one
    Given a root whose folio/ holds only "only-paper" with its manifest
    When the sole folio paper is asked for
    Then it is "only-paper"
