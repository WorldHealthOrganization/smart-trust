# qa-verify-moved (bean 5hox): before the moved QA files leave main, every
# working file must be in the qa-reports entry with the same blob. Runs on a
# real fixture repository whose entry is written by publishQa. Each Scenario
# names the test that executes it.
Feature: The moved QA files are verified against their qa-reports entry

  @test:scripts/tests/qa-verify-moved.test.ts::the_inventory::is_every_file_under_the_roots,_counted,_and_nothing_outside_them
  Scenario: The inventory is every file under the roots and nothing outside
    Given two files under "inst/test/results" and one under "inst/test/attestations"
    When the inventory of "inst/test/results" is taken
    Then it counts 2 files, lists both in order, and totals their bytes

  @test:scripts/tests/qa-verify-moved.test.ts::verifyMoved::IDENTICAL:_every_working_file_is_in_the_entry_with_the_same_blob_id
  Scenario: Every working file in the entry with the same blob is identical
    Given the results published at main/<sha>
    When they are verified
    Then the state is "identical" with 2 identical and nothing differing or missing

  @test:scripts/tests/qa-verify-moved.test.ts::verifyMoved::DIFFERS:_an_edited_file_differs_and_a_new_file_is_missing_from_the_entry
  Scenario: An edited file differs and a new file is missing
    Given the results published, then one file edited and a new file written
    When they are verified
    Then the state is "differs", naming the edited file as differing and the new one as missing

  @test:scripts/tests/qa-verify-moved.test.ts::verifyMoved::a_file_only_the_ENTRY_holds_is_reported_as_extra_and_does_not_fail
  Scenario: A file only the entry holds is extra and does not fail
    Given the results published, then one working file deleted
    When they are verified
    Then the state is "identical" with that file reported as extra

  @test:scripts/tests/qa-verify-moved.test.ts::verifyMoved::UNKNOWN,_never_green,_when_the_branch_or_the_entry_is_not_there
  Scenario: A missing branch or entry is unknown
    When verification runs before anything is published
    Then the state is "unknown" with nothing identical
    When the results are published and main/<another sha> is verified
    Then the state is "unknown" with a reason mentioning "MISS"

  @test:scripts/tests/qa-verify-moved.test.ts::verifyMoved::UNKNOWN_when_the_working_tree_holds_nothing_to_compare
  Scenario: An empty working tree is unknown
    Given the results published, then the working results directory removed
    When they are verified
    Then the state is "unknown"

  @test:scripts/tests/qa-verify-moved.test.ts::verifyMoved::a_malformed_ref_is_a_usage_error,_not_an_unknown
  Scenario: A malformed ref is a usage error
    When "refs/heads/main" is verified
    Then it throws a usage error

  @test:scripts/tests/qa-verify-moved.test.ts::the_CLI_exit_codes::0_identical,_1_differs,_2_unknown_on_a_fetch_miss,_3_usage
  Scenario: The CLI exits 0 identical, 1 differs, 2 unknown, 3 usage
    Then verifying before a publish exits as unknown
    And after the publish exits as identical
    And after a file is edited exits as differs
    And with key "nonsense", or with no key, exits as a usage error
