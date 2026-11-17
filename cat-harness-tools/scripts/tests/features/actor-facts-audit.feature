# The actor-fact-has-consumer criterion (scripts/actor-facts.ts): every capability
# and permission an actor declares should be consumed by some process or policy.
# Each Scenario names the test that executes it.
Feature: Actor facts have a consumer

  @test:scripts/tests/actor-facts-audit.test.ts::token_matching_helper::matches_distinct_identifiers_surrounded_by_non-alphanumeric/hyphen/underscore
  Scenario: A fact token matches only as a whole identifier
    Then "git-push" matches in "The task performs git-push to remote."
    And "git-push" matches inside a quoted task name attribute
    And "git-push" does not match in "git-push-something-else"
    And "admin" does not match in "admin-settings"
    And "admin-settings" matches in "exercising admin-settings"

  @test:scripts/tests/actor-facts-audit.test.ts::vacuity_guard::an_empty_actor_set_returns_unknown_rather_than_passing
  Scenario: An empty actor set evaluates to unknown rather than passing
    When the criterion is evaluated over no actors
    Then the result is "unknown"
    And there is one finding saying "no actors declared"

  @test:scripts/tests/actor-facts-audit.test.ts::vacuity_guard::actors_with_no_declared_capabilities_and_permissions_returns_unknown_rather_than_passing
  Scenario: Actors declaring no capabilities or permissions evaluate to unknown rather than passing
    Given one actor with no capabilities and no permissions
    When the criterion is evaluated
    Then the result is "unknown"
    And there is one finding saying "no actor facts"

  @test:scripts/tests/actor-facts-audit.test.ts::consumer_detection::passes_when_all_declared_facts_are_consumed_in_processes/gateways/tasks
  Scenario: An actor's facts all consumed by a process's gateway and task pass
    Given an actor declaring capability "signing-api" and permission "role-management"
    When the criterion is evaluated against a process whose only task names neither
    Then the result is "fail", with findings for "role-management" and "signing-api"
    When it is evaluated against a process whose gateway names "signing-api" and whose task names "role-management"
    Then the result is "pass" with no findings

  @test:scripts/tests/actor-facts-audit.test.ts::consumer_detection::reports_unconsumed_capability_and_permission_as_findings
  Scenario: Unconsumed capability and permission are each reported as a finding
    Given actor "worker" declaring capability "unconsumed-cap" and permission "unconsumed-perm"
    When the criterion is evaluated with no workflow files
    Then the result is "fail"
    And there are two findings, at "unconsumed-cap" and "unconsumed-perm"
    And the first says declared capability "unconsumed-cap" and names "worker"
    And the second says declared permission "unconsumed-perm" and names "worker"

  @test:scripts/tests/actor-facts-audit.test.ts::consumer_detection::recognizes_consumption_in_constrained_ODRL_policy_rules
  Scenario: A permission granted by a constrained ODRL policy rule counts as consumed
    Given actor "constrained-actor" declaring permission "special-perm"
    And an ODRL policy granting that actor "special-perm" constrained to process "Process_Test"
    When the criterion is evaluated with that policy
    Then the result is "pass"
    And there are no findings

  @test:scripts/tests/actor-facts-audit.test.ts::criterion_definition_in_KG_CRITERIA::is_registered_with_correct_id,_kind,_and_minor_severity
  Scenario: The criterion is registered as a minor graph criterion
    When "actor-fact-has-consumer" is looked up among the KG criteria
    Then it is defined
    And it applies to "graph"
    And its severity is "minor"

  @test:scripts/tests/actor-facts-audit.test.ts::criterion_definition_in_KG_CRITERIA::is_repo-scoped_with_evidence-based_scopeBasis
  Scenario: The criterion is repo-scoped with an evidence-based scope basis
    Then its scope is "repo"
    And its scope basis is longer than 80 characters
    And it mentions the repository root or a measurement

  @test:scripts/tests/actor-facts-audit.test.ts::real_repository_measurement::measures_baseline_unconsumed_actor_facts_count_on_the_repository
  Scenario: The repository's unconsumed actor facts stay within a known ratchet
    Given the repository's actors, policy grants and workflow files
    When the criterion is evaluated
    Then the result is "fail"
    And there are at most 16 findings, each one of the 16 known facts
    And "content-authoring", "qa-reporting", "clinical-validation", "perform-task", "approval-authority", "project-governance", "first-pass-review" and "sme-coordination" are among the findings
    And "git-push", "signing-api", "admin-settings", "role-management", "adjudication" and "translation" are not
