# repo-conversion's scan for mathematical artefacts outside the content tree
# (bean folio-assistant-qdai): refutations, proofs, computations, macros and
# derivation notes that a conversion carrying only the content tree would
# drop. Each Scenario names the test that executes it.
Feature: Mathematical evidence outside the content tree is found and classified

  @test:scripts/tests/repo-conversion-math-scan.test.ts::repo-conversion:_math_candidate_classification_(unit)::classifies_audit_refutations_by_path,_filename,_and_content_cues
  Scenario: Audit refutations are classified
    # Gap: the title says content cues too; only paths are classified, no file content is read.
    Then "docs/audits/skein-mass-relation-is-false.lean" is an audit refutation whose rationale mentions "refutation"
    And "audits/counterexample.py" and "docs/audits/claim-disproof-note.md" are audit refutations

  @test:scripts/tests/repo-conversion-math-scan.test.ts::repo-conversion:_math_candidate_classification_(unit)::classifies_formal_math_proofs_outside_content_tree
  Scenario: Formal proofs outside the content tree are classified
    Then a .lean audit is a math proof citing "Lean", a .v file one citing "Coq", and a .thy file one citing "Isabelle"

  @test:scripts/tests/repo-conversion-math-scan.test.ts::repo-conversion:_math_candidate_classification_(unit)::classifies_computation_and_numerical_verification_scripts
  Scenario: Computation scripts are classified
    Then a .py audit, a .sage file and an .ipynb notebook are computation scripts

  @test:scripts/tests/repo-conversion-math-scan.test.ts::repo-conversion:_math_candidate_classification_(unit)::classifies_TeX_macros,_custom_commands,_and_standalone_tables
  Scenario: TeX macros and standalone tables are classified
    Then macros.tex, tables/spin_table.tex and preamble/defs.sty are macro definitions

  @test:scripts/tests/repo-conversion-math-scan.test.ts::repo-conversion:_math_candidate_classification_(unit)::classifies_derivation_notes_and_mathematical_scratchpads
  Scenario: Derivation notes and scratchpads are classified
    Then docs/notes/derivation-step1.md, notes/proof_scratchpad.md and derivations/spin_chain.tex are derivation notes

  @test:scripts/tests/repo-conversion-math-scan.test.ts::repo-conversion:_math_candidate_classification_(unit)::returns_null_for_non-math_files_outside_content_tree
  Scenario: Non-math files are not candidates
    Then README.md, docs/install.md, docs/contributing.txt, scripts/deploy.sh, scripts/build.ts and assets/diagram.png are not classified

  @test:scripts/tests/repo-conversion-math-scan.test.ts::repo-conversion:_math_candidate_scanning_with_fixtures_(integration)::scans_outside_math_candidates_with_link_status_and_reporting
  Scenario: Outside candidates are scanned with their link status and reported
    Given a repository whose content links docs/audits/helper.lean, beside an unlinked refutation, computation, macro file and derivation note, and two non-math files
    When its math candidates are scanned
    Then there are 5, each with its classification, helper.lean linked by content/chapter1/intro.md and the rest unlinked
    And the repository scan reports 5 math candidates
    And the formatted report says "(5 artifact(s), 4 unlinked)", warns they live outside the content tree, flags the refutation "UNLINKED (danger of dropping!)", and lists helper.lean as linked
    And git status is clean

  @test:scripts/tests/repo-conversion-math-scan.test.ts::repo-conversion:_math_candidate_scanning_with_fixtures_(integration)::negative_control:_clean_content-only_repo_reports_0_math_candidates
  Scenario: A content-only repository has no math candidates
    Given a repository with only content files and a README
    Then it has no math candidates, the report has no math section, and git status is clean

  @test:scripts/tests/repo-conversion-math-scan.test.ts::repo-conversion:_math_candidate_scanning_with_fixtures_(integration)::negative_control:_repo_with_non-math_outside_files_reports_0_math_candidates
  Scenario: Non-math files outside the content tree are not candidates
    Given a repository with setup and contributing docs and two scripts outside content
    Then it has no math candidates and git status is clean

  @test:scripts/tests/repo-conversion-math-scan.test.ts::repo-conversion:_math_candidate_scanning_with_fixtures_(integration)::negative_control:_math_files_inside_content_tree_are_not_treated_as_outside_candidates
  Scenario: Math files inside the content tree are not outside candidates
    Given a repository with a .lean proof and a .py script under content/
    Then it has no math candidates and git status is clean
