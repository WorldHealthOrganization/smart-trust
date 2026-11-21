# scripts/publish-id-lookup.ts copies the identifier lookup client and every declared index
# into a built site where scripts/search-split.ts links to it. Each Scenario names the test that executes it.
Feature: Publishing the identifier lookup into a built site

  @test:test/publish-id-lookup.test.ts::publish-id-lookup::the_client_and_every_declared_index_land_where_the_splitter_looks
  Scenario: The lookup client and every declared index are published where the splitter looks
    Given an empty site directory and this checkout's indexed sources, of which there is at least one
    When the identifier lookup is published into the site
    Then one result is reported per indexed source, in order
    And index.html and lookup.js exist under the lookup directory
    And index.html carries the linked folio-navbar meta and "data-fa-visualiser-nav"
    And each published manifest.json equals the generated one byte for byte
    And no README.md is published beside an index
    And the publish directory is the splitter's lookup directory
    And the splitter finds exactly the indexed sources in the site

  @test:test/publish-id-lookup.test.ts::publish-id-lookup::a_declared_index_with_no_generated_manifest_is_refused,_not_linked
  Scenario: A declared index with no generated manifest is refused
    Given an empty site directory
    When the lookup is published for "an-instance-that-hosts-no-lookup"
    Then publishing throws
