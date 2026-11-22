# The topology axes, and the five combinations a declaration may not name
# (bean folio-assistant-g7vb, issue #363). Each Scenario names the test that
# executes it.
Feature: Topology conflicts

  @test:scripts/tests/topology-conflicts.test.ts::topology_axes_—_absent_is_a_third_state::a_declaration_with_no_topology_at_all_names_no_conflict
  Scenario: No topology names no conflict
    Then no topology, and an empty topology, with no publication host give no conflicts

  @test:scripts/tests/topology-conflicts.test.ts::topology_axes_—_absent_is_a_third_state::THIS_repository's_own_declaration_is_still_readable
  Scenario: The harness's own declaration is readable
    Then reading the harness's declaration does not throw

  @test:scripts/tests/topology-conflicts.test.ts::topology_axes_—_absent_is_a_third_state::a_declared_axis_with_nothing_to_conflict_WITH_is_fine
  Scenario: One side of a pair alone is no conflict
    Then network "air-gapped", forge "none", outward-facing true, and host "github-pages" alone each give no conflicts

  @test:scripts/tests/topology-conflicts.test.ts::topology_axes_—_absent_is_a_third_state::every_axis_value_is_accepted_on_its_own
  Scenario: Every axis value alone is no conflict
    Then every forge, every network reach and every model provenance alone gives no conflicts

  @test:scripts/tests/topology-conflicts.test.ts::the_five_incompatible_pairs::Pages_with_any_forge_that_is_not_GitHub
  Scenario: Pages with a non-GitHub forge conflicts
    Then each forge other than "github" with host "github-pages" gives one conflict mentioning "GitHub Pages"
    And forge "github" with "github-pages" gives none

  @test:scripts/tests/topology-conflicts.test.ts::the_five_incompatible_pairs::air-gapped_with_a_GitHub_forge
  Scenario: Air-gapped with a GitHub forge conflicts
    Then network "air-gapped" with forge "github" gives one conflict naming both

  @test:scripts/tests/topology-conflicts.test.ts::the_five_incompatible_pairs::air-gapped_with_hosted_inference
  Scenario: Air-gapped with hosted inference conflicts
    Then network "air-gapped" with provenance "hosted" gives one conflict mentioning "airlock"

  @test:scripts/tests/topology-conflicts.test.ts::the_five_incompatible_pairs::egress-restricted_with_hosted_inference_is_EXPRESSIBLE_—_it_is_#363's_own_mix
  Scenario: Egress-restricted with hosted inference is allowed
    Then network "egress-restricted" with provenance "hosted" gives no conflicts

  @test:scripts/tests/topology-conflicts.test.ts::the_five_incompatible_pairs::air-gapped_with_Pages_—_and_it_fires_without_`forge`_being_declared
  Scenario: Air-gapped with Pages conflicts without a forge
    Then network "air-gapped" with host "github-pages" and no forge gives one conflict whose second side is "publication.host: github-pages"

  @test:scripts/tests/topology-conflicts.test.ts::the_five_incompatible_pairs::outward-facing_with_nothing_published
  Scenario: Outward-facing with nothing published conflicts
    Then outward-facing true with host "none" gives one conflict
    And outward-facing false with host "none" gives none

  @test:scripts/tests/topology-conflicts.test.ts::the_five_incompatible_pairs::several_conflicts_are_all_reported,_not_just_the_first
  Scenario: Every conflict is reported
    Then air-gapped, self-hosted, hosted inference and GitHub Pages together give more than two conflicts

  @test:scripts/tests/topology-conflicts.test.ts::what_is_deliberately_NOT_a_conflict::a_private_repository_publishing_to_Pages
  Scenario: A GitHub forge publishing to Pages is no conflict
    # Gap: visibility is not an input, so nothing here says the repository is private; the body checks only forge "github" with "github-pages".
    Then forge "github" with host "github-pages" gives no conflicts

  @test:scripts/tests/topology-conflicts.test.ts::what_is_deliberately_NOT_a_conflict::air-gapped_with_MIXED_provenance_—_settled,_and_not_by_the_original_reason
  Scenario: Air-gapped with mixed provenance is no conflict
    Then network "air-gapped" with provenance "mixed" gives no conflicts

  @test:scripts/tests/topology-conflicts.test.ts::what_is_deliberately_NOT_a_conflict::the_refusals_that_DO_hold_are_the_uniform_ones
  Scenario: Only uniform provenances are refused when air-gapped
    Then air-gapped with "hosted" gives one conflict
    And air-gapped with "open-weight-local" gives none

  @test:scripts/tests/topology-conflicts.test.ts::a_contradictory_declaration_is_refused,_not_returned::readDeclaration_throws,_and_the_message_names_both_sides_and_the_reason
  Scenario: Reading a contradictory declaration throws
    Given a declaration publishing to "github-pages" with network "air-gapped"
    When it is read
    Then a TopologyConflictError is thrown naming "air-gapped", "github-pages" and "cannot reach"

  @test:scripts/tests/topology-conflicts.test.ts::a_contradictory_declaration_is_refused,_not_returned::a_consistent_topology_is_returned_intact
  Scenario: A consistent topology is returned
    Given a declaration with a jurisdiction-hosted forge, egress-restricted network, hosted provenance and outward-facing true
    When it is read
    Then its forge is "jurisdiction-hosted" and outward-facing is true

  @test:scripts/tests/topology-conflicts.test.ts::a_contradictory_declaration_is_refused,_not_returned::an_unknown_axis_value_is_refused_by_the_schema,_not_silently_dropped
  Scenario: An unknown axis value is refused
    Given a declaration with network "airgapped"
    Then reading it throws

  @test:scripts/tests/topology-conflicts.test.ts::the_vocabulary_matches_the_proposal::each_axis_ranges_over_exactly_the_values_the_proposal_lists
  Scenario: The axis vocabularies
    Then the forges are none, github, self-hosted, jurisdiction-hosted
    And the network reaches are internet, egress-restricted, air-gapped
    And the model provenances are open-weight-local, hosted, mixed
    And the publication hosts include "none"
