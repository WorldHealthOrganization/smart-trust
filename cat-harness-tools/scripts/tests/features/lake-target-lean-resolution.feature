# A Lean reference a block cites is classified against the Lake build
# targets: built, sibling_only, dangling, or unknown when Lake is unreachable;
# the audit rolls those classes up. Each Scenario names the test that executes it.
Feature: Lean references resolved against Lake build targets

  @test:scripts/tests/lake-target-lean-resolution.test.ts::lake-target-lean-resolution::classifyLeanRefTarget::resolving_built_refs_that_land_in_Lake_build_targets_via_targetModules
  Scenario: A reference inside a declared target module is built
    Given the target modules QOU.FluidDynamics and QOU.Core.Algebra
    When a reference to a declaration in one of them is classified, with or without the package prefix, nested or not
    Then each is "built"

  @test:scripts/tests/lake-target-lean-resolution.test.ts::lake-target-lean-resolution::classifyLeanRefTarget::resolving_built_refs_that_land_in_Lake_build_targets_via_lakefile.toml_and_source_tree
  Scenario: A reference is built when a lakefile.toml library holds its source file
    Given a lakefile.toml declaring the lean_lib QOU and the file QOU/FluidDynamics.lean declaring q_bkm_criterion
    When qou:QOU.FluidDynamics.q_bkm_criterion is classified against that Lake root
    Then it is "built"

  @test:scripts/tests/lake-target-lean-resolution.test.ts::lake-target-lean-resolution::classifyLeanRefTarget::resolving_built_refs_that_land_in_Lake_build_targets_via_lakefile.lean
  Scenario: A reference is built when a lakefile.lean library holds its source file
    Given a lakefile.lean declaring lean_lib Solo and the file Solo/Intro.lean
    When Solo:Solo.Intro.my_definition is classified against that Lake root
    Then it is "built"

  @test:scripts/tests/lake-target-lean-resolution.test.ts::lake-target-lean-resolution::classifyLeanRefTarget::resolving_built_refs_via_compiled_.olean_module_target
  Scenario: A reference is built when a compiled .olean exists for its module
    Given a lakefile.toml for MyPkg and only .lake/build/lib/MyPkg/Compiled.olean, with no source
    When my_pkg:MyPkg.Compiled.some_lemma is classified
    Then it is "built"

  @test:scripts/tests/lake-target-lean-resolution.test.ts::lake-target-lean-resolution::classifyLeanRefTarget::resolving_sibling_only_refs_that_exist_only_in_chapter_directory_.lean_files_but_are_not_in_Lake_targets
  Scenario: A reference held only by a chapter-directory .lean file is sibling_only
    Given the target module QOU.FluidDynamics and the chapter file UncompiledSibling.lean
    When qou:UncompiledSibling.intro_statement is classified
    Then it is "sibling_only"

  @test:scripts/tests/lake-target-lean-resolution.test.ts::lake-target-lean-resolution::classifyLeanRefTarget::resolving_sibling_only_refs_via_on-disk_chapter_directory_file
  Scenario: A chapter-directory file found on disk beside the Lake root makes a reference sibling_only
    Given a Lake root paper/lean with the QOU library and a chapter file paper/chapters/01/IntroSibling.lean
    When qou:IntroSibling.intro_thm is classified against that Lake root
    Then it is "sibling_only"

  @test:scripts/tests/lake-target-lean-resolution.test.ts::lake-target-lean-resolution::classifyLeanRefTarget::detecting_dangling_refs_that_resolve_nowhere
  Scenario: A reference that resolves nowhere dangles
    Given target modules and chapter files that do not hold Ghost
    When qou:Ghost.nowhere and the empty reference qou: are classified
    Then both are "dangling"

  @test:scripts/tests/lake-target-lean-resolution.test.ts::lake-target-lean-resolution::classifyLeanRefTarget::third-state_unknown_when_Lake_environment_is_unreachable
  Scenario: An unreachable Lake environment classifies a reference as unknown
    When a reference is classified with neither target modules nor a Lake root
    And when it is classified with a Lake root that does not exist
    And when it is classified with a Lake root that holds no lakefile.toml or lakefile.lean
    Then each classification is "unknown"

  @test:scripts/tests/lake-target-lean-resolution.test.ts::lake-target-lean-resolution::auditLakeTargetLeanResolution::vacuity_guard_when_0_blocks/refs_exist
  Scenario: An audit with no blocks is unknown under the vacuity guard
    When the audit runs over an explicit empty block list, and over a directory with no block files
    Then each result is "unknown" with a finding naming the vacuity guard

  @test:scripts/tests/lake-target-lean-resolution.test.ts::lake-target-lean-resolution::auditLakeTargetLeanResolution::returns_unknown_when_Lake_environment_is_unreachable_in_audit
  Scenario: The audit is unknown when the Lake root is missing
    Given one block citing a Lean reference and a Lake root that does not exist
    When the audit runs
    Then the result is "unknown" and the finding says the root is missing or unreadable

  @test:scripts/tests/lake-target-lean-resolution.test.ts::lake-target-lean-resolution::auditLakeTargetLeanResolution::reports_pass_when_all_refs_land_in_Lake_build_targets
  Scenario: The audit passes when every reference lands in a build target
    Given two blocks whose references both lie in the target modules
    When the audit runs
    Then the result is "pass" with no findings

  @test:scripts/tests/lake-target-lean-resolution.test.ts::lake-target-lean-resolution::auditLakeTargetLeanResolution::reports_fail_with_advisory_findings_when_sibling_only_and_dangling_refs_are_present
  Scenario: Sibling-only and dangling references fail the audit, one finding each
    Given a built reference, a reference held only by a chapter file, and a reference resolving nowhere
    When the audit runs
    Then the result is "fail" with two findings
    And the first is at thm:intro and names the chapter directory sibling
    And the second is at thm:ghost and says it dangles
