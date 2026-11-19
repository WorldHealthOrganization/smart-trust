# Specifies readerTextProblems, readLandingStickies and declaredContributions
# (scripts/ensure-landing-sticky.ts) over the checkout's live board.
Feature: A harness sticky on the live board opens with its declaration's summary

  @test:test/coordinator/ensure-landing-sticky-checkout.test.ts::a_harness_sticky_shows_the_landing's_text,_not_the_author's_(ob3m_3)::the_live_board:_every_harness_card_opens_with_its_declaration's_summary
  Scenario: Every harness card with a summary opens with it
    Given the live board of the instance that holds the harness
    When the reader-text problems are read
    Then there are none
    And for every declared contribution with a body source and a summary, its card exists and its comment starts with the summary
    And the comment names every file the contribution also writes, in backticks
    And where the description differs from the summary, the comment does not contain the description
    And at least one card was judged, one of them a cat-harness card
