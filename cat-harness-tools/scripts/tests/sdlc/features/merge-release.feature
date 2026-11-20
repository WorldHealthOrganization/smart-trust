# A person's merge release on a queue entry: what schemas/sdlc/merge-queue.ts refuses,
# when releaseCovers says it covers a head, and how scripts/merge-queue-cli.ts builds it.
# Each Scenario names the test that executes it.
Feature: A person's merge release on a queue entry

  @test:scripts/tests/sdlc/merge-release.test.ts::the_release_record_refuses_what_would_make_it_unreliable::a_valid_release_parses_on_an_entry
  Scenario: A valid release parses on an entry
    Given a queue entry carrying a "merge" release decided by "litlfred" at a full sha
    When the entry is parsed
    Then it parses

  @test:scripts/tests/sdlc/merge-release.test.ts::the_release_record_refuses_what_would_make_it_unreliable::the_person_who_decided_cannot_be_the_session_that_wrote_it_down
  Scenario: A release decided by the capturing session is refused
    Given a release whose decidedBy is the session that captured it
    When the entry is parsed
    Then it does not parse

  @test:scripts/tests/sdlc/merge-release.test.ts::the_release_record_refuses_what_would_make_it_unreliable::a_standing_ruling_needs_the_date_it_was_ruled
  Scenario: A standing ruling needs its ruling date
    Given a release on a standing ruling with no ruledAt
    Then the entry does not parse
    And the same release with ruledAt "2026-10-01" parses

  @test:scripts/tests/sdlc/merge-release.test.ts::the_release_record_refuses_what_would_make_it_unreliable::releasedSha_is_a_full_object_name,_and_the_live-fact_rule_still_refuses_headSha
  Scenario: The released sha must be full and headSha is still refused
    Given a release whose releasedSha is "abc123"
    Then the entry does not parse
    And an entry with a valid release and a headSha does not parse

  @test:scripts/tests/sdlc/merge-release.test.ts::the_release_record_refuses_what_would_make_it_unreliable::there_is_no_`hold`_verdict_—_a_hold_is_the_structured_`hold`_field
  Scenario: There is no hold verdict
    Given a release with verdict "hold"
    When the entry is parsed
    Then it does not parse

  @test:scripts/tests/sdlc/merge-release.test.ts::releaseCovers_—_what_merge:guard_asks_before_landing::no_release_is_not_a_yes
  Scenario: No release does not cover a head
    Given a parsed entry with no release
    When release coverage is asked at a head
    Then it is not ok, with reason "none"

  @test:scripts/tests/sdlc/merge-release.test.ts::releaseCovers_—_what_merge:guard_asks_before_landing::a_release_at_this_head_covers_it
  Scenario: A release at this head covers it
    Given a parsed entry released at sha "aaaa…"
    When release coverage is asked at that sha
    Then it is ok

  @test:scripts/tests/sdlc/merge-release.test.ts::releaseCovers_—_what_merge:guard_asks_before_landing::a_push_after_the_decision_voids_it,_and_both_commits_are_named
  Scenario: A push after the release voids it and names both commits
    Given a parsed entry released at sha "aaaa…"
    When release coverage is asked at sha "bbbb…"
    Then it is not ok, with reason "void"
    And the detail names both "aaaaaaaaaaaa" and "bbbbbbbbbbbb"

  @test:scripts/tests/sdlc/merge-release.test.ts::releaseCovers_—_what_merge:guard_asks_before_landing::do-not-merge_never_covers,_even_at_the_released_head
  Scenario: Do-not-merge never covers, even at the released head
    Given a parsed entry with a "do-not-merge" release at sha "aaaa…"
    When release coverage is asked at that sha
    Then it is not ok, with reason "do-not-merge"

  @test:scripts/tests/sdlc/merge-release.test.ts::releaseCovers_—_what_merge:guard_asks_before_landing::the_steward_prints_each_state_apart
  Scenario: The steward prints each release state apart
    Then an entry with no release prints "none"
    And a release at the head prints starting "merge@aaaaaaaaaaaa"
    And a release at another head prints starting "VOID"

  @test:scripts/tests/sdlc/merge-release.test.ts::decisionFrom_—_the_PR's_agent_captures_the_person's_words::on_an_existing_entry:_placement_untouched,_release_set,_beans_merged_without_duplicates
  Scenario: Capturing on an existing entry keeps its placement and merges beans
    Given an existing entry with bean "folio-assistant-zmdo"
    When a merge decision by "litlfred" is captured with beans "folio-assistant-zmdo,folio-assistant-3p7c"
    Then the result is an entry that parses
    And its placement and decidedBy are the existing entry's
    And its release is decided by "litlfred" with the explicit quote and source
    And its beans are folio-assistant-zmdo and folio-assistant-3p7c, without duplicates

  @test:scripts/tests/sdlc/merge-release.test.ts::decisionFrom_—_the_PR's_agent_captures_the_person's_words::a_session_as_the_decider_is_refused,_with_the_field_that_belongs_to_it_named
  Scenario: A session as the decider is refused and the captured-by field named
    Given a capture where --by is the session URL
    When the decision is built on an existing entry
    Then it is refused with a usage that names "--captured-by"

  @test:scripts/tests/sdlc/merge-release.test.ts::decisionFrom_—_the_PR's_agent_captures_the_person's_words::a_new_entry_without_a_placement_is_refused_rather_than_placed_by_guess
  Scenario: A new entry without placement flags is refused
    Given a capture with no placement flags and no existing entry
    When the decision is built
    Then it is refused with a usage that names "merge:queue:record"

  @test:scripts/tests/sdlc/merge-release.test.ts::decisionFrom_—_the_PR's_agent_captures_the_person's_words::a_new_entry_with_placement_flags:_the_placement_is_the_capturer's,_the_release_the_person's
  Scenario: A new entry with placement flags is placed by the capturer and released by the person
    Given a capture with class, rank, rule, reason and repository flags and no existing entry
    When the decision is built
    Then the entry parses with decidedBy the capturing session
    And its release is decided by "litlfred"

  @test:scripts/tests/sdlc/merge-release.test.ts::decisionFrom_—_the_PR's_agent_captures_the_person's_words::a_standing_ruling_without_its_date_is_refused_before_it_reaches_the_schema
  Scenario: A standing ruling without its date is refused at capture
    Given a capture with --standing-ruling and no --ruled-at
    When the decision is built on an existing entry
    Then it is refused with a usage that names "--ruled-at"
