# Specifies the merge request of schemas/sdlc/merge-queue.ts: the six-line
# request a sibling sends the merge manager, its formatter, its parser and
# the schema each line is checked against.
Feature: A merge request is six checked lines

  Background:
    Given a complete request: a PR URL, a full 40-character head SHA, a session URL, two sentences of changes, a URL preview with what to look for, and the full tier green

  @test:schemas/sdlc/merge-request.test.ts::merge_request::a_complete_request_round-trips_through_its_six_lines
  Scenario: A complete request round-trips through its six lines
    When it is formatted
    Then the text has six lines
    And parsing the text succeeds and gives back the request unchanged

  @test:schemas/sdlc/merge-request.test.ts::merge_request::no_preview_is_accepted_only_with_a_reason
  Scenario: No preview is accepted only with a reason
    When the preview is "none" with a reason and there is nothing to look for
    Then the formatted request parses
    And with the reason after "no preview: " emptied it does not parse

  @test:schemas/sdlc/merge-request.test.ts::merge_request::a_request_with_neither_a_preview_nor_a_reason_goes_back
  Scenario: A request with neither a preview nor a reason goes back
    When the "preview:" line is removed from the formatted request
    Then parsing fails
    And the issues mention "preview"

  @test:schemas/sdlc/merge-request.test.ts::merge_request::a_preview_with_nothing_to_look_for_is_refused
  Scenario: A preview with nothing to look for is refused
    When the request keeps its URL preview but has no lookFor
    Then the schema refuses it

  @test:schemas/sdlc/merge-request.test.ts::merge_request::a_short_SHA,_a_non-PR_URL_or_a_non-session_URL_is_refused
  Scenario: A short SHA, a non-PR URL or a non-session URL is refused
    When the head SHA is cut to seven characters
    Then the schema refuses it
    And a PR URL that names only the repository is refused
    And a session URL of "https://claude.ai/chat/abc" is refused

  @test:schemas/sdlc/merge-request.test.ts::merge_request::more_than_three_sentences_of_changes_is_refused
  Scenario: More than three sentences of changes is refused
    When the changes are "One. Two. Three. Four."
    Then the schema refuses it

  @test:schemas/sdlc/merge-request.test.ts::merge_request::without_the_green_line_the_request_is_not_ready
  Scenario: Without the green line the request is not ready
    When "full tier green as judged" is removed from the formatted request
    Then parsing fails
