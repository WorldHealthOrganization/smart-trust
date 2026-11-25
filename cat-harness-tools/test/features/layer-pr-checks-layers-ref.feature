# .github/workflows/layer-pr-checks.yml's "Layers cache ref for a re-pinned lock", its step run
# against stub git and bun (owner, card 2026-11-18): a downstream copy whose re-pinner cannot push it
# gets a warning, not a failure; a ref missing everywhere still fails the full tier; the fast tier is advisory.
# Each Scenario names the test that executes it.
Feature: The layers cache ref check does not fail a downstream copy it cannot be pushed to

  @test:test/layer-pr-checks-layers-ref.test.ts::layers-ref:_a_downstream_copy_whose_re-pinner_cannot_push_it::published_here:_passes,_and_asks_nowhere_else
  Scenario: A ref published at this repository passes
    Given the ref is published at this repository
    Then the step passes and asks no other repository

  @test:test/layer-pr-checks-layers-ref.test.ts::layers-ref:_a_downstream_copy_whose_re-pinner_cannot_push_it::a_WHO_sync_PR:_missing_at_WHO,_published_at_the_litlfred_fork,_is_a_warning,_not_a_failure
  Scenario: A sync PR whose ref is published at the harness owner's fork warns
    Given a WorldHealthOrganization repository whose ref is published only at its litlfred fork
    Then the step passes with a warning naming the fork, and the summary says the ref is not mirrored

  @test:test/layer-pr-checks-layers-ref.test.ts::layers-ref:_a_downstream_copy_whose_re-pinner_cannot_push_it::a_fork_PR:_published_at_the_PR's_head_repository_is_a_warning
  Scenario: A fork PR whose ref is published at its head repository warns
    Given the ref is published only at the PR's head repository
    Then the step passes with a warning naming it

  @test:test/layer-pr-checks-layers-ref.test.ts::layers-ref:_a_downstream_copy_whose_re-pinner_cannot_push_it::missing_everywhere_on_the_full_tier_is_still_a_failure
  Scenario: A ref missing everywhere fails the full tier
    Given the ref is published nowhere
    Then the step fails with the error, after asking this repository and the harness owner's fork

  @test:test/layer-pr-checks-layers-ref.test.ts::layers-ref:_a_downstream_copy_whose_re-pinner_cannot_push_it::missing_in_the_harness_owner's_own_repository_is_a_failure:_there_is_no_other_source_to_defer_to
  Scenario: A ref missing in the harness owner's own repository fails
    Given a litlfred repository whose ref is not published
    Then the step fails and asks no other repository

  @test:test/layer-pr-checks-layers-ref.test.ts::layers-ref:_a_downstream_copy_whose_re-pinner_cannot_push_it::an_error_(not_`missing`)_is_never_excused_by_another_repository
  Scenario: An error other than missing is never excused
    Given the check errs at this repository
    Then the step fails and asks no other repository

  @test:test/layer-pr-checks-layers-ref.test.ts::layers-ref:_a_downstream_copy_whose_re-pinner_cannot_push_it::the_fast_tier_is_advisory:_missing_everywhere_is_a_warning_there
  Scenario: On the fast tier a missing ref is a warning
    Given the fast tier and a ref published nowhere
    Then the step passes with an advisory warning, and the summary says the full tier fails on it
