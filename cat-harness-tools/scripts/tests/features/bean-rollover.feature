# scripts/bean-rollover.ts classifies how a PR's change to a bean relates to the base branch's:
# ignoring updated_at, detecting a strict superset on either side, and otherwise porting or
# asking for adjudication. Each Scenario names the test that executes it.
Feature: Bean rollover classification

  @test:scripts/tests/bean-rollover.test.ts::bean-rollover:_updated_at_exclusion::stripUpdatedAt_removes_updated_at_line_from_front_matter_and_preserves_everything_else
  Scenario: stripUpdatedAt removes the updated_at line and preserves everything else
    Given a bean with front matter including "updated_at" and a two-paragraph body
    When updated_at is stripped
    Then the text is the same bean with only the updated_at line removed

  @test:scripts/tests/bean-rollover.test.ts::bean-rollover:_updated_at_exclusion::differsOnlyInUpdatedAt_returns_true_when_only_updated_at_timestamp_differs
  Scenario: Two beans that differ only in updated_at are recognised as such
    Given two beans with the same status and body and different updated_at timestamps
    When they are compared for differing only in updated_at
    Then the answer is true

  @test:scripts/tests/bean-rollover.test.ts::bean-rollover:_updated_at_exclusion::differsOnlyInUpdatedAt_returns_false_when_status_or_body_differs
  Scenario: Two beans that differ in status or body do not differ only in updated_at
    Given a bean and a copy with status "ready-to-close", and a copy with a different body
    When each copy is compared for differing only in updated_at
    Then both answers are false

  @test:scripts/tests/bean-rollover.test.ts::bean-rollover:_strict_superset_detection::detects_base_as_strict_superset_when_base_contains_claim_note_that_head_lacks_(PR_#1937_case)
  Scenario: The base is a strict superset when it holds a claim note the head lacks
    Given a base bean whose body ends with a "Claimed by claude/state-branch-store" note
    And a head bean with the same body without the note and a later updated_at
    When the strict superset is checked
    Then the superset side is "base"
    And its diff contains the claim note

  @test:scripts/tests/bean-rollover.test.ts::bean-rollover:_strict_superset_detection::detects_head_as_strict_superset_when_head_contains_evidence_section_that_base_lacks
  Scenario: The head is a strict superset when it holds an evidence section the base lacks
    Given a head bean that adds an "## Evidence" section with "All gates green" to the base's body
    When the strict superset is checked
    Then the superset side is "head"
    And its diff contains "## Evidence" and "All gates green"

  @test:scripts/tests/bean-rollover.test.ts::bean-rollover:_strict_superset_detection::returns_undefined_when_texts_are_identical_once_updated_at_is_stripped
  Scenario: No superset is reported when the texts are identical once updated_at is stripped
    Given base and head beans differing only in updated_at
    When the strict superset is checked
    Then it is undefined

  @test:scripts/tests/bean-rollover.test.ts::bean-rollover:_strict_superset_detection::NEGATIVE_CONTROL_(the_dlqu_case):_returns_undefined_when_both_sides_have_divergent_modifications
  Scenario: No superset is reported when both sides modified the bean divergently
    Given a base body "Owner ruling: keep both sides." and a head body "Author note: divergent implementation approach."
    When the strict superset is checked
    Then it is undefined

  @test:scripts/tests/bean-rollover.test.ts::bean-rollover:_classification_in_a_git_repository::change_to_ONLY_updated_at_reports_already-on-main,_NOT_adjudicate
  Scenario: A change to only updated_at is already on main, not for adjudication
    Given a scratch git repository where main and a PR branch each only bump the bean's updated_at after the fork
    When the bean is classified
    Then the state is "already-on-main"

  @test:scripts/tests/bean-rollover.test.ts::bean-rollover:_classification_in_a_git_repository::strict_superset_on_base_reports_port-superset_with_superset:_base
  Scenario: A strict superset on the base is a port-superset with the base as superset
    Given a scratch git repository where the PR moves the bean to in-progress
    And main moves it to in-progress and appends a claim note
    When the bean is classified
    Then the state is "port-superset" with superset "base"
    And the diff contains "Claimed by session on main"

  @test:scripts/tests/bean-rollover.test.ts::bean-rollover:_classification_in_a_git_repository::strict_superset_on_head_reports_port-superset_with_superset:_head
  Scenario: A strict superset on the head is a port-superset with the head as superset
    Given a scratch git repository where main adds a note
    And the PR branch from main keeps that note and adds an Evidence section
    When the bean is classified
    Then the state is "port-superset" with superset "head"
    And the diff contains "Evidence" and "100% test coverage"

  @test:scripts/tests/bean-rollover.test.ts::bean-rollover:_classification_in_a_git_repository::NEGATIVE_CONTROL_(dlqu_case):_divergent_edits_report_adjudicate
  Scenario: Divergent edits on both sides call for adjudication
    Given a scratch git repository where the PR appends approach X and main appends approach Y to the same body
    When the bean is classified
    Then the state is "adjudicate"
    And the reason says "both this PR and the base changed this bean"

  @test:scripts/tests/bean-rollover.test.ts::bean-rollover:_classification_in_a_git_repository::pure_port_when_base_has_not_touched_bean_since_fork
  Scenario: A pure port when the base has not touched the bean since the fork
    Given a scratch git repository where the PR changes the bean and the base is the fork commit
    When the bean is classified
    Then the state is "port"
    And the reason says "the base has not touched this bean"
