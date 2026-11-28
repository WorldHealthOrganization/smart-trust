# pages-bootstrap checks for the gh-pages branch first, reports its absence as
# unprovisioned, and creates it only with --provision (issue #2417, SC-1, SC-2,
# FR-2). Each Scenario names the test that executes it.
Feature: Provisioning the gh-pages branch

  @test:scripts/tests/pages-bootstrap-provision.test.ts::SC-1_—_no_gh-pages_is_`unprovisioned`,_and_exits_non-zero::a_remote_with_no_gh-pages_reports_unprovisioned,_the_exact_command,_and_exits_3
  Scenario: A remote with no gh-pages is unprovisioned and exits 3
    Given a work tree whose origin has no gh-pages branch
    When pages-bootstrap runs
    Then it exits 3, saying UNPROVISIONED, the --provision command, the git push of gh-pages, and the branch source it expects

  @test:scripts/tests/pages-bootstrap-provision.test.ts::SC-1_—_no_gh-pages_is_`unprovisioned`,_and_exits_non-zero::without_--provision_nothing_is_pushed
  Scenario: Without --provision nothing is pushed
    When pages-bootstrap runs without --provision
    Then the origin still has no gh-pages branch

  @test:scripts/tests/pages-bootstrap-provision.test.ts::SC-1_—_no_gh-pages_is_`unprovisioned`,_and_exits_non-zero::a_remote_that_has_gh-pages_does_not_report_unprovisioned
  Scenario: A remote that has gh-pages is not unprovisioned
    Given gh-pages has been created on the origin
    Then the report finds the branch present and the outcome is not unprovisioned
    And the CLI does not say UNPROVISIONED and does not exit 3

  @test:scripts/tests/pages-bootstrap-provision.test.ts::SC-1_—_no_gh-pages_is_`unprovisioned`,_and_exits_non-zero::a_remote_ls-remote_cannot_reach_is_`unknown`,_never_`absent`
  Scenario: A remote ls-remote cannot reach is unknown, never absent
    Given a work tree whose origin does not exist
    Then the gh-pages branch state is unknown

  @test:scripts/tests/pages-bootstrap-provision.test.ts::SC-2_—_--provision_creates_an_orphan_gh-pages,_idempotently::exactly_index.html_and_.nojekyll,_no_parent,_working_tree_untouched
  Scenario: --provision creates an orphan gh-pages holding exactly index.html and .nojekyll
    When pages-bootstrap runs with --provision
    Then it says CREATED and not UNPROVISIONED
    And gh-pages on the origin holds exactly .nojekyll and index.html in one parentless commit
    And the work tree is still on main at the same commit with nothing changed

  @test:scripts/tests/pages-bootstrap-provision.test.ts::SC-2_—_--provision_creates_an_orphan_gh-pages,_idempotently::run_twice,_the_second_run_changes_nothing
  Scenario: Provisioning twice changes nothing the second time
    Given gh-pages was created at a commit
    When it is provisioned again, the state is already-present and gh-pages has not moved
    And the CLI with --provision says ALREADY-PRESENT and gh-pages has not moved

  @test:scripts/tests/pages-bootstrap-provision.test.ts::FR-2_—_the_Pages_source_it_expects::a_workflow_that_pushes_gh-pages_needs_the_branch_source,_never_Actions
  Scenario: A workflow that pushes gh-pages needs the branch source
    Given a Pages workflow that uploads an artifact and also pushes gh-pages
    Then the expected Pages source is branch

  @test:scripts/tests/pages-bootstrap-provision.test.ts::FR-2_—_the_Pages_source_it_expects::only_an_artifact-only_deploy_expects_GitHub_Actions,_and_then_no_branch_is_required
  Scenario: Only an artifact-only deploy expects GitHub Actions, and then no branch is required
    Given a Pages workflow that only deploys an artifact, and no remote
    Then the expected Pages source is actions
    And the report expects the Actions source and marks the branch not required
