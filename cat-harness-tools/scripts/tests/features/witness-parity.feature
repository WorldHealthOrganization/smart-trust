# witness:parity: re-running a computation witness's producer in a throwaway
# git repository and comparing. Each Scenario names the test that executes it.
Feature: Witness parity

  @test:scripts/tests/witness-parity.test.ts::stripEphemeral::removes_run-specific_fields_at_every_depth_and_keeps_the_rest
  Scenario: Run-specific fields are stripped at every depth
    Given a witness with computedAt, a nested elapsed_s, a durationMs inside an array, and an environment
    Then stripping leaves only the data without those fields

  @test:scripts/tests/witness-parity.test.ts::stripEphemeral::masks_extra_keys_on_request
  Scenario: Extra keys can be masked
    Then stripping with key "b" masked leaves only "a"

  @test:scripts/tests/witness-parity.test.ts::diffPaths::ignores_key_order_and_names_each_differing_path
  Scenario: Differences are named by path, ignoring key order
    Then two objects differing only in key order have no differences
    And a changed value, a changed array item and an added key are named "$.a", "$.b[1]" and "$.c (added)"
    And arrays of different length are named "$ (length 1 → 2)"

  @test:scripts/tests/witness-parity.test.ts::environmentMismatch::reports_a_missing_or_different_package,_and_skips_build_fingerprints
  Scenario: A missing package is a mismatch; build fingerprints are skipped
    Given a recorded environment with python, mpmath, pyhecke_native and its build fingerprint
    When only python and mpmath are installed at the recorded versions
    Then the only mismatch is pyhecke_native, recorded 0.9.0, installed none

  @test:scripts/tests/witness-parity.test.ts::environmentMismatch::treats_a_witness_with_no_environment_as_matching
  Scenario: No recorded environment matches
    Then a witness with no environment has no mismatches

  @test:scripts/tests/witness-parity.test.ts::checkParity::passes_when_the_producer_rewrites_the_same_witness,_run-specific_fields_aside
  Scenario: The same witness rewritten passes
    Given a committed witness and a producer that writes it back with new computedAt and durationMs
    Then the verdict is "pass"

  @test:scripts/tests/witness-parity.test.ts::checkParity::fails,_naming_the_path,_when_the_producer_writes_a_different_value
  Scenario: A different value fails, naming the path
    Given a producer that writes data.x 2 where the witness has 1
    Then the verdict is "fail" with difference "$.data.x"

  @test:scripts/tests/witness-parity.test.ts::checkParity::is_unknown,_not_fail,_when_the_producer_exits_non-zero
  Scenario: A producer exiting non-zero is unknown
    Given a producer that prints a refusal and exits 3
    Then the verdict is "unknown" with a reason naming "exited 3" and "precision floor"

  @test:scripts/tests/witness-parity.test.ts::checkParity::is_unknown_on_an_environment_mismatch,_and_does_not_run_the_producer
  Scenario: An environment mismatch is unknown
    # Gap: the title says the producer is not run; nothing checks that.
    Given a witness recording a package that is not installed
    Then the verdict is "unknown" and the first mismatch names that package

  @test:scripts/tests/witness-parity.test.ts::checkParity::is_unknown_when_the_re-run_records_a_different_environment,_e.g._another_native_build
  Scenario: A re-run recording another environment is unknown
    Given a producer whose output records ext_build "bbb" where the witness has "aaa"
    Then the verdict is "unknown" with a reason naming "environment.ext_build"

  @test:scripts/tests/witness-parity.test.ts::checkParity::is_unknown,_not_fail,_when_the_witness_was_written_by_another_version_of_its_script
  Scenario: A witness from another script version is unknown
    Given a producer whose output carries another script hash and a different value
    Then the verdict is "unknown" with a reason saying "stale"

  @test:scripts/tests/witness-parity.test.ts::checkParity::leaves_the_folio's_own_checkout_untouched
  Scenario: The checkout is left untouched
    Given a producer that overwrites the witness file
    When parity is checked
    Then the witness file is unchanged, git status is clean, and there is one worktree

  @test:scripts/tests/witness-parity.test.ts::reproduce_is_data,_never_shell_text_(bean_cat-tools-w7tx)::accepts_the_two_producer_forms_as_an_argv
  Scenario: The two producer forms parse to an argv
    Then "python3 -u computations/p.py --digits 50" parses to its argv
    And "bun run compute:q" parses to its argv

  @test:scripts/tests/witness-parity.test.ts::reproduce_is_data,_never_shell_text_(bean_cat-tools-w7tx)::refuses_shell_syntax,_other_commands,_and_an_untracked_or_escaping_script
  Scenario: Shell syntax, other commands and untracked scripts are refused
    Then a command with ";", a command substitution, "python3 -c", "../p.py", an untracked script, "bash -c" and "bun -e" are each refused

  @test:scripts/tests/witness-parity.test.ts::reproduce_is_data,_never_shell_text_(bean_cat-tools-w7tx)::runs_the_producer_with_a_minimal_environment,_without_secrets
  Scenario: The producer gets a minimal environment
    Then from PATH, HOME, GITHUB_TOKEN and ANTHROPIC_API_KEY the producer gets PATH, HOME and PYTHONDONTWRITEBYTECODE only

  @test:scripts/tests/witness-parity.test.ts::reproduce_is_data,_never_shell_text_(bean_cat-tools-w7tx)::checkParity_refuses_`touch_/tmp/x;_true`_and_runs_nothing
  Scenario: A shell reproduce line is refused and nothing runs
    Given a committed witness whose reproduce is "touch <marker>; true"
    When parity is checked
    Then the verdict is "unknown" with a reason saying "refused", and the marker does not exist

  @test:scripts/tests/witness-parity.test.ts::resolveScript::finds_a_bare_scriptFile_beside_the_witness,_else_by_its_unique_name,_else_nothing
  Scenario: Resolving a witness's script file
    Given a repository with "computations/probes/p.py", "computations/other/q.py" and two "dup.py"
    Then "p.py" resolves beside the witness and "q.py" by its unique name
    And "dup.py" and "missing.py" resolve to nothing
    And a repository path resolves to itself
