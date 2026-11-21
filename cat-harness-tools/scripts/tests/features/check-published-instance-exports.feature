# scripts/check-published-instance-exports.ts derives, from the workflow files, every foreign-instance
# graph export a workflow publishes, runs each one, and reports examining nothing as its own state.
# Each Scenario names the test that executes it.
Feature: Workflow-published instance exports

  @test:scripts/tests/check-published-instance-exports.test.ts::publishedInstances::finds_the_invocation_in_the_real_deploy_workflow
  Scenario: The real deploy workflow's export invocation is found
    Given the repository's ".github/workflows/docs-site.yml"
    When its published instances are read
    Then at least one is found
    And "./bootstrap" is among them

  @test:scripts/tests/check-published-instance-exports.test.ts::publishedInstances::finds_it_in_the_STAGING_workflow_too_—_the_file_`3jhq`_showed_was_missed
  Scenario: The staging workflow's export invocation is found, with a stood-in base
    Given the repository's ".github/workflows/feature-staging.yml"
    When its published instances are read
    Then "./bootstrap" is among them
    And its invocation passes a stand-in base

  @test:scripts/tests/check-published-instance-exports.test.ts::publishedInstances::reads_every_invocation,_in_the_order_the_workflow_runs_them
  Scenario: Every invocation is read in workflow order
    Given workflow text running kg-export.ts with "--instance ./first" and then "--instance ./second"
    When its published instances are read
    Then they are "./first" then "./second"

  @test:scripts/tests/check-published-instance-exports.test.ts::publishedInstances::a_`--base-url`_on_the_line_is_recorded,_and_its_absence_is_too
  Scenario: A base URL on the invocation line is recorded, and so is its absence
    Given a kg-export.ts invocation line with "--base-url" and one without
    When their published instances are read
    Then the first has a stand-in base
    And the second does not

  @test:scripts/tests/check-published-instance-exports.test.ts::publishedInstances::a_`--base-url`_on_the_NEXT_line_is_not_this_invocation's
  Scenario: A base URL on the next line does not belong to the invocation
    Given a kg-export.ts invocation without a base, followed by another command passing "--base-url"
    When its published instances are read
    Then the invocation has no stand-in base

  @test:scripts/tests/check-published-instance-exports.test.ts::publishedInstances::a_DIFFERENT_script_taking_--instance_is_not_this_export
  Scenario: A different script taking --instance is not the export
    Given a line running "some-other-writer.ts --instance ./bootstrap"
    When its published instances are read
    Then none are found

  @test:scripts/tests/check-published-instance-exports.test.ts::publishedInstances::this_instance's_own_export_carries_no_--instance_and_is_not_counted
  Scenario: The instance's own export without --instance is not counted
    Given a kg-export.ts line with "--scope instance" and no "--instance"
    When its published instances are read
    Then none are found

  @test:scripts/tests/check-published-instance-exports.test.ts::publishesNoInstanceGraph::no_deploy_workflow_and_no_publisher_named_anywhere:_determined,_with_a_reason
  Scenario: No deploy workflow and no publisher named is determined, with a reason
    Given workflows "ghbuild.yml" and "release.yml" that name no graph export
    When they are asked whether they publish no instance graph
    Then the reason contains "publishes no instance graph"

  @test:scripts/tests/check-published-instance-exports.test.ts::publishesNoInstanceGraph::the_deploy_workflow_present:_not_determined,_judged_as_before
  Scenario: A present deploy workflow is not determined
    Given a workflow set holding "docs-site.yml"
    When they are asked whether they publish no instance graph
    Then there is no reason

  @test:scripts/tests/check-published-instance-exports.test.ts::publishesNoInstanceGraph::a_publisher_named_in_a_line_the_patterns_miss:_not_determined_(the_pattern_may_have_drifted)
  Scenario: A publisher named in a line the patterns miss is not determined
    Given a workflow naming kg-export.ts with "--instance" on a continuation line
    When they are asked whether they publish no instance graph
    Then there is no reason

  @test:scripts/tests/check-published-instance-exports.test.ts::formatReport::finding_nothing_is_reported_as_examining_nothing,_NOT_as_a_pass
  Scenario: Finding no invocation is reported as examining nothing
    Given no invocations and no results over 39 workflow files read
    When the report is formatted
    Then it contains "EXAMINED NOTHING" and "39 workflow file(s)"
    And it contains no tick

  @test:scripts/tests/check-published-instance-exports.test.ts::formatReport::an_unreadable_workflow_is_its_own_state,_and_says_so
  Scenario: An unreadable workflow is reported as its own state
    Given no invocations and an unreadable "x.yml"
    When the report is formatted
    Then it contains "COULD NOT READ" and "not a pass"
    And it contains no tick

  @test:scripts/tests/check-published-instance-exports.test.ts::formatReport::an_unreadable_workflow_OUTRANKS_green_results_—_a_partial_sweep_is_not_a_clean_one
  Scenario: An unreadable workflow outranks passing results
    Given a passing docs-site.yml result for "./bootstrap" and an unreadable "feature-staging.yml"
    When the report is formatted
    Then it contains "COULD NOT READ" and "partial"
    And it does not claim "every graph a workflow publishes builds"

  @test:scripts/tests/check-published-instance-exports.test.ts::formatReport::each_row_names_its_workflow,_so_two_files'_results_cannot_be_confused
  Scenario: Each result row names its workflow
    Given passing "./bootstrap" results from docs-site.yml and feature-staging.yml
    When the report is formatted
    Then it contains "docs-site.yml: ./bootstrap" and "feature-staging.yml: ./bootstrap"
    And it contains "2 workflow(s)"

  @test:scripts/tests/check-published-instance-exports.test.ts::formatReport::a_stood-in_base_is_disclosed,_never_presented_as_the_workflow's_own_run
  Scenario: A stood-in base is disclosed
    Given a passing feature-staging.yml result run with a stand-in base
    When the report is formatted
    Then it contains "stood in"

  @test:scripts/tests/check-published-instance-exports.test.ts::formatReport::the_node_count_rides_with_the_tick,_so_a_drop_to_nothing_is_visible
  Scenario: The node count is shown with a passing result
    Given a passing result with 85 nodes
    When the report is formatted
    Then it contains "85 node(s)"

  @test:scripts/tests/check-published-instance-exports.test.ts::formatReport::a_failure_names_the_workflow,_the_instance,_and_what_the_export_reported
  Scenario: A failure names the workflow, the instance and the export's message
    Given a failing docs-site.yml result for "./bootstrap" with detail "no canonicalUrl in x"
    When the report is formatted
    Then it contains "✗ docs-site.yml: ./bootstrap"
    And it contains "no canonicalUrl in x"

  @test:scripts/tests/check-published-instance-exports.test.ts::formatReport::a_failure_that_said_nothing_is_distinguishable_from_one_that_did
  Scenario: A failure with no diagnosis says so
    Given a failing result with detail "exited 1 with no diagnosis"
    When the report is formatted
    Then it contains "no diagnosis"

  @test:scripts/tests/check-published-instance-exports.test.ts::committedSidecarSubjects_—_the_comparison_has_a_subject_(bean_r7v6,_C2)::a_committed_foreign_sidecar_that_only_export-graph_invocations_cover_becomes_a_subject
  Scenario: A committed foreign sidecar covered only by export-graph becomes a subject
    Given a QA directory with "kg-export.bootstrap.qa-results.json", "kg-export.qa-results.json" and "other.qa-results.json"
    And an export-graph invocation for "./bootstrap"
    When the committed sidecar subjects are listed
    Then the only subject is "./bootstrap"
    And it is attributed to the committed sidecar and the "kg-export" tool

  @test:scripts/tests/check-published-instance-exports.test.ts::committedSidecarSubjects_—_the_comparison_has_a_subject_(bean_r7v6,_C2)::a_sidecar_a_workflow's_kg-export_invocation_already_covers_is_not_compared_twice
  Scenario: A sidecar already covered by a kg-export invocation is not a subject
    Given a QA directory with "kg-export.bootstrap.qa-results.json"
    And a kg-export invocation for "./bootstrap"
    When the committed sidecar subjects are listed
    Then there are none

  @test:scripts/tests/check-published-instance-exports.test.ts::committedSidecarSubjects_—_the_comparison_has_a_subject_(bean_r7v6,_C2)::the_real_checkout's_committed_bootstrap_sidecar_is_a_subject_—_or_its_absence_is_UNKNOWN,_never_an_empty_list
  Scenario: The real bootstrap sidecar is a subject, or its absence is unknown
    Given the published instances of the real docs-site.yml
    When the sidecar subjects are derived
    Then if they are unknown, the subject list is empty and the reason mentions "--against"
    And otherwise "./bootstrap" is a subject, both derived and committed

  @test:scripts/tests/check-published-instance-exports.test.ts::committedSidecarSubjects_—_the_comparison_has_a_subject_(bean_r7v6,_C2)::an_unlisted_subject_set_is_reported,_not_dropped
  Scenario: A subject set that could not be listed is reported
    Given a report input whose sidecar subjects are unknown because "cat-harness/test/results is not in this checkout"
    When the report is formatted
    Then it contains "UNKNOWN" and "NOT made"

  @test:scripts/tests/check-published-instance-exports.test.ts::committedSidecarSubjects_—_the_comparison_has_a_subject_(bean_r7v6,_C2)::the_report_says_a_compared_sidecar_has_no_workflow_producer,_and_shows_each_row's_sidecar_state
  Scenario: The report states a compared sidecar has no workflow producer and each row's sidecar state
    Given a passing export-graph result and a committed bootstrap sidecar result that is stale
    When the report is formatted
    Then it contains "1 committed sidecar(s) compared"
    And it contains "writes no QA sidecar" and "QA sidecar stale"
    And it says no workflow runs kg-export.ts --instance for "./bootstrap"

  @test:scripts/tests/check-published-instance-exports.test.ts::the_bootstrap_kg-export_sidecar_has_a_WORKFLOW_producer_(bean_0utt)::code-quality-gates.yml_runs_`kg-export.ts_--instance_./bootstrap`,_so_the_sidecar_is_no_orphan
  Scenario: code-quality-gates.yml produces the bootstrap kg-export sidecar
    Given the repository's ".github/workflows/code-quality-gates.yml"
    When its published instances are read
    Then a kg-export invocation for "./bootstrap" is among them
    And when the sidecar subjects are known, "./bootstrap" is not one of them

  @test:scripts/tests/check-published-instance-exports.test.ts::the_bootstrap_kg-export_sidecar_has_a_WORKFLOW_producer_(bean_0utt)::the_producer_step_is_in_the_PUBLISH_job,_ahead_of_the_publish
  Scenario: The producer step runs in the qa-publish job before the publish
    Given the text of code-quality-gates.yml from the "qa-publish:" job onward
    Then it contains "kg-export.ts --instance ./bootstrap"
    And that line comes before "bun run cat qa:publish"
