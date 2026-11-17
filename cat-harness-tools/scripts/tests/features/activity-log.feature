# The agent activity log (schemas/sdlc/log-entry.ts): its entry schema, its
# off-by-default capture, and that it never reaches the published KG export.
# Each Scenario names the test that executes it.
Feature: Agent activity log

  @test:scripts/tests/activity-log.test.ts::the_log_entry_schema::a_minimal_entry_parses,_and_declares_itself
  Scenario: A minimal log entry parses and declares its schema
    Given a log entry with id, time, event "task-start", summary and capture "off"
    When it is parsed with the log entry schema
    Then its $schema is "folio-log/v1"

  @test:scripts/tests/activity-log.test.ts::the_log_entry_schema::the_four_events_the_owner_named_are_the_four_that_exist
  Scenario: The log events are exactly the four the owner named
    When the list of log events is read
    Then it is "task-start", "task-end", "message" and "error"

  @test:scripts/tests/activity-log.test.ts::the_log_entry_schema::process,_role_and_task_are_optional_—_an_agent_logs_outside_any_process
  Scenario: Process, role and task are optional on a log entry
    Given a minimal log entry with no process, role or task
    Then it parses
    And an entry with role "log", process "content-lifecycle" and task "T_Commit" also parses

  @test:scripts/tests/activity-log.test.ts::the_log_entry_schema::an_entry_without_`capture`_is_refused
  Scenario: A log entry without capture is refused
    Given a minimal log entry with its capture field removed
    When it is parsed
    Then parsing throws

  @test:scripts/tests/activity-log.test.ts::the_log_entry_schema::an_unknown_event_is_refused
  Scenario: A log entry with an unknown event is refused
    Given a log entry whose event is "pondered"
    When it is parsed
    Then parsing throws

  @test:scripts/tests/activity-log.test.ts::capture_is_off_by_default_and_`unknown`_is_a_real_answer::the_three_states_exist_and_are_distinct
  Scenario: The three capture states exist and are distinct
    When the list of capture states is read
    Then it is "off", "on" and "unknown"

  @test:scripts/tests/activity-log.test.ts::capture_is_off_by_default_and_`unknown`_is_a_real_answer::%p_resolves_to_on
  Scenario: True and "on" resolve capture to on
    When capture is resolved from true and from "on"
    Then each resolves to "on"

  @test:scripts/tests/activity-log.test.ts::capture_is_off_by_default_and_`unknown`_is_a_real_answer::%p_resolves_to_off
  Scenario: False and "off" resolve capture to off
    When capture is resolved from false and from "off"
    Then each resolves to "off"

  @test:scripts/tests/activity-log.test.ts::capture_is_off_by_default_and_`unknown`_is_a_real_answer::%p_resolves_to_unknown,_NOT_off
  Scenario: Any other capture value resolves to unknown, not off
    When capture is resolved from undefined, null, "", "maybe" and 0
    Then each resolves to "unknown"
    And none resolves to "off"

  @test:scripts/tests/activity-log.test.ts::capture_is_off_by_default_and_`unknown`_is_a_real_answer::only_an_explicit_`on`_persists
  Scenario: Only an explicit on capture persists
    Then "on" persists
    And "off" does not persist
    And "unknown" does not persist

  @test:scripts/tests/activity-log.test.ts::logs_never_reach_a_published_graph::no_node_mentions_the_log_directory
  Scenario: No node of the published graph mentions the log directory
    Given the whole KG export, built once
    Then its graph holds more than 100 nodes
    And the serialised export does not contain the log directory
