# Specifies entrySources, librarySubgraphs and instanceSubgraphFile
# (scripts/gen-library-viz.ts) and its --site mode, over the checkout's
# published library. Tests over the site are skipped where it is not built.
Feature: The library pages' source links resolve, and --site writes a per-repository site

  @test:test/coordinator/library-source-links-checkout.test.ts::source_links_resolve_on_the_checkout's_site::every_entry_page's_sources_are_files_the_site_holds
  Scenario: Every entry page's sources are files the site holds
    Given the published library index
    When each entry's source links are computed from its page directory
    Then every link resolves to an existing file

  @test:test/coordinator/library-source-links-checkout.test.ts::source_links_resolve_on_the_checkout's_site::the_whole-library_page_lists_every_instance_in_the_checkout_that_declares_a_library,_and_its_links_resolve
  Scenario: The whole-library page lists every instance declaring a library, with links that resolve
    Given the published library index and the checkout's declared library directories
    When the library subgraph rows are computed
    Then their instances are exactly the declaring instances and the instances with entries, sorted
    And every row's page has an index.html
    And every row's JSON-LD file exists
    And more than one row has a JSON-LD file

  @test:test/coordinator/library-source-links-checkout.test.ts::`--site_<dir>`_writes_a_per-repository_site::the_subgraph_JSON-LD_is_looked_for_under_the_site_being_written,_at_the_path_the_subgraph_writer_uses
  Scenario: The subgraph JSON-LD is looked for under the site being written
    Given an empty temporary site
    When the subgraph file for "x" is looked up
    Then there is none
    When an index.jsonld is written for "x" at the subgraph writer's path under that site
    Then the lookup returns that file

  @test:test/coordinator/library-source-links-checkout.test.ts::`--site_<dir>`_writes_a_per-repository_site::pages_land_under_the_given_site_at_the_same_declared_route,_and_this_harness's_own_docs_are_untouched
  Scenario: --site writes pages under the given site and leaves this harness's docs untouched
    Given an empty temporary site and the harness's own library page (the test is skipped where the site is not built)
    When gen-library-viz.ts is run with --site pointing at the temporary site
    Then it exits 0
    And the page at the declared route under that site contains 'id="lib-subgraphs"'
    And the first entry's page exists under that site
    And the harness's own library page was not modified
