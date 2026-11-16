# scripts/git-ancestry.ts answers git ancestry questions with "cannot tell" as its own answer,
# so a shallow clone's missing history is never read as "not an ancestor".
# Each Scenario names the test that executes it.
Feature: Git ancestry that can answer unknown

  @test:scripts/tests/git-ancestry.test.ts::isAncestor_on_a_FULL_history::answers_both_directions,_and_knows_it
  Scenario: On a full history both a yes and a no are known answers
    Given a real repository with three commits on one line
    When isAncestor is asked whether the first commit is an ancestor of the last
    Then the answer is known and the first commit is an ancestor
    And when asked the other way round the answer is still known, and is not an ancestor

  @test:scripts/tests/git-ancestry.test.ts::isAncestor_on_a_FULL_history::a_commit_is_its_own_ancestor,_as_git_defines_it
  Scenario: A commit is its own ancestor
    Given a real repository with two commits
    When isAncestor is asked about the second commit against itself
    Then the answer is known and it is an ancestor

  @test:scripts/tests/git-ancestry.test.ts::isAncestor_on_a_SHALLOW_history_—_the_case_this_module_exists_for::the_defect_is_real:_bare_--is-ancestor_exits_128_where_the_answer_is_yes
  Scenario: Bare merge-base --is-ancestor exits 128 on a shallow clone where the answer is yes
    Given a real repository with five commits and a depth-1 clone of it
    When "git merge-base --is-ancestor" asks whether the oldest commit is an ancestor of HEAD in each
    Then the full repository exits 0
    And the shallow clone exits 128, which is not 0

  @test:scripts/tests/git-ancestry.test.ts::isAncestor_on_a_SHALLOW_history_—_the_case_this_module_exists_for::a_truncated_negative_is_unknown,_not_false
  Scenario: A negative caused by truncated history is unknown, not false
    Given a depth-1 clone of a five-commit repository
    And the clone reports itself shallow and cannot see the oldest commit
    When isAncestor asks about the oldest commit against HEAD with deepening off
    Then the answer is not known
    And its reason names the first 9 characters of the oldest commit's sha

  @test:scripts/tests/git-ancestry.test.ts::isAncestor_on_a_SHALLOW_history_—_the_case_this_module_exists_for::deepening_turns_the_same_question_into_a_real_answer
  Scenario: Deepening a shallow clone yields a real answer
    Given a depth-1 clone of a five-commit repository that reports itself shallow
    When isAncestor asks about the oldest commit against HEAD with default options
    Then the answer is known and the oldest commit is an ancestor

  @test:scripts/tests/git-ancestry.test.ts::ancestorOr::the_caller_states_its_own_fallback_for_unknown
  Scenario: ancestorOr uses the caller's fallback only for an unknown answer
    Given known answers of true and false and an unknown answer
    When ancestorOr reads each with a fallback
    Then a known true is true even with a false fallback
    And a known false is false even with a true fallback
    And an unknown answer returns whichever fallback was given, true or false

  @test:scripts/tests/git-ancestry.test.ts::relate::names_which_side_descends
  Scenario: relate names which side descends
    Given a real repository with three commits on one line
    When relate compares the last with the first, the first with the last, and the middle with itself
    Then the answers are "a-descends", "b-descends" and "same"

  @test:scripts/tests/git-ancestry.test.ts::relate::`diverged`_is_only_claimed_on_a_history_whole_enough_to_prove_it
  Scenario: relate reports diverged for two branches off a shared root on a full history
    # Gap: only the full-history case is checked here; the shallow refusal is the next Scenario
    Given a full repository with a root commit and branches "left" and "right" each adding one commit
    When relate compares the left tip with the right tip
    Then the answer is "diverged"

  @test:scripts/tests/git-ancestry.test.ts::relate::an_unreachable_pin_is_unknown_rather_than_diverged_—_the_#2046_error
  Scenario: An unreachable pin is unknown rather than diverged
    Given a depth-1 clone of a four-commit repository
    When relate compares the oldest commit with the clone's HEAD with deepening off
    Then the answer is "unknown"
    And it carries a non-empty reason
