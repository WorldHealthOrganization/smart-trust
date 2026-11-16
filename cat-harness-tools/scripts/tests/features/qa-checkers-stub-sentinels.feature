# Generic detangler stub checkers return a distinguishable sentinel note
# rather than a bare n/a (bean folio-assistant-89wq). Each Scenario names the
# test that executes it.
Feature: Stub QA checkers return a distinguishable sentinel

  @test:scripts/tests/qa-checkers-stub-sentinels.test.ts::QA_stub_checkers_return_distinguishable_sentinel_notes_(folio-assistant-89wq)::checkDetanglerNoXChapterFwd_returns_distinguishable_stub_sentinel
  Scenario: checkDetanglerNoXChapterFwd returns the stub sentinel
    When it is called with no path and with a block path
    Then each result is n/a with no hits and notes "not implemented: stub checker"

  @test:scripts/tests/qa-checkers-stub-sentinels.test.ts::QA_stub_checkers_return_distinguishable_sentinel_notes_(folio-assistant-89wq)::checkDetanglerArchimedeanWall_returns_distinguishable_stub_sentinel
  Scenario: checkDetanglerArchimedeanWall returns the stub sentinel
    When it is called with no paths and with a block and Lean path
    Then each result is n/a with no hits and notes "not implemented: stub checker"
