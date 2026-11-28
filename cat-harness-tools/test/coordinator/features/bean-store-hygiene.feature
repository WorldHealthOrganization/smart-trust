# Specifies that the committed bean store (the checkout's beans/defs) is not
# empty and holds only statuses the beans CLI can produce, and titled beans.
Feature: The committed bean store holds only titled beans in states the CLI can produce

  @test:test/coordinator/bean-store-hygiene.test.ts::bean_store_hygiene::the_store_is_not_empty_—_otherwise_these_tests_prove_nothing
  Scenario: The bean store is not empty
    Given the checkout's beans/defs directory
    When its bean files are listed, README.md excluded
    Then there are more than 10

  @test:test/coordinator/bean-store-hygiene.test.ts::bean_store_hygiene::every_bean's_status_is_one_the_CLI_can_produce
  Scenario: Every bean's status is one the CLI accepts
    Given every bean file in the store
    When its status line is read
    Then every bean has a status line
    And every status is one of draft, todo, in-progress, completed or scrapped

  @test:test/coordinator/bean-store-hygiene.test.ts::bean_store_hygiene::every_bean_has_a_title
  Scenario: Every bean has a title
    Given every bean file in the store
    When it is read
    Then every bean has a non-empty title line
