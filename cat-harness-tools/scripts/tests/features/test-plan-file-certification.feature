# A_FileCertification writes, and what it writes reads back
# (bean folio-assistant-zaui). Each Scenario names the test that executes it.
Feature: Filing a signed certification

  Background:
    Given a layer with an empty attestation store at "test/attestations"
    And a certified decision for test plan "tiny-workflow-tool" version "1.0.0" with a report path

  @test:scripts/tests/test-plan-file-certification.test.ts::A_FileCertification_(fileSignedCertification)::a_certified_decision_is_filed_under_certification/_and_reads_back
  Scenario: A certified decision is filed and reads back
    When the certification is filed
    Then it is "filed" and written at "certification/tiny-workflow-tool.attestations.json"
    And reading it back is a hit of family "certification" whose subject is the test plan and its report
    And it holds one certification with the decision, plan id, report as evidence and timestamp

  @test:scripts/tests/test-plan-file-certification.test.ts::A_FileCertification_(fileSignedCertification)::notes_say_how_the_decision_reached_the_filer,_beside_the_plan_version
  Scenario: Notes carry the plan version and how the decision arrived
    When it is filed with notes "decided by the owner in session S, relayed"
    Then the certification's notes are "plan version 1.0.0; decided by the owner in session S, relayed"

  @test:scripts/tests/test-plan-file-certification.test.ts::A_FileCertification_(fileSignedCertification)::a_second_certification_is_appended,_never_replacing_the_first
  Scenario: A second certification is appended
    When it is filed twice with different timestamps
    Then both certifications are read back in filing order

  @test:scripts/tests/test-plan-file-certification.test.ts::A_FileCertification_(fileSignedCertification)::a_refused_or_undetermined_decision_files_nothing
  Scenario: A refused or undetermined decision files nothing
    When a "refused" or an "undetermined" decision is filed
    Then each answers "refused" and no store file exists

  @test:scripts/tests/test-plan-file-certification.test.ts::A_FileCertification_(fileSignedCertification)::a_certification_with_no_report_to_point_at_is_refused
  Scenario: A certification with no report is refused
    When it is filed with an empty report path
    Then it answers "refused" and no store file exists

  @test:scripts/tests/test-plan-file-certification.test.ts::A_FileCertification_(fileSignedCertification)::a_corrupt_store_is_unknown,_and_the_corrupt_file_is_left_exactly_as_it_was
  Scenario: A corrupt store is unknown and left alone
    Given the store file holds "{ not json"
    When the certification is filed
    Then it answers "unknown" and the file still holds "{ not json"
