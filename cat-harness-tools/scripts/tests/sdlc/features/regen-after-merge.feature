# scripts/regen-after-merge.ts (bun run cat regen) pairs each workflow gate with its writer,
# reruns stale writers to a fixpoint and reports a distinct verdict and exit code for each state.
# Each Scenario names the test that executes it.
Feature: Regenerate artefacts after a merge by asking the gates

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::the_pair_is_READ,_never_assumed::`X:check`_pairs_with_`X`_when_`X`_exists
  Scenario: A ":check" script pairs with its writer when the writer exists
    Given the repository's script table
    When the writer is looked up for "voices:viz:check" and "kg:audit:check"
    Then they are "voices:viz" and "kg:audit"

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::the_pair_is_READ,_never_assumed::a_check_whose_writer_does_NOT_exist_returns_undefined,_not_a_guess
  Scenario: A check whose writer does not exist has no writer
    Given a script table holding only "thing:check"
    When the writer is looked up for "thing:check"
    Then it is undefined

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::the_pair_is_READ,_never_assumed::a_script_that_is_not_a_`:check`_has_no_writer
  Scenario: A script that is not a check has no writer
    Given the repository's script table
    When the writer is looked up for "lint"
    Then it is undefined

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::only_a_gate_that_runs_EXACTLY_one_script_is_repairable::a_plain_`bun_run_X`_yields_X
  Scenario: A plain "bun run cat X" command yields the script X
    Given the commands "bun run cat voices:viz:check" and a padded "bun run cat kg:audit:check"
    When the script is read from each
    Then they are "voices:viz:check" and "kg:audit:check"

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::only_a_gate_that_runs_EXACTLY_one_script_is_repairable::anything_else_yields_undefined_rather_than_a_partial_match
  Scenario: Any other command yields no script
    Given a compound "bun run a && bun run b", "bun test", a bunx tsc command and "bun run gen-voices-viz.ts --check"
    When the script is read from each
    Then each is undefined

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::the_set_comes_from_the_WORKFLOW,_not_from_package.json::it_finds_a_real,_non-empty_set
  Scenario: The repairable set read from the workflow is non-empty
    Given the gates loaded from this repository's workflows
    When they are paired with writers from the script table
    Then more than 10 pairs are found

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::the_set_comes_from_the_WORKFLOW,_not_from_package.json::...and_a_STRICT_subset_of_package.json's_check_scripts
  Scenario: The repairable set is a strict subset of the check scripts
    # Gap: membership is checked only for pairs that have a writer
    Given the repairable pairs from this repository's workflows
    And every script ending ":check" or named in WRITER_OVERRIDES
    Then there are fewer pairs than check scripts
    And every pair with a writer names one of those check scripts

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::the_set_comes_from_the_WORKFLOW,_not_from_package.json::every_pair_it_reports_as_repairable_has_a_writer_that_exists
  Scenario: Every repairable pair's writer is a real script
    Given the repairable pairs from this repository's workflows
    Then every writer named by a pair exists in the script table

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::the_set_comes_from_the_WORKFLOW,_not_from_package.json::the_voices_check_—_the_one_that_broke_main_—_is_in_the_set
  Scenario: The voices check is in the repairable set
    Given the repairable pairs from this repository's workflows
    Then "voices:viz:check" is among the checks
    And its writer is "voices:viz"

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::the_set_comes_from_the_WORKFLOW,_not_from_package.json::a_gate_listed_twice_is_offered_once
  Scenario: A gate listed twice is offered once
    Given the repairable pairs from this repository's workflows
    Then no check name appears twice

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::a_check_with_no_writer_is_REPORTED,_never_skipped::it_is_carried_through_as_a_pair_with_an_undefined_writer
  Scenario: A check with no writer is carried through with an undefined writer
    Given gates running "orphan:check" and "voices:viz:check"
    When they are paired with writers from the script table
    Then the pairs are for "orphan:check" and "voices:viz:check" in that order
    And the "orphan:check" writer is undefined
    And the "voices:viz:check" writer is "voices:viz"

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::a_writer_that_is_not_<check_minus_:check>_is_DECLARED_(bean_eowd)::translate-bpmn:check_is_repaired_by_the_script_that_writes,_not_the_one_that_reports
  Scenario: translate-bpmn:check is repaired by its extracting script
    Given the repository's script table
    When the writer is looked up for "translate-bpmn:check"
    Then it is "translate-bpmn:extract"
    And that script contains "--extract"

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::a_`check:X`_gate_is_paired_only_by_DECLARATION_—_bean_`uju6`::`check:prov-qaqc`_is_repaired_by_`prov:qaqc`
  Scenario: check:prov-qaqc is paired with prov:qaqc by declaration
    Given the repository's script table
    When the writer is looked up for "check:prov-qaqc"
    Then it is "prov:qaqc"
    And a gate running "bun run cat check:prov-qaqc" yields exactly that pair

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::regen_runs_to_a_FIXPOINT,_not_one_pass_—_bean_`14ve`::one_pass_leaves_A_stale;_the_fixpoint_leaves_every_check_current
  Scenario: The fixpoint repairs a check left stale by one pass
    Given a tree where writer b's output feeds check a, and a is asked first
    When regen runs to a fixpoint with the default cap
    Then it settles after 3 passes
    And a's output equals b's output
    And both pairs are reported "regenerated"

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::regen_runs_to_a_FIXPOINT,_not_one_pass_—_bean_`14ve`::a_single_pass_really_does_leave_it_stale_—_the_control
  Scenario: A single pass leaves the dependent check stale
    Given a tree where writer b's output feeds check a, and a is asked first
    When regen runs with a cap of 1 pass
    Then it does not settle
    And a's output differs from b's output

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::regen_runs_to_a_FIXPOINT,_not_one_pass_—_bean_`14ve`::two_writers_that_undo_each_other_stop_at_the_cap_and_say_so
  Scenario: Two writers that undo each other stop at the cap unsettled
    Given a check that always fails and a writer that flips a value
    When regen runs with a cap of 3 passes
    Then it stops after 3 passes
    And it reports not settled

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::UNGATED_INPUTS_—_writers_regen_runs_without_making_them_gates_(bean_5qq3)::every_pair_names_two_scripts_that_exist
  Scenario: Every UNGATED_INPUTS pair names two existing scripts
    Given the UNGATED_INPUTS list and the repository's script table
    Then every check and every writer it names is a defined script

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::UNGATED_INPUTS_—_writers_regen_runs_without_making_them_gates_(bean_5qq3)::an_ungated_input_asked_FIRST_lets_a_dependent_check_settle_in_one_pass
  Scenario: An ungated input asked first lets its dependent check pass in the same run
    # Gap: the number of passes is not asserted
    Given library:viz writes the input methodologies:viz:check reads, and library:viz is asked first
    When regen runs to a fixpoint
    Then library:viz:check is "regenerated"
    And methodologies:viz:check is "current"

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::the_derivation_finds_the_writers_a_merge_stales_—_bean_`g5kt`::%s_is_derived,_with_%s_as_its_writer
  Scenario: Each measured check is derived with its measured writer
    Given the repairable pairs from all of this repository's gates
    When the pair for each measured check is found
    Then it exists and its writer is the measured one
    And the rows are readme:subgraphs:check / readme:subgraphs, check:term-mapping / term:mapping, docs:harness:check / docs:harness and skill:register:check / skill:register

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::the_derivation_finds_the_writers_a_merge_stales_—_bean_`g5kt`::a_writer_added_to_package.json_appears_with_NO_list_to_edit
  Scenario: A writer added to the script table pairs with no list to edit
    Given a gate running "bun run brand:new:check"
    When it is paired against scripts that add "brand:new" and "brand:new:check"
    Then the pair is "brand:new:check" with writer "brand:new"
    And against the unmodified scripts the pair has an undefined writer

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::the_derivation_finds_the_writers_a_merge_stales_—_bean_`g5kt`::a_derived_name_that_resolves_to_no_script_is_a_GAP,_never_a_guess
  Scenario: A derived writer name that is not a script is not guessed
    Given the repository's script table has no "glossary" but has "glossary:page"
    When the writer is looked up for "check:glossary"
    Then it is "glossary:page"
    And the writer for "nothing-like-this:check" is undefined

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::a_run_that_did_not_settle_is_NOT_clean_—_bean_`g5kt`::settled_and_clean_exits_0
  Scenario: A settled, clean run exits 0
    Given a run with one "current" result that settled
    When its exit code is computed
    Then it is code 0 with reason "clean"

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::a_run_that_did_not_settle_is_NOT_clean_—_bean_`g5kt`::NOT_settled_exits_non-zero,_even_with_nothing_unrepaired
  Scenario: A run that did not settle exits 2 even with nothing unrepaired
    Given a run with one "current" result that did not settle after 6 passes
    When its exit code is computed
    Then it is code 2 with reason "not-settled"
    And the message contains "COULD NOT DETERMINE" and "6 pass(es)"

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::a_run_that_did_not_settle_is_NOT_clean_—_bean_`g5kt`::a_real_defect_outranks_non-convergence,_because_it_names_checks_to_read
  Scenario: A real defect outranks non-convergence
    Given a run holding an "unrepaired" result
    When its exit code is computed unsettled
    Then the reason is "not-staleness"
    And when settled the code is 1

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::a_run_that_did_not_settle_is_NOT_clean_—_bean_`g5kt`::no-writer_is_a_defect_too,_not_a_shrug
  Scenario: A check with no writer is a defect
    Given a settled run holding a "no-writer" result
    When its exit code is computed
    Then the code is 1

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::a_run_that_did_not_settle_is_NOT_clean_—_bean_`g5kt`::--dry-run_ran_no_writer,_so_it_is_not_judged_on_settling
  Scenario: A dry run is not judged on settling
    Given an unsettled dry run with one "current" result
    When its exit code is computed
    Then it is code 0 with reason "dry-run"

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::a_run_that_did_not_settle_is_NOT_clean_—_bean_`g5kt`::every_reason_maps_to_exactly_one_code_—_the_states_cannot_collapse
  Scenario: Every exit reason maps to exactly one code
    Given clean, unsettled, unrepaired and dry-run runs
    When their exit codes are computed
    Then a reason seen twice always has the same code
    And the reasons seen are "clean", "dry-run", "not-settled" and "not-staleness"

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::the_fixpoint_bound_is_above_the_measured_need_—_bean_`g5kt`::the_default_settles_it
  Scenario: The default pass cap settles a three-deep writer chain
    Given a chain where c's output feeds b and b's feeds a, asked a, b, c
    When regen runs to a fixpoint with the default cap
    Then it settles
    And a's and b's outputs equal c's input

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::the_fixpoint_bound_is_above_the_measured_need_—_bean_`g5kt`::the_OLD_default_of_3_does_not_—_the_control_that_justifies_the_raise
  Scenario: The old cap of 3 does not settle the three-deep chain
    Given a chain where c's output feeds b and b's feeds a, asked a, b, c
    When regen runs with a cap of 3 passes
    Then it stops after 3 passes unsettled
    And its exit code is 2

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::the_fixpoint_bound_is_above_the_measured_need_—_bean_`g5kt`::`not_settled`_means_UNVERIFIED,_which_is_why_it_cannot_be_read_as_stale_either
  Scenario: An unsettled run is reported not-settled even when the tree happens to be repaired
    Given a chain where c's output feeds b and b's feeds a, asked a, b, c
    When regen runs with a cap of 3 passes
    Then a's output equals c's input
    And the run is not settled
    And its exit reason is "not-settled"

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::the_fixpoint_bound_is_above_the_measured_need_—_bean_`g5kt`::a_chain_one_deeper_than_the_measurement_is_genuinely_stale_at_the_old_cap
  Scenario: A four-deep chain is genuinely stale at the old cap and settles at the default
    Given a chain four writers deep, asked a, b, c, d
    When regen runs with a cap of 3 passes
    Then it is not settled and a's output still differs from d's input
    And when run again with the default cap it settles with a's output equal to d's input

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::the_fixpoint_bound_is_above_the_measured_need_—_bean_`g5kt`::DEFAULT_MAX_PASSES_admits_more_writer_passes_than_the_deepest_chain_measured
  Scenario: The default pass cap admits more than three writer passes
    Given DEFAULT_MAX_PASSES
    Then DEFAULT_MAX_PASSES minus one is greater than 3

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::the_fixpoint_bound_is_above_the_measured_need_—_bean_`g5kt`::--max-passes_is_read_from_argv,_and_a_bad_value_is_refused_rather_than_defaulted
  Scenario: --max-passes is read from argv and a bad value is refused
    Given argv "--max-passes 9" or "--max-passes=9"
    When the pass cap is read
    Then it is 9
    And with no flag it is DEFAULT_MAX_PASSES
    And the values "0", "-1", "two" and a missing value each throw an error naming "--max-passes"

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::a_writer_must_WRITE_—_bean_`i1q7`::translate-bpmn:bootstrap_is_the_convention_writer,_and_it_extracts_when_run_bare
  Scenario: translate-bpmn:bootstrap is the convention writer and carries --extract
    # Gap: the writer is not run; only its script text is checked
    Given the repository's script table
    When the writer is looked up for "translate-bpmn:bootstrap:check"
    Then it is "translate-bpmn:bootstrap"
    And that script contains "--extract"

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::a_writer_must_WRITE_—_bean_`i1q7`::check:published-instance-exports_is_repaired_by_re-exporting_the_bootstrap_instance
  Scenario: check:published-instance-exports is repaired by re-exporting the bootstrap instance
    Given the repository's script table
    When the writer is looked up for "check:published-instance-exports"
    Then it is "kg:export:bootstrap"
    And that script ends with kg-export.ts --instance ./bootstrap

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::a_writer_must_WRITE_—_bean_`i1q7`::a_writer_that_exits_non-zero_is_reported_`writer-failed`,_not_as_a_defect_in_the_tree
  Scenario: A writer that exits non-zero is reported writer-failed
    Given a failing check "x:check" whose writer "x" fails
    When one regen pass runs
    Then the only result is "x:check" with writer "x" and outcome "writer-failed"

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::a_writer_must_WRITE_—_bean_`i1q7`::a_writer_that_exits_0_and_changes_nothing_stays_`unrepaired`
  Scenario: A writer that succeeds but changes nothing leaves the check unrepaired
    Given a check "x:check" that always fails and a writer "x" that succeeds
    When one regen pass runs
    Then the outcome is "unrepaired"

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::the_default_asks_the_WHOLE_gate_set_—_bean_`i1q7`,_item_3::without_a_browser,_a_browser-job_failure_is_`no-browser`,_and_a_fast-set_failure_keeps_its_verdict
  Scenario: Without a browser, browser-job failures become no-browser and fast-set verdicts stand
    Given results: render:bpmn:check unrepaired, voices:viz:check unrepaired, bat:sync:check regenerated
    And a fast set holding only voices:viz:check
    When they are relabelled with no browser available
    Then the outcomes are "no-browser", "unrepaired" and "regenerated"
    And with a browser available the results are unchanged

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::regen_can_repair_what_trains_2_and_3_could_not_—_bean_wczm::%s_is_a_gate_regen_asks,_and_%s_is_its_writer
  Scenario: A gate that merge trains could not repair is asked by regen with its writer
    Given the repairable pairs from this repository's workflows
    When the pair for the row's check is found
    Then it equals the check with the row's writer
    And the writer is a defined script
    And the only row is check:l1-complete:check with writer l1-complete:write

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::a_NEW_outcome_cannot_quietly_become_clean_—_bean_`g5kt`_x_`i1q7`::%s_%s
  Scenario: Each outcome is either clean or not by declaration
    Given a settled run holding one result with the row's outcome
    When its exit code is computed
    Then "current", "regenerated" and "judged" exit 0
    And "unrepaired", "no-writer", "writer-failed" and "no-browser" exit non-zero

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::a_NEW_outcome_cannot_quietly_become_clean_—_bean_`g5kt`_x_`i1q7`::a_run_holding_only_clean_outcomes_is_clean
  Scenario: A run holding only clean outcomes is clean
    Given a settled run with a "current" and a "regenerated" result
    When its exit code is computed
    Then it is code 0 with reason "clean"

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::a_NEW_outcome_cannot_quietly_become_clean_—_bean_`g5kt`_x_`i1q7`::no-browser_keeps_i1q7's_exit_code,_but_is_not_called_a_defect_in_the_tree
  Scenario: no-browser exits 1 but is not called a defect in the tree
    Given a settled run holding a "no-browser" result for render:bpmn:check
    When its exit code is computed
    Then the code is 1
    And the message contains "COULD NOT BE DETERMINED" and "render:bpmn:check"
    And the message does not contain "cannot fix a defect"

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::a_NEW_outcome_cannot_quietly_become_clean_—_bean_`g5kt`_x_`i1q7`::a_real_defect_and_a_missing_browser_in_one_run_are_reported_as_BOTH,_not_as_one
  Scenario: A real defect and a missing browser are both reported
    Given a settled run holding an "unrepaired" and a "no-browser" result
    When its exit code is computed
    Then the code is 1
    And the message contains both "cannot fix a defect" and "COULD NOT BE DETERMINED"

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::a_caller_holding_only_regen's_exit_CODE_is_told_the_truth_(task_#62)::exit_2_is_COULD_NOT_DETERMINE,_and_says_regen_reported_no_unrepaired_check
  Scenario: Exit 2 means could not determine with no unrepaired check
    When regen exit code 2 is decoded
    Then the verdict is "not-settled" and not determined
    And the explanation contains "COULD NOT DETERMINE" and "NO unrepaired check"

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::a_caller_holding_only_regen's_exit_CODE_is_told_the_truth_(task_#62)::exit_1_does_not_name_ONE_kind,_because_the_code_cannot_tell_them_apart
  Scenario: Exit 1 names all four failure kinds
    When regen exit code 1 is decoded
    Then the verdict is "not-staleness" and determined
    And the explanation names "unrepaired", "no-writer", "writer-failed" and "no-browser"

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::a_caller_holding_only_regen's_exit_CODE_is_told_the_truth_(task_#62)::an_exit_outside_regen's_own_three_verdicts_is_a_CRASH,_not_a_measurement
  Scenario: An exit code outside regen's verdicts is a crash
    When regen exit codes 3, 127 and 137 are decoded
    Then each verdict is "crashed" and not determined
    And each explanation contains the code and "nothing was measured"

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::a_caller_holding_only_regen's_exit_CODE_is_told_the_truth_(task_#62)::a_signal_(status_null)_is_a_crash_too,_and_does_not_read_as_code_0
  Scenario: A null status from a signal is a crash
    When a null regen exit status is decoded
    Then the verdict is "crashed" and not determined
    And the explanation contains "on a signal"

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::a_caller_holding_only_regen's_exit_CODE_is_told_the_truth_(task_#62)::exit_0_is_the_only_clean_verdict
  Scenario: Exit 0 is the clean verdict
    When regen exit code 0 is decoded
    Then the verdict is "clean" and determined

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::a_caller_holding_only_regen's_exit_CODE_is_told_the_truth_(task_#62)::every_code_exitCodeFor_can_return_decodes_to_the_reason_that_produced_it
  Scenario: Every code exitCodeFor returns decodes back to its reason
    Given a clean run, an unrepaired run and an unsettled run
    When each exit code is computed and then decoded
    Then the verdicts are "clean", "not-staleness" and "not-settled" respectively

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::a_caller_holding_only_regen's_exit_CODE_is_told_the_truth_(task_#62)::merge-base_composes_its_abort_from_the_TAG,_not_from_matched_prose
  Scenario: merge-base and merge-main-comment use the regen verdict tag
    Given the source of scripts/merge-base.ts and scripts/merge-main-comment.ts
    Then merge-base.ts contains "REGEN_VERDICT_TAG" and "regenExitMeaning"
    And merge-base.ts does not contain "regen reported unrepaired checks)"
    And merge-main-comment.ts contains "REGEN_VERDICT_TAG"
    And REGEN_VERDICT_TAG is "regen-verdict:"

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::judge-mode_pairs_are_distinguished_from_artefact_staleness_checks_—_bean_loxz::audit:coverage:strict_and_audit:coverage:require-all_are_declared_in_NO_WRITER
  Scenario: The audit coverage judge checks are declared in NO_WRITER
    Given the NO_WRITER map
    Then "audit:coverage:strict" and "audit:coverage:require-all" are each declared
    And each reason contains "judge-mode baseline check"

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::judge-mode_pairs_are_distinguished_from_artefact_staleness_checks_—_bean_loxz::JUDGE_CHECKS_and_isJudgeCheck_identify_judge-mode_gates
  Scenario: JUDGE_CHECKS and isJudgeCheck agree on judge-mode gates
    Given JUDGE_CHECKS
    Then every listed check is a judge check
    And "audit:coverage:strict" and "audit:coverage:require-all" are judge checks
    And "voices:viz:check" is not
    And "custom:check" is a judge check when its pair is flagged judge

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::judge-mode_pairs_are_distinguished_from_artefact_staleness_checks_—_bean_loxz::a_judge-mode_check_that_passes_is_reported_as_'judged',_NEVER_'current'
  Scenario: A passing judge-mode check is reported judged, not current
    Given a judge-flagged pair for "audit:coverage:strict" whose check passes
    When one regen pass runs
    Then the only result's outcome is "judged" and not "current"

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::judge-mode_pairs_are_distinguished_from_artefact_staleness_checks_—_bean_loxz::a_run_holding_passing_judge-mode_checks_yields_clean_exit_0_with_outcome_'judged'
  Scenario: Passing judge-mode checks give a clean exit with outcome judged
    Given a judge-flagged pair for "audit:coverage:strict" and a runner where everything passes
    When regen runs to a fixpoint
    Then it settles with one result whose outcome is "judged"
    And its exit is code 0 with reason "clean"

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::judge-mode_pairs_are_distinguished_from_artefact_staleness_checks_—_bean_loxz::a_stale_artefact_for_a_judge-mode_pair_is_NOT_reported_as_current
  Scenario: A known judge check is reported judged even without the judge flag
    # Gap: no stale artefact is modelled; the check simply passes
    Given a pair for "audit:coverage:strict" with no judge flag and a runner where everything passes
    When regen runs to a fixpoint
    Then the outcome is "judged" and not "current"

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::judge-mode_pairs_are_distinguished_from_artefact_staleness_checks_—_bean_loxz::audit-coverage_in_writer_mode_refuses_to_write_sidecar_when_undetermined_graphs_exist
  Scenario: audit-coverage source refuses to write its sidecar when graphs are undetermined
    # Gap: the refusal is not run; only the source text is checked
    Given the source of scripts/audit-coverage.ts
    Then it contains "Refusing to write audit-coverage.qa-results.json"
    And it contains "undet.length > 0"

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::regen_mounts_the_branch-kept_graphs_before_it_grades::by_default
  Scenario: regen mounts first by default
    Given argv for regen-after-merge.ts, with and without "--dry-run --fast"
    When whether to mount first is decided
    Then it is true in both cases

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::regen_mounts_the_branch-kept_graphs_before_it_grades::not_with_--no-mount
  Scenario: regen does not mount with --no-mount
    Given argv for regen-after-merge.ts with "--no-mount"
    When whether to mount first is decided
    Then it is false

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::regen_mounts_the_branch-kept_graphs_before_it_grades::merge:main,_which_has_just_mounted_against_the_merged_declarations,_passes_--no-mount_on_both_paths
  Scenario: merge:main passes --no-mount to regen on both paths
    Given the regen arguments merge:main builds with no base and with base "abc123"
    When whether to mount first is decided for each
    Then it is false for both
    And the arguments for "abc123" carry "--changed" followed by "abc123"

  @test:scripts/tests/sdlc/regen-after-merge.test.ts::bean_p7mb_—_glossary:check_and_libraries:check_pair_with_their_writers_via_WRITER_OVERRIDES::WRITER_OVERRIDES_maps_glossary:check_to_glossary:export_and_libraries:check_to_libraries:derive
  Scenario: glossary:check and libraries:check pair with their writers via WRITER_OVERRIDES
    Given WRITER_OVERRIDES and the repository's script table
    Then "glossary:check" maps to "glossary:export"
    And "libraries:check" maps to "libraries:derive"
    And writer lookup returns the same two writers
