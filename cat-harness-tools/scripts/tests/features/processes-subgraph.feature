# The processes viewer draws one page per sub-graph (owner, 2026-11-01). Each
# Scenario names the test that executes it.
Feature: Processes pages per sub-graph

  @test:scripts/tests/processes-subgraph.test.ts::owningInstance::picks_the_deepest_root,_so_a_mounted_layer_is_its_own_sub-graph
  Scenario: The deepest root owns a file
    Given smart-trust at /w and smart-base mounted at /w/smart-base
    Then a file under /w/smart-base belongs to smart-base and one elsewhere under /w to smart-trust

  @test:scripts/tests/processes-subgraph.test.ts::owningInstance::does_not_match_a_sibling_that_only_shares_a_name_prefix
  Scenario: A sibling that only shares a name prefix is not matched
    Then a file under /w/smart-base-extra belongs to no instance when only smart-base is a root

  @test:scripts/tests/processes-subgraph.test.ts::subgraphPages::groups_rows_by_instance,_sorted,_and_skips_rows_with_none
  Scenario: Rows are grouped by instance, sorted, skipping rows with none
    When rows of who-iris, smart-trust twice and no instance are grouped into pages
    Then the pages are smart-trust with 2 rows and who-iris with 1

  @test:scripts/tests/processes-subgraph.test.ts::page_scope::the_index_carries_a_By_subgraph_table_linking_each_sub-graph_page
  Scenario: The index carries a By subgraph table
    When the index is rendered with one sub-graph
    Then it has a By subgraph section with a linked row and its count, and links process pages at their own level

  @test:scripts/tests/processes-subgraph.test.ts::page_scope::a_sub-graph_page_is_titled_for_its_instance_and_links_process_pages_one_level_up
  Scenario: A sub-graph page is titled for its instance and links one level up
    When the smart-trust page is rendered
    Then its title and heading name smart-trust, its process links go one level up, and it has no By subgraph section
