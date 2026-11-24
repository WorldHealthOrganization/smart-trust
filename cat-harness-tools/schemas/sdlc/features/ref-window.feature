# Specifies schemas/sdlc/ref-window.ts: a ref window is a lease on a declared
# published ref, so it must expire and say who takes it over; it stores
# decisions, never the host's facts (bean xp5j).
Feature: A ref window is an expiring lease on a declared ref

  @test:schemas/sdlc/ref-window.test.ts::a_window_is_a_lease,_so_it_must_expire::a_well-formed_open_window_parses
  Scenario: A well-formed open window parses
    Given an open window on "gh-pages" with a holder, since, expires, handoff and one write request
    When it is parsed with the ref window schema
    Then it parses

  @test:schemas/sdlc/ref-window.test.ts::a_window_is_a_lease,_so_it_must_expire::`expires`_is_REQUIRED_—_without_it,_abandoned_and_open_are_the_same
  Scenario: A window without expires is refused
    Given the open window without its expires field
    When it is parsed
    Then it is refused

  @test:schemas/sdlc/ref-window.test.ts::a_window_is_a_lease,_so_it_must_expire::`handoff`_is_REQUIRED_—_it_is_the_whole_handover_answer
  Scenario: A window without handoff is refused
    Given the open window without its handoff field
    When it is parsed
    Then it is refused

  @test:schemas/sdlc/ref-window.test.ts::a_window_is_a_lease,_so_it_must_expire::a_window_cannot_expire_before_it_opens
  Scenario: A window cannot expire before it opens
    Given the open window with expires one minute before since
    When it is parsed
    Then it is refused with the message "must expire after it opens"

  @test:schemas/sdlc/ref-window.test.ts::a_window_is_a_lease,_so_it_must_expire::a_window_cannot_close_before_it_opened
  Scenario: A window cannot close before it opened
    Given the open window with closedAt an hour before since
    When it is parsed
    Then it is refused with the message "cannot close before it opened"

  @test:schemas/sdlc/ref-window.test.ts::a_window_is_a_lease,_so_it_must_expire::there_is_NO_extend:_a_window_that_extends_on_every_arrival_never_closes
  Scenario: A window has no field to extend it
    Given the open window with an added extend, extendedAt, extendTo or deadline field
    When each is parsed
    Then each is refused

  @test:schemas/sdlc/ref-window.test.ts::decisions_are_stored;_the_host's_facts_are_not::every_forbidden_key_is_refused_BY_NAME,_with_the_rule_as_the_message
  Scenario: Every forbidden host-fact key is refused by name
    Given the non-empty list of forbidden ref fact keys
    When the open window is parsed with each key added
    Then each is refused
    And the error names the key and says the window "stores DECISIONS only"

  @test:schemas/sdlc/ref-window.test.ts::decisions_are_stored;_the_host's_facts_are_not::the_published-ref_specific_ones_are_present,_which_is_what_xom7_is_about
  Scenario: The published-ref facts are among the forbidden keys
    Given the forbidden ref fact keys
    Then they include deploymentState, conclusion, live and siteAsOf

  @test:schemas/sdlc/ref-window.test.ts::a_watched_ref_is_a_declared_one::a_feature_branch_is_refused_—_it_has_one_writer_and_needs_no_steward
  Scenario: A feature branch is not a watched ref
    Given the open window on the ref "claude/xp5j-ref-steward"
    When it is parsed
    Then it is refused

  @test:schemas/sdlc/ref-window.test.ts::a_watched_ref_is_a_declared_one::a_full_refname_is_refused;_the_declaration_spells_an_id_or_a_name
  Scenario: A full refname is refused
    Given the open window on the ref "refs/heads/gh-pages"
    When it is parsed
    Then it is refused

  @test:schemas/sdlc/ref-window.test.ts::a_watched_ref_is_a_declared_one::both_spellings_the_declaration_carries_are_accepted
  Scenario: A declared ref's id and name are both accepted
    Given the open window on each of "gh-pages", "cat/cat-harness/beans" and "beans"
    When each is parsed
    Then each parses

  @test:schemas/sdlc/ref-window.test.ts::a_write_request_names_a_route_and_an_author,_never_content::`authored`_defaults_to_false,_because_a_route-keyed_store_is_regenerable
  Scenario: A write request is not authored by default
    Given a write request with a route, requester and time but no authored flag
    When it is parsed
    Then authored is false

  @test:schemas/sdlc/ref-window.test.ts::a_write_request_names_a_route_and_an_author,_never_content::it_carries_no_content_field_—_the_tree_is_the_answer_to_what_was_written
  Scenario: A write request carries no content
    Given a write request with an added content, body, tree, files or blob field
    When each is parsed
    Then each is refused

  @test:schemas/sdlc/ref-window.test.ts::a_write_request_names_a_route_and_an_author,_never_content::two_same-route_AUTHORED_requests_are_representable,_so_they_can_be_REPORTED
  Scenario: Two authored requests for one route can be represented
    Given the open window with two authored requests for the route "/" by different requesters
    When it is parsed
    Then it parses
    And both authored requests for "/" are present

  @test:schemas/sdlc/ref-window.test.ts::the_lease_fields_stay_spelled_the_same_as_the_hold's::both_samples_are_valid_to_begin_with,_or_every_assertion_below_is_vacuous
  Scenario: The sample hold and the sample window are both valid
    Given a merge-queue hold sample and the open window
    When each is parsed with its own schema
    Then both parse

  @test:schemas/sdlc/ref-window.test.ts::the_lease_fields_stay_spelled_the_same_as_the_hold's::both_refuse_a_window/hold_missing_`%s`
  Scenario: Hold and window both require every shared lease field
    Given each shared lease field in turn
    When it is removed from the hold sample and from the open window
    Then the hold schema refuses the hold
    And the ref window schema refuses the window

  @test:schemas/sdlc/ref-window.test.ts::the_lease_fields_stay_spelled_the_same_as_the_hold's::`waitsOn`_is_deliberately_NOT_shared_—_it_is_narrowed_to_`ref`
  Scenario: waitsOn is not a shared lease field
    Given the shared lease fields
    Then they do not include waitsOn
    And a hold without waitsOn is refused
    And a window with a waitsOn field is refused
