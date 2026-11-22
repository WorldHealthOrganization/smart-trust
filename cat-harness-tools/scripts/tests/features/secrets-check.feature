# secrets:check: names only, three states, and could-not-determine never
# reads as clean. Each Scenario names the test that executes it.
Feature: Checking declared secrets

  @test:scripts/tests/secrets-check.test.ts::reading_workflow_references::only_`${{_secrets.NAME_}}`_counts_—_`secrets.token_hex`_in_a_script_does_not
  Scenario: Only workflow secret expressions count as references
    Given a workflow using two secrets in expressions and Python's secrets.token_hex in a run step
    When its secret references are read
    Then they are PUBLISH_SITE_BOOTSTRAP and PUSH_BRANCH_TRIGGERING_CI

  @test:scripts/tests/secrets-check.test.ts::reading_workflow_references::files_are_read_by_name;_no_needs.json_is_UNDECLARED,_not_an_empty_declaration
  Scenario: A repository without needs.json is undeclared
    Given a repository whose one workflow uses NPM_TOKEN and has no needs.json
    When its files are read
    Then a.yml uses NPM_TOKEN
    And the declaration and registry are undefined

  @test:scripts/tests/secrets-check.test.ts::three_states::a_fully_declared,_present,_unexpiring_set_is_clean_(exit_0)
  Scenario: A declared, present, unexpiring set is clean
    When a fully consistent repository is judged
    Then there are no findings and nothing undetermined, and the exit code is 0

  @test:scripts/tests/secrets-check.test.ts::three_states::no_needs.json_is_COULD_NOT_DETERMINE_(exit_2),_never_clean
  Scenario: No needs.json is could-not-determine
    When a repository with no declared needs is judged
    Then "declared-needs" is undetermined and the exit code is 2

  @test:scripts/tests/secrets-check.test.ts::three_states::unlisted_names_(a_403)_are_could-not-determine,_and_outrank_a_major_finding
  Scenario: Unlistable secret names outrank a finding
    Given the present secrets could not be listed (HTTP 403) and a workflow uses an undeclared secret
    When it is judged
    Then a used-not-declared finding is reported
    And the exit code is 2

  @test:scripts/tests/secrets-check.test.ts::findings,_named::used-not-declared,_declared-not-used,_declared-not-present,_present-not-declared
  Scenario: The four mismatch findings are named
    Given a workflow using UNDECLARED and GITHUB_TOKEN, a declaration of PUBLISH_SITE_BOOTSTRAP, and only ORPHAN present
    When it is judged
    Then UNDECLARED is used-not-declared
    And PUBLISH_SITE_BOOTSTRAP is declared-not-used and declared-not-present
    And ORPHAN is present-not-declared
    And GITHUB_TOKEN is never a finding
    And the exit code is 1

  @test:scripts/tests/secrets-check.test.ts::findings,_named::a_`degrade`_need_missing_is_minor;_a_`fail`_need_missing_is_major
  Scenario: Missing need severity follows its declared consequence
    Then a missing secret declared "degrade" is a minor declared-not-present finding
    And a missing secret declared "fail" is major

  @test:scripts/tests/secrets-check.test.ts::findings,_named::a_mechanism-named_secret_is_advisory;_the_App's_identity_key_is_the_stated_exception
  Scenario: A mechanism-named secret is advisory
    Given a workflow using BOOTSTRAP_PAGES_TOKEN and HARNESS_BOT_PRIVATE_KEY
    When it is judged
    Then the only naming-rule finding is BOOTSTRAP_PAGES_TOKEN, advisory

  @test:scripts/tests/secrets-check.test.ts::findings,_named::expiry:_>30_days_nothing,_≤30_minor,_≤7_major,_past_critical
  Scenario: Expiry severities
    Given today is 2026-10-11
    Then a secret expiring 2026-12-01 gives no finding
    And 2026-11-01 gives minor, 2026-10-15 major and 2026-10-01 critical

  @test:scripts/tests/secrets-check.test.ts::bun_run_health::undeclared_needs_are_a_MAJOR_finding_there_—_not_clean_—_and_the_result_validates
  Scenario: In health, undeclared needs are a major finding
    Given a repository with a workflow and no needs.json
    When the secrets health check runs
    Then the result validates against the health schema with state "finding"
    And secret-needs-undetermined is major with a summary saying declared needs could not be determined for o/r

  @test:scripts/tests/secrets-check.test.ts::bun_run_health::every_threshold_states_its_basis
  Scenario: Every health threshold states its basis
    When the secrets health check runs over no repositories
    Then every threshold's basis is longer than 20 characters
    And the threshold values are 30, 7, 0 and 0
