# Specifies gutsDir, gutsFiles and page (scripts/gen-fsh-guts-viz.ts) over the
# checkout's real fsh-guts directory.
Feature: The fsh-guts page over the real directory declares every upload and ignores untracked files

  @test:test/coordinator/fsh-guts-viz-checkout.test.ts::corpus_—_the_real_directory,_so_a_regression_cannot_pass_on_fixtures::no_archived_source_reads_as_undeclared,_and_no_title_is_binary
  Scenario: No archived upload is undeclared and no title is binary
    Given the files of the checkout's fsh-guts directory
    When the files in the "uploads" group are taken
    Then there is at least one
    And none is in the state "undeclared"
    And no file's title contains the replacement character

  @test:test/coordinator/fsh-guts-viz-checkout.test.ts::corpus_—_the_real_directory,_so_a_regression_cannot_pass_on_fixtures::a_stray_untracked_file_in_the_mount_does_not_change_the_page
  Scenario: An untracked file in the directory changes neither the file list nor the page
    Given the files and the page of the checkout's fsh-guts directory
    When an untracked JSON file is written under its logs/ directory
    Then the file list is unchanged
    And the page is unchanged
    And the stray file is removed afterwards
