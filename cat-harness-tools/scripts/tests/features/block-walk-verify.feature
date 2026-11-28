# pipeline/qa-utils.ts walkBlocks verifies each block by loading its module with
# loadBlockModuleSync (pipeline/block-module.ts) instead of trusting a source-text regex.
# Each Scenario names the test that executes it.
Feature: Block walk verified by loading the module

  @test:scripts/tests/block-walk-verify.test.ts::loadBlockModuleSync::loads_a_block_synchronously,_with_the_fields_the_builder_validated
  Scenario: A block module loads synchronously with the builder's validated fields
    Given a chapter file that exports remark with label "rem:plain" and uses "def:a" and "def:b"
    When it is loaded with loadBlockModuleSync
    Then the loaded kind is "remark" and the label is "rem:plain"
    And its uses are ["def:a", "def:b"]

  @test:scripts/tests/block-walk-verify.test.ts::loadBlockModuleSync::a_module_whose_default_export_is_not_a_block_returns_undefined
  Scenario: A module whose default export is not a block loads as undefined
    Given a chapter file whose default export is a plain object of kind "casserole"
    When it is loaded with loadBlockModuleSync
    Then the result is undefined

  @test:scripts/tests/block-walk-verify.test.ts::the_textual_read_and_the_module_disagree::a_computed_label_is_invisible_to_the_regex_and_found_by_the_loader
  Scenario: A computed label is missed by the regex and found by the loader
    Given a remark whose label is the constant LBL holding "rem:computed"
    When it is read by readBlockManifest, by loadBlockModuleSync and by a verifying walk
    Then readBlockManifest returns undefined
    And the loader's label is "rem:computed"
    And the verifying walk yields "rem:computed"

  @test:scripts/tests/block-walk-verify.test.ts::the_textual_read_and_the_module_disagree::an_earlier_`label:`_makes_the_regex_return_the_WRONG_label
  Scenario: An earlier label key makes the regex return the wrong label
    Given a file that declares an object with label "not-the-block" before the remark labelled "rem:real"
    When it is read by readBlockManifest, by loadBlockModuleSync and by a verifying walk
    Then readBlockManifest's label is "not-the-block"
    And the loader's label is "rem:real"
    And the verifying walk yields "rem:real" and not "not-the-block"

  @test:scripts/tests/block-walk-verify.test.ts::the_textual_read_and_the_module_disagree::a_label_the_schema_rejects_is_reported_instead_of_being_yielded_as_a_node
  Scenario: A label the schema rejects is reported as a load failure and still walked
    Given a remark labelled "remark:x", a prefix the builder rejects
    When it is read by readBlockManifest, loaded, and walked with verification
    Then readBlockManifest's label is "remark:x"
    And loading it throws
    And the walk's load-failure callback names the file
    And the walk still yields that file, with label "remark:x"

  @test:scripts/tests/block-walk-verify.test.ts::verification_does_not_widen_what_gets_executed::a_.ts_that_is_not_a_block_manifest_is_never_imported
  Scenario: A .ts file that is not a block manifest is never imported
    Given a helper .ts file in the chapter that writes a marker file when executed
    When the blocks are walked with verification
    Then the helper is not among the walked files
    And the marker file was never written

  @test:scripts/tests/block-walk-verify.test.ts::verification_does_not_widen_what_gets_executed::the_#125_shape_—_a_builder_inside_a_template_literal_—_is_not_imported
  Scenario: A builder call inside a template literal is not imported
    Given a script whose template literal contains a remark call labelled "rem:x" and which writes a marker when run
    When the blocks are walked with verification
    Then the marker file was never written
    And "rem:x" is not among the walked labels

  @test:scripts/tests/block-walk-verify.test.ts::verification_is_the_default,_and_`verify:_false`_is_the_escape_hatch::the_default_verifies
  Scenario: Walking verifies by default
    Given the chapter fixtures written by the earlier tests
    When the blocks are walked with no verify option
    Then the labels include "rem:real" and "rem:computed"
    And they do not include "not-the-block"

  @test:scripts/tests/block-walk-verify.test.ts::verification_is_the_default,_and_`verify:_false`_is_the_escape_hatch::`verify:_false`_restores_the_source-text_reading
  Scenario: verify false restores the source-text reading
    Given the chapter fixtures written by the earlier tests
    When the blocks are walked with verify false
    Then the labels include "not-the-block"
    And they do not include "rem:computed"
