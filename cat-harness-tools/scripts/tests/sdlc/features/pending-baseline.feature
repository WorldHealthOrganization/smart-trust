# scripts/gates.ts lets a new check wait on main's baseline under a pending-baseline exemption,
# only while CI runs its writer, and reports where each wait stands. Each Scenario names the test that executes it.
Feature: Pending-baseline gate exemptions

  @test:scripts/tests/sdlc/pending-baseline.test.ts::unrunFrom_and_a_pending-baseline_exemption::covers_the_check_while_CI_runs_its_writer
  Scenario: A pending-baseline exemption covers the check while CI runs its writer
    Given a pending-baseline exemption for translation:page-qa:check with writer translation:page-qa
    When CI runs check:a and translation:page-qa
    Then no check is unrun

  @test:scripts/tests/sdlc/pending-baseline.test.ts::unrunFrom_and_a_pending-baseline_exemption::does_not_cover_it_when_the_writer_is_not_run:_no_silent_skip
  Scenario: A pending-baseline exemption does not cover the check when its writer is not run
    Given the pending-baseline exemption for translation:page-qa:check
    When CI runs only check:a
    Then translation:page-qa:check is unrun

  @test:scripts/tests/sdlc/pending-baseline.test.ts::unrunFrom_and_a_pending-baseline_exemption::the_writer's_name_must_match_at_a_token_boundary,_not_as_a_prefix_of_the_check
  Scenario: The writer's name must match at a token boundary, not as a prefix
    Given the pending-baseline exemption with writer translation:page-qa
    When CI runs check:a and translation:page-qa:x
    Then translation:page-qa:check is unrun

  @test:scripts/tests/sdlc/pending-baseline.test.ts::unrunFrom_and_a_pending-baseline_exemption::a_writer_run_INDIRECTLY,_as_a_QA_WRITERS_entry_of_a_qa:refresh_CI_runs,_counts
  Scenario: A writer run indirectly as a QA writer of qa:refresh counts
    Given the pending-baseline exemption with writer translation:page-qa
    When CI runs only check:a and translation:page-qa is among the writers run indirectly
    Then no check is unrun

  @test:scripts/tests/sdlc/pending-baseline.test.ts::unrunFrom_and_a_pending-baseline_exemption::other_kinds_are_unchanged:_an_exemption_covers_without_conditions
  Scenario: Other exemption kinds cover the check without conditions
    Given a report exemption for translation:page-qa:check
    When CI runs only check:a
    Then no check is unrun
    And with no exemption translation:page-qa:check is unrun

  @test:scripts/tests/sdlc/pending-baseline.test.ts::pendingBaselinesFrom_reports_where_each_wait_stands::writer_wired,_check_not_yet
  Scenario: A wait whose writer is wired and check is not is reported as such
    Given the pending-baseline exemption
    When CI runs translation:page-qa
    Then the one row names the check, writer and follow-up, with the writer run and the check not run

  @test:scripts/tests/sdlc/pending-baseline.test.ts::pendingBaselinesFrom_reports_where_each_wait_stands::check_wired:_reported_as_done,_so_the_exemption_can_go
  Scenario: A wait whose check is wired is reported as done
    Given the pending-baseline exemption
    When CI runs translation:page-qa and translation:page-qa:check
    Then the row reports the check as run

  @test:scripts/tests/sdlc/pending-baseline.test.ts::pendingBaselinesFrom_reports_where_each_wait_stands::only_pending-baseline_rows_are_listed
  Scenario: Only pending-baseline rows are listed
    Given only a report exemption
    When the pending baselines are listed
    Then there are none

  @test:scripts/tests/sdlc/pending-baseline.test.ts::the_declaration_schema::a_pending-baseline_entry_names_its_writer_and_its_follow-up
  Scenario: A pending-baseline declaration must name its writer and its follow-up
    Given the gate exemptions schema
    When the pending-baseline entry is parsed
    Then it is valid
    And without its writer it is invalid
    And without its follow-up it is invalid

  @test:scripts/tests/sdlc/pending-baseline.test.ts::the_declaration_schema::no_other_kind_carries_them
  Scenario: No other exemption kind carries a writer
    Given the gate exemptions schema
    When a report entry is parsed
    Then it is valid
    And a report entry with a writer is invalid

  @test:scripts/tests/sdlc/pending-baseline.test.ts::writersRunBy::is_empty_unless_CI_runs_qa:refresh_or_qa:working-copy
  Scenario: writersRunBy is empty unless CI runs qa:refresh or qa:working-copy
    # Gap: only a CI running check:a alone is checked
    Given CI runs only check:a
    When the writers run are listed
    Then there are none

  @test:scripts/tests/sdlc/pending-baseline.test.ts::writersRunBy::lists_every_QA_WRITERS_command_when_it_does,_translation:page-qa_among_them
  Scenario: writersRunBy lists every QA writer when CI runs qa:working-copy or qa:refresh
    Given CI runs qa:working-copy
    When the writers run are listed
    Then they are the first run command of every QA_WRITERS entry, translation:page-qa among them
    And CI running "qa:refresh --dir x" lists the same writers
