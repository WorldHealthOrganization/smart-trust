# Specifies libraryResolver (scripts/lib/library-links.ts) over the entries
# of the published library projection; skipped where the site is not built.
Feature: A library reference links to its viewer page and README

  @test:test/coordinator/library-links-checkout.test.ts::a_library_reference_resolves_only_where_its_target_exists::links_every_projected_item_to_its_viewer_page_and_README
  Scenario: Every projected entry links to its viewer anchor and its README
    Given the entries of the published library index
    When the resolver's links for each entry are read
    Then there is at least one entry
    And each viewer link is the library page for its instance with the anchor "<instance>/<id>"
    And where the entry has a README.md, the README link contains its forge path
