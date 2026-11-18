# publish:check runs the writer in a scratch copy, which must hold every
# authored file and resolve the workspace packages to the layers in the copy.
# Each Scenario names the test that executes it.
Feature: publish:check's scratch copy

  Background:
    Given a source repository with an authored file, a workspace package link to "../../cat-harness", an installed package "zod" and a layer with its own node_modules
    And a scratch copy made of it

  @test:scripts/tests/publish-check-scratch.test.ts::scratchCopy::copies_authored_files
  Scenario: The scratch copy holds the authored files
    Then the copy's "cat-harness/docs/a.svg" reads "<svg/>"
    And the copy has a package.json

  @test:scripts/tests/publish-check-scratch.test.ts::scratchCopy::a_workspace_package_resolves_to_the_layer_in_the_copy
  Scenario: A workspace package resolves to the layer in the copy
    Then the copy's link "node_modules/@litlfred/cat-harness" reads "../../cat-harness"
    And it resolves to the copy's "cat-harness" directory

  @test:scripts/tests/publish-check-scratch.test.ts::scratchCopy::installed_packages_are_linked_to_the_original,_not_copied
  Scenario: Installed packages are linked to the original, not copied
    Then the copy's "node_modules/zod" is a symlink to the original's "node_modules/zod"
    And the copy's "layer/node_modules" is a symlink

  @test:scripts/tests/publish-check-scratch.test.ts::scratchCopy::writing_in_the_copy_leaves_the_original_alone
  Scenario: Writing in the copy leaves the original alone
    When the copy's "cat-harness/docs/a.svg" is overwritten
    Then the original's file still reads "<svg/>"

  @test:scripts/tests/publish-check-scratch.test.ts::scratchCopy_that_fails_partway::removes_its_partial_copy_and_rethrows,_leaving_os.tmpdir()_clean
  Scenario: A copy that fails partway removes itself and rethrows
    Given a source holding a file and, after it, a FIFO that cannot be copied
    And TMPDIR pointed at an empty directory
    When a scratch copy is made of it
    Then it throws
    And the temporary directory is left empty
