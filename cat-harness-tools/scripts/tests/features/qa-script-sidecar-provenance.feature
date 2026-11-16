# Script sidecars describe the platform's own checkers; a sweep from a content
# repository must not rewrite them for a timestamp, a foreign HEAD or another
# bun (bean 3ozg). Each Scenario names the test that executes it.
Feature: A script sidecar is rewritten only when its provenance moves

  @test:scripts/tests/qa-script-sidecar-provenance.test.ts::saveQaScriptSidecar::writes_a_sidecar_that_did_not_exist
  Scenario: A sidecar that did not exist is written
    When a script sidecar for "test-criterion" is saved
    Then its file exists and loads with script_hash "aaaaaaaaaaaa"

  @test:scripts/tests/qa-script-sidecar-provenance.test.ts::saveQaScriptSidecar::does_NOT_rewrite_when_only_last_run_at_/_last_run_sha_differ
  Scenario: Only last_run_at and last_run_sha differing does not rewrite
    Given a saved sidecar, backdated
    When the same sidecar with a new last_run_at and last_run_sha is saved
    Then the file's text and modification time are unchanged

  @test:scripts/tests/qa-script-sidecar-provenance.test.ts::saveQaScriptSidecar::DOES_rewrite_when_the_script_hash_moves
  Scenario: A moved script hash rewrites
    When the sidecar is saved again with script_hash "cccccccccccc"
    Then it loads with script_hash "cccccccccccc"

  @test:scripts/tests/qa-script-sidecar-provenance.test.ts::saveQaScriptSidecar::DOES_rewrite_when_deps_hash_moves
  Scenario: A moved deps_hash rewrites
    When the sidecar is saved again with deps_hash "dddddddddddd"
    Then it loads with deps_hash "dddddddddddd"

  @test:scripts/tests/qa-script-sidecar-provenance.test.ts::saveQaScriptSidecar::DOES_rewrite_when_script_commit_sha_moves
  Scenario: A moved script_commit_sha rewrites
    When the sidecar is saved again with a new script_commit_sha
    Then it loads with that script_commit_sha

  @test:scripts/tests/qa-script-sidecar-provenance.test.ts::saveQaScriptSidecar::DOES_rewrite_when_extra_inputs_change
  Scenario: Changed extra_inputs rewrite
    When the sidecar is saved again with extra_inputs ["folio/schema/refs.ts"]
    Then it loads with those extra_inputs

  @test:scripts/tests/qa-script-sidecar-provenance.test.ts::saveQaScriptSidecar::does_NOT_rewrite_when_only_the_engine_version_differs_(bean_3ozg)
  Scenario: Only the engine version differing does not rewrite
    Given a saved sidecar, backdated
    When it is saved with engine "bun-9.9.9" and new run fields
    Then the file's text and modification time are unchanged

  @test:scripts/tests/qa-script-sidecar-provenance.test.ts::saveQaScriptSidecar::a_CONTENT_change_still_records_the_engine_it_ran_under
  Scenario: A content change records the engine it ran under
    When the sidecar is saved with a new script_hash and engine "bun-9.9.9"
    Then it loads with the new script_hash and engine "bun-9.9.9"

  @test:scripts/tests/qa-script-sidecar-provenance.test.ts::saveQaScriptSidecar::treats_absent_and_empty_extra_inputs_as_the_same
  Scenario: Absent and empty extra_inputs are the same
    Given a saved sidecar with no extra_inputs
    When it is saved with extra_inputs []
    Then the file's text is unchanged
