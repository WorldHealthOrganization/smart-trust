# scripts/downstream-runs.ts and schemas/tools/tool-run.ts judge the downstream-tool criterion family:
# the fresh/stale/not-run/failed read of a run record, the per-Tool verdict and the undeclared-tool finding.
# Each Scenario names the test that executes it.
Feature: Downstream tool runs

  @test:scripts/tests/downstream-runs.test.ts::the_three-state_read::fresh_ONLY_for_a_successful_run_over_the_current_inputs
  Scenario: A run is fresh only when it succeeded over the current inputs
    Given a succeeded run record over input fingerprint "a"
    When its state is read against current fingerprint "a"
    Then it is "fresh"
    And against current fingerprint "b" it is "stale"

  @test:scripts/tests/downstream-runs.test.ts::the_three-state_read::no_record_is_NOT-RUN_and_a_failed_run_is_FAILED_—_never_green
  Scenario: No record is not-run and a failed run is failed
    When the state is read with no record
    Then it is "not-run"
    And a failed run over the current fingerprint is "failed"

  @test:scripts/tests/downstream-runs.test.ts::the_three-state_read::an_unknown_fingerprint_matches_nothing,_not_even_another_unknown
  Scenario: An unknown fingerprint matches nothing, not even another unknown
    Given a succeeded run record over the unknown fingerprint
    When its state is read against the unknown fingerprint
    Then it is "stale"

  @test:scripts/tests/downstream-runs.test.ts::the_three-state_read::a_record_round-trips,_and_rewriting_identical_content_is_a_no-op
  Scenario: A run record round-trips through the record store
    # Gap: that rewriting identical content is a no-op is not checked
    Given a run record for tool "x", target "a/b", fingerprint "f" written under a fresh root
    When it is read back
    Then its input fingerprint is "f"
    And listing the runs gives the single path "test/results/tool-runs/x/a/b.tool-run.json"

  @test:scripts/tests/downstream-runs.test.ts::the_per-Tool_verdict::n/a_for_a_Tool_that_declares_no_downstream_output
  Scenario: A Tool that declares no downstream output is n/a
    Given a Tool with no downstream declaration
    When its downstream entry is judged
    Then the result is "n/a"

  @test:scripts/tests/downstream-runs.test.ts::the_per-Tool_verdict::an_output_judged_only_in_the_published_tree_is_UNKNOWN_naming_its_verifier_—_never_pass
  Scenario: An output judged only in the published tree is unknown, naming its verifier
    Given a Tool whose output is judged at "published" by verifier "v", and "v" in the verifier set
    When its downstream entry is judged
    Then the result is "unknown"
    And the first finding names "`v`"

  @test:scripts/tests/downstream-runs.test.ts::the_per-Tool_verdict::...and_FAILS_when_that_verifier_is_not_in_the_set
  Scenario: An output judged in the published tree fails when its verifier is not in the set
    Given a Tool whose output is judged at "published" by verifier "gone", and only "v" in the set
    When its downstream entry is judged
    Then the result is "fail"

  @test:scripts/tests/downstream-runs.test.ts::the_per-Tool_verdict::a_checkout-judged_declaration_with_no_member_reader_cannot_be_judged:_UNKNOWN
  Scenario: A checkout-judged declaration with no member reader is unknown
    Given a Tool "no-member" whose output is judged at "checkout", with no member reader for it
    When its downstream entry is judged
    Then the result is "unknown"

  @test:scripts/tests/downstream-runs.test.ts::a_downstream_tool_with_no_declaration_is_a_finding::a_run_record_naming_an_undeclared_Tool
  Scenario: A run record naming an undeclared Tool is a finding
    Given a run record for tool "ghost" and no declared Tools
    When the undeclared-downstream entry is judged
    Then the result is "fail"
    And a finding names Tool "ghost"

  @test:scripts/tests/downstream-runs.test.ts::a_downstream_tool_with_no_declaration_is_a_finding::a_publish_verifier_naming_an_undeclared_Tool
  Scenario: A publish verifier naming an undeclared Tool is a finding
    Given an existing empty record directory and verifier "v" naming tool "ghost"
    When the undeclared-downstream entry is judged with no declared Tools
    Then a finding is placed at "v"

  @test:scripts/tests/downstream-runs.test.ts::a_downstream_tool_with_no_declaration_is_a_finding::a_member_reader_with_no_declaring_Tool
  Scenario: A member reader with no declaring Tool is a finding
    Given an existing empty record directory, no declared Tools and no verifiers
    When the undeclared-downstream entry is judged
    Then the result is "fail"
    And there is one finding per member reader, in the members' order

  @test:scripts/tests/downstream-runs.test.ts::a_downstream_tool_with_no_declaration_is_a_finding::THIS_repository_declares_every_member_and_every_verifier's_Tool_—_or_says_it_could_not_see_the_records
  Scenario: This repository declares every member and every verifier's Tool, or says it could not see the records
    Given this repository's Tools and publish verifiers
    When the undeclared-downstream entry is judged over the harness root
    Then if the record directory is absent the result is "unknown"
    And otherwise the result is "pass" with no findings

  @test:scripts/tests/downstream-runs.test.ts::records_that_are_not_in_the_checkout_are_UNKNOWN,_never_an_empty_list_(bean_oq1j)::listToolRuns_over_an_unfetched_store_reports_unknown,_not_an_empty_list
  Scenario: Listing runs over an unfetched store reports unknown, not an empty list
    Given a fresh root with no record directory
    When its tool runs are listed
    Then the state is "unknown" with no runs
    And the reason mentions "qa:fetch"

  @test:scripts/tests/downstream-runs.test.ts::records_that_are_not_in_the_checkout_are_UNKNOWN,_never_an_empty_list_(bean_oq1j)::an_EXISTING_empty_directory_is_a_determined_empty
  Scenario: An existing empty record directory is a determined empty
    Given a root whose record directory exists and is empty
    When its tool runs are listed
    Then the state is "hit" with no runs

  @test:scripts/tests/downstream-runs.test.ts::records_that_are_not_in_the_checkout_are_UNKNOWN,_never_an_empty_list_(bean_oq1j)::the_criterion_is_UNKNOWN_when_the_records_were_not_examined,_even_with_nothing_else_wrong
  Scenario: The criterion is unknown when the records were not examined, even with nothing else wrong
    Given a checkout-judged Tool declared for every member reader, and a root with no record directory
    When the undeclared-downstream entry is judged
    Then the result is "unknown"
    And the findings say the records were "not examined"

  @test:scripts/tests/downstream-runs.test.ts::records_that_are_not_in_the_checkout_are_UNKNOWN,_never_an_empty_list_(bean_oq1j)::...and_UNKNOWN_outranks_a_finding_the_other_halves_made
  Scenario: Unknown outranks the findings of the other halves
    Given no declared Tools, no verifiers and a root with no record directory
    When the undeclared-downstream entry is judged
    Then the result is "unknown"
    And there is one finding per member reader plus one more
