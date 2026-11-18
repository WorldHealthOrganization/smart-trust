Feature: Rendering an ODRL 2.2 Agreement one way into a FHIR R5 Permission

  @test:schemas/odrl-to-fhir-r5-permission.test.ts::One-way_ODRL_2.2_Agreement_→_FHIR_R5_Permission_renderer_(bean_jfbm)::workedExamplesRenderValidPermissions
  Scenario: 1. Done-when #1: worked DSA examples (DSA-042 v1 and PHW DSA 42 v3) render to valid FHIR R5 Permissions and compile with SUSHI (0 errors)
    Given the agreement DSA-042 v1 with its DCAT record
    When it is rendered to a Permission
    Then the Permission validates against the R5 Permission schema
    And it equals the expected Permission, with one permit rule for "use" with the purpose "PUBHLTH" and the limit "DELAU"
    Given the agreement PHW DSA 42 v3 with party references and a target display
    When it is rendered to a Permission
    Then the Permission validates and equals the expected Permission, with a permit rule for "use" and a deny rule for "disclose"
    When the DSA-042 v1 Permission is written as FSH
    Then the FSH contains "Instance: Permission-DSA-042-v1", "InstanceOf: Permission" and "* combining = #deny-overrides"
    And when SUSHI is installed and compiles it, its output reports "0 Errors" and "0 Warnings" and the generated resource validates and equals the Permission

  @test:schemas/odrl-to-fhir-r5-permission.test.ts::One-way_ODRL_2.2_Agreement_→_FHIR_R5_Permission_renderer_(bean_jfbm)::listsDroppedTerms
  Scenario: 2. Done-when #2: every ODRL / DCAT / SPDX term with no exact Permission home is listed in dropped
    Given the agreement PHW DSA 42 v3 with the DCAT record
    When it is rendered
    Then the dropped paths include "@type", the distribution checksum, two constraint operators, both duties, the duty constraint, the informed party and the prohibition action
    Given an agreement using a profile, inheritFrom, conflict "odrl:invalid", an obligation, a refinement, consequence, remedy and constraints with no Permission home
    When it is rendered
    Then the Permission validates and combines as "deny-unless-permit"
    And every one of those terms is listed among the dropped paths

  @test:schemas/odrl-to-fhir-r5-permission.test.ts::One-way_ODRL_2.2_Agreement_→_FHIR_R5_Permission_renderer_(bean_jfbm)::schemaFromR5CoreRefusesInvented
  Scenario: 3. Done-when #3: FhirR5PermissionSchema is built from hl7.fhir.r5.core#5.0.0 StructureDefinition-Permission.json and refuses any invented field
    Then the status, combining, provision type and data meaning codes are the R5 value sets in order
    And a Permission missing status or combining is refused
    And a Permission with status "proposed" or combining "invalid" is refused
    And a Permission with a top-level "identifier" or "policy" is refused
    And a rule with a "duty" and an evidence reference with a "hash" are refused
    And the renderer's source declares no hand-written FhirR5Permission interface and names the R5 core package id
