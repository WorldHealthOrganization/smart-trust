# no-unlisted-block: a block on disk that no section lists (bean eqly).
# Each Scenario names the test that executes it.
Feature: Unlisted blocks

  @test:scripts/tests/validate-unlisted-block.test.ts::no-unlisted-block::flags_a_block_on_disk_that_no_section_lists,_as_a_warning_naming_it
  Scenario: A block no section lists is a warning
    Given a chapter whose section lists "alpha", with blocks "alpha" and "ghost" on disk
    When the chapter is validated
    Then the only unlisted-block issue is for "ghost", at level "warning"

  @test:scripts/tests/validate-unlisted-block.test.ts::no-unlisted-block::a_block_listed_only_in_a_subsection_is_listed
  Scenario: A block listed in a subsection is listed
    Given "beta" is listed only in a subsection
    Then there are no unlisted-block issues

  @test:scripts/tests/validate-unlisted-block.test.ts::no-unlisted-block::the_chapter's_own_manifest_and_a_non-block_helper_module_are_not_blocks
  Scenario: The chapter manifest and a helper module are not blocks
    Given the chapter's manifest and a "helpers.ts" that is not a block
    Then there are no unlisted-block issues

  @test:scripts/tests/validate-unlisted-block.test.ts::no-unlisted-block::a_section_reference_makes_membership_undetermined:_said_once_as_info,_no_orphans_claimed
  Scenario: A section reference makes membership undetermined
    Given a chapter with a section listing "alpha" and a section referenced by name, and "ghost" on disk
    Then there are no unlisted-block issues
    And one info issue says the check "could not determine"

  @test:scripts/tests/validate-unlisted-block.test.ts::no-unlisted-block::the_other_direction:_listed_in_a_section,_absent_from_disk,_is_an_error
  Scenario: A listed block missing from disk is an error
    Given a section listing "missing" that is not on disk
    Then there is one "Block manifest not found" issue at level "error"
