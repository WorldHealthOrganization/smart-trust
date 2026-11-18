# The high-water mark for issue comments an agent has read: no mark means
# everything is unseen, and an edited comment is unseen again.
# Each Scenario names the test that executes it.
Feature: Seen issue comments

  @test:scripts/tests/seen-comments.test.ts::seen-comments::with_NO_stored_mark,_everything_is_unseen
  Scenario: With no mark everything is unseen
    Given three comments and no stored mark
    Then all three are unseen

  @test:scripts/tests/seen-comments.test.ts::seen-comments::ids_above_the_mark_are_unseen,_at_or_below_are_not
  Scenario: Only ids above the mark are unseen
    Given the mark advanced over comments 10 and 20
    Then the mark is 20
    And of 10, 20 and 21 only 21 is unseen

  @test:scripts/tests/seen-comments.test.ts::seen-comments::a_comment_EDITED_after_the_mark_is_unseen_again,_despite_its_id
  Scenario: An edited comment is unseen again
    Given the mark advanced over comment 10 updated at 10:00
    Then comment 10 updated at 12:00 is unseen
    And comment 10 still at 10:00 is seen

  @test:scripts/tests/seen-comments.test.ts::seen-comments::the_mark_never_moves_backwards
  Scenario: The mark never moves backwards
    Given the mark advanced over comment 50
    When it is advanced over comments 10 and 20
    Then the mark is still 50

  @test:scripts/tests/seen-comments.test.ts::seen-comments::round-trips_through_disk
  Scenario: The mark round-trips through disk
    When a mark of 99 with note "branch x" is saved for o/r#203 and loaded
    Then it reads back 99 with that note
    And it lives at issue-marks/o-r-203.json

  @test:scripts/tests/seen-comments.test.ts::seen-comments::a_CORRUPT_mark_reads_as_absent,_not_as_everything-seen
  Scenario: A corrupt mark reads as absent
    Given a mark file that is not valid JSON
    Then loading it gives nothing
    And a comment checked against it is unseen
