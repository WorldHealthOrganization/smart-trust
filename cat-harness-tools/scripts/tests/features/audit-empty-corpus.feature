# pipeline/qa-section-title-audit.ts and pipeline/trivial-skeleton-audit.ts treat auditing an
# empty corpus as a failure, and read a folio's chapters and Lean files from its cwd.
# Each Scenario names the test that executes it.
Feature: Audits refuse to pass over an empty corpus

  @test:scripts/tests/audit-empty-corpus.test.ts::qa-section-title-audit::refuses_to_report_success_over_an_empty_corpus
  Scenario: The section-title audit fails over an empty corpus
    Given the harness root, which holds no folio
    When qa-section-title-audit runs there
    Then it exits non-zero
    And its output contains "refusing to report success"

  @test:scripts/tests/audit-empty-corpus.test.ts::qa-section-title-audit::does_not_print_a_clean_bill_of_health_when_it_read_nothing
  Scenario: The section-title audit prints no clean ticks when it read nothing
    Given the harness root, which holds no folio
    When qa-section-title-audit runs there
    Then its output does not contain "✓ no HARD defect(s)"
    And it does not contain "✓ no structure findings"

  @test:scripts/tests/audit-empty-corpus.test.ts::qa-section-title-audit::reads_a_folio's_chapter_manifests_and_gates_on_a_real_defect
  Scenario: The section-title audit reads a folio's chapters and fails on a split-artifact title
    Given a folio with one chapter whose sections include "Trailing colon artifact : tag"
    When qa-section-title-audit runs from the folio
    Then its output contains "3 titles across 1 chapters"
    And it reports a "split-artifact"
    And it exits with status 1

  @test:scripts/tests/audit-empty-corpus.test.ts::trivial-skeleton-audit::refuses_to_report_success_over_an_empty_corpus
  Scenario: The trivial-skeleton audit fails over an empty corpus
    Given the harness root, which holds no folio
    When trivial-skeleton-audit runs there
    Then it exits non-zero
    And its output contains "refusing to report success"

  @test:scripts/tests/audit-empty-corpus.test.ts::trivial-skeleton-audit::a_strict-gate_budget_cannot_be_satisfied_by_scanning_nothing
  Scenario: A strict-gate budget is not satisfied by scanning nothing
    Given the harness root, which holds no folio
    When trivial-skeleton-audit runs there with "--max-per-pattern one_def=0"
    Then it exits non-zero
    And its output does not contain "budgets respected"

  @test:scripts/tests/audit-empty-corpus.test.ts::trivial-skeleton-audit::scans_a_folio's_Lean_and_enforces_the_budget
  Scenario: The trivial-skeleton audit scans a folio's Lean and enforces the budget
    Given a folio with one Lean file holding a single one-line def
    When trivial-skeleton-audit runs from the folio with budget "one_def=0"
    Then its output contains "one_def: 1 (budget 0)" and it exits with status 1
    And when run with budget "one_def=5" its output contains "1 file(s) scanned" and it exits with status 0
