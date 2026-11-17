# No maintains claim falls between the drift check and the site check that
# reconcile them (bean 6f1x): the two scopes tile. Each Scenario names the
# test that executes it.
Feature: The maintained-artefact checks tile the declared artefacts

  @test:scripts/tests/maintains-coverage-partition.test.ts::the_two_scopes_are_both_real::there_are_declarations,_and_BOTH_sides_of_the_split_are_non-empty
  Scenario: Both sides of the split are non-empty
    When the declared artefacts, those the drift check judges, and those it declines are read
    Then each set is non-empty

  @test:scripts/tests/maintains-coverage-partition.test.ts::the_scopes_TILE_—_nothing_falls_between_them::every_artefact_the_drift_check_DECLINES_is_covered_by_the_site_check
  Scenario: Every artefact the drift check declines is covered by the site check
    When the declined artefacts are compared with the site check's subjects over an empty built tree
    Then none is missing from the site check

  @test:scripts/tests/maintains-coverage-partition.test.ts::the_scopes_TILE_—_nothing_falls_between_them::every_declared_artefact_is_judged_by_at_least_one_check
  Scenario: Every declared artefact is judged by at least one check
    When the declared artefacts are compared with both checks' subjects
    Then none is judged by neither

  @test:scripts/tests/maintains-coverage-partition.test.ts::the_scopes_TILE_—_nothing_falls_between_them::both_checks_read_ONE_declaration,_so_neither_can_see_an_artefact_the_other_cannot
  Scenario: Both checks read one declaration
    When the site check's subjects are compared with the declared artefacts
    Then the two sets are equal

  @test:scripts/tests/maintains-coverage-partition.test.ts::the_artefacts_that_caused_the_narrowing_are_the_ones_to_name::a_layer's_`ns.jsonld`_and_`ns/content/v1.jsonld`_are_covered_by_the_site_check
  Scenario: The artefacts that caused the narrowing are covered by the site check
    Then cat-harness/ns.jsonld and ns/content/v1.jsonld are each a subject of the site check
    And neither is judged by the drift check
