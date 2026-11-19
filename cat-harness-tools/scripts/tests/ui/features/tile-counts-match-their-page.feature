# The landing tiles' counts, read by schemas/ui/tile-count.ts from the built site projections,
# partition their graph and never over-count the page each tile opens. Each Scenario names the test that executes it.
Feature: Tile counts match the page they open

  @test:scripts/tests/ui/tile-counts-match-their-page.test.ts::scoped_counts_partition_their_graph_—_they_never_over-count_it::the_library_projection_is_readable,_so_what_follows_is_not_vacuous
  Scenario: The library projection is readable and carries tile counts
    # Skipped: when the site's library projection has not been built
    Given the built library projection
    Then its entries are a list
    And it carries at least one tile count

  @test:scripts/tests/ui/tile-counts-match-their-page.test.ts::scoped_counts_partition_their_graph_—_they_never_over-count_it::library:_the_entry_counts_do_not_exceed_the_entries
  Scenario: The library tiles' entry counts do not add up to more than the entries
    # Skipped: when the site's library projection has not been built
    Given the built library projection
    When the tile counts whose unit is "entries" or "entry" are summed
    Then the sum is at most the number of entries

  @test:scripts/tests/ui/tile-counts-match-their-page.test.ts::scoped_counts_partition_their_graph_—_they_never_over-count_it::schemas:_the_module_counts_do_not_exceed_the_modules
  Scenario: The schemas tiles' module counts do not add up to more than the modules
    # Skipped: when the site's schemas projection has not been built
    Given the built schemas projection
    When the tile counts whose unit is "modules" or "module" are summed
    Then the sum is at most the number of modules

  @test:scripts/tests/ui/tile-counts-match-their-page.test.ts::scoped_counts_partition_their_graph_—_they_never_over-count_it::and_more_than_one_instance_contributes,_so_the_sum_can_actually_fail
  Scenario: More than one instance contributes modules, so the sum check can fail
    # Skipped: standing alone, outside the composed checkout
    Given the built schemas projection
    When the instances of its modules are collected
    Then there are more than 1

  @test:scripts/tests/ui/tile-counts-match-their-page.test.ts::a_unit_is_pluralised_by_the_declarer::no_count_of_one_carries_a_plural_unit
  Scenario: No tile count of one carries a plural unit
    # Skipped: when any of the library, schemas, beans, todos, qa or voices projections has not been built
    Given the built library, schemas, beans, todos, qa and voices projections
    When each tile count of exactly 1 is read
    Then its unit does not end in "s"
