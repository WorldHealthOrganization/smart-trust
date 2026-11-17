# Specifies libraryAssetIri and libraryAssetSitePath
# (schemas/library/library-iri.ts) and entryView and instanceRootRoutes
# (scripts/gen-library-viz.ts) over the checkout's library.
Feature: A library asset and its rendering have different IRIs, and a view link is a declared root

  @test:test/coordinator/library-entry-iri-checkout.test.ts::asset_and_rendering:_two_resources,_two_IRIs_(owner,_2026-10-02)::every_entry's_@id_IS_the_address_of_its_published_JSON-LD,_and_that_file_is_published
  Scenario: Every entry's @id is the address of its published JSON-LD
    Given the published library index (the test is skipped where the site is not built)
    When each entry's manifest.jsonld is read
    Then its @id is the entry's asset IRI
    And the JSON-LD is published at the asset's site path
    And the published file carries the same @id

  @test:test/coordinator/library-entry-iri-checkout.test.ts::asset_and_rendering:_two_resources,_two_IRIs_(owner,_2026-10-02)::entryView_takes_a_link_only_when_it_is_a_DECLARED_root,_never_any_page
  Scenario: entryView uses a link only when it is a declared root
    Given the declared root "/smart-trust/" for smart-trust
    When entryView is asked for an entry linking to "/smart-trust/", one linking to "/somewhere-else/", and one with no links, each at "x/y/z"
    Then the first view is "/smart-trust/"
    And the other two are "/x/y/z/"

  @test:test/coordinator/library-entry-iri-checkout.test.ts::asset_and_rendering:_two_resources,_two_IRIs_(owner,_2026-10-02)::and_smart-trust's_declared_root_is_the_route_its_entries_take
  Scenario: smart-trust's declared root is its entries' route
    Given the checkout holds smart-trust (the test is skipped where it does not)
    When the instance root routes are derived
    Then smart-trust's route is "/smart-trust/"
