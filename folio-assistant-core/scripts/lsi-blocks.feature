Feature: the text of library blocks for latent semantic indexing

  @test:scripts/lsi-blocks.test.ts::blockText::proseReadsSection
  Scenario: a prose block reads the section file it points at
    When a prose block pointing at a section file is read
    Then its text is its title and the section's text

  @test:scripts/lsi-blocks.test.ts::blockText::figureTitleAndNarrative
  Scenario: a figure contributes its title and narrative — the text no section holds
    When a figure with a narrative is read
    Then its text is its title and narrative

  @test:scripts/lsi-blocks.test.ts::blockText::narrativeListFirstEntry
  Scenario: a figure whose narrative slot is a list reads its first entry, the single-text default
    When a figure whose narrative is a list is read
    Then the first entry is used

  @test:scripts/lsi-blocks.test.ts::blockText::unknownOrMissingIsReason
  Scenario: an unknown kind or a missing section is a REASON, never empty text
    When an unknown kind and a prose block with a missing section are read
    Then each gives a reason, never empty text

  @test:scripts/lsi-blocks.test.ts::blockUnits::unitsKeyedById
  Scenario: units are keyed by the block's @id, and unreadable blocks are counted, not dropped
    When the units of a library with readable and unreadable blocks are made
    Then the units are keyed by @id and counted by kind
    And the two unreadable blocks are counted

  @test:scripts/lsi-blocks.test.ts::blockUnits::repeatedIdReported
  Scenario: a repeated @id is reported, not allowed to overwrite the first
    When two blocks share an @id
    Then one unit is kept and the other reported as already used

  @test:scripts/lsi-blocks.test.ts::lsiNearUnits_(the_`blocks`_provider_for_cross-graph_lsi:near)::rootLibraryOwnRefs
  Scenario: with --root it reads that library, and each block's @id is its own explicit reference
    When the units are made with an explicit library root
    Then each block's @id is its unit and its own reference, with the block index options, and it is searched

  @test:scripts/lsi-blocks.test.ts::lsiNearUnits_(the_`blocks`_provider_for_cross-graph_lsi:near)::noLibraryNotSearched
  Scenario: with no library declared it is not searched, never an empty index
    When the units are made with no library declared
    Then it says no library is declared and has no units
