# blockPlacement and pointsForward (pipeline/qa-checkers-extended.ts) place a
# block in the folio's order so a proposed uses[] edge can be costed before it
# is written. Each Scenario names the test that executes it.
Feature: Block placement and forward references

  @test:scripts/tests/block-placement.test.ts::blockPlacement::a_label_nothing_could_ever_list_is_never_reported_as_ok
  Scenario: A label no folio lists is never placed
    Given the label "def:not-a-real-block-xyzzy"
    When its placement is asked for
    Then its status is "unlisted" or "unavailable"
    And its status is not "ok"

  @test:scripts/tests/block-placement.test.ts::blockPlacement::an_unanswerable_comparison_is_undefined,_not_false
  Scenario: Comparing two unplaceable labels answers undefined
    Given two labels no folio lists
    When pointsForward compares them
    Then the answer is undefined

  @test:scripts/tests/block-placement.test.ts::blockPlacement::a_real_block_resolves,_and_within_is_the_intra-chapter_index
  Scenario: A real block is placed with its index within the chapter
    # Skipped: when no folio is attached
    # Gap: if the attached folio does not list "def:crossing-energy", only an "unlisted" status is checked
    Given an attached folio and the label "def:crossing-energy"
    When its placement is asked for
    Then a placed block has a position of 0 or more
    And within equals the position modulo 1,000,000
    And it names a non-empty chapter

  @test:scripts/tests/block-placement.test.ts::blockPlacement::a_block_never_points_forward_to_itself
  Scenario: A block does not point forward to itself
    # Skipped: when no folio is attached
    # Gap: nothing is asserted when the folio does not place "def:crossing-energy"
    Given an attached folio that places "def:crossing-energy"
    When pointsForward compares that label with itself
    Then the answer is false
