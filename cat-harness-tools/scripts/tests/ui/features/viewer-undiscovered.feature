# The published harness report (docs/_data/harness.json, written by scripts/harness-tiles.ts at
# publish) tells a kind with no published viewer apart from a viewer published where no tile looks.
# Each Scenario names the test that executes it.
Feature: Unbuilt versus undiscovered viewers in the harness report

  @test:scripts/tests/ui/viewer-undiscovered.test.ts::the_harness_report_distinguishes_unbuilt_from_undiscovered::has_harnesses_to_report_on
  Scenario: The harness report has harnesses to report on
    # Skipped: when the harness report is not built
    Given the published harness report
    Then it lists at least one harness

  @test:scripts/tests/ui/viewer-undiscovered.test.ts::the_harness_report_distinguishes_unbuilt_from_undiscovered::no_kind_is_named_as_BOTH_unbuilt_and_undiscovered
  Scenario: No kind is reported both unbuilt and undiscovered
    # Skipped: when the harness report is not built
    Given each harness with both a "no published viewer" and a "not at a conventional path" finding
    When the kinds each finding names are compared
    Then no kind is named in both

  @test:scripts/tests/ui/viewer-undiscovered.test.ts::the_harness_report_distinguishes_unbuilt_from_undiscovered::every_kind_called_unbuilt_really_has_no_declared_viewer_on_disk
  Scenario: An unbuilt-viewer finding names no file path
    # Skipped: when the harness report is not built
    # Gap: that the kinds really have no viewer on disk is not checked, only that the finding carries no path
    Given each harness's "no published viewer" finding
    Then it carries no ".html" or ".md" path in parentheses

  @test:scripts/tests/ui/viewer-undiscovered.test.ts::the_harness_report_distinguishes_unbuilt_from_undiscovered::every_path_named_as_undiscovered_exists_on_disk
  Scenario: Every path named as undiscovered exists on disk
    # Skipped: when the harness report is not built
    Given each harness's "not at a conventional path" finding
    Then every ".html" or ".md" path it names in parentheses exists in the repository

  @test:scripts/tests/ui/viewer-undiscovered.test.ts::the_harness_report_distinguishes_unbuilt_from_undiscovered::a_kind_WITH_a_conventional_path_is_in_neither_finding
  Scenario: A kind with a conventional path is in neither finding
    # Skipped: when the harness report is not built
    Given each harness's visualisations that carry a path
    Then neither its unbuilt nor its undiscovered finding lists that kind followed by a comma

  @test:scripts/tests/ui/viewer-undiscovered.test.ts::no_viewer_is_built_and_unreachable::no_harness_carries_an_undiscovered-viewer_finding
  Scenario: No harness carries an undiscovered-viewer finding
    # Skipped: when the harness report is not built
    Given the published harness report
    Then no harness has a "not at a conventional path" finding

  @test:scripts/tests/ui/viewer-undiscovered.test.ts::who-iris/catalogue_—_the_case_that_exposed_it,_now_closed::who-iris_is_in_the_report
  Scenario: who-iris is in the harness report
    # Skipped: when the harness report is not built or who-iris is not in the checkout
    Given the published harness report
    Then it has a harness named "who-iris"

  @test:scripts/tests/ui/viewer-undiscovered.test.ts::who-iris/catalogue_—_the_case_that_exposed_it,_now_closed::its_catalogue_viewer_is_LINKED,_not_merely_un-reported
  Scenario: The who-iris catalogue viewer is linked
    # Skipped: when the harness report is not built or who-iris is not in the checkout
    Given who-iris in the harness report
    Then it has a "catalogue" visualisation
    And that visualisation carries a path

  @test:scripts/tests/ui/viewer-undiscovered.test.ts::who-iris/catalogue_—_the_case_that_exposed_it,_now_closed::and_is_reported_as_neither_unbuilt_nor_undiscovered
  Scenario: The who-iris catalogue is reported as neither unbuilt nor undiscovered
    # Skipped: when the harness report is not built or who-iris is not in the checkout
    Given who-iris's unbuilt and undiscovered findings
    Then neither mentions "catalogue"

  @test:scripts/tests/ui/viewer-undiscovered.test.ts::fhir-artifact-index_—_a_viewer_inside_a_COMPOSED_directory_is_linked::%s's_fhir-artifact-index_tile_links_its_declared_route,_which_opens_its_IG_site's_artifacts_page
  Scenario: A fhir-artifact-index tile links its declared route
    # Skipped: when the harness report is not built or smart-trust or smart-base is not in the checkout
    # Gap: that the route opens the IG site's artifacts page is not checked
    Given "smart-trust" or "smart-base" in the harness report
    Then its "fhir-artifact-index" visualisation's path is "/smart-base/artifact-index/<name>/"
