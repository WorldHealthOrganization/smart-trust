# verdictForCommit in src/workflow/check-verdict.ts re-examines a would-be pass: a clean but incomplete
# check set, a conflicted head, or an unscanned or unprobed input is undetermined, never green.
# Each Scenario names the test that executes it.
Feature: A commit's check verdict requires a complete check set

  @test:scripts/tests/sdlc/verdict-for-commit.test.ts::a_would-be_pass_is_the_only_state_re-examined::a_FAILURE_is_returned_untouched_—_a_completeness_question_never_softens_it
  Scenario: A failing verdict is returned untouched
    Given a verdict from one completed run concluding "failure"
    When the commit verdict is taken with no owed summary and no merge state
    Then it equals the failing verdict
    And with a satisfied owed summary on a "conflicted" head its state is still "fail"

  @test:scripts/tests/sdlc/verdict-for-commit.test.ts::a_would-be_pass_is_the_only_state_re-examined::pending_and_undetermined_pass_through_unchanged
  Scenario: Pending and undetermined verdicts pass through unchanged
    Given a verdict from one run still in progress
    When the commit verdict is taken with no owed summary and no merge state
    Then it equals the pending verdict
    And the verdict from no runs at all is likewise returned unchanged

  @test:scripts/tests/sdlc/verdict-for-commit.test.ts::the_defect:_a_clean_PARTIAL_set_is_not_a_pass::a_required_workflow_with_no_run_refuses,_and_NAMES_it
  Scenario: A clean set missing a required workflow is undetermined and names it
    Given a clean verdict and "Code-quality gates" owed but missing, on a "mergeable" head
    When the commit verdict is taken
    Then its state is "undetermined"
    And it names "Code-quality gates"
    And its reason says "partial check set"

  @test:scripts/tests/sdlc/verdict-for-commit.test.ts::the_defect:_a_clean_PARTIAL_set_is_not_a_pass::the_complete_set_passes,_and_says_so
  Scenario: A clean complete set passes
    Given a clean verdict, nothing missing or unreadable, on a "mergeable" head
    When the commit verdict is taken
    Then its state is "pass"
    And its reason says "every workflow owed for this event ran"

  @test:scripts/tests/sdlc/verdict-for-commit.test.ts::the_defect:_a_clean_PARTIAL_set_is_not_a_pass::`not-a-pr-head`_is_a_normal_state,_not_a_finding
  Scenario: A commit that is not a PR head can pass
    Given a clean verdict and a satisfied owed summary on a "not-a-pr-head" commit
    When the commit verdict is taken
    Then its state is "pass"

  @test:scripts/tests/sdlc/verdict-for-commit.test.ts::a_conflicted_head_gets_its_own_story,_not_the_generic_one::it_refuses,_and_says_the_checks_will_NEVER_arrive
  Scenario: A clean verdict on a conflicted head is undetermined with the conflict story
    Given a clean verdict and a satisfied owed summary on a "conflicted" head
    When the commit verdict is taken
    Then its state is "undetermined"
    And its reason says "CONFLICTED" and cites bean "52cz"
    And its reason does not say "partial check set"

  @test:scripts/tests/sdlc/verdict-for-commit.test.ts::a_conflicted_head_gets_its_own_story,_not_the_generic_one::NO_runs_on_a_conflicted_head_gets_the_conflict_story_too_—_re-told,_not_re-decided
  Scenario: No runs on a conflicted head gets the conflict story too
    Given the verdict from no runs on a "conflicted" head with no owed summary
    When the commit verdict is taken
    Then its state is "undetermined"
    And its reason says "CONFLICTED" and "no check has run"
    And on a "mergeable" head the no-runs verdict is returned unchanged

  @test:scripts/tests/sdlc/verdict-for-commit.test.ts::a_conflicted_head_gets_its_own_story,_not_the_generic_one::conflicted_is_checked_BEFORE_missing,_so_the_better_message_wins
  Scenario: The conflict story wins over a missing workflow
    Given a clean verdict with "Code-quality gates" missing on a "conflicted" head
    When the commit verdict is taken
    Then its reason says "CONFLICTED"

  @test:scripts/tests/sdlc/verdict-for-commit.test.ts::could-not-determine_is_never_green_(bean_`dh4f`)::an_unscanned_tree_is_not_a_satisfied_required_set
  Scenario: An unscanned tree is undetermined
    Given a clean verdict with no owed summary on a "mergeable" head
    When the commit verdict is taken
    Then its state is "undetermined" and its reason says "not scanned"

  @test:scripts/tests/sdlc/verdict-for-commit.test.ts::could-not-determine_is_never_green_(bean_`dh4f`)::an_unprobed_merge_state_is_not_a_mergeable_one
  Scenario: An unprobed merge state is undetermined
    Given a clean verdict and a satisfied owed summary with no merge state
    When the commit verdict is taken
    Then its state is "undetermined" and its reason says "not probed"

  @test:scripts/tests/sdlc/verdict-for-commit.test.ts::could-not-determine_is_never_green_(bean_`dh4f`)::an_unreadable_workflow_file_means_the_required_set_is_NOT_established
  Scenario: An unreadable workflow file leaves the verdict undetermined
    Given a clean verdict with nothing missing but 2 unreadable workflow files, on a "mergeable" head
    When the commit verdict is taken
    Then its state is "undetermined" and its reason says "could not be read"

  @test:scripts/tests/sdlc/verdict-for-commit.test.ts::nothing_here_reconciles_anything::the_module_IMPORTS_nothing_—_the_inputs_are_given,_not_fetched
  Scenario: The check-verdict module imports nothing and fetches nothing
    Given the source text of "src/workflow/check-verdict.ts"
    Then it has no import lines
    And it contains no awaited fetch call and no require call
