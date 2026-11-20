Feature: The catalogue page's rows lead somewhere, and the page is themed
  Asserted over the committed catalogue viewer page: held items link to their
  library entry pages, held-as library ids link to the library viewer, and the
  page sits on the site's default layout without styling outside itself.

  Background:
    Given the committed catalogue viewer page
    And its "Every node" table

  @test:scripts/tests/catalogue-links.test.ts::the_catalogue's_rows_lead_somewhere_(qgjh)::linksHeldTitlesToLibraryEntries
  Scenario: links each held item's title to its library entry page, and nothing to the retired replica
    Then the table has no link to an item- or collection- .html page
    And it has at least one link of the form ".../library/who-iris/<id>/"
    And every such id exists as a directory under library/, or as a Dublin Core record of an item catalogued by reference

  @test:scripts/tests/catalogue-links.test.ts::the_catalogue's_rows_lead_somewhere_(qgjh)::linksLibraryIdsToViewerPage
  Scenario: links a held-as library id to the viewer page, which exists or is built at publish
    When the links on the table's library-id code cells are collected
    Then there is at least one
    And for each distinct link, its index.html under the published catalogue route either exists or is declared built at publish by the site's owner

  @test:scripts/tests/catalogue-links.test.ts::the_catalogue_viewer_is_THEMED,_so_it_carries_the_site's_top_band_(2026-10-07)::isOnDefaultLayout
  Scenario: is on the default layout, not a standalone document
    Then the page starts with front matter "layout: default"
    And it contains no doctype, html, head or body tag
    And it contains the heading with id "ic-title"

  @test:scripts/tests/catalogue-links.test.ts::the_catalogue_viewer_is_THEMED,_so_it_carries_the_site's_top_band_(2026-10-07)::stylesOnlyOwnWrapperNoRail
  Scenario: styles nothing outside its own wrapper, and carries no rail
    When the selectors in the page's style blocks are collected, comments removed
    Then there is at least one selector
    And every selector is scoped to ".ic-page", optionally under the light-scheme root
    And the page has no "fa-nav" navigation
