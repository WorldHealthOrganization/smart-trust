# scripts/check-draft-beans.ts finds draft decision beans (ruling requests carrying a recommendation or safe default)
# that exist on no ancestor of the default branch, and reports any state it cannot determine as a finding.
# Each Scenario names the test that executes it.
Feature: A draft decision bean must land on the default branch

  @test:scripts/tests/check-draft-beans.test.ts::hasRecommendationOrDefaultSection::matches_##_Recommendation_heading
  Scenario: A Recommendation heading marks a decision bean
    Given bodies headed "## Recommendation", "## 6. Recommendation" and "### Recommendation"
    When each is tested for a recommendation or default section
    Then each matches

  @test:scripts/tests/check-draft-beans.test.ts::hasRecommendationOrDefaultSection::matches_safe_default_phrase_or_heading
  Scenario: A safe default phrase or heading marks a decision bean
    Given a sentence stating "the safe default is option D"
    And bodies headed "## Safe default" and "### The safe default"
    When each is tested for a recommendation or default section
    Then each matches

  @test:scripts/tests/check-draft-beans.test.ts::hasRecommendationOrDefaultSection::matches_options_comparison_with_recommendation_or_if-silent
  Scenario: An options comparison with a recommended option or an if-silent default marks a decision bean
    Given an options table with an option marked "(recommended)"
    And an Options section saying "If you say nothing, I will take option A."
    And an Options section saying "If silent, default to A."
    When each is tested for a recommendation or default section
    Then each matches

  @test:scripts/tests/check-draft-beans.test.ts::hasRecommendationOrDefaultSection::returns_false_for_regular_task_or_bug_prose
  Scenario: Ordinary task or bug prose is not a decision bean
    Given a feature instruction, a bug fix sentence and a "## Done when" checklist
    When each is tested for a recommendation or default section
    Then none matches

  @test:scripts/tests/check-draft-beans.test.ts::resolveDefaultRef::respects_customRef_when_valid
  Scenario: A valid custom ref is used as the default ref
    # Gap: the custom ref given is "main", which is also the fallback, so a custom ref differing from the fallback is not checked
    Given a git repository with one commit on "main"
    When the default ref is resolved with the custom ref "main"
    Then it is "main"

  @test:scripts/tests/check-draft-beans.test.ts::resolveDefaultRef::resolves_main_when_present
  Scenario: The default ref resolves to main when main exists
    Given a git repository with one commit on "main"
    When the default ref is resolved with no custom ref
    Then it is "main"

  @test:scripts/tests/check-draft-beans.test.ts::resolveDefaultRef::returns_null_when_no_candidate_ref_exists
  Scenario: No default ref resolves when no candidate exists
    Given an empty git repository on branch "some-feature"
    When the default ref is resolved with the custom ref "non-existent-ref"
    Then no ref is returned

  @test:scripts/tests/check-draft-beans.test.ts::checkDraftBeans_detection_logic_with_mocked_beans_&_git::passes_when_no_draft_beans_exist
  Scenario: A store with no draft beans passes
    Given three beans in todo, in-progress and completed and a resolvable "main"
    When the draft beans are checked
    Then there are no findings and nothing undetermined
    And the draft and decision-draft counts are 0 of a total of 3

  @test:scripts/tests/check-draft-beans.test.ts::checkDraftBeans_detection_logic_with_mocked_beans_&_git::ignores_draft_beans_that_are_not_decision_ruling_requests
  Scenario: A draft bean that is not a ruling request is not flagged
    Given one draft bean whose body describes ordinary task work
    When the draft beans are checked
    Then there are no findings and nothing undetermined
    And one draft and no decision drafts are counted

  @test:scripts/tests/check-draft-beans.test.ts::checkDraftBeans_detection_logic_with_mocked_beans_&_git::catches_draft_decision_bean_unmerged_on_branch
  Scenario: A draft decision bean committed only on a branch is a finding
    Given a draft bean "folio-assistant-r0tm" with a Recommendation and a safe default
    And the bean file does not exist on "main", was committed on HEAD, and that commit is not an ancestor of main
    When the draft beans are checked
    Then there is one finding for "folio-assistant-r0tm" whose reason mentions "no ancestor of main"
    And one draft and one decision draft are counted

  @test:scripts/tests/check-draft-beans.test.ts::checkDraftBeans_detection_logic_with_mocked_beans_&_git::passes_when_draft_decision_bean_exists_on_default_branch
  Scenario: A draft decision bean present on the default branch passes
    Given a draft decision bean whose file exists on "main" as a draft with a recommendation
    When the draft beans are checked
    Then there are no findings and nothing undetermined
    And one decision draft is counted

  @test:scripts/tests/check-draft-beans.test.ts::checkDraftBeans_detection_logic_with_mocked_beans_&_git::reports_uncommitted_draft_decision_bean_as_finding
  Scenario: An uncommitted draft decision bean is a finding
    Given a draft decision bean whose file is absent from "main" and has no commit on HEAD
    When the draft beans are checked
    Then there is one finding whose reason mentions "uncommitted and exists on no ancestor"

  @test:scripts/tests/check-draft-beans.test.ts::checkDraftBeans_detection_logic_with_mocked_beans_&_git::handles_unreadable_git_ancestry_as_dh4f_undetermined_(never_green)
  Scenario: Unreadable git ancestry is undetermined, never green
    Given a draft decision bean committed on HEAD whose ancestry check fails with "shallow clone missing object"
    When the draft beans are checked
    Then one entry is undetermined, quoting "shallow clone missing object"
    And the formatted report says "could not determine" and "dh4f: could not determine is a finding, never green"

  @test:scripts/tests/check-draft-beans.test.ts::checkDraftBeans_detection_logic_with_mocked_beans_&_git::handles_missing_default_branch_as_undetermined
  Scenario: A default branch that cannot be resolved is undetermined
    Given one draft bean and git failing every default branch lookup
    When the draft beans are checked with no default ref given
    Then one entry is undetermined, saying "could not determine default branch ref"

  @test:scripts/tests/check-draft-beans.test.ts::real_git_repo_workflow::catches_unmerged_draft_decision_bean,_then_passes_once_merged_to_main
  Scenario: An unmerged draft decision bean is caught on its branch and passes once merged
    Given a real git repository with a completed bean on "main"
    And a feature branch committing the draft decision bean "folio-assistant-r0tm"
    When the draft beans are checked on the branch against "main"
    Then there is one finding for "folio-assistant-r0tm", with one draft decision of 2 beans
    When the branch is merged into "main" and the check runs again
    Then there are no findings and nothing undetermined, with one draft decision of 2 beans
    And the report says "0 unmerged of 1 draft decisions (1 draft, 2 total)"
    And it says "every draft decision bean exists on an ancestor of main"
