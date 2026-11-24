# Specifies instanceIdOf, isCurrentShape, buildReport and renderPage
# (scripts/prov-qaqc.ts) on workflow records in the earlier shape.
Feature: PROV QA/QC reports workflow records in the earlier shape instead of crashing

  @test:test/prov-qaqc-legacy-records.test.ts::prov-qaqc:_records_in_the_earlier_shape::the_id_is_read_from_either_shape
  Scenario: The id is read from either shape
    Given a record with `instanceId` and no `id`, one with `id`, and one with neither
    When each one's id is read
    Then the first gives its `instanceId`, the second its `id`, and the third nothing

  @test:test/prov-qaqc-legacy-records.test.ts::prov-qaqc:_records_in_the_earlier_shape::only_the_current_shape_is_walked
  Scenario: Only the current shape is walked
    Given a record in the earlier shape, a record with no id, and a record with `id`, `source` and `node`-keyed history
    When each is tested for the current shape
    Then only the last one is in it

  @test:test/prov-qaqc-legacy-records.test.ts::prov-qaqc:_records_in_the_earlier_shape::a_store_of_legacy_records_reports_them_instead_of_throwing
  Scenario: A store of legacy records reports them instead of throwing
    Given a workflow store holding only records in the earlier shape
    When the PROV QA/QC report is built
    Then each record is listed with one `legacy-record` finding
    And nothing is invalid
    And the page shows the `legacy-record` row

  @test:test/prov-qaqc-legacy-records.test.ts::prov-qaqc:_records_in_the_earlier_shape::a_page_with_no_legacy_record_does_not_gain_the_row
  Scenario: A page with no legacy record does not gain the row
    Given a workflow store with no record in the earlier shape
    When the PROV QA/QC page is rendered
    Then it has no `legacy-record` row
