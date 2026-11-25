# pipeline/block-module.ts loads blocks by importing them as modules, and
# verifyEditedBlock checks an edit by reading back what it produced.
# Each Scenario names the test that executes it.
Feature: Blocks loaded as modules, and edits verified by reading back

  @test:scripts/tests/block-module.test.ts::loadBlocksUnder_sees_every_block_kind::finds_algorithm_and_table_—_kinds_the_regex_missed_—_and_the_rest
  Scenario: Loading a chapter directory finds every block kind
    Given a chapter directory with remark, example, algorithm and table blocks built with the harness builders
    When the blocks under it are loaded
    Then "alg:a1", "tbl:tb1", "rem:r1" and "ex:e1" are all found

  @test:scripts/tests/block-module.test.ts::loadBlocksUnder_sees_every_block_kind::reads_uses[]_from_the_validated_object,_not_from_source_text
  Scenario: A loaded block's uses list comes from the built object
    Given the same chapter directory
    When the blocks under it are loaded
    Then "rem:r1" uses ["def:d1"] and "alg:a1" uses ["thm:t1"]
    And "ex:e1", which declares no uses, has an empty uses list

  @test:scripts/tests/block-module.test.ts::loadBlocksUnder_sees_every_block_kind::a_chapter_manifest_is_skipped,_not_reported_as_a_failure
  Scenario: A chapter manifest is skipped without a failure
    Given the chapter directory also holds a chapter manifest "ch1.ts"
    When the blocks under it are loaded
    Then no loaded block has kind "chapter"
    And no failure names "ch1.ts"

  @test:scripts/tests/block-module.test.ts::loadBlocksUnder_sees_every_block_kind::a_block_that_will_not_load_is_REPORTED,_never_silently_dropped
  Scenario: A block that fails to load is reported as a failure
    Given the chapter directory holds "broken.ts", a remark with the invalid label "NOT-A-VALID-PREFIX"
    When the blocks under it are loaded
    Then there is exactly one failure
    And it names "broken.ts" with a non-empty error

  @test:scripts/tests/block-module.test.ts::loadBlocksUnder_and_contributed_kinds::a_contributed_kind_is_a_block_only_when_the_caller_names_it
  Scenario: A contributed kind is loaded only when the caller names it
    Given the chapter directory holds a plain object of kind "persona" labelled "pers:p1"
    When the blocks are loaded with no contributed kinds
    Then "pers:p1" is not found
    And when they are loaded with the contributed kind "persona", "pers:p1" is found with kind "persona"

  @test:scripts/tests/block-module.test.ts::loadBlockModule::rejects_a_label_the_schema_would_reject
  Scenario: Loading a block with a label its builder refuses throws
    Given a remark block labelled "remark:x" instead of a "rem:" label
    When loadBlockModule loads it
    Then it rejects with an error

  @test:scripts/tests/block-module.test.ts::verifyEditedBlock_—_the_write_path_stops_trusting_the_splice::accepts_an_edit_that_produces_exactly_the_intended_uses[]
  Scenario: An edit producing exactly the intended uses list is accepted
    Given a remark "rem:v1" that uses ["def:a", "def:b"]
    When an edit leaving uses ["def:a"] is verified against the intended ["def:a"]
    Then the result is ok

  @test:scripts/tests/block-module.test.ts::verifyEditedBlock_—_the_write_path_stops_trusting_the_splice::rejects_an_edit_whose_uses[]_is_not_what_was_asked_for
  Scenario: An edit producing the wrong uses list is rejected
    Given a remark "rem:v1" that uses ["def:a", "def:b"]
    When an edit leaving uses ["def:b"] is verified against the intended ["def:a"]
    Then the result is not ok
    And the reason mentions "uses[]"

  @test:scripts/tests/block-module.test.ts::verifyEditedBlock_—_the_write_path_stops_trusting_the_splice::rejects_an_edit_that_landed_in_a_different_field
  Scenario: An edit that changed the label is rejected
    Given a remark "rem:v1" that uses ["def:a", "def:b"]
    When an edit changing its label to "rem:other" is verified against the unchanged uses list
    Then the result is not ok
    And the reason mentions "label changed"

  @test:scripts/tests/block-module.test.ts::verifyEditedBlock_—_the_write_path_stops_trusting_the_splice::rejects_an_edit_that_no_longer_parses
  Scenario: An edit that no longer loads is rejected
    Given a remark "rem:v1"
    When a truncated, unparseable edit is verified
    Then the result is not ok
    And the reason mentions "does not load"

  @test:scripts/tests/block-module.test.ts::verifyEditedBlock_—_the_write_path_stops_trusting_the_splice::rejects_an_edit_the_schema_refuses
  Scenario: An edit the schema refuses is rejected
    Given a remark "rem:v1"
    When an edit changing its label to "nonsense" is verified
    Then the result is not ok

  @test:scripts/tests/block-module.test.ts::verifyEditedBlock_—_the_write_path_stops_trusting_the_splice::leaves_no_probe_file_behind,_on_success_or_failure
  Scenario: Verifying an edit leaves no probe file behind
    Given a remark "rem:v1"
    When one valid and one unparseable edit are verified
    Then no file named with "prune-verify" remains in the chapter directory

  @test:scripts/tests/block-module.test.ts::verifyEditedBlock_—_the_write_path_stops_trusting_the_splice::never_writes_to_the_target_itself
  Scenario: Verifying an edit does not write the target file
    Given a remark "rem:v1" on disk
    When an edit is verified
    Then the target file's size is unchanged
    # Gap: only the file size is compared, not its content
