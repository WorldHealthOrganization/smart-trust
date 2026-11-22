# scripts/check-bun-pin.ts checks that every workflow's setup-bun step installs the Bun version named in .bun-version,
# following reusable-workflow calls into mounted layers. Each Scenario names the test that executes it.
Feature: Every workflow installs the pinned Bun

  @test:scripts/tests/sdlc/bun-pin.test.ts::readPinFile::a_bare_version,_with_or_without_a_trailing_newline
  Scenario: A bare version is read from the pin file, with or without a trailing newline
    Given a pin file holding "1.3.14" followed by a newline
    When the pin file is read
    Then the pin is "1.3.14"
    And the same text without the trailing newline also reads as "1.3.14"

  @test:scripts/tests/sdlc/bun-pin.test.ts::readPinFile::`latest`_is_NOT_a_version_—_that_is_the_whole_point_of_the_file
  Scenario: "latest" in the pin file is not a version
    Given a pin file holding "latest"
    When the pin file is read
    Then no pin is returned

  @test:scripts/tests/sdlc/bun-pin.test.ts::readPinFile::a_`v`_prefix_is_refused,_because_that_is_not_what_the_action_takes
  Scenario: A "v" prefix in the pin file is refused
    Given a pin file holding "v1.3.14"
    When the pin file is read
    Then no pin is returned

  @test:scripts/tests/sdlc/bun-pin.test.ts::readPinFile::an_empty_or_commentary_file_yields_nothing_rather_than_a_guess
  Scenario: An empty or commentary-only pin file yields no pin
    Given an empty pin file
    When the pin file is read
    Then no pin is returned
    And a pin file holding only a "#" comment line also returns no pin

  @test:scripts/tests/sdlc/bun-pin.test.ts::auditWorkflow_—_falsified_by_breaking::a_site_pinned_to_the_expected_version_is_clean
  Scenario: A setup-bun site pinned to the expected version is clean
    Given a workflow whose one setup-bun step pins "1.3.14"
    When the workflow is audited against "1.3.14"
    Then it reports 1 site and no findings

  @test:scripts/tests/sdlc/bun-pin.test.ts::auditWorkflow_—_falsified_by_breaking::a_DISAGREEING_site_is_caught,_and_the_finding_names_the_version_found
  Scenario: A disagreeing site is caught and the finding names the version found
    Given a workflow whose setup-bun step in job "build", step "bun", pins "1.4.2"
    When the workflow is audited against "1.3.14"
    Then the single finding is "disagrees" for workflow "a.yml", job "build", step "bun", found "1.4.2"

  @test:scripts/tests/sdlc/bun-pin.test.ts::auditWorkflow_—_falsified_by_breaking::`latest`_is_a_disagreement_like_any_other,_not_a_special_case
  Scenario: A "latest" pin is reported as an ordinary disagreement
    Given a workflow whose setup-bun step pins "latest"
    When the workflow is audited against "1.3.14"
    Then the first finding is "disagrees" with found "latest"

  @test:scripts/tests/sdlc/bun-pin.test.ts::auditWorkflow_—_falsified_by_breaking::an_UNPINNED_site_is_caught_—_silence_is_not_agreement
  Scenario: An unpinned setup-bun site is caught
    Given a workflow whose setup-bun step has no bun-version
    When the workflow is audited against "1.3.14"
    Then the single finding is "unpinned" for workflow "a.yml", job "build", step "bun"

  @test:scripts/tests/sdlc/bun-pin.test.ts::auditWorkflow_—_falsified_by_breaking::a_numeric_YAML_value_is_compared_AS_WRITTEN,_not_normalised
  Scenario: A numeric YAML bun-version is compared as written
    Given a workflow whose setup-bun step pins the number 1.3
    When the workflow is audited against "1.3.14"
    Then the first finding is "disagrees" with found "1.3"

  @test:scripts/tests/sdlc/bun-pin.test.ts::auditWorkflow_—_falsified_by_breaking::a_step_that_is_not_setup-bun_is_not_a_site
  Scenario: A step that is not setup-bun is not counted as a site
    Given a workflow whose only versioned step uses "actions/setup-node@v4"
    When the workflow is audited against "1.3.14"
    Then it reports 0 sites and no findings

  @test:scripts/tests/sdlc/bun-pin.test.ts::auditWorkflow_—_falsified_by_breaking::a_pinned_action_ref_still_counts_as_a_site
  Scenario: A setup-bun step pinned to a commit ref still counts as a site
    Given an unpinned step using "oven-sh/setup-bun@abc123"
    When the workflow is audited against "1.3.14"
    Then it reports 1 site

  @test:scripts/tests/sdlc/bun-pin.test.ts::auditWorkflow_—_falsified_by_breaking::several_jobs_are_all_walked,_and_each_finding_names_its_own_job
  Scenario: Every job is walked and each finding names its own job
    Given job "one" pins setup-bun to "1.4.2" and job "two" runs setup-bun unpinned
    When the workflow is audited against "1.3.14"
    Then it reports 2 sites
    And the findings are "disagrees" for job "one" and "unpinned" for job "two", in that order

  @test:scripts/tests/sdlc/bun-pin.test.ts::auditWorkflow_—_falsified_by_breaking::a_workflow_with_no_jobs,_and_a_null_document,_yield_nothing_rather_than_throwing
  Scenario: A workflow with no jobs, or a null document, yields nothing without throwing
    Given a workflow with an empty jobs map
    When it is audited against "1.3.14"
    Then it reports 0 sites and no findings
    And a null document also reports 0 sites and no findings

  @test:scripts/tests/sdlc/bun-pin.test.ts::reusable_workflows_—_a_site_that_only_calls_them_(re-pin_wave_5)::job-level_uses:_are_the_calls;_step-level_uses:_are_not
  Scenario: Only job-level uses are counted as reusable-workflow calls
    Given a workflow where job "a" uses "o/r/.github/workflows/x.yml@v1" and job "b" has a step using "actions/checkout@v7"
    When its reusable calls are listed
    Then the only call is "o/r/.github/workflows/x.yml@v1"
    And a null document lists no calls

  @test:scripts/tests/sdlc/bun-pin.test.ts::reusable_workflows_—_a_site_that_only_calls_them_(re-pin_wave_5)::a_local_call_is_the_repository's_own_file,_already_scanned
  Scenario: A local reusable call resolves to the repository's own file
    Given a call to "./.github/workflows/x.yml"
    When the call is resolved
    Then it resolves to "local"

  @test:scripts/tests/sdlc/bun-pin.test.ts::reusable_workflows_—_a_site_that_only_calls_them_(re-pin_wave_5)::a_call_into_a_MOUNTED_layer_is_followed,_and_a_disagreeing_pin_there_is_caught
  Scenario: A call into a mounted layer is followed and its disagreeing pin is caught
    Given a checkout pinned to "1.4.4" whose workflow calls "litlfred/cat-harness-tools/.github/workflows/layer-pr-checks.yml@main"
    And the mounted cat-harness-tools layer's called workflow pins setup-bun to "1.4.2"
    When the gate runs over the checkout
    Then it reports 1 site
    And the single finding is "disagrees" for "cat-harness-tools/.github/workflows/layer-pr-checks.yml", job "t", step "step 1", found "1.4.2"
    And nothing is reported as delegated

  @test:scripts/tests/sdlc/bun-pin.test.ts::reusable_workflows_—_a_site_that_only_calls_them_(re-pin_wave_5)::a_call_whose_file_is_not_in_the_checkout_is_named_as_delegated,_not_silently_passed
  Scenario: A call whose file is not in the checkout is reported as delegated
    Given a checkout pinned to "1.4.4" whose workflow calls the layer-pr-checks workflow of cat-harness-tools
    And the called workflow is not present in the checkout
    When the gate runs over the checkout
    Then it reports 0 sites
    And the delegated list is exactly "litlfred/cat-harness-tools/.github/workflows/layer-pr-checks.yml@main"

  @test:scripts/tests/sdlc/bun-pin.test.ts::reusable_workflows_—_a_site_that_only_calls_them_(re-pin_wave_5)::no_setup-bun_and_no_calls_is_still_'could_not_determine'_material:_nothing_delegated
  Scenario: A checkout with no setup-bun step and no calls delegates nothing
    # Gap: the "could not determine" outcome itself is not asserted, only the zero sites and absent delegation
    Given a checkout whose only workflow runs "actions/checkout@v7"
    When the gate runs over the checkout
    Then it reports 0 sites
    And nothing is reported as delegated
