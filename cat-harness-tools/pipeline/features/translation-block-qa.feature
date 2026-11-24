# pipeline/translation-block-qa.ts sweeps each block's translations into translation-qa sidecars:
# coverage, preserved terms (read through the locale glossary) and echoes, with no offline round-trip verdict.
# Each Scenario names the test that executes it.
Feature: Block-level translation QA sweep

  @test:pipeline/translation-block-qa.test.ts::invariantTokens_—_what_a_translation_may_not_silently_drop::acronyms,_numbers_and_URLs_are_all_found
  Scenario: Acronyms, numbers and URLs are all invariant tokens
    Given the text "The CRDM gate ran 3 times; see https://phii.org/x for QA notes."
    When its invariant tokens are found
    Then they include "CRDM", "QA", "3" and "https://phii.org/x"

  @test:pipeline/translation-block-qa.test.ts::invariantTokens_—_what_a_translation_may_not_silently_drop::a_number_or_a_URL_is_STRICT_—_it_cannot_legitimately_change
  Scenario: A number or a URL is a strict token
    Given the text "ran 3 times; see https://phii.org/x"
    When its invariant tokens are found
    Then "3" and "https://phii.org/x" are of kind "strict"

  @test:pipeline/translation-block-qa.test.ts::invariantTokens_—_what_a_translation_may_not_silently_drop::an_acronym_is_NOT_strict,_because_a_good_translation_localises_it
  Scenario: An acronym is not strict, because a translation may localise it
    When the invariant tokens of "the WHO SMART Guidelines" are found
    Then "WHO" is of kind "acronym"

  @test:pipeline/translation-block-qa.test.ts::invariantTokens_—_what_a_translation_may_not_silently_drop::a_number_inside_a_URL_does_not_demote_the_URL_to_an_acronym
  Scenario: A number inside a URL leaves the URL strict
    When the invariant tokens of "see https://example.org/v2/spec" are found
    Then the URL is of kind "strict"

  @test:pipeline/translation-block-qa.test.ts::invariantTokens_—_what_a_translation_may_not_silently_drop::an_ordinary_capitalised_word_is_not_an_invariant_token_at_all
  Scenario: An ordinary capitalised word is not an invariant token
    When the invariant tokens of "Public Health Informatics Institute" are found
    Then there are none

  @test:pipeline/translation-block-qa.test.ts::measureBlock::an_empty_msgstr_is_untranslated,_not_translated-to-nothing
  Scenario: An empty msgstr is untranslated
    Given a block whose source is "The CRDM gate is a checkpoint."
    And its msgstr is only whitespace
    When the block is measured
    Then the total is 1 and the translated count is 0

  @test:pipeline/translation-block-qa.test.ts::measureBlock::a_msgstr_identical_to_its_msgid_is_counted_as_an_echo
  Scenario: A msgstr identical to its msgid counts as an echo
    Given a block whose source is "The CRDM gate is a checkpoint."
    And its msgstr is the same sentence
    When the block is measured
    Then the translated count is 1 and the echoed count is 1

  @test:pipeline/translation-block-qa.test.ts::measureBlock::a_dropped_acronym_is_a_finding_that_quotes_the_translation
  Scenario: A dropped acronym is a finding that quotes the translation
    Given a block whose source is "The CRDM gate is a checkpoint."
    And its msgstr "La barrière est un point de contrôle." drops "CRDM"
    When the block is measured
    Then there is one missing-acronym finding naming "CRDM" and quoting "barrière"
    And there are no missing strict tokens

  @test:pipeline/translation-block-qa.test.ts::measureBlock::a_dropped_NUMBER_is_strict_—_nothing_localises_a_3
  Scenario: A dropped number is a strict finding
    Given a block "The gate ran 3 times." translated without the "3"
    When the block is measured
    Then there is one missing strict finding naming "3"
    And there are no missing acronyms

  @test:pipeline/translation-block-qa.test.ts::measureBlock::a_real_translation_that_keeps_its_terms_is_clean
  Scenario: A translation that keeps its terms is clean
    Given a block whose source is "The CRDM gate is a checkpoint."
    And its msgstr "La barrière CRDM est un point de contrôle."
    When the block is measured
    Then the translated count is 1 and the echoed count is 0
    And there are no missing strict tokens or acronyms

  @test:pipeline/translation-block-qa.test.ts::buildReport_—_absence_is_absence::no_PO_source_at_all:_no_report
  Scenario: No PO source means no report
    Given a block "b.md" reading "The CRDM gate is a checkpoint."
    When a "fr" report is built with no PO files
    Then there is no report

  @test:pipeline/translation-block-qa.test.ts::buildReport_—_absence_is_absence::a_PO_that_holds_none_of_this_block's_strings:_no_report,_NOT_a_0%_failure
  Scenario: A PO holding none of the block's strings gives no report, not a failure
    Given a block "b.md" reading "The CRDM gate is a checkpoint."
    And a PO file that translates only "Some other sentence."
    When a "fr" report is built from it
    Then there is no report

  @test:pipeline/translation-block-qa.test.ts::buildReport_—_absence_is_absence::a_translated_block_reports_coverage,_terms_and_echo_—_and_NO_round-trip_verdict
  Scenario: A translated block reports coverage, terms and echo, and no round-trip verdict
    Given a block "b.md" reading "The CRDM gate is a checkpoint."
    And a "fr" PO translating it as "La barrière CRDM est un point de contrôle."
    When the "fr" report is built for label "sec:b"
    Then the report label is "trans:fr/b" and its block is "sec:b"
    And "translation-coverage" passes at 100 percent
    And "translation-terms-preserved" and "translation-not-echo" pass
    And "translation-semantic-roundtrip" has no entries

  @test:pipeline/translation-block-qa.test.ts::buildReport_—_absence_is_absence::the_PO_is_a_hashed_input,_so_editing_the_translation_stales_the_verdict
  Scenario: Editing the PO changes its recorded hash
    Given a block "b.md" reading "The CRDM gate is a checkpoint."
    And a "fr" PO translating it
    When a report is built, the PO translation is edited, and a report is built again
    Then the two reports record different PO source hashes
    And the coverage entries record different PO field hashes

  @test:pipeline/translation-block-qa.test.ts::buildReport_—_absence_is_absence::a_partial_translation_warns,_and_says_how_much_is_missing
  Scenario: A partial translation warns and says how much is missing
    Given a block with two sentences of which the PO translates only the first
    When the "fr" report is built
    Then "translation-coverage" warns
    And its metrics are 1 translated of 2 total, 50 percent
    And its notes say "1 of 2"

  @test:pipeline/translation-block-qa.test.ts::mergeCriteria_—_a_re-run_must_not_delete_what_it_did_not_write::the_sweep_replaces_its_OWN_entries_rather_than_stacking_them
  Scenario: The sweep replaces its own entries rather than stacking them
    Given an existing "translation-coverage" with a "fail" entry from this sweep
    When it is merged with a fresh "pass" entry from this sweep
    Then the criterion has one entry, the "pass"

  @test:pipeline/translation-block-qa.test.ts::mergeCriteria_—_a_re-run_must_not_delete_what_it_did_not_write::an_agent_verdict_on_a_criterion_the_sweep_does_not_measure_SURVIVES
  Scenario: An agent verdict on a criterion the sweep does not measure survives
    Given an existing "translation-semantic-roundtrip" with agent entries "pass" and "n/a"
    When it is merged with an empty fresh list for that criterion
    Then both agent entries remain, "pass" first

  @test:pipeline/translation-block-qa.test.ts::mergeCriteria_—_a_re-run_must_not_delete_what_it_did_not_write::an_agent_entry_on_a_criterion_the_sweep_DOES_measure_is_kept,_behind_the_fresh_script_one
  Scenario: An agent entry on a measured criterion is kept behind the fresh script entry
    Given an existing "translation-coverage" with an agent "warn" entry
    When it is merged with a fresh "pass" entry from this sweep
    Then the criterion has 2 entries, the script entry first and the agent entry second

  @test:pipeline/translation-block-qa.test.ts::mergeCriteria_—_a_re-run_must_not_delete_what_it_did_not_write::another_script's_entry_is_not_mistaken_for_this_one's
  Scenario: Another script's entry is not mistaken for this sweep's
    Given an existing "translation-coverage" with a "fail" entry from "some/other-checker.ts"
    When it is merged with a fresh "pass" entry from this sweep
    Then the criterion has 2 entries

  @test:pipeline/translation-block-qa.test.ts::mergeCriteria_—_a_re-run_must_not_delete_what_it_did_not_write::a_criterion_only_the_existing_sidecar_has_is_carried_through_untouched
  Scenario: A criterion only the existing sidecar has is carried through
    Given an existing "human-only-axis" criterion with one agent entry
    When it is merged with no fresh criteria
    Then "human-only-axis" still has one entry

  @test:pipeline/translation-block-qa.test.ts::the_glossary_is_a_reading_rule,_not_a_mute_button::a_localised_term_absent_from_the_translation_PASSES,_and_says_why
  Scenario: A localised glossary term absent from the translation passes and says why
    Given "The WHO guidelines apply." translated with "OMS" in place of "WHO"
    And a glossary marking "WHO" as localised
    When the block is measured
    Then there are no missing acronyms and no broken glossary terms
    And one resolved acronym note names "WHO" and "localised"

  @test:pipeline/translation-block-qa.test.ts::the_glossary_is_a_reading_rule,_not_a_mute_button::a_PINNED_form_present_in_the_translation_passes
  Scenario: A pinned glossary form present in the translation passes
    Given "The WHO guidelines apply." translated with "OMS"
    And a glossary pinning "WHO" to "OMS"
    When the block is measured
    Then there is one resolved acronym and no broken glossary terms

  @test:pipeline/translation-block-qa.test.ts::the_glossary_is_a_reading_rule,_not_a_mute_button::a_PINNED_form_that_is_ALSO_absent_FAILS_—_the_glossary_said_what_it_should_be
  Scenario: A pinned glossary form absent from the translation fails
    Given "The WHO guidelines apply." translated with neither "WHO" nor "OMS"
    And a glossary pinning "WHO" to "OMS"
    When the block is measured
    Then there is one broken glossary term naming "OMS"
    And there are no resolved acronyms

  @test:pipeline/translation-block-qa.test.ts::the_glossary_is_a_reading_rule,_not_a_mute_button::a_VERBATIM_term_that_was_dropped_still_fails_—_the_identity_mapping_bites
  Scenario: A verbatim glossary term that was dropped fails
    Given "The FHIR profile is normative." translated without "FHIR"
    And a glossary pinning "FHIR" to "FHIR"
    When the block is measured
    Then there is one broken glossary term naming "FHIR"

  @test:pipeline/translation-block-qa.test.ts::the_glossary_is_a_reading_rule,_not_a_mute_button::a_term_the_glossary_does_not_name_still_WARNS_—_silence_is_not_permission
  Scenario: A term the glossary does not name still warns
    Given "The CRDM gate is a checkpoint." translated without "CRDM"
    And a glossary that names only "WHO"
    When the block is measured
    Then there is one missing acronym naming "CRDM"

  @test:pipeline/translation-block-qa.test.ts::the_glossary_is_a_reading_rule,_not_a_mute_button::an_EMPTY_entry_—_no_form,_no_flag_—_is_unfinished,_not_permission
  Scenario: An empty glossary entry gives no permission
    Given "The CRDM gate is a checkpoint." translated without "CRDM"
    And a glossary entry for "CRDM" with no form and no localised flag
    When the block is measured
    Then there is one missing acronym
    And there are no resolved acronyms

  @test:pipeline/translation-block-qa.test.ts::the_glossary_is_a_reading_rule,_not_a_mute_button::localised_CANNOT_forgive_a_number_—_no_glossary_speaks_for_strict_tokens
  Scenario: A localised glossary entry cannot forgive a dropped number
    Given "The gate ran 3 times." translated without the "3"
    And a glossary marking "3" as localised
    When the block is measured
    Then there is one missing strict finding naming "3"
    And there are no resolved acronyms

  @test:pipeline/translation-block-qa.test.ts::the_glossary_is_a_reading_rule,_not_a_mute_button::localised_CANNOT_forgive_a_dropped_URL_either
  Scenario: A localised glossary entry cannot forgive a dropped URL
    Given "See https://example.org/spec for details." translated without the URL
    And a glossary marking that URL as localised
    When the block is measured
    Then there is one missing strict finding

  @test:pipeline/translation-block-qa.test.ts::the_glossary_is_a_reading_rule,_not_a_mute_button::a_glossary_for_ANOTHER_locale_is_not_consulted_—_the_map_is_per-locale
  Scenario: With no glossary for the locale a dropped acronym still warns
    # Gap: no other locale's glossary is set up; only an empty glossary is checked
    Given "The WHO guidelines apply." translated without "WHO"
    And an empty glossary
    When the block is measured
    Then there is one missing acronym naming "WHO"

  @test:pipeline/translation-block-qa.test.ts::readPrior_(bean_8wj1)::without_a_ref_it_is_the_working_copy,_present_or_absent
  Scenario: Without a ref the prior is the working copy, present or absent
    Given a sidecar on disk with note "disk"
    When the prior is read with no ref
    Then the prior has note "disk"
    When the prior is read with no ref and no existing sidecar
    Then there is no prior document

  @test:pipeline/translation-block-qa.test.ts::readPrior_(bean_8wj1)::with_a_ref_the_branch_decides,_and_a_different_working_copy_is_ignored
  Scenario: With a ref the stored branch decides and the working copy is ignored
    Given a sidecar published to the qa-reports store at "main/<40 a>" with note "branch"
    And the working copy holds the same sidecar with note "disk"
    When the prior is read for ref "main"
    Then the read succeeds with note "branch"
    And it reports coming from "qa-reports:main/<40 a>"

  @test:pipeline/translation-block-qa.test.ts::readPrior_(bean_8wj1)::a_sidecar_the_branch_lacks_has_no_prior,_even_with_one_on_disk
  Scenario: A sidecar the branch lacks has no prior, even with one on disk
    Given a sidecar "x.fr" published to the qa-reports store
    And a sidecar "y.fr" only in the working copy
    When the prior of "y.fr" is read for ref "main"
    Then there is no prior document

  @test:pipeline/translation-block-qa.test.ts::readPrior_(bean_8wj1)::a_branch_that_cannot_be_read_refuses_rather_than_reading_as_no_prior
  Scenario: A branch that cannot be read refuses rather than reading as no prior
    Given a qa-reports store whose remote does not exist
    When the prior is read for ref "main"
    Then the read is not ok

  @test:pipeline/translation-block-qa.test.ts::judge_only_the_caller's_own_instance::unscoped_(a_local_run):_judges,_as_before
  Scenario: An unscoped local run judges every instance
    Given an instance "cat-harness"
    When it is checked with no own-instance setting
    Then there is no not-own line, so it is judged

  @test:pipeline/translation-block-qa.test.ts::judge_only_the_caller's_own_instance::the_caller_is_another_instance:_nothing_of_its_own,_a_pass
  Scenario: Another instance's caller passes with nothing of its own
    Given an instance "cat-harness"
    When it is checked with own instances "content-ig"
    Then the not-own line names "content-ig" and says "judged by their own CI"

  @test:pipeline/translation-block-qa.test.ts::judge_only_the_caller's_own_instance::the_caller_is_the_harness:_judges
  Scenario: The harness as caller judges its own instance
    Given an instance "cat-harness"
    When it is checked with own instances "cat-harness"
    Then there is no not-own line, so it is judged

  @test:pipeline/translation-block-qa.test.ts::judge_only_the_caller's_own_instance::own_paths_only:_an_instance_outside_them_is_not_judged
  Scenario: With own paths set, an instance outside them is not judged
    Given own paths "content-ig" and foreign paths "index/cat-harness"
    When an instance "cat-harness" under "fa" is checked
    Then there is a not-own line
    When an instance "content-ig" is checked
    Then there is no not-own line
