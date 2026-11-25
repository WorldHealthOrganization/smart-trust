# What scripts/tests/kg/kg-changed-assets.test.ts covers: scripts/kg-changed-assets.ts compares a staging preview's
# graph with main's, listing added, changed and removed assets with the pages the renderer maps them to.
# Each Scenario names the test that executes it.
Feature: The changed-assets list on a staging preview's graph

  @test:scripts/tests/kg/kg-changed-assets.test.ts::basesOf::reads_both_bases_off_the_document
  Scenario: Both bases are read off a preview document
    Given a preview document carrying its staging @id and its canonical main document
    When its bases are read
    Then they are the staging and main bases

  @test:scripts/tests/kg/kg-changed-assets.test.ts::basesOf::a_canonical_document_is_not_a_preview
  Scenario: A canonical document is not a preview
    Given a main document, with and without a canonicalDocument pointing at itself
    When its bases are read
    Then each answer is a string reason rather than bases

  @test:scripts/tests/kg/kg-changed-assets.test.ts::diffGraphs::the_same_graph_minted_under_the_staging_base_is_no_change
  Scenario: The same graph minted under the staging base is no change
    Given a staging base "https://o.github.io/r/STAGING/b" and a main base "https://o.github.io/r"
    And skills "a" and "b" in both the preview and main graphs
    When the graphs are diffed
    Then there are no changes

  @test:scripts/tests/kg/kg-changed-assets.test.ts::diffGraphs::key_order_is_not_a_change
  Scenario: Key order is not a change
    Given a staging base "https://o.github.io/r/STAGING/b" and a main base "https://o.github.io/r"
    And skill "a" with its keys in a different order in the preview
    When the graphs are diffed
    Then there are no changes

  @test:scripts/tests/kg/kg-changed-assets.test.ts::diffGraphs::added,_changed_and_removed,_in_@id_order
  Scenario: Added, changed and removed nodes are listed in @id order
    Given a staging base "https://o.github.io/r/STAGING/b" and a main base "https://o.github.io/r"
    And a preview with skill "a" given a description and skill "c", against main with skills "a" and "b"
    When the graphs are diffed
    Then the changes are changed skill/a, removed skill/b and added skill/c, in that order

  @test:scripts/tests/kg/kg-changed-assets.test.ts::diffGraphs::a_link_that_moved_is_a_change,_though_both_sides_are_rebased
  Scenario: A link that moved is a change though both sides are rebased
    Given a staging base "https://o.github.io/r/STAGING/b" and a main base "https://o.github.io/r"
    And skill "a" whose inPackage points at package q in the preview and package p on main
    When the graphs are diffed
    Then there is one change, "changed"

  @test:scripts/tests/kg/kg-changed-assets.test.ts::changedAssets::a_node_links_itself_on_both_sides:_its_@id_in_each_published_document
  Scenario: A changed node links its @id in each published document
    Given a preview with a changed skill "a" and an added page p from "docs/p.md", against main with skill "a" and a page q from "docs/q.md", and a renderer that maps only docs/ files
    When the changed assets are listed
    Then skill "a" is "changed", kind "Skill", title "a", with before its main @id and after its staging @id

  @test:scripts/tests/kg/kg-changed-assets.test.ts::changedAssets::a_source_the_renderer_cannot_map_says_so,_never_an_empty_page_list
  Scenario: A source the renderer cannot map says so instead of an empty page list
    Given a preview with a changed skill "a" and an added page p from "docs/p.md", against main with skill "a" and a page q from "docs/q.md", and a renderer that maps only docs/ files
    When the changed assets are listed
    Then skill "a" has no pages
    And its pagesUnknown reason mentions "staging cone"
    And its source is "cat-harness/skills/a.md"

  @test:scripts/tests/kg/kg-changed-assets.test.ts::changedAssets::an_added_node's_page_has_no_before;_a_removed_node's_has_no_after
  Scenario: An added node's page has no before and a removed node's has no after
    Given a preview with a changed skill "a" and an added page p from "docs/p.md", against main with skill "a" and a page q from "docs/q.md", and a renderer that maps only docs/ files
    When the changed assets are listed
    Then page p is "added" from "docs/p.md" with page "p.html" only after, on staging
    And page q is "removed", titled "Q", with page "q.html" only before, on main

  @test:scripts/tests/kg/kg-changed-assets.test.ts::the_third_state::no_main_site,_a_missing_document,_or_the_wrong_document_is_unavailable_—_never_an_empty_list
  Scenario: No main site, a missing document or a wrong one is unavailable rather than an empty list
    Given no main site, or a main site path that does not exist
    When main's document is read
    Then the reasons say "no published main site" and "could not be read"
    When the fields are built with main given as a reason string
    Then they carry only changedAssetsUnavailable with that reason and no changedAssets

  @test:scripts/tests/kg/kg-changed-assets.test.ts::the_third_state::compared_and_equal_is_an_empty_list_beside_what_it_was_compared_with
  Scenario: Compared and equal is an empty list beside what it was compared with
    Given a preview and main graph both holding only skill "a"
    When the changed-assets fields are built
    Then changedAssetsComparedWith is main's document and changedAssets is empty

  @test:scripts/tests/kg/kg-changed-assets.test.ts::declared,_so_a_JSON-LD_processor_keeps_it::the_export's_@context_declares_every_field_this_script_writes
  Scenario: The export's @context declares every field the script writes
    Given a preview document with the export's @context
    When its undeclared fields are listed
    Then there are none
    And with an empty @context every changed-assets field is undeclared

  @test:scripts/tests/kg/kg-changed-assets.test.ts::declared,_so_a_JSON-LD_processor_keeps_it::every_term_it_mints_is_glossed_in_the_vocabulary_(ns:check)
  Scenario: Every term the script mints is glossed in the vocabulary
    Given the export's @context
    When the IRIs of changedAssets, its nested terms, changedAssetsComparedWith and changedAssetsUnavailable are taken
    Then each one's last segment is a property gloss in the vocabulary
