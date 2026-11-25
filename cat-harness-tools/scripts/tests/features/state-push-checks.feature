# state:push judges the text it splices: a push that introduces a dangling
# link or a retired word is refused for that graph, a finding already at the
# tip does not block, and a stated bypass pushes and is logged.
# Each Scenario names the test that executes it.
Feature: Text checks on state pushes

  Background:
    Given a mounted todos graph whose a.md links b.md and the missing gone.md and says "The bean was filed"

  @test:scripts/tests/state-push-checks.test.ts::the_dangling-link_rule_is_check-subgraphs'_own::a_link_to_nothing_is_dangling;_a_link_that_resolves,_a_URL_and_code_are_not
  Scenario: Only an unresolved link is dangling
    When text linking b.md, nope.md, a URL and a link inside code is checked in todos/a.md
    Then the only dangling link is nope.md

  @test:scripts/tests/state-push-checks.test.ts::the_dangling-link_rule_is_check-subgraphs'_own::a_file_no_declared_directory_owns_is_not_judged
  Scenario: A file outside any declared directory is not judged
    When a link in elsewhere/x.md is checked
    Then the answer is undefined

  @test:scripts/tests/state-push-checks.test.ts::only_what_this_push_introduces_is_a_finding::a_new_dangling_link_is_refused,_nothing_is_sent,_and_the_edit_is_kept
  Scenario: A new dangling link is refused
    Given a.md gains a link to ../skills/sdlc/x.md
    When state is pushed with checks
    Then the run fails with todos refused, naming the new link but not gone.md
    And the report names CAT_GATES_BYPASS
    And the branch tip is unchanged and the edit is still on disk

  @test:scripts/tests/state-push-checks.test.ts::only_what_this_push_introduces_is_a_finding::a_finding_already_at_the_tip_does_not_block_an_edit_to_the_same_file
  Scenario: A finding already at the tip does not block
    Given a.md is edited but keeps its existing gone.md link and retired word
    When state is pushed with checks
    Then it is pushed and the branch holds the edit

  @test:scripts/tests/state-push-checks.test.ts::only_what_this_push_introduces_is_a_finding::a_new_use_of_a_retired_word_is_refused;_the_old_one_is_not_counted
  Scenario: A new use of a retired word is refused
    Given a.md gains a second use of "bean"
    When state is pushed with checks
    Then todos is refused with a reason naming "bean" and "work item"

  @test:scripts/tests/state-push-checks.test.ts::only_what_this_push_introduces_is_a_finding::a_name_in_code_is_not_a_retired_word
  Scenario: A retired word in code is not a finding
    Given a.md gains `beans create` in inline code
    When state is pushed with checks
    Then it is pushed

  @test:scripts/tests/state-push-checks.test.ts::only_what_this_push_introduces_is_a_finding::a_file_this_push_creates_is_judged_whole
  Scenario: A new file is judged whole
    Given a new todos/new.md with a dangling link
    When state is pushed with checks
    Then todos is refused naming todos/new.md

  @test:scripts/tests/state-push-checks.test.ts::only_what_this_push_introduces_is_a_finding::a_dry_run_reports_the_refusal_and_sends_nothing
  Scenario: A dry run reports the refusal
    Given a new file with a dangling link
    When a dry run push is made with checks
    Then todos is refused and the tip is unchanged

  @test:scripts/tests/state-push-checks.test.ts::only_what_this_push_introduces_is_a_finding::a_library_caller_that_passes_no_checks_runs_none
  Scenario: A caller passing no checks runs none
    Given a new file with a dangling link
    When state is pushed without checks
    Then it is pushed

  @test:scripts/tests/state-push-checks.test.ts::a_bypass_says_why,_and_is_logged::a_stated_reason_pushes_the_finding_and_logs_it_with_the_reason
  Scenario: A stated bypass pushes and is logged
    Given a new file with a dangling link
    When state is pushed with the bypass reason "target lands in the next PR"
    Then it is pushed and the branch holds the file
    And the graph lists todos/new.md as bypassed and the report says "bypass"
    And the push log's last entry is a state-push bypass of todos with that reason

  @test:scripts/tests/state-push-checks.test.ts::a_bypass_says_why,_and_is_logged::an_empty_reason_is_no_bypass
  Scenario: A blank bypass reason does not bypass
    When state is pushed with a blank bypass reason
    Then todos is refused

  @test:scripts/tests/state-push-checks.test.ts::a_tip_it_cannot_read_is_not_compared,_and_not_called_new::an_unreadable_baseline_is_listed,_not_refused
  Scenario: An unreadable baseline is listed as not compared
    When findings are computed for a file whose tip text is unknown
    Then there are no findings and the file is listed as not compared

  @test:scripts/tests/state-push-checks.test.ts::a_tip_it_cannot_read_is_not_compared,_and_not_called_new::a_file_no_declared_directory_owns_is_said,_not_read_as_clean
  Scenario: A file no directory owns is reported as not judged
    When findings are computed with a dangling check that cannot judge x/a.md
    Then x/a.md is listed as not judged
    And the report says "no declared directory owns x/a.md"
