# scripts/security-gate.ts runs the security checks, each pinned to its command, and judges third-party
# action pinning in the workflows; a blocking failure or an unknown refuses the gate.
# Each Scenario names the test that executes it.
Feature: Security gate

  @test:test/security-gate.test.ts::security:gate::a_check_that_cannot_be_run_is_UNKNOWN,_and_unknown_blocks
  Scenario: A check that cannot be run is unknown, and an unknown blocks
    Given a repository whose package.json has no scripts
    When the blocking check "check:does-not-exist" is run
    Then its state is "unknown"
    And blocks reports one blocking result

  @test:test/security-gate.test.ts::security:gate::an_advisory_failure_never_blocks
  Scenario: An advisory failure does not block
    Given a non-blocking result in state "fail"
    When blocks judges it
    Then no blocking result is reported

  @test:test/security-gate.test.ts::security:gate::a_failing_blocking_check_refuses
  Scenario: A failing blocking check refuses the gate
    Given a repository with script "check:always-fails" set to "exit 3", pinned to that same command
    When the blocking check is run
    Then its state is "fail"
    And its detail does not mention "pins"
    And blocks reports one blocking result

  @test:test/security-gate.test.ts::security:gate::a_check_NOT_APPLICABLE_here_(exit_78)_is_UNKNOWN_with_its_reason,_never_a_refusal,_and_still_blocks
  Scenario: A check exiting 78 is unknown with its reason and still blocks
    Given a repository with script "check:not-here" that echoes "no corpus here" and exits 78, pinned to that command
    When the blocking check is run
    Then its state is "unknown"
    And its detail is "not applicable in this root — no corpus here"
    And blocks reports one blocking result

  @test:test/security-gate.test.ts::each_gate_check_is_pinned_to_its_command_(roast_1ygp_L4.5)::repointing_a_check_to_`true`_makes_the_gate_REFUSE,_without_running_it
  Scenario: A gate check repointed to "true" fails against its pin
    Given a repository whose "check:secret-leaks" script is "true"
    When the blocking check "check:secret-leaks" is run
    Then its state is "fail"
    And its detail mentions "pins" and the pinned command for "check:secret-leaks"
    And blocks reports one blocking result
    # Gap: that the repointed command is not executed is not checked.

  @test:test/security-gate.test.ts::each_gate_check_is_pinned_to_its_command_(roast_1ygp_L4.5)::a_command_that_wraps_the_pinned_one_but_does_something_else_is_refused_too
  Scenario: A command wrapping the pinned one is refused
    Given a repository whose "check:bun-pin" script is its pinned command followed by "|| true"
    When the blocking check "check:bun-pin" is run
    Then its state is "fail"

  @test:test/security-gate.test.ts::each_gate_check_is_pinned_to_its_command_(roast_1ygp_L4.5)::a_check_with_no_pin_is_refused,_and_an_absent_one_stays_UNKNOWN
  Scenario: An unpinned check is refused and an absent check stays unknown
    Given a repository with script "check:new" set to "true" and no pin for it
    When "check:new" is run
    Then its state is "fail"
    And running the absent "check:absent" gives state "unknown"

  @test:test/security-gate.test.ts::each_gate_check_is_pinned_to_its_command_(roast_1ygp_L4.5)::every_gate_check_has_a_pin,_and_every_pin_matches_this_checkout's_manifests
  Scenario: Every gate check is pinned and every pin matches the checkout's manifests
    Given the script table of the composed checkout, which is not empty
    Then every security check has an entry in the pinned commands
    And every security check present in the table has the command its pin resolves to
    And the pinned commands name exactly the security checks

  @test:test/security-gate.test.ts::pinned_means_a_SHA_and_its_#_<ref>_(roast_1ygp_L4.6)::a_SHA_with_no_#_<ref>_comment_is_unpinned-unlabelled_and_BLOCKS
  Scenario: A SHA without a ref comment is unpinned-unlabelled and blocks
    Given a workflow using "actions/checkout" at a 40-hex SHA with no "# <ref>" comment
    When unpinnedActions scans it
    Then one unpinned use is reported, marked "unpinned-unlabelled"
    And the published action-pinning result is "fail" and blocks

  @test:test/security-gate.test.ts::pinned_means_a_SHA_and_its_#_<ref>_(roast_1ygp_L4.6)::a_flow-mapping_uses:_is_seen,_and_blocks_when_unpinned
  Scenario: A flow-mapping uses is seen and reported when unpinned
    Given a workflow step written as "{uses: owner/x@main, with: {a: 1}}"
    When unpinnedActions scans it
    Then the total is 1
    And the unpinned entry names "owner/x@main"
    # Gap: the blocking verdict is not checked.

  @test:test/security-gate.test.ts::pinned_means_a_SHA_and_its_#_<ref>_(roast_1ygp_L4.6)::a_docker://_image_by_tag_is_reported,_advisory_only;_a_digest_passes
  Scenario: A docker image by tag is an advisory failure and a digest is not reported
    Given a workflow using "docker://alpine:latest" and "docker://alpine" by sha256 digest
    When actionPinning judges it
    Then the "docker-image-digest-pinning" result is a non-blocking "fail"
    And its detail names "docker://alpine:latest" but not the digest
    And nothing blocks

  @test:test/security-gate.test.ts::pinned_means_a_SHA_and_its_#_<ref>_(roast_1ygp_L4.6)::only_a_full_40-hex_SHA_counts_as_pinned;_local_and_docker_refs_are_not_third-party
  Scenario: Only a full 40-hex SHA counts as pinned, and local and docker refs are not counted
    Given a workflow using "actions/checkout@v4", "actions/setup-node" at a full SHA with "# v4", "owner/short@0123456", a local action and "docker://alpine:3"
    When unpinnedActions scans it
    Then the total is 3
    And the unpinned uses are "actions/checkout@v4" and "owner/short@0123456"
    And the first action-pinning result is "fail"

  @test:test/security-gate.test.ts::pinned_means_a_SHA_and_its_#_<ref>_(roast_1ygp_L4.6)::no_workflows_directory_is_unknown,_not_pass
  Scenario: A repository without a workflows directory is unknown
    Given a repository with no ".github/workflows" directory
    When actionPinning judges it
    Then the first result's state is "unknown"

  @test:test/security-gate.test.ts::action_pinning_follows_the_owner's_staging_ruling::an_unpinned_action_BLOCKS_outside_staging_and_is_advisory_in_a_staging-only_workflow
  Scenario: An unpinned action blocks in a published workflow and is advisory in a staging workflow
    Given "ci.yml" and "feature-staging.yml" each using "actions/checkout@v4"
    When actionPinning judges the repository
    Then the published result is a blocking "fail"
    And the staging result is a non-blocking "fail"
    And exactly one result blocks

  @test:test/security-gate.test.ts::action_pinning_follows_the_owner's_staging_ruling::first-party_reusable_workflows_are_not_third-party
  Scenario: First-party reusable workflows are not counted as third-party
    Given a workflow using reusable workflows from "litlfred/folio-assistant" and "litlfred/cat-harness-tools" at "@main"
    When unpinnedActions scans it
    Then the total is 0

  @test:test/security-gate.test.ts::a_staging_workflow_that_holds_a_write_token_is_NOT_exempt_(owner_2026-10-07,_roast_1ygp_L4.1)::an_unpinned_action_in_it_blocks
  Scenario: An unpinned action in a staging workflow with a write token blocks
    Given only "feature-staging.yml" with "contents: write" permission using "actions/checkout@v4"
    When actionPinning judges the repository
    Then the published result is a blocking "fail"

  @test:test/security-gate.test.ts::checks_moved_into_a_layer's_checkoutScripts_are_still_run_(#2448)::a_layer_script_is_found_and_run,_not_reported_unknown
  Scenario: A check declared in a layer's checkoutScripts is found
    Given the real checkout, where "check:secret-leaks" lives in a layer's checkoutScripts
    When the blocking check "check:secret-leaks" is run
    Then its state is not "unknown"

  @test:test/security-gate.test.ts::layer_checkout_support_(bean_cat-tools-q8gk)::check:materialized-fixity_resolves_from_whichever_layer_declares_it
  Scenario: The materialized-fixity pin resolves under the declaring layer
    When pinnedCommandFor resolves "check:materialized-fixity" for layer "folio-assistant-core"
    Then it is "bun run folio-assistant-core/scripts/check-materialized-fixity.ts"
    And for layer "custom-content-layer" it is "bun run custom-content-layer/scripts/check-materialized-fixity.ts"
    And for no layer it is "bun run scripts/check-materialized-fixity.ts"

  @test:test/security-gate.test.ts::layer_checkout_support_(bean_cat-tools-q8gk)::from_a_layer_checkout,_each_check_either_runs_or_reports_a_named_unknown_without_a_stack_trace
  Scenario: From a layer checkout every check passes or is unknown without a stack trace
    Given this layer's own root
    When securityGate runs every check over it
    Then every result's state is "pass" or "unknown"
    And no detail contains "ENOENT", "Cannot find module" or a stack-frame line
