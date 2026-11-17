# scripts/check-declared-paths.ts scans the harness for hardcoded literals naming declared paths,
# ratcheted against scripts/declared-path-baseline.json and its committed witness list.
# Each Scenario names the test that executes it.
Feature: No file gains a hardcoded path the declaration already names

  @test:scripts/tests/kg/declared-paths.test.ts::declared-path_literals::the_scan_saw_something_—_otherwise_nothing_below_proves_anything
  Scenario: The declared-path scan sees something
    Given the declared-path scan of the harness root
    Then it found more than 5 declared prefixes
    And more than 100 artefact, marked and refused literals together

  @test:scripts/tests/kg/declared-paths.test.ts::declared-path_literals::no_file_exceeds_its_recorded_baseline
  Scenario: No file exceeds its recorded baseline
    Given the committed baseline "scripts/declared-path-baseline.json" exists
    And the refused literals of the scan, leaving out test files and unverifiable witnesses under absent results
    When they are counted per file
    Then no file's count exceeds its baseline count

  @test:scripts/tests/kg/declared-paths.test.ts::declared-path_literals::every_exemption_carries_a_reason
  Scenario: Every exemption carries a reason
    Given the literals marked as exempt by the scan
    Then none has a reason shorter than 10 characters

  @test:scripts/tests/kg/declared-paths.test.ts::declared-path_literals::every_witnessed_literal_still_resolves
  Scenario: Every witnessed literal still resolves
    Given the witness list recorded in the baseline, more than 50 entries long
    When it is compared with the witnesses of the current scan
    Then no recorded witness is lost, apart from unverifiable ones and those under a declared publish-time artefact

  @test:scripts/tests/kg/declared-paths.test.ts::declared-path_literals::a_witness_naming_a_declared_publish-time_artefact_is_held_by_the_declaration
  Scenario: A literal under a declared publish-time artefact is held by the declaration
    Given the harness root
    Then "uml/overview/cat-harness.mmd" is under a built-at-publish declaration
    And "docs/uml/overview/cat-harness.md" is too
    And "schemas/no-such-module.ts" is not

  @test:scripts/tests/kg/declared-paths.test.ts::declared-path_literals::no_literal_names_an_existing_file_the_witness_list_does_not_record
  Scenario: No literal names an existing file the witness list does not record
    Given the recorded witnesses and the witnesses of the current scan
    When the new witnesses are computed
    Then there are none

  @test:scripts/tests/kg/declared-paths.test.ts::declared-path_literals::newWitnesses_names_exactly_the_unrecorded_ones,_in_order
  Scenario: New witnesses are exactly the unrecorded ones, in order
    Given the recorded witnesses "a.ts::nowhere/one.md" and "b.ts::nowhere/two.md"
    Then the same list yields no new witnesses
    And a list adding "c.ts::nowhere/three.md" yields only "c.ts::nowhere/three.md"
    And a list that only drops a witness yields no new witnesses

  @test:scripts/tests/kg/declared-paths.test.ts::declared-path_literals::relocatedWitnesses_pairs_a_lost_witness_with_the_same_literal_in_another_file,_one_to_one
  Scenario: A lost witness pairs one to one with the same literal in another file
    Given the lost witnesses "tools/index.ts::schemas/a.ts" and "tools/index.ts::schemas/b.ts"
    And added witnesses naming "schemas/a.ts" in two other files and "schemas/c.ts" in a third
    When the relocated witnesses are computed
    Then only "tools/index.ts::schemas/a.ts" is paired, with "tools/a/a.ts::schemas/a.ts"
    And a lost "schemas/b.ts" with only an added "schemas/c.ts" pairs with nothing

  @test:scripts/tests/kg/declared-paths.test.ts::declared-path_literals::a_test_file's_unresolved_literals_are_not_counted_as_debt
  Scenario: A test file's unresolved literals are not counted as debt
    Given the baseline's per-file counts
    Then no ".test.ts" file is counted there
    And the scan holds more than 50 refused literals from ".test.ts" files

  @test:scripts/tests/kg/declared-paths.test.ts::declared-path_literals::tests_are_scanned_—_the_exclusion_cost_three_breakages_and_had_no_reason
  Scenario: Test files are scanned
    Given the refused, artefact and marked literals of the scan
    Then more than 100 come from ".test.ts" files

  @test:scripts/tests/kg/declared-paths.test.ts::declared-path_literals::test_literals_naming_real_artefacts_are_checked_to_dereference
  Scenario: Test literals naming real artefacts are checked to dereference
    Given the artefact literals of the scan
    Then more than 20 come from ".test.ts" files

  @test:scripts/tests/kg/declared-paths.test.ts::a_witness_under_an_ABSENT_results_tree_is_unknown,_not_lost_(bean_`c8uq`)::only_a_literal_INSIDE_an_absent_results_directory_qualifies
  Scenario: Only a literal inside an absent results directory qualifies as under absent results
    Given the fixture root "/r" with absent results directories "test/results" and "test/health/results/"
    Then "test/results/kg-qa.manifest.json" is under absent results
    And "test/health/results/example.health-report.json" is under absent results
    And "test/results-old/x.json" is not
    And "processes/x.bpmn" is not

  @test:scripts/tests/kg/declared-paths.test.ts::a_witness_under_an_ABSENT_results_tree_is_unknown,_not_lost_(bean_`c8uq`)::absentResultDirs_names_only_declared_qa/health_directories_that_are_missing
  Scenario: Every absent results directory named is missing from disk
    # Gap: that only declared qa/health directories are named is not checked, and in this checkout the list is normally empty
    Given the harness root
    When its absent declared results directories are listed
    Then none of them exists on disk
