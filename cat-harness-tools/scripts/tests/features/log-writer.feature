# The activity-log producer and its rich reference schema (owner,
# 2026-09-19; folio-assistant-7uff). Each Scenario names the test that executes it.
Feature: Writing the activity log

  @test:scripts/tests/log-writer.test.ts::the_log_directory_is_composed_from_the_declaration,_not_spelled::it_follows_the_declared_fsh-guts_path_wherever_that_is
  Scenario: The log directory follows the declared fsh-guts path
    Given an instance declaring an fsh-guts directory
    Then its log directory is fsh-guts/logs inside its own root

  @test:scripts/tests/log-writer.test.ts::the_log_directory_is_composed_from_the_declaration,_not_spelled::an_instance_that_declares_no_trashcan_has_nowhere_to_log
  Scenario: An instance that declares no trashcan has nowhere to log
    Given an instance declaring no fsh-guts directory
    Then it has no log directory

  @test:scripts/tests/log-writer.test.ts::the_log_directory_is_composed_from_the_declaration,_not_spelled::and_that_is_reported,_not_swallowed
  Scenario: Having nowhere to log is reported
    When an entry is written to an instance with no fsh-guts directory
    Then nothing is written, the reason names the missing fsh-guts directory, and the one-liner says nothing was written

  @test:scripts/tests/log-writer.test.ts::writing_an_entry::a_task-start_lands_on_disk_and_validates
  Scenario: A task-start lands on disk and validates
    When a task-start entry is written
    Then one entry is on disk, it parses as a log entry, and its event is task-start

  @test:scripts/tests/log-writer.test.ts::writing_an_entry::the_filename_sorts_chronologically_without_opening_anything
  Scenario: The filename sorts chronologically
    When a late entry and then an early entry of one day are written
    Then sorted by name, the early one comes first

  @test:scripts/tests/log-writer.test.ts::writing_an_entry::two_entries_in_the_same_millisecond_do_not_collide
  Scenario: Two entries in the same millisecond do not collide
    When two entries are written at the same instant
    Then both are on disk

  @test:scripts/tests/log-writer.test.ts::writing_an_entry::a_malformed_draft_is_reported,_never_thrown
  Scenario: A malformed draft is reported, never thrown
    When an entry with an empty summary is written
    Then nothing is written, the reason names folio-log/v1, and no entry is on disk

  @test:scripts/tests/log-writer.test.ts::capture_is_resolved_and_REPORTED_on_every_write::declared_%p_→_capture_%p,_eligible_%p
  Scenario Outline: The declared capture resolves to a capture and store eligibility
    When an entry is written with capture declared as <declared>
    Then the capture is <capture> and it is <eligible> that it is eligible for the store

    Examples:
      | declared  | capture | eligible |
      | on        | on      | true     |
      | off       | off     | false    |
      | undefined | unknown | false    |
      | maybe     | unknown | false    |

  @test:scripts/tests/log-writer.test.ts::capture_is_resolved_and_REPORTED_on_every_write::an_entry_is_written_even_when_it_will_never_reach_the_store
  Scenario: An entry is written even when it will never reach the store
    When an entry is written with capture off
    Then it is written and on disk

  @test:scripts/tests/log-writer.test.ts::capture_is_resolved_and_REPORTED_on_every_write::the_one-liner_distinguishes_all_three_states_in_words
  Scenario: The one-liner distinguishes all three capture states in words
    Then capture on is described as kept in the data store, off as local only, and undeclared as undetermined
    And the undeclared description differs from the off one

  @test:scripts/tests/log-writer.test.ts::references_—_the_rich_half::the_known_kinds_cover_what_the_owner_named
  Scenario: The known reference kinds cover what the owner named
    Then the known kinds include discussion and command

  @test:scripts/tests/log-writer.test.ts::references_—_the_rich_half::a_reference_needs_somewhere_to_point
  Scenario: A reference needs somewhere to point
    Then a reference with a kind and no ref is refused
    And one with a kind and a ref is accepted

  @test:scripts/tests/log-writer.test.ts::references_—_the_rich_half::an_entry_carries_several_references_of_one_kind
  Scenario: An entry carries several references of one kind
    When an entry with two comment references and a discussion reference is written
    Then it is written with three references

  @test:scripts/tests/log-writer.test.ts::references_—_the_rich_half::an_UNKNOWN_kind_is_accepted_and_flagged,_not_refused
  Scenario: An unknown reference kind is accepted and flagged
    When an entry with a reference of kind case is written
    Then it is written, case is listed as an unknown kind, and the one-liner names it

  @test:scripts/tests/log-writer.test.ts::references_—_the_rich_half::a_known_kind_raises_no_flag
  Scenario: A known reference kind raises no flag
    When an entry with a commit reference is written
    Then no unknown kinds are listed and the one-liner says nothing of a typo

  @test:scripts/tests/log-writer.test.ts::command_execution::exit_code_and_duration_are_queryable_fields,_not_prose
  Scenario: Exit code and duration are queryable fields
    When an entry with an execution of exit code 1 and 38400 ms is written
    Then the stored execution has exitCode 1 and durationMs 38400

  @test:scripts/tests/log-writer.test.ts::command_execution::a_command_that_did_not_finish_has_NO_exit_code,_which_is_not_zero
  Scenario: A command that did not finish has no exit code
    When an execution with only a command is parsed
    Then it has no exit code

  @test:scripts/tests/log-writer.test.ts::command_execution::there_is_no_field_to_inline_command_output_into
  Scenario: There is no field to inline command output into
    When an execution with an outputRef is parsed, it has no output key
    And an execution given an output field parses without it
