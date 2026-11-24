# LaTeX to Lean coverage over the folio's chapters/*.tex: every \lean{} tag
# names a Lean declaration, \leanok needs \lean{}, and coverage and label
# prefixes are reported. With no chapters attached every test skips rather
# than passes. Each Scenario names the test that executes it.
Feature: LaTeX to Lean coverage

  @test:scripts/tests/latex-lean-coverage.test.ts::\lean{}_tags_→_Lean_declarations::at_least_one_\lean{}_tag_found
  Scenario: The chapters carry at least one \lean{} tag
    Given the folio's chapter files
    When their environments are extracted
    Then at least one environment carries a \lean{} declaration
    And with no chapter files the test is skipped

  @test:scripts/tests/latex-lean-coverage.test.ts::\lean{}_tags_→_Lean_declarations::the_per-declaration_checks_below_were_generated
  Scenario: The per-declaration checks are actually generated
    Given the unique \lean{} declarations in the chapters
    Then there is at least one, so the per-declaration tests are not silently empty
    And with no chapter files the test is skipped

  @test:scripts/tests/latex-lean-coverage.test.ts::\lean{}_tags_→_Lean_declarations::%s_exists_in_Lean_source
  Scenario: Each \lean{} declaration is found in the Lean source
    # Gap: the check passes when the declaration's short name appears anywhere in any Lean file, not only as a declaration
    Given a unique declaration named by a \lean{} tag
    When the Lean sources are searched for its short name
    Then it is found

  @test:scripts/tests/latex-lean-coverage.test.ts::Coverage_completeness::formalizable_environments_found
  Scenario: The chapters hold formalizable environments
    Given the theorem, lemma, proposition, corollary and definition environments of the chapters
    Then there is at least one
    And with no chapter files the test is skipped

  @test:scripts/tests/latex-lean-coverage.test.ts::Coverage_completeness::coverage_statistics_(report)
  Scenario: The coverage statistics are reported over a real corpus
    # Gap: a report, not a check: only that the corpus has a formalizable environment is asserted, never the coverage figure
    Given the formalizable environments of the chapters
    When the covered, not-ready and total counts are logged
    Then the total is greater than zero

  @test:scripts/tests/latex-lean-coverage.test.ts::\leanok_consistency::no_\leanok_without_\lean{}
  Scenario: No environment carries \leanok without \lean{}
    Given the environments of the chapters
    Then none carries \leanok without a \lean{} declaration
    And with no chapter files the test is skipped

  @test:scripts/tests/latex-lean-coverage.test.ts::Label_conventions::label_prefix_mismatches_(report)
  Scenario: Label prefix mismatches are reported over a real corpus
    # Gap: a report, not a check: mismatches are only logged; only that the corpus has an environment is asserted
    Given the environments of the chapters and the prefix expected for each type
    When the mismatches are logged
    Then the corpus holds at least one environment
