# scripts/mount-instance-docs.ts reads a built layer's _data/harness.json (its icon row, rail
# scopes and names) where sync-docs-harness.ts wrote it: the layer's output root when the
# checkout mounts it. Each Scenario names the test that executes it.
Feature: The rail pass reads a mounted layer's harness data from its output root

  @test:scripts/tests/harness-data-path.test.ts::harnessDataPath_—_where_a_built_layer's_harness_data_is_read::a_mounted_layer's_data_written_at_its_output_root_is_read_there,_not_from_the_mount
  Scenario: A mounted layer's harness data at its output root is read there
    Given a checkout whose lock mounts "layer" at "layer/"
    And its harness data written at the layer's output root
    Then the harness data for "layer/docs" is read from the output root, not the mount

  @test:scripts/tests/harness-data-path.test.ts::harnessDataPath_—_where_a_built_layer's_harness_data_is_read::with_nothing_at_the_output_root,_the_pinned_copy_in_the_mount_is_read
  Scenario: With nothing at the output root the pinned copy is read
    Given a checkout whose lock mounts "layer" at "layer/"
    Then the harness data for "layer/docs" is read from the mount

  @test:scripts/tests/harness-data-path.test.ts::harnessDataPath_—_where_a_built_layer's_harness_data_is_read::a_layer_the_checkout_does_not_mount_is_read_in_place
  Scenario: A layer the checkout does not mount is read in place
    Given a checkout with no lock
    Then the harness data for "layer/docs" is read in place
