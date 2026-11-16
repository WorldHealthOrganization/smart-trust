# Which actor a script sweep records, and why there are two.
# Each Scenario names the test that executes it.
Feature: Sweep actor

  @test:scripts/tests/sweep-actor.test.ts::sweepActor::an_empty_environment_is_LOCAL,_not_unknown
  Scenario: An empty environment is the local actor
    When the sweep actor is resolved from an empty environment
    Then it is the local sweep actor

  @test:scripts/tests/sweep-actor.test.ts::sweepActor::`CI=true`_resolves_to_the_pipeline_—_any_CI,_not_only_GitHub's
  Scenario: CI=true is the pipeline
    When the sweep actor is resolved with CI "true"
    Then it is the CI sweep actor

  @test:scripts/tests/sweep-actor.test.ts::sweepActor::`GITHUB_ACTIONS=true`_resolves_to_the_pipeline
  Scenario: GITHUB_ACTIONS=true is the pipeline
    When the sweep actor is resolved with GITHUB_ACTIONS "true"
    Then it is the CI sweep actor

  @test:scripts/tests/sweep-actor.test.ts::sweepActor::`CI=false`_is_local_—_the_value_is_read,_not_merely_the_key
  Scenario: CI=false is local
    When the sweep actor is resolved with CI "false"
    Then it is the local sweep actor

  @test:scripts/tests/sweep-actor.test.ts::both_actors_satisfy_the_permission_the_gate_checks::each_is_declared
  Scenario: Both sweep actors are declared
    When the declared actors are read
    Then the CI and the local sweep actors are among them

  @test:scripts/tests/sweep-actor.test.ts::both_actors_satisfy_the_permission_the_gate_checks::each_holds_qa-reporting,_so_a_stamped_verdict_is_`permitted`
  Scenario: A verdict stamped by either sweep actor is permitted
    When a script reviewer stamped with either sweep actor is judged
    Then the outcome is "permitted"

  @test:scripts/tests/sweep-actor.test.ts::both_actors_satisfy_the_permission_the_gate_checks::NEITHER_holds_content-authoring_—_the_separation_this_epic_is_about
  Scenario: Neither sweep actor holds content-authoring
    # Gap: an undeclared actor also passes (missing permissions read as false), so this does not fail if the actors are absent; "each is declared" covers that.
    Then neither the CI nor the local sweep actor holds "content-authoring"

  @test:scripts/tests/sweep-actor.test.ts::both_actors_satisfy_the_permission_the_gate_checks::an_unstamped_reviewer_is_still_unresolved_—_the_hook_is_not_retroactive
  Scenario: An unstamped script reviewer is unresolved
    When a script reviewer with no actor is judged
    Then the outcome is "unresolved"
