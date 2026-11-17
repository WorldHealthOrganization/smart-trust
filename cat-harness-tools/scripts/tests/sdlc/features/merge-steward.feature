# scripts/merge-steward.ts (`merge:steward`) reads the conflicted paths out of `git merge-tree`
# CONFLICT lines and finds a PR's open hand-back bean. Each Scenario names the test that executes it.
Feature: Merge steward conflict paths and hand-back beans

  @test:scripts/tests/sdlc/merge-steward.test.ts::conflictPath::the_`Merge_conflict_in_<path>`_forms,_whatever_the_kind_in_parentheses
  Scenario: The "Merge conflict in <path>" forms yield the path whatever the kind in parentheses
    Given CONFLICT lines of kind content, submodule and add/add
    When the conflicted path is read from each
    Then they yield "cat-harness/docs/lsi/index.md", "bootstrap-tools" and "a/b.json"

  @test:scripts/tests/sdlc/merge-steward.test.ts::conflictPath::the_modify/delete_form,_whose_path_is_NOT_after_`in`
  Scenario: The modify/delete form yields the path that comes first, not the text after "in"
    Given a CONFLICT (modify/delete) line naming smart-l1/test/results/README.md deleted in one revision and modified in another
    When the conflicted path is read from it
    Then it is "smart-l1/test/results/README.md"

  @test:scripts/tests/sdlc/merge-steward.test.ts::conflictPath::an_unknown_form_is_`null`,_never_the_raw_line
  Scenario: An unknown form yields null, never the raw line
    Given a CONFLICT line of an unseen kind, an "Auto-merging" line and an empty line
    When the conflicted path is read from each
    Then each yields null

  @test:scripts/tests/sdlc/merge-steward.test.ts::conflictPath::a_path_with_spaces_survives,_since_the_form_is_terminated_by_end-of-line
  Scenario: A path with spaces survives whole
    Given the line "CONFLICT (content): Merge conflict in docs/a file.md"
    When the conflicted path is read from it
    Then it is "docs/a file.md"

  @test:scripts/tests/sdlc/merge-steward.test.ts::handBackBeanFor::finds_the_open_hand-back_bean_by_its_prescribed_title
  Scenario: The open hand-back bean is found by its prescribed title
    Given a bean store with an open bean titled "Merge refused: #2078 merge:guard checks 3 and 5"
    When the hand-back bean for PR 2078 is looked up
    Then it is "folio-assistant-aaaa"

  @test:scripts/tests/sdlc/merge-steward.test.ts::handBackBeanFor::a_completed_hand-back_bean_does_not_count,_so_the_gap_is_reported_again
  Scenario: A completed hand-back bean does not count
    Given a bean store whose only hand-back bean for PR 2043 is completed
    When the hand-back bean for PR 2043 is looked up
    Then there is none

  @test:scripts/tests/sdlc/merge-steward.test.ts::handBackBeanFor::the_PR_number_is_matched_whole:_#2078_is_not_#20780
  Scenario: The PR number is matched whole, so #2078 is not #20780
    Given a bean store with hand-back beans for #2078 and #20780
    When the hand-back beans for PRs 20780 and 207 are looked up
    Then PR 20780 finds "folio-assistant-cccc"
    And PR 207 finds none

  @test:scripts/tests/sdlc/merge-steward.test.ts::handBackBeanFor::an_unreadable_store_is_no_bean,_never_a_pass
  Scenario: An unreadable bean store yields no bean, never a pass
    Given a bean store whose state is absent
    When the hand-back bean for PR 2078 is looked up
    Then there is none
