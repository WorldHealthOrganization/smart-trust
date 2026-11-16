Feature: platform/schema.ts is the seam of the files the platform loads
  The files the platform loads by glob (themes.ts, schemas/**, the
  qa-checkers pipeline files) reach the platform only through schema.ts, and
  their import closure stays off fhir-harness and every scripts/ directory.
  Skipped when cat-harness-tools is not mounted.

  @test:smart-base/platform/schema.test.ts::platform/schema.ts:_the_seam_of_the_files_the_platform_loads::globbedFilesReachPlatformViaSchemaOnly
  Scenario: no globbed file reaches the platform except through schema.ts
    Given the instance's files the platform loads by glob
    Then none imports a file under platform/ other than platform/schema.ts

  @test:smart-base/platform/schema.test.ts::platform/schema.ts:_the_seam_of_the_files_the_platform_loads::schemaReachesNoFhirHarnessOrScript
  Scenario: schema.ts reaches no fhir-harness file and no platform script
    Given the relative-import closure of platform/schema.ts
    Then it holds no file under fhir-harness/ and none in a top-level scripts/ directory

  @test:smart-base/platform/schema.test.ts::platform/schema.ts:_the_seam_of_the_files_the_platform_loads::globbedClosureStaysOffFhirHarness
  Scenario: the globbed files' whole closure stays off fhir-harness
    Given the relative-import closure of every globbed file
    Then it holds no file under fhir-harness/ and none in a top-level scripts/ directory
