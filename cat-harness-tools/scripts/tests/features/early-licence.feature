# earlyLicence and carryIntakeLicence in scripts/ingest-document.ts give the early licence verdict read from the upload alone
# (stated, unknown or undetermined, never cleared by default) and carry an intake licence into the entry's licence.json.
# Each Scenario names the test that executes it.
Feature: Early licence verdict at ingest

  @test:scripts/tests/early-licence.test.ts::earlyLicence_(bean_7bg9)::a_stated_licence_in_intake.json_is_reported_with_its_basis
  Scenario: A stated licence in intake.json is reported with its id
    Given an upload whose intake.json records a stated licence "CC-BY-4.0" with a basis
    When the early licence verdict is read
    Then the verdict is "stated"
    And the detail contains "CC-BY-4.0"

  @test:scripts/tests/early-licence.test.ts::earlyLicence_(bean_7bg9)::unknown_—_somebody_looked_—_is_reported_as_unknown,_not_cleared
  Scenario: A licence recorded as unknown is reported as unknown
    Given an upload whose intake.json records licence status "unknown" with one place searched
    When the early licence verdict is read
    Then the verdict is "unknown"

  @test:scripts/tests/early-licence.test.ts::earlyLicence_(bean_7bg9)::nothing_recorded_is_UNDETERMINED,_never_stated
  Scenario: Nothing recorded is undetermined
    Given an upload with no intake.json, and another whose intake.json has no licence
    When the early licence verdict is read for each
    Then both verdicts are "undetermined"

  @test:scripts/tests/early-licence.test.ts::earlyLicence_(bean_7bg9)::a_LICENSE_file_beside_the_upload_is_named,_but_a_person_states_it_—_still_undetermined
  Scenario: A LICENSE file beside the upload is named but leaves the verdict undetermined
    Given an upload with a LICENSE file reading "MIT License" beside it and no intake.json
    When the early licence verdict is read
    Then the verdict is "undetermined"
    And the detail mentions "LICENSE"

  @test:scripts/tests/early-licence.test.ts::earlyLicence_(bean_7bg9)::a_malformed_licence_record_is_not_read_as_'no_licence'_—_it_says_it_could_not_validate
  Scenario: A malformed licence record is undetermined and says it does not validate
    Given an upload whose intake.json records a stated licence "CC-BY-4.0" with no basis
    When the early licence verdict is read
    Then the verdict is "undetermined"
    And the detail contains "does not validate"

  @test:scripts/tests/early-licence.test.ts::carryIntakeLicence_(bean_7bg9)::a_licence_recorded_at_intake_becomes_the_entry's_licence.json_—_the_sidecar_gen:jsonld_carries,_not_the_generated_manifest
  Scenario: A licence recorded at intake is written as the entry's licence.json
    Given an empty staged entry directory
    And an upload whose intake.json records a stated "CC-BY-4.0" licence with a basis
    When the intake licence is carried into the entry
    Then the outcome is "carried"
    And the entry's licence.json equals the intake licence
    And no manifest.jsonld is written in the entry

  @test:scripts/tests/early-licence.test.ts::carryIntakeLicence_(bean_7bg9)::never_overwrites:_a_different_licence.json_already_there_is_a_CONFLICT,_and_left_alone
  Scenario: A different licence.json already in the entry is a conflict and is left alone
    Given a staged entry whose licence.json records status "unknown"
    And an upload whose intake.json records a stated "CC-BY-4.0" licence
    When the intake licence is carried into the entry
    Then the outcome is "conflict"
    And the entry's licence.json is unchanged

  @test:scripts/tests/early-licence.test.ts::carryIntakeLicence_(bean_7bg9)::nothing_recorded_at_intake_writes_nothing_—_absence_is_not_a_licence
  Scenario: No intake licence writes no licence.json
    Given an empty staged entry directory
    And an upload whose intake.json has no licence
    When the intake licence is carried into the entry
    Then the outcome is "nothing"
    And the entry has no licence.json
