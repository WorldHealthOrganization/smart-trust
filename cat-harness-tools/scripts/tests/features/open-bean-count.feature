# One definition of open beans (bean v215), and the two committed projections
# every Beans badge reads agree with it. Each Scenario names the test that executes it.
Feature: Counting open beans

  @test:scripts/tests/open-bean-count.test.ts::openBeanCount::counts_draft,_todo_and_in-progress;_not_completed,_scrapped_or_a_bean_with_no_status
  Scenario: Draft, todo and in-progress are open; others are not
    When beans of every status, one with no status and one with status "constructor" are counted
    Then 3 are open, and the open statuses are draft, in-progress and todo

  @test:scripts/tests/open-bean-count.test.ts::openBeanCount::an_empty_store_is_zero,_a_real_answer
  Scenario: An empty store is zero
    Then counting no beans gives 0

  @test:scripts/tests/open-bean-count.test.ts::the_two_projections_every_Beans_badge_reads_agree::index.json's_tile_count_(the_glass_and_launcher_tiles)_equals_count.json's_(the_icon_row)
  Scenario: The tile count in index.json equals the icon row's in count.json
    Given both bean projections are built
    Then the beans tile count of index.json is defined, equals count.json's, and is in the open-beans unit

  @test:scripts/tests/open-bean-count.test.ts::the_two_projections_every_Beans_badge_reads_agree::and_equals_openBeanCount_over_the_index's_own_items
  Scenario: The tile count equals the open count over the index's own items
    Given the bean index is built
    Then its beans tile count equals the open bean count of its items
