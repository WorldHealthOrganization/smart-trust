# sameScriptVerdict: a re-run that reproduces a script verdict is not a
# change, so the sidecar is not rewritten; any movement in verdict, inputs,
# checker or detail is. Each Scenario names the test that executes it.
Feature: A reproduced script verdict is not a change

  @test:scripts/tests/qa-same-script-verdict.test.ts::sameScriptVerdict::a_re-run_that_reproduces_the_verdict_is_not_a_change
  Scenario: A re-run differing only in timestamps is not a change
    Given a prior script entry and a fresh one differing only in reviewed_at and reviewed_sha
    Then they are the same verdict

  @test:scripts/tests/qa-same-script-verdict.test.ts::sameScriptVerdict::a_moved_verdict_is_a_change
  Scenario: A moved verdict is a change
    Then a "pass" entry and a "fail" entry are not the same verdict

  @test:scripts/tests/qa-same-script-verdict.test.ts::sameScriptVerdict::moved_inputs_are_a_change_even_at_the_same_verdict
  Scenario: Moved inputs are a change at the same verdict
    Then entries differing only in the md field hash are not the same verdict

  @test:scripts/tests/qa-same-script-verdict.test.ts::sameScriptVerdict::a_changed_checker_is_a_change
  Scenario: A changed checker is a change
    Then entries differing only in script_hash are not the same verdict

  @test:scripts/tests/qa-same-script-verdict.test.ts::sameScriptVerdict::changed_evidence,_notes,_metrics_or_severity_are_changes
  Scenario: Changed evidence, notes, metrics or severity are changes
    Then entries differing only in notes, evidence, metrics or severity are each not the same verdict

  @test:scripts/tests/qa-same-script-verdict.test.ts::sameScriptVerdict::script_commit_sha_alone_is_NOT_a_change
  Scenario: script_commit_sha alone is not a change
    Then entries differing only in script_commit_sha are the same verdict

  @test:scripts/tests/qa-same-script-verdict.test.ts::sameScriptVerdict::no_prior_entry_is_always_a_change
  Scenario: No prior entry is always a change
    Then no prior entry and a fresh entry are not the same verdict
