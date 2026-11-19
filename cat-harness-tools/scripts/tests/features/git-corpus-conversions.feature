# The scanners converted from bare filesystem walks to schemas/sdlc/git-corpus.ts, each checked two-sided:
# the git corpus admits nothing the old walk lacked, and everything it drops is gitignored and not mounted.
# Each Scenario names the test that executes it.
Feature: Scanners converted to git's corpus narrow without losing files

  @test:scripts/tests/git-corpus-conversions.test.ts::every_converted_scanner_narrowed_to_git's_corpus_and_lost_nothing::check-code-accounting_/_typescriptFiles
  Scenario: The TypeScript file scan narrows to the git corpus and loses nothing
    Given the old walk of the checkout for ".ts" files, skipping dot directories and node_modules
    When gitFiles lists ".ts" files with no dot segment in their path
    Then no file the git listing admits is missing from the old walk
    And every file the old walk had and the git listing drops is gitignored and not in the corpus

  @test:scripts/tests/git-corpus-conversions.test.ts::every_converted_scanner_narrowed_to_git's_corpus_and_lost_nothing::bpmnFiles_—_lane-documentation,_process-documentation,_glossary-export
  Scenario: The BPMN file scan narrows to the git corpus and loses nothing
    Given the old walk of the checkout for ".bpmn" files
    When gitFiles lists ".bpmn" files with no dot segment in their path
    Then no file the git listing admits is missing from the old walk
    And every file the old walk had and the git listing drops is gitignored and not in the corpus
    And the old walk found at least one ".bpmn" file

  @test:scripts/tests/git-corpus-conversions.test.ts::every_converted_scanner_narrowed_to_git's_corpus_and_lost_nothing::ns-export_/_minted-term_scan
  Scenario: The minted-term scan of non-test TypeScript narrows and loses nothing
    Given the old walk of the checkout for ".ts" files that are not ".test.ts"
    When gitFiles lists the same kind of files with no dot segment in their path
    Then no file the git listing admits is missing from the old walk
    And every file the old walk had and the git listing drops is gitignored and not in the corpus

  @test:scripts/tests/git-corpus-conversions.test.ts::every_converted_scanner_narrowed_to_git's_corpus_and_lost_nothing::check-viewer-backticks_/_viewerSources
  Scenario: The viewer source scan narrows and loses nothing
    Given the old walk of the checkout for ".ts" files that are neither ".test.ts" nor ".e2e.ts"
    When gitFiles lists the same kind of files with no dot segment in their path
    Then no file the git listing admits is missing from the old walk
    And every file the old walk had and the git listing drops is gitignored and not in the corpus

  @test:scripts/tests/git-corpus-conversions.test.ts::every_converted_scanner_narrowed_to_git's_corpus_and_lost_nothing::audit-coverage_/_census,_over_a_declared_directory
  Scenario: The coverage census over a declared directory loses nothing
    Given the old walk of every file under "cat-harness/skills", skipping dot entries
    When gitFiles lists that directory's files with no dot segment in their path
    Then no file the git listing admits is missing from the old walk
    And every file the old walk had and the git listing drops is gitignored and not in the corpus
    And the old walk found more than 100 files

  @test:scripts/tests/git-corpus-conversions.test.ts::the_control_itself_is_discriminating::a_`keep`_that_admits_nothing_FAILS_the_swept-are-ignored_half
  Scenario: A conversion that admits nothing fails the swept-are-ignored check
    Given the old walk of the checkout for ".bpmn" files
    When the control compares it with an empty listing
    Then at least one dropped file is not gitignored
