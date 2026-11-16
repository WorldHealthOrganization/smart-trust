# BLOCK_KINDS (schemas/types.ts) is the single runtime list of block kinds; its
# consumers, readBlockManifest and the viewer registry, must recognise all of it.
# Each Scenario names the test that executes it.
Feature: One list of block kinds and its consumers

  @test:scripts/tests/block-kinds.test.ts::BLOCK_KINDS::carries_the_two_kinds_whose_omission_caused_this
  Scenario: BLOCK_KINDS includes algorithm and table
    Given the BLOCK_KINDS list
    Then it contains "algorithm"
    And it contains "table"

  @test:scripts/tests/block-kinds.test.ts::BLOCK_KINDS::has_no_duplicates
  Scenario: BLOCK_KINDS has no duplicate kinds
    Given the BLOCK_KINDS list
    Then its size as a set equals its length

  @test:scripts/tests/block-kinds.test.ts::BLOCK_KINDS::excludes_container_kinds
  Scenario: BLOCK_KINDS excludes the container kinds
    Given the BLOCK_KINDS list
    Then it does not contain "chapter", "paper" or "folio"

  @test:scripts/tests/block-kinds.test.ts::BLOCK_KINDS::the_alternation_matches_the_list
  Scenario: The block-kind alternation matches the list
    Given BLOCK_KIND_ALT
    When it is split on "|"
    Then the parts equal BLOCK_KINDS in order

  @test:scripts/tests/block-kinds.test.ts::readBlockManifest_recognises_every_kind::still_rejects_a_chapter_manifest
  Scenario: A chapter manifest is not read as a block
    Given a manifest file whose default export is chapter with label "ch:x"
    When readBlockManifest reads it
    Then the result is undefined

  @test:scripts/tests/block-kinds.test.ts::viewer_registry::registers_a_renderer_for_every_schema_block_kind
  Scenario: The viewer registry has a renderer for every block kind
    Given the viewer block registry
    When each kind in BLOCK_KINDS is looked up
    Then no kind is missing

  @test:scripts/tests/block-kinds.test.ts::readBlockManifest_recognises_every_kind::%s
  Scenario: readBlockManifest recognises a manifest of each block kind
    Given, for each kind in BLOCK_KINDS, a manifest file whose default export calls that kind's builder with label "<kind>:x"
    When readBlockManifest reads it
    Then the result is the kind and the label "<kind>:x"
