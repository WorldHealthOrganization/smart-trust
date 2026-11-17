# scripts/apply-image-verdicts.ts `runStaging` applies image verdicts to a staged document's
# images.json before it is in a library; its exit code tolerates absent verdicts but not orphaned ones.
# Each Scenario names the test that executes it.
Feature: Applying image verdicts to a staged document

  @test:scripts/tests/apply-image-verdicts.test.ts::runStaging_—_the_exit_code_is_the_point::NO_verdicts_file_at_all_is_exit_0,_not_an_error
  Scenario: No verdicts file at all exits 0 and leaves the sidecar alone
    Given a staged entry with a geometry-only images.json and a library with no image-verdicts.json
    When runStaging runs in write mode
    Then it returns 0
    And the images.json is unchanged

  @test:scripts/tests/apply-image-verdicts.test.ts::runStaging_—_the_exit_code_is_the_point::a_verdicts_file_with_nothing_for_THIS_document_is_exit_0
  Scenario: A verdicts file with nothing for this document exits 0
    Given a library verdicts file that only judges "some-other-doc"
    When runStaging runs over the staged entry in write mode
    Then it returns 0
    And the images.json is unchanged

  @test:scripts/tests/apply-image-verdicts.test.ts::runStaging_—_the_exit_code_is_the_point::an_ORPHANED_verdict_IS_an_error,_and_writes_nothing
  Scenario: An orphaned verdict is an error and writes nothing
    Given a verdict for this document naming image "img-p999-9", which the sidecar does not have
    When runStaging runs in write mode
    Then it returns 1
    And the images.json is unchanged

  @test:scripts/tests/apply-image-verdicts.test.ts::runStaging_—_the_exit_code_is_the_point::a_missing_images.json_is_an_error_—_an_arm_did_not_run
  Scenario: A missing images.json is an error
    Given a staging path "no-such-doc" with no images.json
    When runStaging runs over it
    Then it returns 1

  @test:scripts/tests/apply-image-verdicts.test.ts::runStaging_—_what_it_writes::applies_the_verdict,_and_the_narrative_lands_as_a_DRAFT
  Scenario: Applying a verdict sets the role and adds a draft narrative
    Given a logo verdict for image "img-p003-1" of this document
    When runStaging runs in write mode
    Then it returns 0
    And the image's role is "logo" and its basis method is "inspection"
    And the image has exactly one narrative, in state "draft", language "en", with the verdict's draft text

  @test:scripts/tests/apply-image-verdicts.test.ts::runStaging_—_what_it_writes::translations_land_as_one_draft_per_language,_beside_the_primary
  Scenario: Translations land as one draft narrative per language after the primary
    Given a logo verdict carrying French and Spanish translations
    When runStaging runs in write mode
    Then it returns 0
    And the narratives are "en:draft", "fr:draft", "es:draft" in that order
    And the French narrative's text is the French translation

  @test:scripts/tests/apply-image-verdicts.test.ts::runStaging_—_what_it_writes::a_translation_in_the_verdict's_own_language_is_refused
  Scenario: A translation in the verdict's own language is refused
    Given a logo verdict carrying an "en" translation
    When runStaging runs
    Then it throws an error mentioning "own language"

  @test:scripts/tests/apply-image-verdicts.test.ts::runStaging_—_what_it_writes::the_geometry_basis_is_REPLACED_by_an_inspection_basis
  Scenario: The geometry basis is replaced by an inspection basis
    Given a logo verdict for image "img-p003-1"
    When runStaging runs in write mode
    Then the image's basis has no coverage
    And the basis records what was seen, who inspected it and the date "2026-09-23"

  @test:scripts/tests/apply-image-verdicts.test.ts::runStaging_—_what_it_writes::--check_reports_without_writing
  Scenario: Check mode reports without writing
    Given a logo verdict for image "img-p003-1"
    When runStaging runs in check mode
    Then it returns 0
    And the images.json is unchanged

  @test:scripts/tests/apply-image-verdicts.test.ts::runStaging_—_what_it_writes::applying_twice_is_idempotent_—_which_is_what_makes_a_re-run_safe
  Scenario: Applying the same verdicts twice is idempotent
    Given a logo verdict for image "img-p003-1"
    When runStaging runs in write mode twice
    Then the images.json after the second run equals the one after the first

  @test:scripts/tests/apply-image-verdicts.test.ts::translations_drafted_after_the_verdict_survive_a_re-ingest_(re-ingest_pilot,_2026-11-14)::a_staged_sidecar_takes_the_filed_entry's_other_languages_when_the_English_is_unchanged
  Scenario: A re-ingest keeps the image descriptions in other languages
    When the filed entry's sidecar holds the verdict's English text and five other languages
    Then the rebuilt sidecar holds them too

  @test:scripts/tests/apply-image-verdicts.test.ts::translations_drafted_after_the_verdict_survive_a_re-ingest_(re-ingest_pilot,_2026-11-14)::a_changed_English_description_does_not_carry_the_old_translations
  Scenario: A changed description does not keep its old translations
    When the verdict's English text differs from the filed one
    Then only the verdict's own narratives are written

  @test:scripts/tests/apply-image-verdicts.test.ts::translations_drafted_after_the_verdict_survive_a_re-ingest_(re-ingest_pilot,_2026-11-14)::a_bare_run_over_a_filed_sidecar_keeps_what_it_holds
  Scenario: Re-applying the verdicts to a filed sidecar keeps its other languages
    When the verdicts are applied to a sidecar that already holds translations of the same text
    Then the translations stay

