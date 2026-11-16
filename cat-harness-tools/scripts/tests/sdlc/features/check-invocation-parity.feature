# scripts/check-invocation-parity.ts checks that every preview workflow runs the generators and named checks the deploy
# workflow runs, with the same instance arguments, and reports when it cannot tell. Each Scenario names the test that executes it.
Feature: Preview workflows run what the deploy runs

  @test:scripts/tests/sdlc/check-invocation-parity.test.ts::invocations::a_bootstrap-tools_script_is_its_own_obligation,_and_`--root`_is_its_instance
  Scenario: A bootstrap-tools script is its own obligation with --root as its instance
    Given workflow text running bootstrap-tools "export-graph.ts" with "--root ./no-such-instance" and cat-harness "kg-export.ts"
    When its invocations are read
    Then they are "bootstrap-tools/export-graph" with instance "./no-such-instance", and "kg-export" with no instance

  @test:scripts/tests/sdlc/check-invocation-parity.test.ts::invocations::`kg-export`_and_`kg-export_--instance_X`_are_DIFFERENT_obligations
  Scenario: kg-export with and without --instance are separate obligations
    Given workflow text running "kg-export.ts" once plainly and once with "--instance ./no-such-instance"
    When its invocations are read
    Then there are 2 invocations
    And their instances are none and "./no-such-instance"

  @test:scripts/tests/sdlc/check-invocation-parity.test.ts::invocations::a_check_the_deploy_runs_BY_SCRIPT_NAME_is_an_obligation_too_(63es)
  Scenario: A check run by script name is an obligation
    Given workflow text running "bun run check:no-such-check ./_site" and "kg-export.ts"
    When its invocations are read
    Then they are "check:no-such-check" and "kg-export"

  @test:scripts/tests/sdlc/check-invocation-parity.test.ts::invocations::a_named_check_mentioned_only_in_a_COMMENT_is_not_an_obligation
  Scenario: A named check mentioned only in a comment is not an obligation
    Given workflow text where "bun run check:no-such-check" appears only in a "#" comment
    When its invocations are read
    Then there are none

  @test:scripts/tests/sdlc/check-invocation-parity.test.ts::invocations::the_real_deploy's_built-site_checks_are_obligations_the_real_preview_meets
  Scenario: The real deploy's built-site checks are also run by the real preview
    Given the repository's "docs-site.yml" and "feature-staging.yml" workflows
    When the invocations of each are read
    Then the deploy runs "check:escaped-markup" and "check:maintained-artefacts"
    And the preview runs both of them too

  @test:scripts/tests/sdlc/check-invocation-parity.test.ts::invocations::a_repeated_invocation_is_counted_once
  Scenario: A repeated invocation is counted once
    Given workflow text running "ns-export.ts" twice with different "--layer" arguments
    When its invocations are read
    Then the only invocation is "ns-export"

  @test:scripts/tests/sdlc/check-invocation-parity.test.ts::invocations::a_generator_named_only_in_a_COMMENT_is_not_an_invocation
  Scenario: A generator named only in a comment is not an invocation
    Given workflow text that names "kg-export.ts" only in a "#" comment
    When its invocations are read
    Then there are none
    And the text with comments stripped does not contain "kg-export"

  @test:scripts/tests/sdlc/check-invocation-parity.test.ts::invocations::the_real_deploy_workflow's_set_includes_the_foreign-instance_export
  Scenario: The real deploy includes the bootstrap graph export
    Given the repository's "docs-site.yml" workflow
    When its invocations are read
    Then one of them is "bootstrap-tools/export-graph" with instance "./bootstrap"

  @test:scripts/tests/sdlc/check-invocation-parity.test.ts::isDeploy::no_`--base-url`_on_the_graph_export_means_it_publishes_at_the_canonical_base
  Scenario: A graph export with no --base-url is a deploy
    Given a "kg-export.ts" command with an "--out" path and no "--base-url"
    When it is classified
    Then it is a deploy

  @test:scripts/tests/sdlc/check-invocation-parity.test.ts::isDeploy::a_`--base-url`_means_a_preview_naming_itself
  Scenario: A graph export with --base-url is a preview
    Given a "kg-export.ts" command with "--base-url" and an "--out" path
    When it is classified
    Then it is not a deploy

  @test:scripts/tests/sdlc/check-invocation-parity.test.ts::isDeploy::the_real_pair_classifies_without_either_being_named_in_the_check
  Scenario: The real deploy and preview workflows classify from their own text
    Given the repository's "docs-site.yml" and "feature-staging.yml" workflows
    When each is classified
    Then "docs-site.yml" is a deploy
    And "feature-staging.yml" is not

  @test:scripts/tests/sdlc/check-invocation-parity.test.ts::EXEMPT::every_exemption_carries_a_reason
  Scenario: Every exemption carries a reason
    Given the exemption list
    Then every exemption's reason is longer than 20 characters

  @test:scripts/tests/sdlc/check-invocation-parity.test.ts::EXEMPT::each_exempt_generator_really_is_one_the_deploy_runs
  Scenario: Every exempt generator is one the real deploy runs
    Given the exemption list and the invocations of the repository's "docs-site.yml"
    Then every exempt script is among the deploy's invocations

  @test:scripts/tests/sdlc/check-invocation-parity.test.ts::formatReport::no_preview_is_reported_as_examining_nothing,_NOT_as_a_pass
  Scenario: A report with no preview workflow says it examined nothing
    Given a result naming deploy "docs-site.yml" with no peers and no stale exemptions
    When the report is formatted
    Then it contains "EXAMINED NOTHING"
    And it contains no check mark

  @test:scripts/tests/sdlc/check-invocation-parity.test.ts::formatReport::no_identifiable_deploy_is_could-not-determine,_NOT_a_pass
  Scenario: A report with no identifiable deploy says it could not determine
    Given a result with no deploy, no peers and an unreadable reason
    When the report is formatted
    Then it contains "COULD NOT DETERMINE" and "not a pass"
    And it contains no check mark

  @test:scripts/tests/sdlc/check-invocation-parity.test.ts::formatReport::a_stale_exemption_is_a_finding_in_its_own_right
  Scenario: A stale exemption is reported as a finding
    Given a result with a clean preview peer and the stale exemption "gone-export"
    When the report is formatted
    Then it contains "EXEMPTION IS STALE" and "gone-export"

  @test:scripts/tests/sdlc/check-invocation-parity.test.ts::formatReport::a_missing_invocation_names_the_instance_argument,_not_just_the_script
  Scenario: A missing invocation is reported with its instance argument
    Given a result whose preview is missing "kg-export" for instance "./no-such-instance"
    When the report is formatted
    Then it contains "kg-export --instance ./no-such-instance"

  @test:scripts/tests/sdlc/check-invocation-parity.test.ts::formatReport::a_clean_run_prints_the_exemptions_with_their_reasons
  Scenario: A clean report lists the exemptions
    # Gap: the reasons' text is not checked, only the heading and one exempt script name
    Given a result with a clean preview peer and no stale exemptions
    When the report is formatted
    Then it contains "exempt, each with its reason"
    And it contains "fsh-guts-export"

  @test:scripts/tests/sdlc/check-invocation-parity.test.ts::checkInvocationParity_over_a_workflows_directory::no_workflow_builds_a_site_and_exports_the_graph:_not_applicable,_not_a_pass
  Scenario: A workflows directory with no site-building graph export is not applicable
    Given a workflows directory holding a reusable-workflow caller and a translations workflow
    When invocation parity is checked over it
    Then the not-applicable note mentions "2 workflow(s)"
    And there is no unreadable reason
    And there are no peers

  @test:scripts/tests/sdlc/check-invocation-parity.test.ts::checkInvocationParity_over_a_workflows_directory::a_graph-exporting_site_workflow_with_no_deploy_is_still_could-not-determine
  Scenario: A graph-exporting site workflow with no deploy cannot be determined
    Given a workflows directory whose only workflow runs "kg-export.ts" with "--base-url"
    When invocation parity is checked over it
    Then there is no not-applicable note
    And the unreadable reason contains "deploy cannot be identified"
