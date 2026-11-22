# scripts/proposal-approve.ts approves a proposal by seeding or tagging its work plan, so the
# proposal names the plan and the plan names the proposal; mismatches are reported, not fatal.
# Each Scenario names the test that executes it.
Feature: Approving a proposal seeds its work plan

  @test:scripts/tests/sdlc/proposal-approve.test.ts::proposal:approve::with_no_--plan_it_creates_an_epic_titled_as_the_proposal,_and_both_ends_name_each_other
  Scenario: With no plan given, approval creates an epic and both ends name each other
    Given a checkout with a proposal titled "Do the thing" and an empty work-item store
    When the proposal is approved for process "Process_ContentLifecycle" on 2026-11-05
    Then a new epic titled "Do the thing" is created
    And the epic's work plan names that process and the proposal
    And the proposal's front matter has status "approved", approvedOn "2026-11-05" and the new plan id
    And the proposal's folded summary is kept
    And the proposal and plan have no findings against each other

  @test:scripts/tests/sdlc/proposal-approve.test.ts::proposal:approve::with_--plan_it_tags_that_epic_or_milestone_and_keeps_its_other_tags
  Scenario: With a plan given, approval tags that milestone and keeps its other tags
    Given a milestone "t-goal" already tagged "vocabulary"
    When the proposal is approved with plan "t-goal" for process "P"
    Then no new item is created
    And t-goal's tags are "vocabulary", "process:P" and "proposal:docs/proposals/p.md"

  @test:scripts/tests/sdlc/proposal-approve.test.ts::proposal:approve::refuses_what_would_not_be_a_plan:_no_process,_a_feature,_an_unknown_id
  Scenario: Approval refuses what would not be a plan
    Given a feature "t-feat" in the store
    When the proposal is approved with no process
    Then it fails saying the plan needs the process it runs
    And approving with plan "t-feat" fails asking for an epic or a milestone
    And approving with plan "t-none" fails because there is no work item
    And the proposal is left with no status

  @test:scripts/tests/sdlc/proposal-approve.test.ts::proposal:approve::a_dry_run_writes_nothing
  Scenario: A dry run writes nothing
    Given a checkout with an unapproved proposal
    When the proposal is approved for process "P" as a dry run
    Then the result lists tags "process:P" and "proposal:docs/proposals/p.md"
    And the store holds no work items
    And the proposal is left with no status

  @test:scripts/tests/sdlc/proposal-approve.test.ts::proposal:approve::approving_twice_without_--plan_is_refused,_naming_the_plan
  Scenario: Approving twice without a plan is refused, naming the plan
    Given a proposal already approved, which created a plan
    When it is approved again without a plan
    Then it fails naming "--plan" with the existing plan id

  @test:scripts/tests/sdlc/proposal-approve.test.ts::proposal_↔_plan_findings:_reported,_never_fatal::each_way_the_two_ends_can_disagree
  Scenario: Each way a proposal and its plan can disagree is reported
    Given work items e1 tagged for a different proposal and e2 with no process tag
    And approved proposals a (no plan), b (plan e1), c (plan e2), d (plan "nope") and an unapproved e (plan e1)
    When the proposal-plan findings are computed
    Then findings are reported for a, b, c and d only
    And a "names no plan"
    And b's finding names the other proposal e1 points at
    And c's plan is "not a work plan yet"
    And d's plan is "not a work item"

  @test:scripts/tests/sdlc/proposal-approve.test.ts::adding_tags_keeps_the_rest_of_the_file::extends_the_sequence,_creates_it_after_type:,_never_repeats_a_tag
  Scenario: Adding tags extends the sequence, creates it after type, and never repeats a tag
    Given a work-item file whose tags already hold "a"
    When tags "b", "a", "b" are added
    Then only "b" is appended after "a" and the rest of the file is unchanged
    And adding "p" to a file with no tags creates a tags sequence right after its type line
    And adding "a" again leaves the file unchanged

  @test:scripts/tests/sdlc/proposal-approve.test.ts::--check_reads_every_proposal_against_the_store::an_approved_proposal_with_no_plan_is_found;_one_approved_through_the_command_is_not
  Scenario: The check finds an approved proposal with no plan but not one approved through the command
    Given a proposal q with status approved and no plan, and a generated README in the proposals directory
    And the main proposal approved through the command
    When the proposals directory is checked against the store
    Then 2 proposals are read
    And the only finding is for "docs/proposals/q.md"
