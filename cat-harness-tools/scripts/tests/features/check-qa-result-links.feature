# scripts/check-qa-result-links.ts finds links that address a stored QA result on main, where it
# is not, in page text and in the site's qa-witness projections. Each Scenario names the test that
# executes it.
Feature: Checking links to QA results

  @test:scripts/tests/check-qa-result-links.test.ts::judgeBlobMainPath::the_owner's_dead_link:_an_instance-relative_test/results_path
  Scenario: An instance-relative test/results path on main is judged dead
    Given the qa directories "cat-harness/test/results" (stored) and "legacy/test/results" (not stored)
    When the main-branch path "test/results/translation-qa/docs/index.ar.translation-qa.json" is judged
    Then the verdict mentions "instance-relative"

  @test:scripts/tests/check-qa-result-links.test.ts::judgeBlobMainPath::a_stored_directory's_file_addressed_on_main
  Scenario: A stored directory's file addressed on main is a finding
    Given the stored qa directory "cat-harness/test/results"
    When the main-branch path "cat-harness/test/results/kg-qa/x.kg-qa.json" is judged
    Then the verdict mentions "declares storage"

  @test:scripts/tests/check-qa-result-links.test.ts::judgeBlobMainPath::an_unstored_qa_directory_keeps_its_main_link
  Scenario: An unstored qa directory keeps its main link
    Given the unstored qa directory "legacy/test/results"
    When the main-branch path "legacy/test/results/a.json" is judged
    Then there is no verdict

  @test:scripts/tests/check-qa-result-links.test.ts::judgeBlobMainPath::an_authored_file_is_none_of_this_gate's_business
  Scenario: An authored file outside the qa directories is not judged
    When the main-branch path "cat-harness/sdlc/skills/sdlc-core/qa-reports.md" is judged
    Then there is no verdict

  @test:scripts/tests/check-qa-result-links.test.ts::scanText::finds_each_offending_URL_with_its_line,_and_passes_a_branch_address
  Scenario: Scanning text finds each offending URL by line and passes a branch address
    Given three lines: a link on the qa-reports entry branch, an instance-relative main link and a stored-directory main link
    When the text is scanned
    Then findings are reported on lines 2 and 3 only

  @test:scripts/tests/check-qa-result-links.test.ts::judgeProjection::not_a_projection:_not_judged,_and_not_counted
  Scenario: A document that is not a projection is neither judged nor counted
    When a document with schema "other/v1" is judged
    Then it is not counted as a projection

  @test:scripts/tests/check-qa-result-links.test.ts::judgeProjection::an_unstamped_projection_is_a_finding:_the_panel_would_have_nothing_to_link
  Scenario: A projection with no sidecar links is a finding
    Given a "qa-witness/v1" projection listing a sidecar but carrying no sidecar links
    When it is judged
    Then there is exactly 1 finding

  @test:scripts/tests/check-qa-result-links.test.ts::judgeProjection::a_stored_result_addressed_on_main_is_a_finding
  Scenario: A projection linking a stored result on main is a finding
    Given a projection whose sidecar link addresses "cat-harness/test/results/a.json" on main
    When it is judged
    Then there is at least one finding

  @test:scripts/tests/check-qa-result-links.test.ts::judgeProjection::a_stored_result_addressed_on_its_entry_is_clean
  Scenario: A projection linking a stored result on its entry is clean
    Given a projection whose sidecar link addresses the result on its qa-reports entry branch
    When it is judged
    Then it is a projection with no findings

  @test:scripts/tests/check-qa-result-links.test.ts::checkSite::counts_projections,_so_an_empty_site_can_be_told_from_a_clean_one
  Scenario: Checking a site counts projections so an empty site differs from a clean one
    Given a site holding only an index.html and an empty assets/qa directory
    When the site is checked
    Then it counts 0 projections
    And after a clean projection is added under assets/qa it counts 1 projection with no findings
