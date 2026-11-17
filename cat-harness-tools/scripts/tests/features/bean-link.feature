# src/workflow/bean-link.ts keeps a process instance and its bean one record: it finds beans in
# the store and applies the claim, note, resolve and archive operations a diagram step declares.
# Each Scenario names the test that executes it.
Feature: Linking process steps to beans

  @test:scripts/tests/bean-link.test.ts::reading_the_store::a_bean_is_found_by_id,_not_by_a_filename_prefix_that_merely_starts_the_same
  Scenario: A bean is found by its id, not by a filename prefix that merely starts the same
    Given a scratch store with beans "fq0b" titled "Real bean" and "fq0bx" titled "Different bean"
    When each is looked up by id
    Then "fq0b" is "Real bean" and "fq0bx" is "Different bean"
    And the store lists 2 beans

  @test:scripts/tests/bean-link.test.ts::reading_the_store::a_missing_bean_is_undefined,_not_an_error
  Scenario: A missing bean is undefined, not an error
    Given an empty scratch store
    When bean "nope" is looked up
    Then it is undefined
    And the store lists no beans

  @test:scripts/tests/bean-link.test.ts::claim::moves_the_bean_to_in-progress_and_bumps_updated_at
  Scenario: Claim moves the bean to in-progress and bumps updated_at
    Given a todo bean "aaaa"
    When it is claimed
    Then the summary is "bean aaaa: todo → in-progress"
    And the file holds "status: in-progress"
    And its updated_at is no longer "2026-01-01T00:00:00Z"

  @test:scripts/tests/bean-link.test.ts::claim::is_idempotent_—_re-entering_the_step_does_not_churn_the_file
  Scenario: Claim is idempotent and re-entering the step does not churn the file
    Given an in-progress bean "aaaa"
    When it is claimed
    Then the summary is "bean aaaa already in-progress"
    And the file is byte-for-byte unchanged

  @test:scripts/tests/bean-link.test.ts::note::appends_to_the_body_and_leaves_the_status_alone
  Scenario: A note appends to the body and leaves the status alone
    Given an in-progress bean "bbbb"
    When the note "3 findings, 1 critical." is applied
    Then the file holds the note and the original body
    And its status is still in-progress

  @test:scripts/tests/bean-link.test.ts::resolve::does_NOT_close_the_bean_while_the_process_it_tracks_is_still_running
  Scenario: Resolve does not close the bean while the process it tracks is still running
    Given an in-progress bean "cccc"
    When it is resolved with the instance not completed
    Then the summary says "left in-progress"
    And the file still holds "status: in-progress"

  @test:scripts/tests/bean-link.test.ts::resolve::closes_it_once_the_instance_has_completed
  Scenario: Resolve closes the bean once the instance has completed
    Given an in-progress bean "cccc"
    When it is resolved with the instance completed and the note "Landed clean."
    Then the summary is "bean cccc: in-progress → completed"
    And the file holds "status: completed" and the note

  @test:scripts/tests/bean-link.test.ts::an_instance_with_no_bean::says_so_rather_than_silently_doing_nothing
  Scenario: An instance with no bean says so rather than silently doing nothing
    Given an instance with no bean
    When a claim is applied
    Then the summary says "no bean on this instance"
    And no bean is returned

  @test:scripts/tests/bean-link.test.ts::an_instance_with_no_bean::a_bean_id_that_is_not_in_the_store_is_reported,_not_invented
  Scenario: A bean id that is not in the store is reported, not invented
    Given an empty scratch store
    When bean "zzzz" is claimed
    Then the summary says "not in beans/"

  @test:scripts/tests/bean-link.test.ts::the_store_as_it_is_laid_out_now:_beans/defs/_(bean_folio-assistant-m8gz)::a_bean_in_beans/defs/_is_found,_and_so_is_one_already_in_its_archive/
  Scenario: A bean in beans/defs/ is found, and so is one already in its archive/
    Given a todo bean "dddd" in beans/defs/ and a completed bean "eeee" in beans/defs/archive/
    When each is looked up
    Then "dddd" is found at beans/defs/dddd--work.md
    And "eeee" is found at beans/defs/archive/eeee--work.md
    And claiming "dddd" gives "bean dddd: todo → in-progress"

  @test:scripts/tests/bean-link.test.ts::the_store_as_it_is_laid_out_now:_beans/defs/_(bean_folio-assistant-m8gz)::archive_moves_a_completed_bean_into_archive/,_keeping_its_status_and_recording_why
  Scenario: Archive moves a completed bean into archive/, keeping its status and recording why
    Given a completed bean "ffff" in beans/defs/
    When it is archived with the instance completed and a note saying why
    Then the summary is "bean ffff archived (completed) to archive/"
    And the original file is gone
    And the archived file holds "status: completed" and the note
    And archiving it again gives "bean ffff already archived"

  @test:scripts/tests/bean-link.test.ts::the_store_as_it_is_laid_out_now:_beans/defs/_(bean_folio-assistant-m8gz)::archive_refuses_a_bean_that_is_not_terminal,_and_notes_why_(check:bean-archive's_invariant)
  Scenario: Archive refuses a bean that is not terminal and notes why
    Given an in-progress bean "gggg" in beans/defs/
    When it is archived with the instance completed
    Then the summary says "left in place"
    And the file is still where it was
    And it notes "only a completed or scrapped bean may be archived"

  @test:scripts/tests/bean-link.test.ts::the_store_as_it_is_laid_out_now:_beans/defs/_(bean_folio-assistant-m8gz)::archive_refuses_while_the_process_it_tracks_is_still_running
  Scenario: Archive refuses while the process it tracks is still running
    Given a completed bean "hhhh" in beans/defs/
    When it is archived with the instance not completed
    Then the summary says "still running"
    And the file is still where it was

  @test:scripts/tests/bean-link.test.ts::the_diagrams_declare_which_operation_each_step_performs::an_op_this_build_does_not_implement_is_refused,_not_ignored
  Scenario: A bean op this build does not implement is refused when the diagram loads
    Given a diagram whose task declares bean op "obliterate"
    When the process model is loaded
    Then it throws UnsupportedBpmn
    And the error names "obliterate"

  @test:scripts/tests/bean-link.test.ts::a_step_drawn_against_the_Beans_store_works_the_bean_(Q-BR-8_F)::a_write_to_the_store_is_a_note;_a_read_alone_is_not;_a_named_op_still_wins
  Scenario: A write to the Beans store is a note, a read alone is not, and a named op still wins
    Given a diagram with a step writing the Beans store, one only reading it, and one writing it with op "claim"
    When the process model is loaded
    Then the writing step has op "note", works the bean and touches the work plan
    And the reading step has no op, does not work the bean and does not touch the work plan
    And the named step's op is "claim"

  @test:scripts/tests/bean-link.test.ts::a_step_drawn_against_the_Beans_store_works_the_bean_(Q-BR-8_F)::working_the_bean_claims_one_nobody_has_started,_then_notes
  Scenario: Working a bean claims one nobody has started, then notes
    Given a todo bean "wb01"
    When the note "did a step" is applied with claim-if-not-started
    Then the summary is "bean wb01: todo → in-progress, and noted"
    And the file holds "status: in-progress" and the note

  @test:scripts/tests/bean-link.test.ts::a_step_drawn_against_the_Beans_store_works_the_bean_(Q-BR-8_F)::never_claims_a_draft,_or_a_bean_already_in_progress_or_finished
  Scenario: Working a bean never claims a draft, or a bean already in progress or finished
    Given beans in status draft, in-progress, completed and scrapped
    When a note is applied to each with claim-if-not-started
    Then each summary is only "noted on bean <id>"
    And each bean keeps its status

  @test:scripts/tests/bean-link.test.ts::resolve_before_a_closing_archive_step::a_token_on_a_closing_archive_step_counts_as_finished;_one_on_earlier_work_does_not
  Scenario: A token on a closing archive step counts as finished, one on earlier work does not
    Given a diagram Work, Resolve, Archive, end
    When only archive is checked as left
    Then a token on Archive counts as only archive left
    And a token on Resolve does not
    And a completed instance with no tokens does

  @test:scripts/tests/bean-link.test.ts::resolve_before_a_closing_archive_step::an_archive_step_with_work_after_it_does_not_let_resolve_fire_early
  Scenario: An archive step with work after it does not let resolve fire early
    Given a diagram Work, Resolve, Archive, More, end
    When only archive is checked as left with a token on Archive
    Then it is not
