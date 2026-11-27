# scripts/post-merge-regen.ts re-asks every derived check after a merge to main, runs each stale
# check's writer, and opens a reviewable repair PR; outputs built at publish are never stale.
# Each Scenario names the test that executes it.
Feature: Post-merge regeneration and repair PRs

  @test:scripts/tests/sdlc/post-merge-regen.test.ts::post-merge-regen_pipeline_(bean_folio-assistant-ey1c)::NEGATIVE_CONTROL:_clean_main_tree_triggers_0_repairs::when_all_verify/write_pairs_pass,_report_is_clean_with_0_repairs_and_no_PR_opened
  Scenario: A clean main tree triggers no repairs and opens no PR
    Given every verify/write pair's check passes
    When the post-merge regen runs with PR creation on
    Then the report is clean with no stale, repaired, unrepaired or writerless checks and no changed files
    And no PR is opened, the exit code is 0 and the summary says "Clean (negative control)"
    And no branch is created, nothing is committed or pushed and no PR is created

  @test:scripts/tests/sdlc/post-merge-regen.test.ts::post-merge-regen_pipeline_(bean_folio-assistant-ey1c)::NEGATIVE_CONTROL:_clean_main_tree_triggers_0_repairs::when_writers_run_but_leave_no_changed_files,_report_is_clean_with_no_PR_opened
  Scenario: Writers that leave no changed files give a clean report and no PR
    Given readme:subgraphs:check fails at first and passes after its writer runs, and git shows no changed files
    When the post-merge regen runs with PR creation on
    Then the report is clean, opens no PR and exits 0
    And the summary says "0 changed files"
    And no PR is created

  @test:scripts/tests/sdlc/post-merge-regen.test.ts::post-merge-regen_pipeline_(bean_folio-assistant-ey1c)::POSITIVE_DETECTION:_stale_derived_artefact_identifies_exact_repair_diff_and_targets_repair_PR::stale_derived_check_triggers_writer,_detects_changed_file,_and_creates_repair_PR
  Scenario: A stale derived check runs its writer, finds the changed file and opens a repair PR
    Given readme:subgraphs:check fails until readme:subgraphs runs, which changes uploads/README.md
    When the post-merge regen runs at commit 8688288494a… with PR creation on
    Then the report is repaired, with readme:subgraphs:check stale and repaired and nothing unrepaired
    And the changed files are uploads/README.md and the repair branch is "automation/post-merge-regen-8688288494"
    And PR #1946 is opened at its URL and the exit code is 0
    And git creates the branch, commits "fix(derived): regenerate post-merge derived artefacts (readme:subgraphs:check)" and pushes the branch, in that order
    And the PR goes from the repair branch to main, its title names the check and its body names folio-assistant-ey1c and the changed file

  @test:scripts/tests/sdlc/post-merge-regen.test.ts::post-merge-regen_pipeline_(bean_folio-assistant-ey1c)::POSITIVE_DETECTION:_stale_derived_artefact_identifies_exact_repair_diff_and_targets_repair_PR::does_not_open_duplicate_PR_if_PR_already_exists_for_the_branch
  Scenario: No duplicate PR is opened when one is already open for the branch
    Given a stale readme:subgraphs:check repaired by its writer, and PR #1946 already open for the repair branch
    When the post-merge regen runs with PR creation on
    Then the report is repaired with PR number 1946
    And no PR is opened or created
    And the summary says "PR #1946 already open"

  @test:scripts/tests/sdlc/post-merge-regen.test.ts::post-merge-regen_pipeline_(bean_folio-assistant-ey1c)::dry-run_and_check-only_semantics::--dry-run_reports_stale_checks_and_generated_payload_without_modifying_git_or_creating_PR
  Scenario: A dry run reports stale checks and the PR payload without touching git or opening a PR
    Given readme:subgraphs:check fails and every other check passes
    When the post-merge regen runs as a dry run with PR creation on
    Then the report is stale, naming readme:subgraphs:check
    And it carries a PR payload whose title names the check
    And no PR is opened, the exit code is 0, git is untouched and no PR is created

  @test:scripts/tests/sdlc/post-merge-regen.test.ts::post-merge-regen_pipeline_(bean_folio-assistant-ey1c)::dry-run_and_check-only_semantics::--check-only_exits_1_when_stale_derived_checks_are_found
  Scenario: Check-only exits 1 when stale derived checks are found
    Given readme:subgraphs:check fails and every other check passes
    When the post-merge regen runs check-only
    Then the report is stale with exit code 1, naming readme:subgraphs:check
    And the summary says "Check-only: detected 1 stale check(s)"

  @test:scripts/tests/sdlc/post-merge-regen.test.ts::post-merge-regen_pipeline_(bean_folio-assistant-ey1c)::dry-run_and_check-only_semantics::--check-only_exits_0_when_all_derived_checks_are_clean
  Scenario: Check-only exits 0 when all derived checks are clean
    Given every check passes
    When the post-merge regen runs check-only
    Then the report is clean with exit code 0 and no stale checks

  @test:scripts/tests/sdlc/post-merge-regen.test.ts::post-merge-regen_pipeline_(bean_folio-assistant-ey1c)::honest_reporting_on_defects_and_unrepaired_checks::check_failing_when_its_writer_does_NOT_fix_it_is_reported_unrepaired_(exit_1)
  Scenario: A check its writer does not fix is reported unrepaired with exit 1
    Given readme:subgraphs:check always fails, though its writer succeeds
    When the post-merge regen runs with PR creation on
    Then the report is unrepaired, naming readme:subgraphs:check
    And no PR is opened and the exit code is 1
    And the summary says "Repair failed: 1 check(s) could not be repaired"

  @test:scripts/tests/sdlc/post-merge-regen.test.ts::post-merge-regen_pipeline_(bean_folio-assistant-ey1c)::fixity_gates_are_not_asked::the_mount_checks_are_left_out,_and_every_other_pair_is_kept_in_order
  Scenario: The mount fixity checks are left out and every other pair is kept in order
    Given pairs for library:viz, mount:remote, readme:subgraphs and mount:lock
    When the post-merge pairs are chosen
    Then they are library:viz:check and readme:subgraphs:check, in that order

  @test:scripts/tests/sdlc/post-merge-regen.test.ts::post-merge-regen_pipeline_(bean_folio-assistant-ey1c)::fixity_gates_are_not_asked::each_excluded_gate_says_why
  Scenario: Each excluded fixity gate says why
    Given the fixity checks table
    When it is read
    Then it holds exactly mount:lock:check and mount:remote:check
    And each reason is longer than 20 characters

  @test:scripts/tests/sdlc/post-merge-regen.test.ts::post-merge-regen_pipeline_(bean_folio-assistant-ey1c)::buildPrBody::generates_structured_markdown_referencing_ey1c_and_reviewable_PR_rationale
  Scenario: The repair PR body is structured markdown naming ey1c and why it is a reviewable PR
    Given stale checks readme:subgraphs:check and check:prov-qaqc at commit 8688288494a…
    When the PR body is built
    Then it names folio-assistant-ey1c and "8688288494"
    And it lists each stale check as a bullet
    And it says "reviewable PR rather than direct push" and names the "accidental-repair hazard"

  @test:scripts/tests/sdlc/post-merge-regen.test.ts::builtAtPublish_outputs_are_never_stale_(bean_folio-assistant-p7mb)::builtAtPublishIn_asks_isBuiltAtPublish_of_the_owning_instance,_with_the_instance-relative_path
  Scenario: builtAtPublishIn asks the owning instance with the instance-relative path
    Given instance inst declaring out/pages/ and out/index.json built at publish, and a nested instance declaring nothing
    When repo paths are tested
    Then inst/out/pages/a/index.html and inst/out/index.json are built at publish
    And inst/notes.txt, other/out/pages/a.html and inst/nested/out/pages/a.html are not

  @test:scripts/tests/sdlc/post-merge-regen.test.ts::builtAtPublish_outputs_are_never_stale_(bean_folio-assistant-p7mb)::the_tracker_tells_a_builtAtPublish_write_from_a_committed_one,_and_a_same-bytes_rewrite_moves_nothing
  Scenario: The tree tracker tells a builtAtPublish write from a committed one, and a same-bytes rewrite moves nothing
    Given a scratch tree with instance inst declaring outputs built at publish and a committed notes.txt
    When the tracker takes its baseline, then a built page is written and notes.txt rewritten with the same bytes
    Then the baseline moves nothing and the second take lists only inst/out/pages/index.html as built at publish
    And after notes.txt changes, the next take lists only inst/notes.txt as committed

  @test:scripts/tests/sdlc/post-merge-regen.test.ts::builtAtPublish_outputs_are_never_stale_(bean_folio-assistant-p7mb)::a_check_red_only_because_its_builtAtPublish_outputs_are_absent_is_NOT_reported_stale,_and_opens_no_PR
  Scenario: A check red only because its builtAtPublish outputs are absent is not stale and opens no PR
    Given library:viz:check red until library:viz writes only outputs declared built at publish
    When the post-merge regen runs over that pair with PR creation on
    Then the report is clean with no stale or repaired checks
    And library:viz:check is listed as a builtAtPublish check
    And no PR is opened, the exit code is 0 and the summary mentions "builtAtPublish"

  @test:scripts/tests/sdlc/post-merge-regen.test.ts::builtAtPublish_outputs_are_never_stale_(bean_folio-assistant-p7mb)::control:_a_writer_that_also_moves_a_COMMITTED_file_is_still_a_stale_check,_repaired
  Scenario: A writer that also moves a committed file is still a stale check, repaired
    Given render:bpmn:check red until render:bpmn writes a built page and changes the committed notes.txt
    When the post-merge regen runs over that pair
    Then the report is repaired with render:bpmn:check stale and repaired
    And no check is listed as builtAtPublish

  @test:scripts/tests/sdlc/post-merge-regen.test.ts::builtAtPublish_outputs_are_never_stale_(bean_folio-assistant-p7mb)::publish-check_style_checks_and_checks_waiting_on_another_writer's_builtAtPublish_output_are_classified_as_builtAtPublishChecks
  Scenario: Publish-check style checks and checks waiting on another writer's builtAtPublish output are builtAtPublish checks
    Given node-kind:pages:check that writes a built page on its first call, themes:css:check red until themes:css writes a built file, and a navbar check that reads that file
    When the post-merge regen runs over the three pairs with PR creation on
    Then the report is clean with no stale or repaired checks and exit code 0
    And the builtAtPublish checks are node-kind:pages:check, themes:css:check and check:navbar-consistency:check

  @test:scripts/tests/sdlc/post-merge-regen.test.ts::builtAtPublish_outputs_are_never_stale_(bean_folio-assistant-p7mb)::instance_scoping:_another_layer's_committed_move_in_the_composed_index_is_not_reported_stale_for_the_caller_instance
  Scenario: Another layer's committed move is not stale for the caller instance
    Given glossary:pot:check red until glossary:pot changes a committed file in layer "other"
    When the post-merge regen runs for instance inst, with git reporting other/notes.txt changed
    Then the report is clean with no stale or repaired checks and exit code 0
    And glossary:pot:check is listed as a builtAtPublish check

  @test:scripts/tests/sdlc/post-merge-regen.test.ts::builtAtPublish_outputs_are_never_stale_(bean_folio-assistant-p7mb)::clean_checks_from_the_audit_pass_are_not_re-run_during_builtAtPublish_convergence_across_passes
  Scenario: A check clean in the audit pass is not re-run during builtAtPublish convergence
    Given slice:sqlite needs a file library:viz writes, both red until written at publish, and translation:block-qa:check clean
    When the post-merge regen runs over the three pairs
    Then the report is clean with no stale or repaired checks
    And the builtAtPublish checks are slice:sqlite:check and library:viz:check
    And translation:block-qa:check ran exactly once

  @test:scripts/tests/sdlc/post-merge-regen.test.ts::builtAtPublish_outputs_are_never_stale_(bean_folio-assistant-p7mb)::a_gate_judged_after_publish_is_reported_with_builtAtPublishChecks,_an_unlisted_red_one_stays_unrepaired
  Scenario: A gate judged after publish is reported with the builtAtPublish checks, and an unlisted red gate stays unrepaired
    Given check:nav-names:check with no writer, always red, and slice:sqlite:check red after its writer
    When the post-merge regen runs over those pairs
    Then check:nav-names:check is in the judged-after-publish list
    And nothing is unrepaired or stale, both checks are builtAtPublish checks, and the report is clean with exit 0
    And the same red under the unlisted name other:gate:check is unrepaired with exit 1 and no builtAtPublish checks

  @test:scripts/tests/sdlc/post-merge-regen.test.ts::builtAtPublish_outputs_are_never_stale_(bean_folio-assistant-p7mb)::a_committed_file_move_in_pass_1_re-asks_only_checks_whose_declared_inputs_match
  Scenario: A committed file move in pass 1 re-asks only checks whose declared inputs match
    Given source:check red until source:write changes data/source.json, which makes derived:check red until derived:write runs, and unrelated:check reading other/**
    When the post-merge regen runs over the three pairs with their declared inputs and outputs
    Then the report is repaired with derived:check and source:check repaired
    And unrelated:check ran exactly once

  @test:scripts/tests/sdlc/post-merge-regen.test.ts::builtAtPublish_outputs_are_never_stale_(bean_folio-assistant-p7mb)::barren_pass:_a_writer_that_neither_repairs_its_check_nor_moves_any_file_settles_after_1_repair_pass
  Scenario: A writer that neither repairs its check nor moves a file settles after one repair pass
    Given broken:check always red and a broken:write writer that moves nothing
    When the post-merge regen runs allowing 6 passes
    Then the report is unrepaired, naming broken:check
    And the writer ran exactly once

  @test:scripts/tests/sdlc/post-merge-regen.test.ts::builtAtPublish_outputs_are_never_stale_(bean_folio-assistant-p7mb)::publishTimeDeclarations_includes_off-checkout_storage_directories_(e.g._test/results/_on_qa-reports)
  Scenario: publishTimeDeclarations includes off-checkout storage directories
    Given the publish-time declarations of the real repo
    When repo paths are tested
    Then cat-harness/test/results/check.qa-results.json and cat-harness/site/index.html are built at publish
    And cat-harness/README.md is not

  @test:scripts/tests/sdlc/post-merge-regen.test.ts::builtAtPublish_outputs_are_never_stale_(bean_folio-assistant-p7mb)::index_scoping_(bean_ksek):_in_an_index_checkout_with_remote_mounts,_writers_that_only_touch_remote_mounts_are_classified_as_builtAtPublishChecks_and_open_no_PR
  Scenario: In an index checkout, writers that only touch remote mounts are builtAtPublish checks and open no PR
    Given an index checkout whose lock mounts layer "mounted-layer", and kind:register:check red until kind:register changes a file in that mount
    When the target scope is read
    Then mounted-layer/layer.txt is out of scope and README.md is in scope
    And the post-merge regen over that pair reports clean, with no stale or repaired checks and kind:register:check as builtAtPublish
    And there are no changed files, no PR is opened and the exit code is 0

  @test:scripts/tests/sdlc/post-merge-regen.test.ts::prerequisite_writers_come_from_the_declarations,_not_from_instance_names::a_writer_runs_only_when_an_instance_declares_it_and_its_output_is_absent
  Scenario: A prerequisite writer runs only when an instance declares it and its output is absent
    Given an instance declaring writer ig-index:build for fhir-artifact-index/index.json
    When the missing prerequisite writers are listed while that output is absent
    Then they are ig-index:build
    And once the output exists, there are none
    And a render:bpmn writer declared for a missing output is not listed, since it is not a prerequisite writer
