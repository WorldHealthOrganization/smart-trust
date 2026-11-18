# readBlockManifest decides what counts as a content block, and must not read
# a builder call or label inside a string or comment as one. Each Scenario
# names the test that executes it.
Feature: A block manifest is read only from code, not from strings or comments

  @test:scripts/tests/read-block-manifest-masking.test.ts::readBlockManifest_ignores_builders_and_labels_inside_strings::a_builder_call_inside_a_template_literal_is_not_a_manifest
  Scenario: A builder call inside a template literal is not a manifest
    Given a source file passing manifest text in a template literal to a function
    When its block manifest is read
    Then there is none

  @test:scripts/tests/read-block-manifest-masking.test.ts::readBlockManifest_ignores_builders_and_labels_inside_strings::a_builder_call_inside_a_comment_is_not_a_manifest
  Scenario: A builder call inside a comment is not a manifest
    Given a source file whose comment shows a theorem builder call
    When its block manifest is read
    Then there is none

  @test:scripts/tests/read-block-manifest-masking.test.ts::readBlockManifest_ignores_builders_and_labels_inside_strings::a_real_manifest_still_reads,_with_kind_and_label
  Scenario: A real manifest reads with kind and label
    Given a file whose default export is proposition with label "prop:real-one"
    When its block manifest is read
    Then it is kind "proposition" with label "prop:real-one"

  @test:scripts/tests/read-block-manifest-masking.test.ts::readBlockManifest_ignores_builders_and_labels_inside_strings::a_decoy_label_in_a_comment_does_not_win_over_the_real_field
  Scenario: A decoy label in a comment does not win over the real field
    Given a remark manifest whose comment names "rem:ghost" and whose label is "rem:actual"
    When its block manifest is read
    Then its label is "rem:actual"

  @test:scripts/tests/read-block-manifest-masking.test.ts::readBlockManifest_ignores_builders_and_labels_inside_strings::a_manifest_with_no_label_is_not_a_block
  Scenario: A manifest with no label is not a block
    Given a remark manifest with only a title
    When its block manifest is read
    Then there is none

  @test:scripts/tests/read-block-manifest-masking.test.ts::readBlockManifest_ignores_builders_and_labels_inside_strings::a_missing_file_is_undefined,_not_a_throw
  Scenario: A missing file has no manifest
    When the block manifest of a file that does not exist is read
    Then there is none
