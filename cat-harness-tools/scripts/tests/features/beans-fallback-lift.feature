# scripts/beans-fallback.ts closing a bean lifts the blocks it holds from every other bean, and
# its listBeans skips a generated README.md. Each Scenario names the test that executes it.
Feature: Closing a bean lifts its blocks

  @test:scripts/tests/beans-fallback-lift.test.ts::closing_a_blocker_lifts_its_blocks::completed:_its_id_leaves_every_blocked_by,_and_the_key_goes_when_empty
  Scenario: Completing a bean removes its id from every blocked_by, and the key goes when empty
    Given a scratch store where "t-b" is blocked by "t-a", "t-c" by "t-z" and "t-a", and "t-d" by "t-z"
    When "t-a" is updated to completed
    Then the lifted beans are "t-b" and "t-c"
    And "t-b" has no blocked_by and notes "Block lifted: `t-a` is completed."
    And "t-c" is still blocked by "t-z" alone, its parent line kept
    And "t-d" is unchanged

  @test:scripts/tests/beans-fallback-lift.test.ts::closing_a_blocker_lifts_its_blocks::scrapped_lifts_too,_and_the_closed_bean's_own_blocking:_is_cleared
  Scenario: Scrapping a bean lifts too, and clears the closed bean's own blocking
    Given a scratch store where "t-a" is blocking "t-b"
    When "t-a" is updated to scrapped
    Then "t-a" has status scrapped and no blocking key
    And it notes "Block on `t-b` lifted: this bean is scrapped."

  @test:scripts/tests/beans-fallback-lift.test.ts::closing_a_blocker_lifts_its_blocks::a_status_that_does_not_close_lifts_nothing
  Scenario: A status that does not close lifts nothing
    Given a scratch store where "t-b" is blocked by "t-a"
    When "t-a" is updated to in-progress
    Then nothing is reported lifted
    And "t-b" is still blocked by "t-a"

  @test:scripts/tests/beans-fallback-lift.test.ts::closing_a_blocker_lifts_its_blocks::the_text_transform_says_when_there_was_nothing_to_lift
  Scenario: The text transform says when there was nothing to lift
    Given a bean's text with no blocked_by
    When the block on "t-a" is lifted from its blocked_by
    Then the result is undefined

  @test:scripts/tests/beans-fallback-lift.test.ts::listBeans_skips_README.md::README.md_with_generated_front_matter_is_not_listed_as_an_open_bean
  Scenario: A README.md with generated front matter is not listed as an open bean
    Given a scratch store with bean "t-a" and a README.md with generated front matter
    When the beans are listed
    Then only "t-a" is listed
