# scripts/check-ci-health.ts reports the health of a repository's CI runs, with an exit code that tells "could not check" apart
# from "checked", and src/workflow/ci-health.ts decides whether a workflow's push trigger fires for a commit. Each Scenario names the test that executes it.
Feature: CI health check exit codes and push-trigger evaluation

  @test:scripts/tests/sdlc/check-ci-health-cli.test.ts::the_exit-code_contract::a_repo_it_cannot_check_exits_2_—_not_0
  Scenario: A repository it cannot check exits 2
    Given a git repository with no origin remote
    When the CI health check runs with no flags
    Then it exits 2

  @test:scripts/tests/sdlc/check-ci-health-cli.test.ts::the_exit-code_contract::--markdown_ALWAYS_exits_0,_even_when_it_could_not_check
  Scenario: The markdown report always exits 0, even when it could not check
    Given a git repository with no origin remote
    When the CI health check runs with "--markdown"
    Then it exits 0

  @test:scripts/tests/sdlc/check-ci-health-cli.test.ts::the_exit-code_contract::--markdown_prints_the_unknown_report_rather_than_nothing
  Scenario: The markdown report says the repository was not checked
    Given a git repository with no origin remote
    When the CI health check runs with "--markdown"
    Then its output contains "Not checked"
    And its output contains "treat as unknown, not as green"

  @test:scripts/tests/sdlc/check-ci-health-cli.test.ts::the_exit-code_contract::--warn_reports_without_failing
  Scenario: Warn mode exits 0 when it could not check
    # Gap: only the exit code is checked, not that a report is printed
    Given a git repository with no origin remote
    When the CI health check runs with "--warn"
    Then it exits 0

  @test:scripts/tests/sdlc/check-ci-health-cli.test.ts::--out:_the_report_AND_the_verdict,_from_one_API_call::writes_the_report_and_still_exits_2_when_it_could_not_check
  Scenario: The --out flag writes the report and still exits 2 when it could not check
    Given a git repository with no origin remote
    When the CI health check runs with "--out" and a report path
    Then it exits 2
    And the report file contains "Not checked"

  @test:scripts/tests/sdlc/check-ci-health-cli.test.ts::--out:_the_report_AND_the_verdict,_from_one_API_call::--out=<path>_is_accepted_too
  Scenario: The --out=<path> form is accepted
    Given a git repository with no origin remote
    When the CI health check runs with "--out=<path>"
    Then it exits 2
    And the report file contains "treat as unknown, not as green"

  @test:scripts/tests/sdlc/check-ci-health-cli.test.ts::--out:_the_report_AND_the_verdict,_from_one_API_call::--out_with_no_path_is_its_own_error,_not_the_unreachable_exit
  Scenario: --out with no path is reported as a misused flag
    Given a git repository with no origin remote
    When the CI health check runs with "--out" and nothing after it
    Then it exits 2
    And its error output contains "--out needs a file path"

  @test:scripts/tests/sdlc/check-ci-health-cli.test.ts::triggersOnPush_distinguishes_an_unfiltered_push_from_a_filtered_one::%s
  Scenario: Each push-trigger shape is classified as firing, not firing or undecidable without context
    Given a workflow whose "on" is one of the listed shapes
    When its push trigger is evaluated with no commit context
    Then the answer matches the row
    And a bare "push" string, a list containing push, and a mapping with an empty push all fire
    And a push filtered by branches only, or by paths, is undecidable
    And "workflow_dispatch" only and "pull_request" only do not fire

  @test:scripts/tests/sdlc/check-ci-health-cli.test.ts::a_filtered_push_trigger_is_decided,_not_waved_away::branches-only_is_decidable_with_no_path_data_at_all
  Scenario: A branches-only push filter is decided from the branch alone
    Given a workflow whose push is filtered to branch "main"
    When its push trigger is evaluated for branch "main"
    Then it fires
    And for branch "release" it does not fire

  @test:scripts/tests/sdlc/check-ci-health-cli.test.ts::a_filtered_push_trigger_is_decided,_not_waved_away::branches-only_without_a_branch_still_claims_nothing
  Scenario: A branches-only push filter with no branch given is undecidable
    Given a workflow whose push is filtered to branch "main"
    When its push trigger is evaluated with no context
    Then the answer is undecidable

  @test:scripts/tests/sdlc/check-ci-health-cli.test.ts::a_filtered_push_trigger_is_decided,_not_waved_away::docs-site:_a_docs_change_runs_it,_a_src_change_does_not
  Scenario: The docs-site paths filter fires for docs changes and not for source changes
    Given a workflow pushing on "main" with paths "docs/**", "schemas/**" and ".github/workflows/docs-site.yml"
    When its push trigger is evaluated on "main" for each changed-file list
    Then "docs/index.md", "docs/a/b/c.md" and ".github/workflows/docs-site.yml" each fire it
    And "src/index.ts" alone does not fire it
    And "src/a.ts" with "docs/b.md" fires it

  @test:scripts/tests/sdlc/check-ci-health-cli.test.ts::a_filtered_push_trigger_is_decided,_not_waved_away::the_wrong_branch_short-circuits_before_paths_are_consulted
  Scenario: The wrong branch does not fire even when a path matches
    Given the docs-site workflow filtered to branch "main" and docs paths
    When its push trigger is evaluated for branch "other" with "docs/x.md" changed
    Then it does not fire

  @test:scripts/tests/sdlc/check-ci-health-cli.test.ts::a_filtered_push_trigger_is_decided,_not_waved_away::`a/**/b`_matches_zero_directories_as_well_as_many
  Scenario: A "**" segment matches zero directories as well as many
    Given a workflow with paths "folio/**/*.ts", "schemas/kg/jsonld.ts" and "library/**/structure.json"
    When its push trigger is evaluated for each changed file
    Then "folio/a.ts", "folio/deep/er/a.ts", "library/x/structure.json" and "library/structure.json" each fire it

  @test:scripts/tests/sdlc/check-ci-health-cli.test.ts::a_filtered_push_trigger_is_decided,_not_waved_away::`*`_does_not_cross_a_slash
  Scenario: A single "*" does not cross a slash
    Given a workflow with path "folio/*.ts"
    When its push trigger is evaluated for each changed file
    Then "folio/a.ts" fires it
    And "folio/deep/a.ts" does not

  @test:scripts/tests/sdlc/check-ci-health-cli.test.ts::a_filtered_push_trigger_is_decided,_not_waved_away::an_exact_path_is_exact
  Scenario: An exact path matches only itself
    Given a workflow whose paths include "schemas/kg/jsonld.ts"
    When its push trigger is evaluated for each changed file
    Then "schemas/kg/jsonld.ts" fires it
    And "schemas/kg/jsonld.ts.bak" does not

  @test:scripts/tests/sdlc/check-ci-health-cli.test.ts::a_filtered_push_trigger_is_decided,_not_waved_away::paths_without_the_file_list_claims_nothing
  Scenario: A paths filter with no changed-file list is undecidable
    Given a workflow with a paths filter
    When its push trigger is evaluated with branch "main" and no changed files
    Then the answer is undecidable

  @test:scripts/tests/sdlc/check-ci-health-cli.test.ts::a_filtered_push_trigger_is_decided,_not_waved_away::paths-ignore_runs_unless_EVERY_changed_file_is_ignored
  Scenario: A paths-ignore filter fires unless every changed file is ignored
    Given a workflow with paths-ignore "docs/**"
    When its push trigger is evaluated for each changed-file list
    Then "docs/a.md" alone does not fire it
    And "docs/a.md" with "src/b.ts" fires it
    And "src/b.ts" alone fires it

  @test:scripts/tests/sdlc/check-ci-health-cli.test.ts::a_filtered_push_trigger_is_decided,_not_waved_away::syntax_this_cannot_evaluate_claims_nothing_rather_than_guessing
  Scenario: Path patterns it cannot evaluate leave the trigger undecidable
    Given a workflow whose single path pattern is one of "!docs/**", "docs/?.md", "docs/[ab].md" or "docs/+.md"
    When its push trigger is evaluated with "docs/a.md" changed
    Then each answer is undecidable

  @test:scripts/tests/sdlc/check-ci-health-cli.test.ts::a_filtered_push_trigger_is_decided,_not_waved_away::a_tag_filter_is_not_a_branch_push
  Scenario: A tag-filtered push is not decided as a branch push
    Given a workflow whose push is filtered to tags "v*"
    When its push trigger is evaluated for branch "main" with "a.ts" changed
    Then the answer is undecidable
