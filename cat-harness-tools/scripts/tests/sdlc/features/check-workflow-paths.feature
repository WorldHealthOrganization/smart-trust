# scripts/check-workflow-paths.ts checks that every script a workflow step invokes, and every working-directory it declares,
# exists from the frame the step actually runs in (cwd, checkout layout, ref), and ratchets the known misses.
# Each Scenario names the test that executes it.
Feature: Workflow script paths and working directories resolve where the step runs

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::invokedPath::takes_a_script_path
  Scenario: A bun run line yields the script path it invokes
    When the invoked path is read from "bun run cat-harness/scripts/x.ts"
    Then it is "cat-harness/scripts/x.ts"

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::invokedPath::an_npm_SCRIPT_NAME_is_not_a_path_—_it_is_the_recommended_fix
  Scenario: An npm script name is not taken as a script path
    When the invoked path is read from "bun run cat check:ci-health --out /tmp/x.md"
    Then there is no invoked path
    And "bun run cat health" also yields no invoked path

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::invokedPath::ignores_lines_that_are_not_bun_invocations
  Scenario: Lines that are not bun invocations yield no path
    When the invoked path is read from "echo bun run x.ts"
    Then there is no invoked path
    And the comment line "# bun run x.ts" also yields no invoked path

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::invokedPath::sees_past_--cwd_to_the_script
  Scenario: A --cwd flag is skipped to reach the script and reported as the cwd
    Given the line "bun run --cwd content pipeline/a.ts"
    When the invoked path and the cwd flag are read from it
    Then the invoked path is "pipeline/a.ts"
    And the cwd flag is "content"

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::invokedPath_—_the_`bash`_verb::takes_a_shell_script
  Scenario: A bash or sh line yields the shell script it runs
    When the invoked path is read from "bash cat-harness/scripts/x.sh pages"
    Then it is "cat-harness/scripts/x.sh"
    And "sh scripts/y.sh" yields "scripts/y.sh"

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::invokedPath_—_the_`bash`_verb::a_flag_or_a_`-c`_string_is_not_a_path
  Scenario: A bash flag or -c string is not a script path
    When the invoked path is read from "bash -c 'echo hi'"
    Then there is no invoked path
    And "bash -euo pipefail" also yields no invoked path

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::invokedPath_—_the_`bash`_verb::a_bare_`bash`_with_no_script_is_not_a_path
  Scenario: A bare bash with no script is not a script path
    When the invoked path is read from "bash"
    Then there is no invoked path

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::invokedPath_—_the_`bash`_verb::it_is_the_VERB_that_was_missing,_not_the_machinery
  Scenario: A bash script at the workspace root is missing when the checkout went to source
    Given a job that checks out the repository at path "source"
    And a step that runs "bash cat-harness/scripts/x.sh pages" with no working-directory
    When the invocations are read from the workflow
    Then the invocation's verdict is Missing

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::workflow-level_defaults::a_workflow-level_`defaults.run.working-directory`_applies
  Scenario: A workflow-level default working-directory sets the cwd
    Given a workflow whose defaults.run.working-directory is "cat-harness-tools"
    And a step that runs "bun run scripts/gates.ts"
    When the invocations are read from the workflow
    Then the invocation's cwd is "cat-harness-tools"
    And its verdict is Resolves

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::workflow-level_defaults::a_JOB_default_overrides_the_workflow_default
  Scenario: A job-level default working-directory overrides the workflow default
    Given a workflow whose default working-directory is "nowhere"
    And a job whose default working-directory is "cat-harness-tools"
    And a step that runs "bun run scripts/gates.ts"
    When the invocations are read from the workflow
    Then the invocation's cwd is "cat-harness-tools"

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::cdTarget::a_plain_cd_is_followed
  Scenario: A plain cd line yields its target
    When the cd target is read from "cd content"
    Then it is "content"

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::cdTarget::a_cd_naming_a_VARIABLE_is_unresolvable,_not_ignorable
  Scenario: A cd to a variable or glob is unresolvable rather than ignored
    When the cd target is read from "cd \"$RUNNER_TEMP\""
    Then it is null, meaning a cd that cannot be followed
    And "cd $HOME/x" is null
    And "cd build-*" is null

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::cdTarget::a_non-cd_line_is_undefined
  Scenario: A line that is not a cd has no cd target
    When the cd target is read from "bun run x.ts"
    Then it is undefined

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::cwd_tracking::a_cd_earlier_in_the_SAME_run_block_moves_the_path
  Scenario: A cd earlier in the same run block moves the cwd
    Given a single run block holding "cd content" and then "bun run pipeline/build.ts"
    When the invocations are read from the workflow
    Then the invocation's cwd is "content"

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::cwd_tracking::`cd_x_&&_bun_…`_on_one_line_is_followed_too
  Scenario: A cd joined to the bun call with && is followed
    Given a run block holding "cd content && bun run pipeline/build.ts"
    When the invocations are read from the workflow
    Then the invocation's cwd is "content"

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::cwd_tracking::a_cd_does_NOT_leak_into_the_next_run_block_—_each_`run:`_is_its_own_shell
  Scenario: A cd in one run block does not carry into the next step
    Given a step that runs "cd content && bun install"
    And a following step that runs "bun run cat-harness/scripts/x.ts"
    When the invocations are read from the workflow
    Then the first invocation's cwd is the root ""

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::cwd_tracking::a_step's_working-directory_applies
  Scenario: A step's working-directory sets the cwd
    Given a step with working-directory "cat-harness-tools" that runs "bun run scripts/gates.ts"
    When the invocations are read from the workflow
    Then the invocation's cwd is "cat-harness-tools"
    And its verdict is Resolves

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::cwd_tracking::a_job-level_defaults.run.working-directory_applies
  Scenario: A job-level defaults working-directory applies to its steps
    Given a job whose defaults.run.working-directory is "cat-harness-tools"
    And a step that runs "bun run scripts/gates.ts"
    When the invocations are read from the workflow
    Then the invocation's verdict is Resolves

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::verdicts::a_path_that_is_not_there_from_the_computed_cwd_is_MISSING
  Scenario: A script path absent from the computed cwd is Missing
    Given a step at the root that runs "bun run scripts/check-ci-health.ts"
    When the invocations are read from the workflow
    Then the invocation's verdict is Missing

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::verdicts::the_same_script_WITH_the_cat-harness_prefix_resolves
  Scenario: The same script with its package prefix resolves
    Given a step at the root that runs "bun run cat-harness-tools/scripts/check-ci-health.ts"
    When the invocations are read from the workflow
    Then the invocation's verdict is Resolves

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::verdicts::an_unresolvable_cd_yields_UNDETERMINED,_never_a_pass
  Scenario: A script after an unresolvable cd is Undetermined
    Given a run block holding "cd \"$RUNNER_TEMP\"" and then "bun run scripts/x.ts"
    When the invocations are read from the workflow
    Then the invocation's verdict is Undetermined
    And its note mentions "variable"

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::verdicts::a_declared_folio_path_is_NEEDS-FOLIO_and_carries_its_reason
  Scenario: A script matching a declared folio path is NeedsFolio with its reason
    Given a folio table with one entry matching "pipeline/build.ts" and a reason naming a folio's own build
    And a run block holding "cd content" and then "bun run pipeline/build.ts"
    When the invocations are read from the workflow with that table
    Then the invocation's verdict is NeedsFolio
    And its note mentions "folio"

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::checkout_paths::a_step_working_in_an_actions/checkout_`path:`_resolves_against_the_repo
  Scenario: A step working inside a checkout path resolves against the repository
    Given a job that checks out the repository at path "source"
    And a step with working-directory "source" that runs "bun run cat-harness-tools/scripts/gates.ts"
    When the invocations are read from the workflow
    Then the invocation's verdict is Resolves

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::checkout_paths::the_prefix_may_be_in_the_PATH,_from_the_workspace_root
  Scenario: A script path that carries the checkout prefix from the workspace root resolves
    Given a job that checks out the repository at path "source"
    And a step at the root that runs "bun run source/cat-harness-tools/scripts/gates.ts"
    When the invocations are read from the workflow
    Then the invocation's verdict is Resolves

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::checkout_paths::the_prefix_may_be_reached_RELATIVELY,_through_`..`_from_a_sibling_dir
  Scenario: A script path reaching the checkout through .. from a sibling directory resolves
    Given a job that checks out the repository at path "source"
    And a step with working-directory "pages" that runs "bun run ../source/cat-harness-tools/scripts/gates.ts"
    When the invocations are read from the workflow
    Then the invocation's verdict is Resolves

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::checkout_paths::a_path_at_the_bare_workspace_root_is_BROKEN_when_the_checkout_went_elsewhere
  Scenario: A workspace-root script path is Missing when the only checkout went elsewhere
    Given a job that checks out the repository only at path "source"
    And a step at the root that runs "bun run cat-harness-tools/scripts/gates.ts"
    When the invocations are read from the workflow
    Then the invocation's verdict is Missing
    And its note says "empty directory at run time"

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::checkout_paths::...and_is_fine_when_the_job_ALSO_checks_out_at_the_root
  Scenario: A workspace-root script path resolves when the job also checks out at the root
    Given a job that checks out the repository at the root and again at path "source"
    And a step at the root that runs "bun run cat-harness-tools/scripts/gates.ts"
    When the invocations are read from the workflow
    Then the invocation's verdict is Resolves

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::checkout_paths::a_job_with_NO_checkout_keeps_the_old_behaviour_rather_than_inventing_a_layout
  Scenario: A job with no checkout resolves script paths against the repository
    Given a job with no checkout step
    And a step that runs "bun run cat-harness-tools/scripts/gates.ts"
    When the invocations are read from the workflow
    Then the invocation's verdict is Resolves

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::checkout_paths::a_path_landing_in_a_checkout_at_ANOTHER_ref_is_undetermined,_never_green
  Scenario: A script path inside a checkout of another ref is Undetermined
    Given a job that checks out HEAD at "source" and ref "gh-pages" at "pages"
    And a step with working-directory "pages" that runs "bun run cat-harness-tools/scripts/gates.ts"
    When the invocations are read from the workflow
    Then the invocation's verdict is Undetermined
    And its note mentions "gh-pages"

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::checkout_paths::...while_reaching_OUT_of_it_to_the_HEAD_checkout_still_resolves
  Scenario: A script path reaching out of the other-ref checkout to the HEAD checkout resolves
    Given a job that checks out HEAD at "source" and ref "gh-pages" at "pages"
    And a step with working-directory "pages" that runs "bun run ../source/cat-harness-tools/scripts/gates.ts"
    When the invocations are read from the workflow
    Then the invocation's verdict is Resolves

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::checkout_paths::`ref:_${{_github.sha_}}`_is_THIS_tree,_not_another_one
  Scenario: A checkout at ref github.sha counts as this tree
    Given a job that checks out ref "${{ github.sha }}" at path "source"
    And a step with working-directory "source" that runs "bun run cat-harness-tools/scripts/gates.ts"
    When the invocations are read from the workflow
    Then the invocation's verdict is Resolves

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::checkout_paths::a_checkout_of_a_DIFFERENT_repository_is_not_collected
  Scenario: A checkout of a different repository does not make its paths resolve
    Given a job that checks out repository "other/repo" at path "source"
    And a step with working-directory "source" that runs "bun run cat-harness-tools/scripts/gates.ts"
    When the invocations are read from the workflow
    Then the invocation's verdict is Missing

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::FOLIO_PATHS::every_entry_carries_a_reason
  Scenario: Every shipped folio path entry carries a reason
    Given the shipped FOLIO_PATHS table
    Then every entry's reason is longer than 20 characters

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::FOLIO_PATHS::build.ts_is_not_exempt_any_more,_and_is_not_resolved_to_the_platform's_copy_either
  Scenario: pipeline/build.ts after cd content is neither exempt nor resolved to the platform copy
    Given the shipped FOLIO_PATHS table
    Then it has no entry matching "pipeline/build.ts"
    When a run block holding "cd content" and then "bun run pipeline/build.ts" is read with the shipped table
    Then the invocation's verdict is Missing

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::working-directory_—_does_the_cwd_exist_at_all::an_ABSENT_directory_is_Missing_—_the_defect_`ai9u`_exists_for
  Scenario: An absent working-directory is Missing
    Given a step whose working-directory is "folio-assistant"
    When the working directories are read from the workflow
    Then its verdict is Missing

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::working-directory_—_does_the_cwd_exist_at_all::a_present_one_resolves
  Scenario: A present working-directory resolves
    Given a step whose working-directory is "cat-harness"
    When the working directories are read from the workflow
    Then its verdict is Resolves

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::working-directory_—_does_the_cwd_exist_at_all::a_trailing_slash_and_a_leading_./_are_the_same_directory
  Scenario: A trailing slash or leading ./ names the same working-directory
    Given a step whose working-directory is "cat-harness/"
    Then its verdict is Resolves
    And a step whose working-directory is "./cat-harness" also resolves

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::working-directory_—_does_the_cwd_exist_at_all::a_computed_value_is_Undetermined_—_NOT_a_pass,_and_not_a_defect
  Scenario: A computed working-directory is Undetermined
    Given a step whose working-directory is "${{ matrix.lake-root }}"
    When the working directories are read from the workflow
    Then its verdict is Undetermined

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::working-directory_—_does_the_cwd_exist_at_all::a_folio_directory_is_exempt_WITH_A_REASON,_not_silently_skipped
  Scenario: A folio working-directory is NeedsFolio and carries a note
    Given a step whose working-directory is "tools/hecke-engine"
    When the working directories are read from the workflow
    Then its verdict is NeedsFolio
    And its note is not empty

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::working-directory_—_does_the_cwd_exist_at_all::the_exemption_matches_a_subdirectory_of_a_folio_path_too
  Scenario: A subdirectory of a folio working-directory is also NeedsFolio
    Given a step whose working-directory is "tools/hecke-engine/src"
    When the working directories are read from the workflow
    Then its verdict is NeedsFolio

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::working-directory_—_the_checkout_layout_decides_what_exists::a_checkout_`path:`_MATERIALISES_the_cwd,_so_it_resolves
  Scenario: A working-directory created by a checkout path resolves
    Given a job that checks out the repository at path "source"
    And a step whose working-directory is "source"
    When the working directories are read from the workflow
    Then its verdict is Resolves

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::working-directory_—_the_checkout_layout_decides_what_exists::a_path_UNDER_a_checkout_is_measured_inside_that_tree
  Scenario: A working-directory under a checkout path is measured inside that tree
    Given a job that checks out the repository at path "source"
    Then a step whose working-directory is "source/cat-harness" resolves
    And a step whose working-directory is "source/nope" is Missing

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::working-directory_—_the_checkout_layout_decides_what_exists::a_gh-pages_checkout_ROOT_resolves_—_unlike_the_same_prefix_for_a_script_path
  Scenario: The root of a gh-pages checkout resolves as a working-directory
    Given a job that checks out ref "gh-pages" at path "pages"
    And a step whose working-directory is "pages"
    When the working directories are read from the workflow
    Then its verdict is Resolves

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::working-directory_—_the_checkout_layout_decides_what_exists::...but_a_path_BELOW_it_is_still_Undetermined
  Scenario: A working-directory below a gh-pages checkout is Undetermined
    Given a job that checks out ref "gh-pages" at path "pages"
    And a step whose working-directory is "pages/STAGING"
    When the working directories are read from the workflow
    Then its verdict is Undetermined

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::working-directory_—_the_checkout_layout_decides_what_exists::checked_out_elsewhere,_the_workspace_root_is_EMPTY_at_run_time
  Scenario: A repository directory is Missing as a working-directory when the checkout went elsewhere
    Given a job that checks out the repository only at path "source"
    And a step whose working-directory is "cat-harness"
    When the working directories are read from the workflow
    Then its verdict is Missing

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::working-directory_—_where_it_is_DECLARED::a_workflow-level_default_is_ONE_finding,_not_one_per_job
  Scenario: A workflow-level default working-directory is reported once, not once per job
    Given a workflow whose default working-directory is "folio-assistant/snappea-wasm"
    And three jobs that each run one step
    When the working directories are read from the workflow
    Then exactly one finding has step "(workflow defaults)"

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::working-directory_—_where_it_is_DECLARED::...but_a_SECOND_verdict_is_a_second_finding,_not_a_duplicate
  Scenario: A workflow default with different verdicts in different jobs is reported once per verdict
    Given a workflow whose default working-directory is "cat-harness-tools"
    And a job "plain" with no checkout
    And a job "relocated" that checks out the repository at path "source"
    When the working directories are read from the workflow
    Then two findings have step "(workflow defaults)"
    And their verdicts are Resolves and Missing

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::working-directory_—_where_it_is_DECLARED::job_defaults_and_step-level_are_both_read
  Scenario: Job defaults and step-level working-directories are both reported
    Given a job whose default working-directory is "cat-harness-tools"
    And a step "s" whose working-directory is "folio-assistant"
    When the working directories are read from the workflow
    Then the findings' steps are "(job defaults)" then "s"
    And their verdicts are Resolves then Missing

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::working-directory_—_where_it_is_DECLARED::a_step_with_NO_cwd_contributes_nothing_—_the_default_is_the_root
  Scenario: A step with no working-directory yields no finding
    Given a step that runs "bun run cat-harness/scripts/x.ts" with no working-directory
    When the working directories are read from the workflow
    Then there are no findings

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::working-directory_—_a_`cd`_target_is_deliberately_NOT_checked::a_directory_the_same_block_creates_is_not_a_finding
  Scenario: A cd target is not checked as a working-directory
    Given a run block that runs "mkdir -p appendices", then "cd appendices", then a bun script
    When the working directories are read from the workflow
    Then there are no findings

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::the_baseline_is_a_RATCHET::every_entry_carries_a_reason,_checked_on_load
  Scenario: The working-directory baseline loads with every entry's reason and is not empty
    # Gap: the per-entry reason check is only observed as "loading does not throw"
    When the working-directory baseline is loaded
    Then loading does not throw
    And the baseline has at least one entry

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::the_baseline_is_a_RATCHET::it_keys_on_workflow_and_value,_not_on_a_line_number
  Scenario: A working-directory finding is keyed by workflow and value
    Given a step in "publish.yml" whose working-directory is "folio-assistant"
    When its baseline key is computed
    Then the key is "publish.yml: folio-assistant"

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::the_baseline_is_a_RATCHET::MUTATION:_a_missing_working-directory_is_actually_detected
  Scenario: A missing working-directory in a fixture produces a Missing finding
    Given a step whose working-directory is "folio-assistant"
    Then its verdict is Missing
    And a step whose working-directory is "cat-harness" resolves

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::the_baseline_is_a_RATCHET::RATCHET:_every_live_Missing_work-dir_is_baselined
  Scenario: Every Missing working-directory in the live tree is baselined
    Given every working-directory finding in the live repository's workflows
    When the Missing ones are selected
    Then each one's key is in the baseline

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::the_allowlist_ratchets_are_the_harness_root's_(cat-harness-tools#1701)::a_content_root_(no_gates_workflow)_excuses_them,_with_a_reason
  Scenario: A content root with no gates workflow excuses the allowlist ratchets with a reason
    Given an empty temporary directory as the root
    When the allowlists-not-ours reason is asked for
    Then it mentions "content root"

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::the_allowlist_ratchets_are_the_harness_root's_(cat-harness-tools#1701)::a_harness_root_judges_them_as_before
  Scenario: A harness root with a gates workflow judges the allowlist ratchets
    Given a temporary root holding ".github/workflows/code-quality-gates.yml"
    When the allowlists-not-ours reason is asked for
    Then it is null

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::disallowed_.github/_invocations_(bean_folio-assistant-dtda)::a_workflow_run:_invoking_.github/skills/_fails_the_gate
  Scenario: A workflow run step invoking a path under .github/skills/ produces a finding
    Given a workflow step that runs "python .github/skills/cli/dak_skill.py run" and "bun run .github/skills/bpmn_author/validate.ts"
    When the disallowed .github/ path findings are read from the workflow
    Then their normalized paths are ".github/skills/cli/dak_skill.py" and ".github/skills/bpmn_author/validate.ts"

  @test:scripts/tests/sdlc/check-workflow-paths.test.ts::disallowed_.github/_invocations_(bean_folio-assistant-dtda)::allows_.github/workflows/,_bootstrap_pointers,_CI_plumbing_and_declared_directories
  Scenario: Workflows, bootstrap pointers, CI plumbing and declared directories under .github/ are allowed
    When .github/ invocation paths are checked against the allowlist
    Then ".github/workflows/helper.sh", ".github/mount-from-lock.sh", ".github/cat.ts" and ".github/scripts/repin-train.ts" are allowed
    And ".github/skills/cli/dak_skill.py" is disallowed
    And ".github/declared-tools/run.ts" is allowed when ".github/declared-tools" is a declared directory
