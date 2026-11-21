Feature: an upload's intake record and its Dublin Core record

  @test:adapters/document/intake-records.test.ts::uploadRecords::intakePointsAtValidRecord
  Scenario: the intake points at its Dublin Core record, and both validate
    Given an upload form for "my-paper" with one PDF file
    When uploadRecords builds the intake and the record
    Then the intake validates against IntakeSchema and the record against DublinCoreRecordSchema
    And the intake names the record file of "my-paper"
    And the intake carries no title of its own
    And the intake lists the PDF as the original bitstream with its size and sha256

  @test:adapters/document/intake-records.test.ts::uploadRecords::formFieldsLandOnDublinCore
  Scenario: the form's fields land on Dublin Core, normativeLevel as a qualified dc.type
    Given an upload form with a domain, normativeLevel "recommendation" and format "pdf"
    When uploadRecords builds the record
    Then the record's title, type, subject and format carry the form's values
    And normativeLevel is a dc.type qualified "normativeLevel" with value "recommendation"

  @test:adapters/document/intake-records.test.ts::uploadRecords::emptyFieldWritesNoDcField
  Scenario: an empty form field writes no Dublin Core field, rather than an empty one
    Given an upload form with an empty domain and no normativeLevel
    When uploadRecords builds the record
    Then the record has no subject and no qualified normativeLevel type

  @test:adapters/document/intake-records.test.ts::uploadRecords::urlIntakeRecordsUpstream
  Scenario: a URL intake records where it came from, on both records
    Given an upload form with no files and an upstream URL
    When uploadRecords builds the intake and the record
    Then the intake's source.upstream is the URL
    And the record's provenance.source is the URL

  @test:adapters/document/intake-records.test.ts::IntakeSchema::intakeRequiresItem
  Scenario: an intake must say what it is a capture OF
    When an intake with no item and one with item "item/1" are validated
    Then the one without an item is refused
    And the one with an item is accepted

  @test:adapters/document/intake-records.test.ts::IntakeSchema::unzonedCaptureTimeAccepted
  Scenario: an unzoned capture time is accepted; a compact one is not
    When intakes with various capturedAt values are validated
    Then "2026-09-20T20:30:54" and "2026-09-20T07:44:32Z" are accepted
    And the compact "20260920203054" is refused
