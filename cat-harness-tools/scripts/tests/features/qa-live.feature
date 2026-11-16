# A layer's QA page reads its results in the browser (owner card 2026-11-10):
# what the page carries, and what its script draws for each answer GitHub can
# give. The script runs in a VM with a stub DOM and a stub fetch. Each
# Scenario names the test that executes it.
Feature: A layer's QA page loads its results in the browser

  @test:scripts/tests/qa-live.test.ts::qaLiveSourceOf::names_the_layer's_repository,_pinned_commit,_branch_and_entry_root
  Scenario: The live source names repository, pinned commit, branch and entry root
    Given layer "fhir-harness" with path "test/results/" and storage "cat/cat-harness/qa-reports", mounted at a pinned commit
    When its live source is derived
    Then it names "litlfred/fhir-harness", the commit, the branch, and root "fhir-harness/test/results"

  @test:scripts/tests/qa-live.test.ts::qaLiveSourceOf::is_undefined_without_a_storage_branch_or_a_plain_pin
  Scenario: No live source without a storage branch or a plain pin
    Then there is no live source without storage, without a mount, with ref "main", or with a storage value holding markup

  @test:scripts/tests/qa-live.test.ts::qaLivePanel::carries_the_source_as_data_attributes_and_a_no-script_link
  Scenario: The panel carries the source as data attributes and a no-script link
    When the panel is rendered for the source
    Then it carries data-repo, data-ref and data-root
    And it contains a <noscript> element

  @test:scripts/tests/qa-live.test.ts::qaLivePanel::holds_nothing_Liquid_would_evaluate
  Scenario: The panel holds nothing Liquid would evaluate
    When the panel is rendered
    Then it contains neither "{{" nor "{%"

  @test:scripts/tests/qa-live.test.ts::the_page_script::draws_the_pinned_commit's_entry,_failing_subjects_first
  Scenario: The script draws the pinned commit's entry, failing subjects first
    Given the pinned commit's manifest, a tree with records "a" (passing) and "b" (failing) and one other file
    When the page script runs
    Then it says "2 subject(s) audited: 1 with a failing check" and "1 pass, 1 fail, 2 n/a, 0 unknown"
    And it says "1 other file(s)"
    And "b" is listed before "a"
    And it does not say "ANOTHER commit"

  @test:scripts/tests/qa-live.test.ts::the_page_script::clicking_a_row_shows_its_checks,_failures_first,_with_their_findings
  Scenario: Clicking a row shows its checks, failures first, with their findings
    Given the pinned commit's entry with failing record "b"
    When the page script runs and the "tool-a" row is clicked
    Then it shows "tools/b.json", "Full record" and "Task_X: names no tool"
    And "tool-a" is shown before "tool-b"

  @test:scripts/tests/qa-live.test.ts::the_page_script::falls_back_to_the_newest_main_entry_and_says_it_is_another_commit's
  Scenario: The script falls back to the newest main entry and says so
    Given no entry at the pinned commit, and an index whose main entry is another commit with an empty tree
    When the page script runs
    Then it says "ANOTHER commit" and "0 subject(s) audited"

  @test:scripts/tests/qa-live.test.ts::the_page_script::a_layer_with_no_branch_is_'not_available',_never_an_empty_table
  Scenario: A layer with no published results is not available, not an empty table
    Given every fetch answers 404
    When the page script runs
    Then it says "no QA results are published for this layer yet"
    And it does not say "subject(s) audited"

  @test:scripts/tests/qa-live.test.ts::the_page_script::an_unreachable_GitHub_is_unknown,_not_zero
  Scenario: An unreachable GitHub is unknown, not zero
    Given the pinned commit's manifest answers 503
    When the page script runs
    Then it says "unknown, not zero"
