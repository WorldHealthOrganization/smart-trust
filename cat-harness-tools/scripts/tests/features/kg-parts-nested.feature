# `scripts/kg-parts.ts` and `scripts/kg-subscribe.ts` keep a nested subgraph's byte
# copy under nested/, keyed by its path and apart from its parent's own part.
# Each Scenario names the test that executes it.
Feature: Nested subgraph parts

  @test:scripts/tests/kg-parts-nested.test.ts::nested_subgraph_parts::partDirOf_keys_a_nested_part_by_its_path_under_nested/,_apart_from_its_parent's_part
  Scenario: A nested part's directory is keyed by its path under nested/, apart from its parent's part
    Given a snapshot root "/s" and a subscription "sub"
    When the part directory of the subgraph "skills" at path "skills" is computed
    Then it is "/s/sub/subgraphs/skills"
    And the part directory of the nested subgraph "skills" at path "skills/voices" is "/s/sub/nested/skills/voices"

  @test:scripts/tests/kg-parts-nested.test.ts::nested_subgraph_parts::partRecordsIn_reads_a_nested_part_as_its_own_slot,_and_a_file_with_no_record_under_nested/_as_a_stray
  Scenario: A nested part is read as its own slot, and an unrecorded file under nested/ as a stray
    Given a snapshot holding a nested part "skills/voices" with a tree file and a referenced part record
    And a loose file "loose.md" directly under the subscription's nested/ directory
    When the part records of the subscription are read
    Then the only part has the slot kind "nested" with path "skills/voices"
    And that part is id "skills", path "skills/voices", nested
    And the only stray is "sub/nested/loose.md"
