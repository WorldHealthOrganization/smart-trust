# scripts/derive-at-publish.ts orders the declared publish-time writers: lowest layer first,
# each layer's declared order kept, a shared writer once, a declared reader after what fills
# the kind it reads, and a cycle refused. Each Scenario names the test that executes it.
Feature: The order derive:publish runs publish-time writers in

  @test:scripts/tests/sdlc/derive-at-publish-order.test.ts::the_base_order_is_lowest_layer_first::every_instance_comes_after_each_instance_it_needs
  Scenario: Every instance is written after each instance it needs
    Given fixture layers a-platform, c-base needing a-platform, and b-ig needing c-base
    When the writing order of the instances is computed
    Then a-platform comes before c-base
    And c-base comes before b-ig

  @test:scripts/tests/sdlc/derive-at-publish-order.test.ts::the_base_order_is_lowest_layer_first::an_entry_carries_the_kinds_it_reads,_and_the_kinds_of_the_directory_it_fills
  Scenario: A planned entry carries the kinds it reads and the kinds of the directory it fills
    Given the fixture layers
    When the declared plan is read
    Then a-platform's "docs/_data/harness.json" entry reads "docs"
    And b-ig's "docs/" entry fills "docs" and "ig-pages"

  @test:scripts/tests/sdlc/derive-at-publish-order.test.ts::a_declared_read_edge_orders_the_reader_after_what_it_reads::the_IG's_pages_are_written_before_the_platform_data_that_reads_whether_they_exist
  Scenario: The IG's pages are written before the platform data that reads them
    Given the fixture layers, where a-platform's harness data reads "docs" and b-ig fills a "docs" directory
    When the writers are ordered
    Then "ig:pages" comes before "platform:pages" and before "platform:harness"

  @test:scripts/tests/sdlc/derive-at-publish-order.test.ts::a_declared_read_edge_orders_the_reader_after_what_it_reads::the_edge_is_named,_with_the_entries_it_comes_from
  Scenario: A read edge is named with the entries it comes from
    Given the fixture layers
    When the writer edges are computed
    Then the edge from "ig:pages" to "platform:harness" says "a-platform/docs/_data/harness.json reads docs, which b-ig/docs/ fills"

  @test:scripts/tests/sdlc/derive-at-publish-order.test.ts::a_declared_read_edge_orders_the_reader_after_what_it_reads::an_instance's_own_declared_order_holds_behind_a_moved_writer,_and_a_shared_writer_runs_once
  Scenario: A layer's declared order holds behind a moved writer and a shared writer runs once
    Given the fixture layers, with "shared:contexts" declared by both b-ig and c-base
    When the writers are ordered
    Then the order is shared:contexts, ig:pages, platform:pages, platform:harness, platform:navbar, platform:other

  @test:scripts/tests/sdlc/derive-at-publish-order.test.ts::a_declared_read_edge_orders_the_reader_after_what_it_reads::without_the_declared_edge_the_base_order_stands:_lowest_first,_no_guess_at_a_read
  Scenario: Without a declared read the base lowest-first order stands
    Given the fixture plan with every "reads" removed
    When the writers are ordered
    Then the order is platform:pages, platform:harness, platform:navbar, platform:other, shared:contexts, ig:pages

  @test:scripts/tests/sdlc/derive-at-publish-order.test.ts::a_declared_read_edge_orders_the_reader_after_what_it_reads::a_reader_is_not_ordered_after_its_own_instance's_entries_by_`reads`
  Scenario: A reader is not ordered after its own instance's entries by its reads
    Given one instance whose "x:reader" reads "docs" and whose "x:docs" fills "docs"
    When the writer edges and order are computed
    Then there is no edge from a read
    And the order stays x:reader then x:docs

  @test:scripts/tests/sdlc/derive-at-publish-order.test.ts::a_cycle_is_refused::two_instances_that_each_read_what_the_other_builds_have_no_right_order
  Scenario: Two instances that each read what the other fills are refused as a cycle
    Given "low:tiles" reads "docs" and fills "listing", and "high:pages" reads "listing" and fills "docs"
    When the writers are ordered
    Then it throws naming a cycle among low:tiles, high:pages

  @test:scripts/tests/sdlc/derive-at-publish-order.test.ts::a_cycle_is_refused::an_instance's_declared_order_contradicting_a_read_edge_is_a_cycle_too
  Scenario: A declared order contradicting a read edge is refused as a cycle
    Given instance high lists "shared:gen" before "high:pages", which fills "docs"
    And instance low's "shared:gen" reads "docs"
    When the writers are ordered
    Then it throws saying high lists shared:gen before high:pages

  @test:scripts/tests/sdlc/derive-at-publish-order.test.ts::an_entry_fills_the_kinds_of_the_declared_directory_that_holds_it::an_index_file_inside_the_declared_index_directory_fills_its_kind
  Scenario: An entry inside a declared directory fills that directory's kinds
    Given an ig layer declaring "fhir-artifact-index/" of kind fhir-artifact-index
    And an entry "fhir-artifact-index/index.json" that names no directory
    When the declared plan is read
    Then the ig entry fills "fhir-artifact-index"

  @test:scripts/tests/sdlc/derive-at-publish-order.test.ts::an_entry_fills_the_kinds_of_the_declared_directory_that_holds_it::the_reader_of_that_kind_runs_after_the_index's_writer,_though_it_stands_in_a_lower_layer
  Scenario: A lower-layer reader of the index kind runs after the index's writer
    Given a platform layer whose uml entry, written by platform:handler then platform:uml, reads fhir-artifact-index
    And the ig layer above it whose index file is written by ig:index
    When the writers are ordered
    Then "ig:index" comes before "platform:uml"
    And "platform:handler" still comes before "platform:uml"

  @test:scripts/tests/sdlc/derive-at-publish-order.test.ts::an_entry_fills_the_kinds_of_the_declared_directory_that_holds_it::the_deepest_declared_directory_wins;_a_path_outside_every_one_fills_nothing;_an_explicit_`directory`_is_unchanged
  Scenario: The deepest enclosing directory decides the kinds, and an explicit directory is unchanged
    Given declared directories "docs/", "docs/api/" and "fhir-artifact-index"
    When the enclosing kinds of paths are read
    Then "docs/api/x.json" fills "api" and "docs/" fills "docs"
    And "./fhir-artifact-index/menu.json" fills "fhir-artifact-index"
    And "fhir-artifact-indexes/x.json" and "elsewhere/outside.json" fill nothing
    And b-ig's "docs/" entry with an explicit directory still fills "docs" and "ig-pages"
