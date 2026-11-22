# `scripts/l1-blocks.ts` and `pipeline/gen-library-jsonld.ts` must name a section's
# prose block the same way, so running both on one entry leaves no orphaned block.
# Each Scenario names the test that executes it.
Feature: One naming rule for an L1 prose block

  @test:scripts/tests/l1-blocks.test.ts::one_naming_rule_for_a_prose_block_—_bean_`xwi8`::the_arm_writes_the_generator's_block_ids,_not_the_full_section_id
  Scenario: The L1 arm writes the generator's block ids, not the full section id
    Given a staged entry with sections "sec-001-introduction" and "sec-002-2-related-work"
    When the L1 arm builds the entry
    Then nothing is missing
    And the blocks written are the generator's prose block ids for each section key
    And they are "prose-sec-001.jsonld" and "prose-sec-002.jsonld"

  @test:scripts/tests/l1-blocks.test.ts::one_naming_rule_for_a_prose_block_—_bean_`xwi8`::the_arm's_manifest_points_at_section_NODES_by_the_generator's_name
  Scenario: The arm's manifest points at section nodes by the generator's name
    Given the staged entry "fixture-doc"
    When the L1 arm builds the entry
    Then the manifest contains "library/fixture-doc/sections/sec-001" and "library/fixture-doc/sections/sec-002"

  @test:scripts/tests/l1-blocks.test.ts::one_naming_rule_for_a_prose_block_—_bean_`xwi8`::both_writers_on_one_entry_leave_NO_orphaned_block
  Scenario: Both writers on one entry leave no orphaned block
    Given the staged entry built by the L1 arm
    When the generator's document nodes are written over it
    Then the generator wrote at least one file
    And the entry holds at least one block
    And the generator's orphan detector finds no orphaned block
