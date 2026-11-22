# pipeline/content-graph-analysis.py analyses the paper named by --paper, or the folio's
# only paper, and fails listing the papers when several exist and none is named.
# Each Scenario names the test that executes it.
Feature: Content graph analysis paper resolution

  @test:pipeline/content-graph-analysis.test.ts::content-graph-analysis.py_paper_resolution::a_one-paper_folio_needs_no_--paper
  Scenario: A one-paper folio needs no --paper
    Given a repository whose folio holds only the paper "alpha"
    When the analysis runs there with no arguments
    Then it exits 0
    And its output is headed "# Content Graph Analysis: alpha"

  @test:pipeline/content-graph-analysis.test.ts::content-graph-analysis.py_paper_resolution::several_papers_and_no_--paper_fails_and_names_them
  Scenario: Several papers and no --paper fails and names them
    Given a repository whose folio holds the papers "alpha" and "beta"
    When the analysis runs there with no arguments
    Then it exits non-zero
    And its error lists "alpha, beta"

  @test:pipeline/content-graph-analysis.test.ts::content-graph-analysis.py_paper_resolution::--paper_picks_one_of_several
  Scenario: --paper picks one of several papers
    Given a folio holding the papers "alpha" and "beta"
    When the analysis runs with --paper "beta"
    Then it exits 0
    And its output is headed "# Content Graph Analysis: beta"

  @test:pipeline/content-graph-analysis.test.ts::content-graph-analysis.py_paper_resolution::an_unknown_--paper_fails_instead_of_reading_nothing
  Scenario: An unknown --paper fails instead of reading nothing
    Given a folio holding the papers "alpha" and "beta"
    When the analysis runs with --paper "gamma"
    Then it exits non-zero
    And its error says "no paper 'gamma'"

  @test:pipeline/content-graph-analysis.test.ts::content-graph-analysis.py_paper_resolution::--content-root_and_a_path_--paper_both_work_from_anywhere
  Scenario: --content-root and a path --paper both work from outside the folio
    Given the analysis runs from the parent of both test repositories
    When --content-root names the one-paper folio
    Then it exits 0
    And when --paper is the path of the "beta" paper directory, the output names the analysis of beta
