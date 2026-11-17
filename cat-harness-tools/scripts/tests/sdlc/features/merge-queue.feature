# scripts/merge-queue.ts derives each open PR's overlap kind (none, generated-only,
# shared-declaration, authored) and places it through merge-priority.dmn.
# Each Scenario names the test that executes it.
Feature: Merge-queue overlap kinds and priority placement

  @test:scripts/tests/sdlc/merge-queue.test.ts::the_premises_the_partition_rests_on::a_shared_declaration_is_a_SUBSET_of_an_authored_path,_not_a_sibling
  Scenario: A shared declaration is a kind of authored path
    Then package.json is a shared declaration
    And the merge-queue skill markdown, an authored path, is not

  @test:scripts/tests/sdlc/merge-queue.test.ts::deriveFacts_—_overlapKind::no_shared_path_at_all_is_`none`
  Scenario: PRs sharing no path have overlap kind none
    Given two PRs touching different authored files
    When their facts are derived
    Then both have overlap kind "none"

  @test:scripts/tests/sdlc/merge-queue.test.ts::deriveFacts_—_overlapKind::a_generated-only_collision_is_`generated-only`,_and_NOT_`none`
  Scenario: A collision only on a generated path is generated-only
    Given two PRs that both touch only beans/README.md
    When their facts are derived
    Then both have overlap kind "generated-only"

  @test:scripts/tests/sdlc/merge-queue.test.ts::deriveFacts_—_overlapKind::sharing_only_a_shared_declaration_is_`shared-declaration`,_not_`authored`
  Scenario: Sharing only a shared declaration is shared-declaration
    Given PRs 1907 and 1909 that both touch package.json and beans/README.md
    When their facts are derived
    Then both have overlap kind "shared-declaration"

  @test:scripts/tests/sdlc/merge-queue.test.ts::deriveFacts_—_overlapKind::sharing_an_authored_non-declaration_path_is_`authored`
  Scenario: Sharing an authored non-declaration path is authored
    Given two PRs that both touch the same authored skill file
    When their facts are derived
    Then both have overlap kind "authored"

  @test:scripts/tests/sdlc/merge-queue.test.ts::deriveFacts_—_overlapKind::`authored`_outranks_both_cheaper_kinds_when_they_hold_together
  Scenario: Authored outranks the cheaper kinds when all hold
    Given two PRs that both touch an authored file, package.json and beans/README.md
    When their facts are derived
    Then the first has overlap kind "authored"

  @test:scripts/tests/sdlc/merge-queue.test.ts::deriveFacts_—_overlapKind::a_REFUSED_member_cannot_be_the_other_side_of_a_collision
  Scenario: A refused member is not the other side of a collision
    Given two PRs touching the same authored file, the second refused
    When their facts are derived
    Then the first has overlap kind "none"

  @test:scripts/tests/sdlc/merge-queue.test.ts::deriveFacts_—_overlapKind::conflictRisk_and_overlapKind_are_computed_from_one_pass_and_cannot_disagree
  Scenario: Conflict risk and overlap kind agree
    Given two PRs sharing an authored file and two sharing a generated file
    When their facts are derived
    Then each PR's conflict risk is "high" exactly when its overlap kind is "authored" or "shared-declaration"

  @test:scripts/tests/sdlc/merge-queue.test.ts::merge-priority.dmn_—_readiness_and_CI,_evaluated::a_finished_PR_is_admitted
  Scenario: A finished PR is admitted
    Given a PR that is green, matches its CI head, and carries a ready marker signed by its own session at its head
    Then its readiness is "ready"
    And placing it through the priority table routes it to "admit"

  @test:scripts/tests/sdlc/merge-queue.test.ts::merge-priority.dmn_—_readiness_and_CI,_evaluated::%s_is_`%s`_and_handed_back_by_Rule_NotReady
  Scenario: A PR that is not ready is handed back by Rule_NotReady
    Given a finished PR with one field broken per row
    When its readiness is read and it is placed through the priority table
    Then its readiness is the row's state
    And it is routed "hand back" with class "hand-back" by "Rule_NotReady"
    And the rows are: a draft is "draft"; a base other than main is "not-main"; no ready marker is "no-marker"; an unsigned marker or one signed by another session is "foreign-marker"; a head moved past the marker is "stale-marker"

  @test:scripts/tests/sdlc/merge-queue.test.ts::merge-priority.dmn_—_readiness_and_CI,_evaluated::ownCi_`%s`_is_handed_back_by_Rule_HeadNotGreen,_without_throwing
  Scenario: A PR whose own CI is not green is handed back by Rule_HeadNotGreen
    Given a finished PR whose own CI is "red", "missing-required", "none" or "unknown"
    When it is placed through the priority table
    Then placing does not throw
    And it is routed "hand back" with class "ci-not-green" by "Rule_HeadNotGreen"

  @test:scripts/tests/sdlc/merge-queue.test.ts::merge-priority.dmn_—_readiness_and_CI,_evaluated::every_class_the_table_can_return_is_in_PRIORITY_CLASSES
  Scenario: Every class the priority table returns is in the vocabulary
    Given the class output entries read from merge-priority.dmn
    Then there are more than ten of them
    And each is in PRIORITY_CLASSES
