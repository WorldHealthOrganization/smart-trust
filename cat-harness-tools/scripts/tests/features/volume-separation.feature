# Volume separation: volume-separation.py (cat-harness-tools#132), run against
# page-granularity entries and votes the test builds. Each Scenario names the
# test that executes it.
Feature: Volume separation

  Background:
    Given a page-granularity volume entry of 10 pages, each with its own text

  @test:scripts/tests/volume-separation.test.ts::volume-separation::the_queue_holds_every_page's_text
  Scenario: The queue holds every page's text
    Given a volume of 3 pages
    When the queue is written to "build/q.json"
    Then it exits 0, the queue is "separation-queue/v1" with pages 1, 2, 3, and page 1's text holds "Text of page 1"

  @test:scripts/tests/volume-separation.test.ts::volume-separation::spans_the_majority_agrees_on_are_proposed;_the_rest_are_undetermined
  Scenario: Majority-agreed spans are proposed
    Given three voters agreeing on 1–4 and on start 5, two of them on end 10, with titles differing in case and space, and one extra span at 9
    When a proposal is made
    Then it is "proposed" with spans 1–4 "On cusps" and 5–10 "Volumes"
    And the second span's votes are start 3, end 2, title 3 of 3
    And the span starting at 9 is undetermined

  @test:scripts/tests/volume-separation.test.ts::volume-separation::an_end_page_with_no_majority_is_undetermined,_never_cut
  Scenario: No majority on the end page is undetermined
    Given three voters starting at 1 and ending at 3, 4 and 5
    Then no span is proposed and the undetermined entry says "no end page" with 3 answers

  @test:scripts/tests/volume-separation.test.ts::volume-separation::an_agreed_span_that_runs_into_the_next_agreed_start_is_undetermined
  Scenario: A span running into the next start is undetermined
    Given three voters agreeing on 1–6 and 5–10
    Then only the span starting at 5 is proposed and the other is undetermined, saying "runs into"

  @test:scripts/tests/volume-separation.test.ts::volume-separation::fewer_than_three_voters,_a_voter_with_no_model,_or_a_span_off_the_volume_is_refused
  Scenario: Bad votes are refused
    Then two voters are refused with "at least three"
    And a voter with no model is refused mentioning "model"
    And a span ending at page 11 is refused with "<= 10"

  @test:scripts/tests/volume-separation.test.ts::volume-separation::propose_writes_the_proposal_beside_the_volume,_and_score_compares_it_with_a_hand_cut
  Scenario: The proposal is written and scored against a hand cut
    Given three voters agreeing on 1–4 and 5–10
    When the proposal is made without --stdout
    Then "separation-proposal.json" is written in the entry
    When it is scored against a truth of 1–4, 5–7 and 8–10
    Then 1 span is exact and starts and ends have precision 1 and recall 0.667

  @test:scripts/tests/volume-separation.test.ts::volume-separation::a_non-page_entry_is_refused
  Scenario: A non-page entry is refused
    Given the entry's granularity is "section"
    Then queueing it is refused with "not 'page'"

  @test:scripts/tests/volume-separation.test.ts::volume-separation::GDZ_Invent._Math._106_(PPN356556735_0106)_acceptance_run:_majority_vote_proposes_all_26_articles_and_matches_the_4-article_hand_cut
  Scenario: The GDZ Invent. Math. 106 acceptance run
    Given a 673-page volume "PPN356556735_0106" and the fixture votes
    When a proposal is made
    Then it equals the fixture proposal, with 26 spans and 9 undetermined
    And against the 26 content-page truth all 26 spans are exact with precision and recall 1
    And against the 4-article hand cut 4 are exact with precision 0.154 and recall 1
    And against the 26-entry GDZ outline 15 are exact, starts 1/1 and ends 0.577/0.577
