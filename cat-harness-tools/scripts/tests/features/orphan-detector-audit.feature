# Generic orphan detection across declared graph kinds (bean
# folio-assistant-9mmu). Each Scenario names the test that executes it.
Feature: Orphan detection across graphs

  @test:scripts/tests/orphan-detector-audit.test.ts::orphan-detector:_vacuity_guard::empty_candidate_set_returns_unknown,_never_pass
  Scenario: An empty candidate set is unknown, never a pass
    When orphans are detected over no beans, sidecars or attestations
    Then nothing is examined, the result is unknown, and a finding names the vacuity guard

  @test:scripts/tests/orphan-detector-audit.test.ts::orphan-detector:_vacuity_guard::empty_directory_returns_unknown_due_to_vacuity_guard
  Scenario: An empty directory is unknown
    When orphans are detected over an empty directory
    Then nothing is examined and the result is unknown

  @test:scripts/tests/orphan-detector-audit.test.ts::orphan-detector:_positive_orphan_detection::detects_bean_referencing_nonexistent_parent
  Scenario: A bean referencing a nonexistent parent is an orphan
    When a bean whose parent does not exist is examined
    Then one candidate is examined, the result is fail, and the one finding at the bean names the missing parent

  @test:scripts/tests/orphan-detector-audit.test.ts::orphan-detector:_positive_orphan_detection::detects_bean_referencing_nonexistent_blocking_target
  Scenario: A bean referencing a nonexistent blocking target is an orphan
    When a bean blocking a missing task is examined
    Then the result is fail with one finding at the bean naming the missing blocking target

  @test:scripts/tests/orphan-detector-audit.test.ts::orphan-detector:_positive_orphan_detection::detects_bean_referencing_nonexistent_blocked_by_target
  Scenario: A bean referencing a nonexistent blocked_by target is an orphan
    When a bean blocked by a missing predecessor is examined
    Then the result is fail with one finding at the bean naming the missing blocked_by target

  @test:scripts/tests/orphan-detector-audit.test.ts::orphan-detector:_positive_orphan_detection::detects_QA_sidecar_whose_subject_file_is_missing_on_disk
  Scenario: A QA sidecar whose subject file is missing is an orphan
    When a sidecar whose subject is not on disk is examined
    Then the result is fail with one finding at the sidecar naming the missing subject

  @test:scripts/tests/orphan-detector-audit.test.ts::orphan-detector:_positive_orphan_detection::detects_unreadable_QA_sidecar
  Scenario: An unreadable QA sidecar is a finding
    When a sidecar marked unreadable is examined
    Then the result is fail and the finding says it could not be parsed as JSON

  @test:scripts/tests/orphan-detector-audit.test.ts::orphan-detector:_positive_orphan_detection::detects_attestation_whose_subject_is_missing_on_disk
  Scenario: An attestation whose subject is missing is an orphan
    When an attestation whose subject is not on disk is examined
    Then the result is fail and the finding names the missing subject

  @test:scripts/tests/orphan-detector-audit.test.ts::orphan-detector:_clean_resolution::resolves_cleanly_when_all_bean_and_sidecar_targets_exist
  Scenario: Everything resolves cleanly
    Given three beans whose parent and blocking references exist, and a sidecar and an attestation over an existing file
    When orphans are detected
    Then five candidates are examined, the result is pass, and there are no findings

  @test:scripts/tests/orphan-detector-audit.test.ts::orphan-detector:_filesystem-based_integration::reads_bean_definitions_from_defs_directory_with_valid_and_invalid_references
  Scenario: Bean definitions are read from the defs directory
    Given an epic, a child of it, and a child of a missing epic, as bean files
    When orphans are detected from that directory
    Then two beans are examined, the result is fail, and the one finding is the orphan's missing parent

  @test:scripts/tests/orphan-detector-audit.test.ts::orphan-detector:_schema_and_kg-audit_integration::criterion_orphan-subject-resolves_is_registered_in_KG_CRITERIA
  Scenario: The orphan-subject-resolves criterion is registered
    Then it is defined for graphs at repository scope with minor severity
    And its scope basis is over 80 characters and names the repository root, and its summary names orphans

  @test:scripts/tests/orphan-detector-audit.test.ts::orphan-detector:_schema_and_kg-audit_integration::orphanSubjectResolves_returns_a_valid_KgCriterionEntry_on_current_repo
  Scenario: The criterion runs on the current repository
    When it runs from the working directory
    Then its result is pass, fail or unknown and its findings are a list
    # Gap: any result the criterion type allows passes; only a throw or a malformed entry fails it.
