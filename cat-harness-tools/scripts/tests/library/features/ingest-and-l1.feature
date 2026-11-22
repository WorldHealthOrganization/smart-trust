# The ingest rung decision, and the L1 completeness gate. Each Scenario names
# the test that executes it (skill test-engineer, "Every test has a Gherkin").
Feature: The ingest rung decision and the L1 completeness gate

  @test:scripts/tests/library/ingest-and-l1.test.ts::what_makes_an_outline_entry_capable_of_being_a_chapter::a_real_heading_counts
  Scenario: A real heading is a usable outline entry
    When the usable outline entries of "2. Preliminaries" on page 7 are counted
    Then the count is 1

  @test:scripts/tests/library/ingest-and-l1.test.ts::what_makes_an_outline_entry_capable_of_being_a_chapter::an_entry_with_no_resolvable_destination_does_not
  Scenario: An outline entry with no destination is not usable
    When outline entries pointing at page -1 or page 0 are counted
    Then each count is 0

  @test:scripts/tests/library/ingest-and-l1.test.ts::what_makes_an_outline_entry_capable_of_being_a_chapter::a_bare_page_reference_does_not,_in_the_spellings_the_corpus_uses
  Scenario: A bare page reference is not usable
    When outline entries titled "p. 177", "p.177", "p 177", "pp. 12", "P. 3" and "  p. 9  " are counted
    Then each count is 0

  @test:scripts/tests/library/ingest-and-l1.test.ts::what_makes_an_outline_entry_capable_of_being_a_chapter::a_heading_that_merely_CONTAINS_a_page_number_still_counts
  Scenario: A heading that contains a page number is usable
    When outline entries titled "Chapter 3, p. 177" and "Theorem 177" are counted
    Then each count is 1

  @test:scripts/tests/library/ingest-and-l1.test.ts::what_makes_an_outline_entry_capable_of_being_a_chapter::the_milnorlink_shape:_35_in,_0_usable
  Scenario: The milnorlink outline has no usable entry
    Given 35 outline entries: two with no destination, 19 bare page references and 14 other articles with no destination
    When the usable entries are counted
    Then the count is 0

  @test:scripts/tests/library/ingest-and-l1.test.ts::what_makes_an_outline_entry_capable_of_being_a_chapter::nothing_in_is_0_out,_not_a_crash
  Scenario: An empty outline counts 0
    When the usable entries of an empty outline are counted
    Then the count is 0

  @test:scripts/tests/library/ingest-and-l1.test.ts::which_rung_a_document_needs::an_embedded_outline_selects_pdf-structure_—_the_structure_is_READ
  Scenario: A usable embedded outline selects pdf-structure
    Given a probe with 258 outline entries, 257 usable, and 90000 characters
    When the plan is made
    Then the rung is pdf-structure, its first step runs pdf-structure.py by absolute path
    And the reason names 258 and 257

  @test:scripts/tests/library/ingest-and-l1.test.ts::which_rung_a_document_needs::an_outline_of_JUNK_is_not_a_structure_—_the_bean_`8shg`_case
  Scenario: An outline with no usable entry selects pdf-pages
    Given a probe with 35 outline entries, none usable, and 47871 characters
    When the plan is made
    Then the rung is pdf-pages
    And the reason names 35 and does not say "no outline"

  @test:scripts/tests/library/ingest-and-l1.test.ts::which_rung_a_document_needs::a_junk_outline_still_falls_through_to_OCR_when_there_is_no_text_either
  Scenario: A junk outline with no text selects OCR then pages
    Given a probe with 35 outline entries, none usable, and no characters
    When the plan is made
    Then the rung is pdf-ocr+pdf-pages and the reason names 35

  @test:scripts/tests/library/ingest-and-l1.test.ts::which_rung_a_document_needs::an_outline_whose_usability_was_NOT_measured_is_undetermined,_not_structure
  Scenario: An outline whose usability is unknown is undetermined
    Given probes with 35 outline entries whose usable count is absent or null
    When each plan is made
    Then the rung is undetermined with no steps and the reason says "unknown"

  @test:scripts/tests/library/ingest-and-l1.test.ts::which_rung_a_document_needs::no_outline_but_a_text_layer_selects_pdf-structure,_which_decides_inferred_contents_vs_pages
  Scenario: No outline but a text layer selects pdf-structure
    Given a probe with no outline and 50000 characters
    When the plan is made
    Then the rung is pdf-structure with one pdf-structure.py step
    And the reason mentions the "trust tests"

  @test:scripts/tests/library/ingest-and-l1.test.ts::which_rung_a_document_needs::no_outline_and_almost_no_text_selects_OCR_FIRST,_then_pages
  Scenario: No outline and almost no text selects OCR first
    Given a probe with no outline and one character below the OCR threshold
    When the plan is made
    Then the rung is pdf-ocr+pdf-pages, running pdf-ocr.py then pdf-pages.py
    And the pdf-pages step carries --from-ocr

  @test:scripts/tests/library/ingest-and-l1.test.ts::which_rung_a_document_needs::the_OCR_threshold_is_a_boundary,_not_a_vibe
  Scenario: The OCR threshold is an exact boundary
    Then a probe with exactly the threshold's characters selects pdf-structure
    And one with a character fewer selects pdf-ocr+pdf-pages

  @test:scripts/tests/library/ingest-and-l1.test.ts::which_rung_a_document_needs::a_PDF_that_cannot_be_probed_is_UNDETERMINED_and_runs_nothing
  Scenario: A PDF that cannot be probed is undetermined
    Given probes with a backend error, an unknown outline, or unknown characters
    When each plan is made
    Then the rung is undetermined with no steps

  @test:scripts/tests/library/ingest-and-l1.test.ts::L1_completeness::a_full_entry_is_complete
  Scenario: A full entry meets every derivable requirement
    Given an entry with sections, blocks, a pdf-structure with a full source block, a manifest and a page-scan images.json
    Then every derivable requirement is met

  @test:scripts/tests/library/ingest-and-l1.test.ts::L1_completeness::each_missing_artefact_is_reported_unmet,_not_skipped
  Scenario: Each missing artefact is unmet
    Then an entry with no sections has sections unmet
    And one with no blocks has blocks unmet
    And one whose manifest has only an @id has manifest unmet
    And one whose manifest has no provenance has provenance unmet
    And one with an empty structure has structure unmet
    And one whose structure has no source, or a partial source, has technical-metadata unmet

  @test:scripts/tests/library/ingest-and-l1.test.ts::L1_completeness::unparseable_JSON_is_unmet_rather_than_an_exception
  Scenario: An unparseable structure.json is unmet
    Given a full entry whose structure.json is not JSON
    Then structure is unmet

  @test:scripts/tests/library/ingest-and-l1.test.ts::L1_completeness::an_empty_structure_with_NO_note_is_unmet_—_nothing_says_the_emptiness_was_determined
  Scenario: An empty structure needs a note
    Given an entry whose structure has no sections and no note
    Then structure-note is unmet
    And with a structure_note the structure-note requirement is not reported

  @test:scripts/tests/library/ingest-and-l1.test.ts::L1_completeness::what_no_arm_can_produce_is_NOT-DERIVABLE,_never_met
  Scenario: What no arm produces is not-derivable
    Given a full entry
    Then its not-derivable requirements are exactly the NOT_DERIVABLE list
    And each one's detail names a bean

  @test:scripts/tests/library/ingest-and-l1.test.ts::L1_completeness::NO_DECLARATION_is_undetermined_—_never_'nothing_to_check'
  Scenario: A root with no declaration is undetermined
    Given a directory that declares no instance
    When every library under it is checked
    Then the result is undefined, not an empty list

  @test:scripts/tests/library/ingest-and-l1.test.ts::L1_completeness::...and_a_DECLARED_library_holding_nothing_is_`[]`,_a_real_finding
  Scenario: A declared empty library checks to an empty list
    Given a root declaring an empty library
    When every library under it is checked
    Then the result is an empty list

  @test:scripts/tests/library/ingest-and-l1.test.ts::L1_completeness::the_real_corpus_passes_every_derivable_requirement
  Scenario: The harness's own library meets every requirement
    Given the harness root declares a library
    When every library under it is checked
    Then there is at least one entry
    And no requirement is unmet

  @test:scripts/tests/library/ingest-and-l1.test.ts::the_verdict_as_a_committed_sidecar::the_ASSET_is_the_subject_and_the_TOOL_is_the_producer
  Scenario: The verdict sidecar's subject is the asset and its producer the tool
    Given the sidecar document of a full entry
    Then its schema is qa-results/v1 and its subject kind is library-document
    And its producer is scripts/check-l1-complete.ts with a 12-hex-digit script hash

  @test:scripts/tests/library/ingest-and-l1.test.ts::the_verdict_as_a_committed_sidecar::a_DEFECT_and_a_GAP_are_separate_families,_and_neither_is_hidden
  Scenario: Unmet and not-derivable are separate families
    Given the sidecar document of an entry with no sections
    Then the unmet family counts 1
    And the not-derivable family counts the NOT_DERIVABLE list

  @test:scripts/tests/library/ingest-and-l1.test.ts::the_verdict_as_a_committed_sidecar::total_counts_the_not-derivable_too,_so_it_is_zero_only_when_every_requirement_was_checked
  Scenario: The total counts not-derivable requirements
    Given the sidecar document of a full entry
    Then the unmet family counts 0
    And the total and the not-derivable family both equal the NOT_DERIVABLE count

  @test:scripts/tests/library/ingest-and-l1.test.ts::the_verdict_as_a_committed_sidecar::rerunning_produces_the_same_bytes,_and_carries_no_timestamp
  Scenario: The sidecar is byte-stable and has no timestamp
    Given a full entry
    Then two sidecar documents of it serialise identically
    And it has no updated_at

  @test:scripts/tests/library/ingest-and-l1.test.ts::the_verdict_as_a_committed_sidecar::a_missing_sidecar_is_stale,_not_absent-and-fine
  Scenario: A missing sidecar is stale
    Given a root with no sidecars and a checked full entry
    When the stale sidecars are listed
    Then there is one, saying "no sidecar"

  @test:scripts/tests/library/ingest-and-l1.test.ts::the_verdict_as_a_committed_sidecar::the_committed_verdicts_for_the_real_corpus_are_current_—_or,_when_not_committed,_ABSENT_and_never_current
  Scenario: The real corpus's verdicts are current, unknown or absent as stored
    Given the harness root declares a library with at least one entry
    When the qa results directory is declared as storage
    Then each entry whose results are stored reads unknown, and each with no library-qa directory reads absent
    And when no library-qa results are committed, every entry reads absent
    And otherwise no sidecar is stale

  @test:scripts/tests/library/ingest-and-l1.test.ts::the_third_state_has_to_EXPIRE_—_bean_`pn6j`::an_expired_claim_is_REPORTED:_the_probe_exists,_so_the_arm_runs
  Scenario: A not-derivable claim whose probe exists is reported expired
    Given the audio-transcripts claim with probe transcript and bean 1r0p
    And entry /y holds a transcript while /x does not
    When expired claims are listed
    Then audio-transcripts is reported, with bean 1r0p, found in /y

  @test:scripts/tests/library/ingest-and-l1.test.ts::the_third_state_has_to_EXPIRE_—_bean_`pn6j`::nothing_expires_when_no_probe_is_present
  Scenario: Nothing expires without a probe
    Given an entry where no probe exists
    When expired claims are listed against NOT_DERIVABLE
    Then there are none

  @test:scripts/tests/library/ingest-and-l1.test.ts::the_third_state_has_to_EXPIRE_—_bean_`pn6j`::the_real_corpus_has_no_expired_claim
  Scenario: The real corpus has no expired claim
    Given the declared library entries, at least one
    When expired claims are listed by probing each entry on disk
    Then there are none

  @test:scripts/tests/library/ingest-and-l1.test.ts::the_third_state_has_to_EXPIRE_—_bean_`pn6j`::the_probe_was_what_the_BEAN_said_its_arm_writes,_and_the_arm_writes_it
  Scenario: The audio-transcripts probe is an allowed entry directory and the claim is retired
    # Gap: the title says the arm writes the probe; the body checks only that transcript is an allowed entry directory, never that the recording arm writes it.
    Then the audio-transcripts probe is "transcript"
    And transcript is among the allowed entry directories
    And audio-transcripts is no longer in NOT_DERIVABLE

  @test:scripts/tests/library/ingest-and-l1.test.ts::the_third_state_has_to_EXPIRE_—_bean_`pn6j`::a_DIRECTORY_probe_fires_—_existsSync_is_not_file-only
  Scenario: A directory probe fires
    Given an entry holding a transcript directory
    When expired claims are listed by probing on disk
    Then audio-transcripts is reported

  @test:scripts/tests/library/ingest-and-l1.test.ts::the_third_state_has_to_EXPIRE_—_bean_`pn6j`::every_remaining_entry_carries_a_PROBE,_so_it_can_expire_at_all
  Scenario: Every not-derivable claim carries a probe and a bean
    Then every NOT_DERIVABLE entry has a non-blank probe and a non-blank bean

  @test:scripts/tests/library/ingest-and-l1.test.ts::the_third_state_has_to_EXPIRE_—_bean_`pn6j`::`image-descriptions`_is_CHECKED_now,_not_excused
  Scenario: image-descriptions is not excused
    Then image-descriptions is not in NOT_DERIVABLE

  @test:scripts/tests/library/ingest-and-l1.test.ts::the_bearing_list_is_SHARED_with_the_review_queue::this_gate_reads_`images.json`_because_the_queue_says_it_is_bearing
  Scenario: The shared narrative-bearing list holds images.json
    # Gap: the title says this gate reads images.json because of the shared list; the body checks only the list's contents, not that the gate uses it.
    Then the narrative-bearing list contains images.json

  @test:scripts/tests/library/ingest-and-l1.test.ts::the_bearing_list_is_SHARED_with_the_review_queue::the_corpus's_drafts_are_COUNTED,_not_reported_as_absent
  Scenario: The corpus's narrative drafts are counted
    Given the harness root's library check
    When the drafts named in each narrative-review detail are summed
    Then the sum is greater than 0

  @test:scripts/tests/library/ingest-and-l1.test.ts::image-descriptions_has_three_states,_and_the_third_is_not_a_pass::`images:_null`_is_NOT-DERIVABLE,_carrying_the_sidecar's_own_reason
  Scenario: images null is not-derivable with the sidecar's reason
    Given an images.json whose images is null with the reason "no backend available"
    Then image-descriptions is not-derivable and its detail carries that reason

  @test:scripts/tests/library/ingest-and-l1.test.ts::image-descriptions_has_three_states,_and_the_third_is_not_a_pass::an_image_with_an_UNDETERMINED_role_is_unmet_—_nobody_judged_it
  Scenario: An image with an undetermined role is unmet
    Given an images.json with one image of undetermined role
    Then image-descriptions is unmet, naming the "undetermined role"

  @test:scripts/tests/library/ingest-and-l1.test.ts::image-descriptions_has_three_states,_and_the_third_is_not_a_pass::a_DESCRIBABLE_image_with_no_narrative_is_unmet
  Scenario: A describable image with no narrative is unmet
    Given an images.json with a page scan and an inspected logo with no narrative
    Then image-descriptions is unmet

  @test:scripts/tests/library/ingest-and-l1.test.ts::image-descriptions_has_three_states,_and_the_third_is_not_a_pass::a_page_scan_needs_no_narrative_—_geometry_settles_it
  Scenario: A page scan needs no narrative
    Given an images.json with one geometry-judged page scan
    Then image-descriptions is met

  @test:scripts/tests/library/ingest-and-l1.test.ts::image-descriptions_has_three_states,_and_the_third_is_not_a_pass::a_description_per_configured_language_(bean_d5f1)::English_alone_is_unmet,_and_the_detail_names_each_missing_locale
  Scenario: A figure described only in English is unmet
    Given a page scan and a figure whose only narrative is English
    Then image-descriptions is unmet, saying "1 lack a narrative in a configured language"
    And the detail names ar, zh, fr, ru and es with 1 each, and not en

  @test:scripts/tests/library/ingest-and-l1.test.ts::image-descriptions_has_three_states,_and_the_third_is_not_a_pass::a_description_per_configured_language_(bean_d5f1)::all_six_UN_languages_is_met
  Scenario: A figure described in all six UN languages is met
    Given a figure with a narrative in each of ar, zh, en, fr, ru and es
    Then image-descriptions is met

  @test:scripts/tests/library/ingest-and-l1.test.ts::image-descriptions_has_three_states,_and_the_third_is_not_a_pass::a_description_per_configured_language_(bean_d5f1)::a_single-form_narrative_with_no_lang_counts_as_English
  Scenario: A narrative with no lang counts as English
    Given an image with a single narrative that names no language
    When its locale gaps are counted for en
    Then no image has a gap

  @test:scripts/tests/library/ingest-and-l1.test.ts::image-descriptions_has_three_states,_and_the_third_is_not_a_pass::a_description_per_configured_language_(bean_d5f1)::a_not-authored_entry_covers_nothing
  Scenario: A not-authored narrative covers no locale
    Given an image with an English draft and a French not-authored narrative
    When its locale gaps are counted for en and fr
    Then one image has a gap, and it is fr

  @test:scripts/tests/library/ingest-and-l1.test.ts::image-descriptions_has_three_states,_and_the_third_is_not_a_pass::a_description_per_configured_language_(bean_d5f1)::an_entry_with_no_instance_config_is_owed_the_six_UN_languages
  Scenario: An entry with no instance config is owed the six UN languages
    Given a full entry outside any instance
    Then its locales are ar, zh, en, fr, ru and es

  @test:scripts/tests/library/ingest-and-l1.test.ts::image-descriptions_has_three_states,_and_the_third_is_not_a_pass::a_missing_images.json_is_UNMET,_not_not-derivable
  Scenario: A missing images.json is unmet
    Given a full entry whose images.json is removed
    Then image-descriptions is unmet, naming pdf-images.py

  @test:scripts/tests/library/ingest-and-l1.test.ts::refuse_to_promote_—_the_gate_between_the_arms_and_the_library::promotion_is_a_SEPARATE_step_—_one_rung_is_not_a_whole_pipeline
  Scenario: Promotion is a separate mode
    Then the ingest mode is stage with no arguments or a file
    And promote whenever --promote is given
    And the ingest source runs no plan steps in promote mode

  @test:scripts/tests/library/ingest-and-l1.test.ts::refuse_to_promote_—_the_gate_between_the_arms_and_the_library::the_derived_arms_run_for_a_PDF_rung_and_NOT_for_archive_or_tabular
  Scenario: The derived arms follow a PDF rung only
    Given a pdf-pages plan of one step
    When the derived arms are added
    Then there are 10 steps: the rung, latex-math-overlay, pdf-images, pdf-vector-labels, pdf-vector-figures, l1-blocks, pdf-footnotes, extract-candidates, apply-image-verdicts and pdf-cover
    And each arm is given its stated source, staging root, entry, library or cover path
    And an archive, tabular or undetermined plan keeps its one step

  @test:scripts/tests/library/ingest-and-l1.test.ts::refuse_to_promote_—_the_gate_between_the_arms_and_the_library::the_PDF_is_passed_in,_never_read_back_off_the_rung's_argv
  Scenario: The PDF is passed to the arms, not read from the rung's argv
    Given a pdf-structure rung whose argv ends with a trailing --ocr flag
    When the derived arms are added for /real.pdf
    Then the pdf-images step ends with /real.pdf

  @test:scripts/tests/library/ingest-and-l1.test.ts::refuse_to_promote_—_the_gate_between_the_arms_and_the_library::the_arms_are_pointed_at_STAGING,_never_at_the_library
  Scenario: The ingest source points the arms at staging
    Given the ingest-document.ts source
    Then it plans against the staging root and never plans with the default library
    And it no longer prints "run the remaining arms"
    And it gives pdf-images the staging root and l1-blocks the staging entry directory

  @test:scripts/tests/library/ingest-and-l1.test.ts::refuse_to_promote_—_the_gate_between_the_arms_and_the_library::the_verdict_arm_runs_AFTER_pdf-images.py,_which_is_the_whole_mechanism
  Scenario: The verdict arm runs after pdf-images
    Given a pdf-structure plan with the derived arms added
    Then the pdf-images step exists and the apply-image-verdicts step comes after it

  @test:scripts/tests/library/ingest-and-l1.test.ts::refuse_to_promote_—_the_gate_between_the_arms_and_the_library::the_verdict_arm_is_given_the_DESTINATION_library,_not_the_staging_root
  Scenario: The verdict arm is given the destination library
    Given a pdf-pages plan with the derived arms added for library /some/library
    Then the apply-image-verdicts step's --library is /some/library
    And it is not given the staging root

  @test:scripts/tests/library/ingest-and-l1.test.ts::refuse_to_promote_—_the_gate_between_the_arms_and_the_library::staging_is_NOT_dot-prefixed
  Scenario: The staging directory is not dot-prefixed
    Given the ingest-document.ts source
    Then it names "ingest-staging" and never ".ingest-staging"

  @test:scripts/tests/library/ingest-and-l1.test.ts::refuse_to_promote_—_the_gate_between_the_arms_and_the_library::the_printed_next_step_is_the_caller's_own_command,_plus_--promote_—_bean_`apui`
  Scenario: The printed promote command is the caller's command plus --promote
    Then the promote command for a file and --library keeps both and adds --promote
    And a file name with a space is quoted
    And --dry-run is dropped and --promote is not doubled

  @test:scripts/tests/library/ingest-and-l1.test.ts::refuse_to_promote_—_the_gate_between_the_arms_and_the_library::promotion_mints_the_entry's_JSON-LD_for_its_DESTINATION,_before_anything_is_copied
  Scenario: Promotion builds the entry's nodes before copying
    Given the ingest-document.ts source
    Then it calls buildEntryNodes(slug, staging, out)
    And that call comes before cpSync(staging, out

  @test:scripts/tests/library/ingest-and-l1.test.ts::refuse_to_promote_—_the_gate_between_the_arms_and_the_library::ONE_unmet_requirement_refuses_the_whole_entry
  Scenario: One unmet requirement refuses promotion
    Then a single met requirement may promote
    And a single unmet requirement may not
    And a met and an unmet requirement together may not

  @test:scripts/tests/library/ingest-and-l1.test.ts::refuse_to_promote_—_the_gate_between_the_arms_and_the_library::`not-derivable`_does_NOT_refuse_—_that_is_the_third_state's_whole_job
  Scenario: Not-derivable does not refuse promotion
    Then a lone not-derivable requirement may promote
    And a not-derivable with a met requirement may promote

  @test:scripts/tests/library/ingest-and-l1.test.ts::refuse_to_promote_—_the_gate_between_the_arms_and_the_library::a_text_layer_of_mojibake_or_reversed_Arabic_ligatures_is_not_text
  Scenario: A text layer that is mojibake, or that reverses Arabic ligatures, sends the document to OCR
    Given a probe whose text layer is mostly letters
    Then it is readable
    And a probe whose non-space characters are under 55% letters is mojibake
    And a probe where 967 of 12798 Arabic words carry a reversed lam-alef or lam-yeh ligature scrambles right-to-left ligatures
    And 10 of 12798 is readable
    And 20 Arabic words are too few to judge, and a probe with no counts decides nothing

  @test:scripts/tests/library/ingest-and-l1.test.ts::refuse_to_promote_—_the_gate_between_the_arms_and_the_library::--qa-later_lets_ONLY_the_QA-only_requirements_stay_unmet
  Scenario: --qa-later promotes past unmet image descriptions and nothing else
    Given an entry whose only unmet requirement is image-descriptions
    Then it does not promote by default
    And it promotes with --qa-later
    And an entry with image-descriptions and structure unmet does not promote even with --qa-later
    And --qa-later is read from the arguments only when given

  @test:scripts/tests/library/ingest-and-l1.test.ts::refuse_to_promote_—_the_gate_between_the_arms_and_the_library::an_EMPTY_requirement_list_does_not_promote_by_vacuous_truth
  Scenario: An empty requirement list never promotes, with or without --qa-later
    Then an empty requirement list may not promote
    And it may not promote with --qa-later either
    And the L1 check of an empty directory yields at least one requirement

  @test:scripts/tests/library/ingest-and-l1.test.ts::refuse_to_promote_—_the_gate_between_the_arms_and_the_library::an_unmet_entry_has_unmet_requirements_to_refuse_ON
  Scenario: An empty staging entry has unmet requirements
    Given an empty directory
    When it is L1-checked
    Then at least one requirement is unmet, structure among them

  @test:scripts/tests/library/ingest-and-l1.test.ts::refuse_to_promote_—_the_gate_between_the_arms_and_the_library::a_COMPLETE_entry_has_none,_so_it_can_promote
  Scenario: A complete entry has no unmet requirement
    Given a full entry
    Then no requirement is unmet

  @test:scripts/tests/library/ingest-and-l1.test.ts::the_L1_gate_stopped_assuming_every_document_is_a_PDF::a_sidecar_names_the_shape_—_and_absence_is_UNDETERMINED,_not_paged
  Scenario: The sidecar an entry holds names its kind
    Then an entry with structure.json is paged
    And one with tabular.jsonld is tabular
    And one with contents.jsonld is archive
    And one with none is undetermined

  @test:scripts/tests/library/ingest-and-l1.test.ts::the_L1_gate_stopped_assuming_every_document_is_a_PDF::a_tabular_entry_is_not_asked_for_a_chapter_tree
  Scenario: A tabular entry faces no paged-only requirement
    Then no paged-only requirement applies to tabular
    And manifest, technical-metadata and tabular-records do

  @test:scripts/tests/library/ingest-and-l1.test.ts::the_L1_gate_stopped_assuming_every_document_is_a_PDF::a_paged_entry_still_faces_every_requirement
  Scenario: A paged entry faces every paged-only requirement
    Then every paged-only requirement applies to paged

  @test:scripts/tests/library/ingest-and-l1.test.ts::the_L1_gate_stopped_assuming_every_document_is_a_PDF::UNDETERMINED_keeps_every_requirement_—_the_vacuity_this_guards
  Scenario: An undetermined entry faces every paged-only requirement
    Then every paged-only requirement applies to undetermined

  @test:scripts/tests/library/ingest-and-l1.test.ts::the_L1_gate_stopped_assuming_every_document_is_a_PDF::`image-descriptions`_is_not_demanded_of_a_spreadsheet
  Scenario: image-descriptions applies to paged entries only
    Then image-descriptions does not apply to tabular or archive
    And it applies to paged

  @test:scripts/tests/library/ingest-and-l1.test.ts::the_L1_gate_stopped_assuming_every_document_is_a_PDF::the_source_block_is_read_from_whichever_sidecar_the_entry_HAS
  Scenario: The source block is read from tabular.jsonld
    Given an empty entry
    Then it has no source block
    And once it holds a tabular.jsonld with a source, its source file is x.csv

  @test:scripts/tests/library/ingest-and-l1.test.ts::the_L1_gate_stopped_assuming_every_document_is_a_PDF::checkEntry_on_a_REAL_tabular_entry_emits_no_paged_requirement
  Scenario: A real-shaped tabular entry is checked without paged requirements
    Given an entry holding only a tabular.jsonld as tabular-records.py writes it
    When it is L1-checked
    Then no paged-only requirement is reported
    And at least one requirement is, manifest among them

  @test:scripts/tests/library/ingest-and-l1.test.ts::the_L1_gate_stopped_assuming_every_document_is_a_PDF::every_sidecar_in_KIND_SIDECAR_names_a_kind_that_is_not_`undetermined`
  Scenario: No sidecar maps to undetermined
    Then no KIND_SIDECAR row names the kind undetermined
    And the table has more than one row

  @test:scripts/tests/library/ingest-and-l1.test.ts::a_document's_figures_can_be_VECTOR,_and_the_gate_no_longer_passes_over_them_—_bean_`m4xy`::a_caption_is_counted_at_the_start_of_a_line;_a_cross-reference_is_not
  Scenario: Captions count at line start, cross-references do not
    Given sections holding "Fig. 1." and "Figure 2.3." captions at line start, inline mentions of Fig. 1 and Fig. 9, and a repeated Fig. 1 caption
    When the declared figure labels are read
    Then they are 1 and 2.3

  @test:scripts/tests/library/ingest-and-l1.test.ts::a_document's_figures_can_be_VECTOR,_and_the_gate_no_longer_passes_over_them_—_bean_`m4xy`::ZERO_images_placed,_but_every_declared_figure_is_CAPTIONED_—_the_caption_is_the_handle
  Scenario: Captioned figures with no images placed are met on the caption
    Given an entry with no images whose section captions Fig. 3
    Then image-descriptions is met
    And its detail quotes the caption and names m4xy

  @test:scripts/tests/library/ingest-and-l1.test.ts::a_document's_figures_can_be_VECTOR,_and_the_gate_no_longer_passes_over_them_—_bean_`m4xy`::a_figure_with_NO_caption_text_is_still_not-derivable,_and_is_NAMED
  Scenario: A figure with no caption text is not-derivable and named
    Given an entry with no images whose section only mentions "Fig. 7"
    Then image-descriptions is not-derivable
    And its detail names Fig. 7 and m4xy

  @test:scripts/tests/library/ingest-and-l1.test.ts::a_document's_figures_can_be_VECTOR,_and_the_gate_no_longer_passes_over_them_—_bean_`m4xy`::a_caption_beats_a_bare_mention_of_the_SAME_figure,_in_either_order
  Scenario: A caption beats an earlier bare mention of the same figure
    # Gap: the title says "in either order"; only the mention-before-caption order is checked.
    Given an entry with no images whose section mentions Fig. 5 and then captions it
    Then image-descriptions is met and its detail quotes the caption

  @test:scripts/tests/library/ingest-and-l1.test.ts::a_document's_figures_can_be_VECTOR,_and_the_gate_no_longer_passes_over_them_—_bean_`m4xy`::...and_NOT_`unmet`,_because_that_would_be_a_permanent_blocker
  Scenario: A captioned vector figure is never unmet
    Given an entry with no images whose section captions Fig. 3
    Then image-descriptions is not unmet

  @test:scripts/tests/library/ingest-and-l1.test.ts::a_document's_figures_can_be_VECTOR,_and_the_gate_no_longer_passes_over_them_—_bean_`m4xy`::zero_images_and_NO_declared_figures_stays_`met`_—_a_determined_empty
  Scenario: No images and no declared figures is met
    Given an entry with no images whose section declares no figure
    Then image-descriptions is met

  @test:scripts/tests/library/ingest-and-l1.test.ts::a_document's_figures_can_be_VECTOR,_and_the_gate_no_longer_passes_over_them_—_bean_`m4xy`::described_images_still_pass,_but_the_detail_refuses_to_claim_coverage
  Scenario: Described images pass without claiming figure coverage
    Given an entry whose section captions a figure and whose one image is described in all six UN languages
    Then image-descriptions is met
    And its detail says it "declares at least 1 captioned figure" and coverage is "NOT established"

  @test:scripts/tests/library/ingest-and-l1.test.ts::an_entry's_contents_are_a_CLOSED_set_—_`3psh`::a_clean_entry_is_MET,_and_says_how_many_children_it_accounted_for
  Scenario: A clean entry's contents are met with a child count
    Given an entry holding structure.json, manifest.jsonld, images.json, sections and blocks
    Then contents is met, saying "5 child(ren)"

  @test:scripts/tests/library/ingest-and-l1.test.ts::an_entry's_contents_are_a_CLOSED_set_—_`3psh`::`images/`_and_`ocr/`_are_allowed_—_they_are_arms'_output,_not_strays
  Scenario: images and ocr directories are allowed
    Given a clean entry with images and ocr directories added
    Then contents is met

  @test:scripts/tests/library/ingest-and-l1.test.ts::an_entry's_contents_are_a_CLOSED_set_—_`3psh`::a_NESTED_ORPHAN_is_unmet_and_is_NAMED
  Scenario: A nested orphan directory is unmet and named
    Given a clean entry with a directory 260725032v1 added
    Then contents is unmet, naming it and saying "Reported, not removed"

  @test:scripts/tests/library/ingest-and-l1.test.ts::an_entry's_contents_are_a_CLOSED_set_—_`3psh`::an_unexpected_loose_FILE_is_unmet_too_—_not_only_directories
  Scenario: An unexpected loose file is unmet and named
    Given a clean entry with notes.txt added
    Then contents is unmet, naming notes.txt

  @test:scripts/tests/library/ingest-and-l1.test.ts::an_entry's_contents_are_a_CLOSED_set_—_`3psh`::a_dotfile_is_NOT_a_stray
  Scenario: A dotfile is not a stray
    Given a clean entry with .DS_Store added
    Then contents is met

  @test:scripts/tests/library/ingest-and-l1.test.ts::an_entry's_contents_are_a_CLOSED_set_—_`3psh`::the_allowed_set_is_the_DECLARED_one,_not_a_literal_repeated_here
  Scenario: Every declared entry directory and sidecar is allowed
    Then a clean entry with any one declared entry directory added has contents met
    And a clean entry with any one declared sidecar added has contents met

  @test:scripts/tests/library/ingest-and-l1.test.ts::an_entry's_declared_library_sub-graph_is_not_a_stray_—_`8pzh`::a_directory_declared_with_a_within-library_kind_is_MET
  Scenario: A directory declared with a within-library kind is not a stray
    Given entry e1's out/ directory declared with a within-library kind
    Then contents is met

  @test:scripts/tests/library/ingest-and-l1.test.ts::an_entry's_declared_library_sub-graph_is_not_a_stray_—_`8pzh`::the_same_directory_UNDECLARED_is_still_a_stray
  Scenario: The same directory undeclared is a stray
    Given entry e1's out/ directory not declared
    Then contents is unmet, naming out

  @test:scripts/tests/library/ingest-and-l1.test.ts::an_entry's_declared_library_sub-graph_is_not_a_stray_—_`8pzh`::declared_with_a_kind_that_is_NOT_within_library_is_still_a_stray
  Scenario: A directory declared with a kind not within library is a stray
    Given entry e1's out/ directory declared with a kind that is not within library
    Then contents is unmet

  @test:scripts/tests/library/ingest-and-l1.test.ts::libraryRootFor_(bean_12ws)::returns_cwd_when_it_declares_a_library_graph
  Scenario: A directory declaring a library is its own library root
    Given a directory that declares a library
    Then its library root is itself

  @test:scripts/tests/library/ingest-and-l1.test.ts::libraryRootFor_(bean_12ws)::falls_back_to_own_instance_when_cwd_does_not_declare_a_library
  Scenario: A directory declaring no library falls back to the harness
    Given an empty directory that declares nothing
    Then its library root is the harness root

  @test:scripts/tests/library/ingest-and-l1.test.ts::--text:_a_text_source_through_cat_ingest::is_routed_to_text-structure_only_when_the_caller_says_so,_never_by_extension
  Scenario: --text routes a source to text-structure
    When a Markdown file is planned with the text flag
    Then the rung is text, with one text-structure.ts step carrying --doc-id and ending with the file
    And planned without the flag, the same file's rung is not text

  @test:scripts/tests/library/ingest-and-l1.test.ts::--text:_a_text_source_through_cat_ingest::a_binary_file_is_refused_as_text,_not_read
  Scenario: A binary file is refused as text
    Then a file sniffed as application/pdf, planned as text, is undetermined
    And a file sniffed as application/xml, planned as text, is text

  @test:scripts/tests/library/ingest-and-l1.test.ts::--text:_a_text_source_through_cat_ingest::it_takes_the_l1-blocks_arm,_and_a_known_title_reaches_the_rung
  Scenario: A text rung takes the l1-blocks and aspects arms and a known title
    Given a text plan with the derived arms added
    Then there are 3 steps, the second running l1-blocks.ts on the staging entry and the third extract-candidates.py --aspects-only on it
    And a known title adds --title to the text step

  @test:scripts/tests/library/ingest-and-l1.test.ts::refuse_to_promote_—_the_gate_between_the_arms_and_the_library::a_text_layer_in_the_wrong_script_for_the_document's_language_is_not_text
  Scenario: A text layer in the wrong script for the document's language is not text
    Given a probe whose letters are 5900 Latin and 12 Arabic
    When it is judged for a document in "ar"
    Then it is unreadable, with a reason naming "wrong script"
    And with no language, with "fr", or with the mixed "ar" and "en", nothing is decided
    And an "ar" probe that is mostly Arabic letters, and a "ru-RU" probe with 2000 Cyrillic letters, decide nothing
    And a "zh" probe of 5900 Latin and 100 Han letters is unreadable, with a reason naming "han"
