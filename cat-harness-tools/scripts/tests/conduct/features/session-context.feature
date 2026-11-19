# schemas/sdlc/session-context.ts: the session-context record (who the actor is, what is open,
# claimed and waited on) and the session-state kind it is filed under.
# Each Scenario names the test that executes it.
Feature: The session-context record

  @test:scripts/tests/conduct/session-context.test.ts::session_context::an_IDLE_session_parses_—_empty_`open`_is_the_normal_state
  Scenario: An idle session parses, with an empty open list
    Given an idle session record with an actor, start and update times, and empty open and claimed lists
    When it is parsed
    Then its open list is empty

  @test:scripts/tests/conduct/session-context.test.ts::session_context::`actor`_is_required_—_the_one_field_nothing_else_can_supply
  Scenario: The actor is required
    Given an idle session record with its actor removed
    When it is parsed with the session-context schema
    Then it is refused

  @test:scripts/tests/conduct/session-context.test.ts::session_context::an_undeclared_actor_is_representable,_and_says_so
  Scenario: An undeclared actor is representable and says so
    Given an idle session record whose actor is "some-agent" with declared false
    When it is parsed
    Then its actor is "some-agent" with declared false

  @test:scripts/tests/conduct/session-context.test.ts::session_context::`declared`_cannot_be_omitted_—_absent_is_not_`false`
  Scenario: An actor's declared flag cannot be omitted
    Given an idle session record whose actor is "x" with no declared flag
    When it is parsed with the session-context schema
    Then it is refused

  @test:scripts/tests/conduct/session-context.test.ts::session_context::`waitingOn`_carries_`since`_or_does_not_exist
  Scenario: waitingOn carries a since time or does not exist
    Given an idle session record
    When it is waiting on "a review" with no since time
    Then it is refused
    And waiting on "a review" since "2026-09-20T06:10:00Z" parses

  @test:scripts/tests/conduct/session-context.test.ts::session_context::the_`$schema`_tag_is_what_identifies_the_file,_not_its_path
  Scenario: The $schema tag identifies the file, not its path
    Given an idle session record stamped "folio-workflow-instance/v1"
    When it is parsed with the session-context schema
    Then it is refused

  @test:scripts/tests/conduct/session-context.test.ts::session_context::`session-state`_is_a_registered_kind,_writable,_and_its_reader_names_it
  Scenario: session-state is a registered, writable state kind that its reader skill names
    When the default graph typologies are read
    Then "session-state" is registered
    And its graph layer is "state"
    And a process may write it
    And the front matter of skills/process/workflow/session-context.md lists "session-state" under graph-typologies

  @test:scripts/tests/conduct/session-context.test.ts::session_context::a_session_is_NOT_a_process_instance_—_two_kinds,_both_state
  Scenario: A session is not a process instance: two distinct kinds
    # Gap: only that both kinds are registered with different IRIs is checked; that workflow-state is also a state kind is not
    When the default graph typologies are read
    Then both "session-state" and "workflow-state" are registered
    And their typology IRIs differ
