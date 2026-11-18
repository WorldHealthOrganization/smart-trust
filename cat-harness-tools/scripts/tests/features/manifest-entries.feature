# The shared predicate for which sections[] entries are references, and the
# flattening of a section's blocks through its subsections. Each Scenario
# names the test that executes it.
Feature: Section entries of a manifest

  @test:scripts/tests/manifest-entries.test.ts::isSectionRef::a_bare_reference_is_a_reference
  Scenario: A bare reference is a reference
    Then an entry with only a name is a reference
    And an entry with a name and a uri is a reference

  @test:scripts/tests/manifest-entries.test.ts::isSectionRef::an_inline_section_is_not
  Scenario: An inline section is not a reference
    Then an entry with a title and blocks is not a reference

  @test:scripts/tests/manifest-entries.test.ts::isSectionRef::a_section_with_only_subsections_is_NOT_a_reference_—_the_case_the_two_copies_disagreed_on
  Scenario: A section with only subsections is not a reference
    Then an entry with a title and subsections but no blocks is not a reference

  @test:scripts/tests/manifest-entries.test.ts::isSectionRef::an_entry_that_names_a_target_AND_carries_blocks_is_inline
  Scenario: An entry naming a target and carrying blocks is inline
    Then an entry with a name, a title and blocks is not a reference

  @test:scripts/tests/manifest-entries.test.ts::sectionBlockNames::own_blocks,_in_order
  Scenario: A section's own blocks come in order
    Then a section with blocks a and b gives a, b

  @test:scripts/tests/manifest-entries.test.ts::sectionBlockNames::own_blocks_first,_then_each_subsection's,_in_declaration_order
  Scenario: Own blocks come first, then each subsection's in order
    Then a section with block a and subsections holding b, c and d gives a, b, c, d

  @test:scripts/tests/manifest-entries.test.ts::sectionBlockNames::reaches_blocks_that_exist_ONLY_in_subsections
  Scenario: Blocks that exist only in subsections are reached
    Then a section with no blocks of its own and subsections holding b and c gives b, c

  @test:scripts/tests/manifest-entries.test.ts::sectionBlockNames::skips_a_subsection_that_is_a_bare_reference
  Scenario: A subsection that is a bare reference is skipped
    Then a section with block a, a reference subsection and a subsection holding d gives a, d

  @test:scripts/tests/manifest-entries.test.ts::sectionBlockNames::tolerates_a_missing_or_non-array_blocks/subsections
  Scenario: Missing or non-array blocks and subsections are tolerated
    Then a section with no blocks gives none, one whose blocks is a string gives none
    And one whose subsections is a string gives only its own blocks

  @test:scripts/tests/manifest-entries.test.ts::sectionBlockNames::tolerates_a_hole_in_subsections
  Scenario: A hole in subsections is tolerated
    Then a section whose subsections hold null and a subsection with b gives b
