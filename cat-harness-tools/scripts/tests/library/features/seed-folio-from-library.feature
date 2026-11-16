# Markdown to KG end to end: a text source becomes a library entry, the entry
# seeds a folio document, and every seeded block is a current KG node.
Feature: Seeding a folio document from a library entry

  @test:scripts/tests/library/seed-folio-from-library.test.ts::seed-folio-from-library::nests_by_level_and_strips_a_section's_front_matter_and_heading
  Scenario: Sections nest by level, and a section body drops front matter and heading
    Given sections at levels 1, 2, 3, 2, 1
    When they are nested
    Then the roots are the two level-1 sections
    And the first root's children are the two level-2 sections, the first holding the level-3 one
    And the body of a section with front matter and a heading is just its text

  @test:scripts/tests/library/seed-folio-from-library.test.ts::seed-folio-from-library::Markdown_→_library_entry_→_folio_document,_every_block_a_current_KG_node
  Scenario: Markdown becomes a library entry, then a folio document of current KG nodes
    Given a new document folio and a Markdown source with two parts, a chapter and a detail
    When text-structure.ts ingests the source into the folio's library
    And seed-folio-from-library.ts seeds document "seeded" from the entry
    Then both succeed and the seed reports 2 chapters, 4 blocks and 4 KG nodes
    And the detail block holds "Detail text." with a JSON-LD sibling beside it
    And gen-block-jsonld --check reports 4 siblings up to date
    And the source file is unchanged
    And a second seed without --force exits 1 saying it is "one-time"
