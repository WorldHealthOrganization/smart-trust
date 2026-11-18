# pipeline/gen-library-jsonld.ts turns a library entry's ingest artefacts (Stage A structure, candidates,
# tabular records, figures, licence and title sidecars) into its graph nodes: a manifest, section manifests and blocks.
# Each Scenario names the test that executes it.
Feature: Library entries become graph nodes

  @test:scripts/tests/gen-library-jsonld.test.ts::id_derivation::section_key_is_the_stable_prefix,_not_the_slugged_title
  Scenario: A section key is the stable prefix of its id
    Given the section ids "sec-000-1-introduction" and "sec-012-appendix-b"
    When their section keys are derived
    Then they are "sec-000" and "sec-012"

  @test:scripts/tests/gen-library-jsonld.test.ts::id_derivation::block_ids_are_per-section_ordinals,_so_one_section_cannot_renumber_another
  Scenario: Block ids are ordinals within their section
    Given the section key "sec-001"
    When a block id is derived for the third theorem
    Then it is "thm-sec-001-03"
    And the prose block id is "prose-sec-001"

  @test:scripts/tests/gen-library-jsonld.test.ts::id_derivation::uses_the_same_prefixes_an_author_would
  Scenario: Block ids use the prefixes an author would
    Given the section key "sec-000"
    When block ids are derived for the first remark and the first lemma
    Then they are "rem-sec-000-01" and "lem-sec-000-01"

  @test:scripts/tests/gen-library-jsonld.test.ts::a_section_is_a_manifest::it_carries_no_text_of_its_own
  Scenario: A section node carries no text of its own
    Given the nodes built for the document "0110001v3" with two sections and three candidates
    When the section node "sections/sec-000.jsonld" is read
    Then it has no text

  @test:scripts/tests/gen-library-jsonld.test.ts::a_section_is_a_manifest::contains_is_ordered:_prose_first,_then_candidates_in_extraction_order
  Scenario: A section lists its prose block first, then its candidates in extraction order
    Given the nodes built for the document "0110001v3"
    When the section node "sections/sec-001.jsonld" is read
    Then it contains "prose-sec-001", "thm-sec-001-01" and "lem-sec-001-02", in that order, under "library/0110001v3/blocks/"

  @test:scripts/tests/gen-library-jsonld.test.ts::a_section_is_a_manifest::the_prose_block_points_at_Stage_A's_file_rather_than_copying_it
  Scenario: The prose block points at Stage A's section file instead of copying it
    Given the nodes built for the document "0110001v3"
    When the prose block "blocks/prose-sec-000.jsonld" is read
    Then its text is "../sections/sec-000-1-introduction.md"
    And no "blocks/prose-sec-000.md" is emitted

  @test:scripts/tests/gen-library-jsonld.test.ts::a_section_is_a_manifest::a_section_with_no_.md_yields_no_prose_block
  Scenario: A section with no Stage A file has no prose block
    Given a document whose sections have no .md files
    When its nodes are built
    Then no prose block is emitted

  @test:scripts/tests/gen-library-jsonld.test.ts::extracted_claims_become_typed_blocks::kind_and_type_survive
  Scenario: An extracted theorem keeps its kind and type
    Given the nodes built for the document "0110001v3"
    When the block "blocks/thm-sec-001-01.jsonld" is read
    Then its kind is "theorem"
    And its @type is "folio-assistant-sci:Theorem" and "doco:Section"

  @test:scripts/tests/gen-library-jsonld.test.ts::extracted_claims_become_typed_blocks::a_claim's_statement_is_written_as_its_own_text_file
  Scenario: A claim's statement is written to its own text file
    Given the nodes built for the document "0110001v3"
    Then "blocks/thm-sec-001-01.md" contains "triple linking number"
    And the theorem block's text is "thm-sec-001-01.md"

  @test:scripts/tests/gen-library-jsonld.test.ts::extracted_claims_become_typed_blocks::an_empty_statement_yields_no_text_file_and_no_dangling_link
  Scenario: An empty statement yields no text file and no link to one
    Given the nodes built for a document with a lemma whose statement is empty
    Then no "blocks/lem-sec-001-02.md" is emitted
    And the lemma block has no text

  @test:scripts/tests/gen-library-jsonld.test.ts::nothing_here_is_folio_content::every_node_is_marked_ingested
  Scenario: Every node is marked ingested
    Given the nodes built for the document "0110001v3"
    Then every .jsonld node has the provenance "ingested"

  @test:scripts/tests/gen-library-jsonld.test.ts::nothing_here_is_folio_content::every_node_is_attributed_to_its_source_document
  Scenario: Every node is attributed to its source document
    Given the nodes built for the document "0110001v3"
    Then every .jsonld node but the manifest has the source document "library/0110001v3/manifest"

  @test:scripts/tests/gen-library-jsonld.test.ts::nothing_here_is_folio_content::the_extractor's_own_disposition_is_carried_verbatim,_not_paraphrased
  Scenario: The extractor's disposition is carried verbatim
    Given candidates whose disposition is "proposals only — promote via document-intake Stage 4"
    When the manifest is built
    Then its meta disposition is exactly that text

  @test:scripts/tests/gen-library-jsonld.test.ts::nothing_here_is_folio_content::a_document_with_no_candidates.json_still_says_it_is_not_folio_content
  Scenario: A document with no candidates still says it is not folio content
    Given a document with no candidates
    When its manifest is built
    Then its meta disposition says "not folio content"

  @test:scripts/tests/gen-library-jsonld.test.ts::the_manifest::carries_source_identity_for_the_PROV_join
  Scenario: The manifest carries the source's identity
    Given a structure whose source has the sha256 "f30f603ac1c5" and 12 pages
    When the manifest is built
    Then its meta has the source_sha256 "f30f603ac1c5" and 12 pages

  @test:scripts/tests/gen-library-jsonld.test.ts::the_manifest::contains_the_sections_in_document_order
  Scenario: The manifest lists the sections in document order
    Given the nodes built for the document "0110001v3"
    When the manifest is read
    Then it contains "library/0110001v3/sections/sec-000" then "library/0110001v3/sections/sec-001"

  @test:scripts/tests/gen-library-jsonld.test.ts::determinism::two_builds_are_byte-identical_—_the_--check_gate_depends_on_it
  Scenario: Two builds of the same input are byte-identical
    Given the same structure and candidates
    When the nodes are built twice
    Then both builds have the same paths and contents

  @test:scripts/tests/gen-library-jsonld.test.ts::determinism::no_key_is_emitted_with_an_undefined_or_empty_value
  Scenario: No node key is undefined or an empty list
    # Gap: empty strings and empty objects are not checked; only undefined values and empty arrays
    Given the nodes built for the document "0110001v3"
    Then no key of any .jsonld node is undefined
    And no list value is empty

  @test:scripts/tests/gen-library-jsonld.test.ts::which_ingest_rung_an_entry_is_on_—_bean_`p67i`::Stage_A_output_puts_it_on_the_paged_rung
  Scenario: Stage A output puts an entry on the paged rung
    Given an entry holding "structure.json"
    When its ingest rung is read
    Then it is "paged"

  @test:scripts/tests/gen-library-jsonld.test.ts::which_ingest_rung_an_entry_is_on_—_bean_`p67i`::a_tabular_record_puts_it_on_the_tabular_rung
  Scenario: A tabular record puts an entry on the tabular rung
    Given an entry holding "tabular.jsonld"
    When its ingest rung is read
    Then it is "tabular"

  @test:scripts/tests/gen-library-jsonld.test.ts::which_ingest_rung_an_entry_is_on_—_bean_`p67i`::the_CSVW_record_puts_it_there_too,_for_when_eief's_extractors_land
  Scenario: A CSVW record also puts an entry on the tabular rung
    Given an entry holding "tabular.csvw.json"
    When its ingest rung is read
    Then it is "tabular"

  @test:scripts/tests/gen-library-jsonld.test.ts::which_ingest_rung_an_entry_is_on_—_bean_`p67i`::neither_input_is_a_DETERMINED_`none`,_not_an_unreadable_one
  Scenario: An entry with neither input is on no rung
    Given an entry holding only "manifest.jsonld", and an entry holding nothing
    When their ingest rungs are read
    Then each is "none"

  @test:scripts/tests/gen-library-jsonld.test.ts::which_ingest_rung_an_entry_is_on_—_bean_`p67i`::paged_wins_when_both_are_present_—_the_table_is_ordered,_not_a_set
  Scenario: The paged rung wins when both inputs are present
    Given an entry holding "structure.json" and "tabular.jsonld"
    When its ingest rung is read
    Then it is "paged"
    And "paged" is the first rung in the rung table

  @test:scripts/tests/gen-library-jsonld.test.ts::which_ingest_rung_an_entry_is_on_—_bean_`p67i`::every_rung_in_the_table_is_reachable_from_its_own_input
  Scenario: Every rung is reached from each of its own inputs
    Given the rung table
    When the rung is read for an entry holding only one of a rung's inputs
    Then it is that rung, for every input of every rung

  @test:scripts/tests/gen-library-jsonld.test.ts::a_whole_library_entry,_through_the_real_branch_—_bean_`p67i`::a_CSV_entry_yields_manifest_+_ONE_table,_and_no_sheet
  Scenario: A CSV entry yields a manifest and one table, with no sheet
    Given an entry "d" whose tabular record is a one-sheet CSV
    When its nodes are built
    Then the state is "built" on the "tabular" rung
    And the files are "blocks/table-001.jsonld" and "manifest.jsonld"
    And the manifest contains "library/d/blocks/table-001" with the tabular depth "table" and the record "folio-tabular-records/v1"
    And the manifest's title is the slug "d", with the title source "slug"

  @test:scripts/tests/gen-library-jsonld.test.ts::a_whole_library_entry,_through_the_real_branch_—_bean_`p67i`::a_two-sheet_workbook_yields_a_sheet_node_per_sheet
  Scenario: A two-sheet workbook yields a sheet node per sheet
    Given an entry "d" whose tabular record is an xlsx with the sheets "Coverage" and "Notes"
    When its nodes are built
    Then the files are two tables, two sheets and the manifest
    And the manifest contains "library/d/sheets/sheet-001" and "library/d/sheets/sheet-002"
    And its tabular depth is "sheet"

  @test:scripts/tests/gen-library-jsonld.test.ts::a_whole_library_entry,_through_the_real_branch_—_bean_`p67i`::a_STAGED_entry_is_minted_for_the_library_it_is_promoted_INTO_—_bean_`apui`
  Scenario: A staged entry is minted for the library it is promoted into
    Given the layers "stager" and "sib", each declaring a library
    And an entry "d" staged under "stager/ingest-staging/d"
    When its nodes are built with no destination
    Then the manifest @id names "/stager/source/d"
    When its nodes are built with the destination "sib/library/d"
    Then the manifest @id names "/sib/source/d"
    And building the entry once it sits at the destination gives the same @id

  @test:scripts/tests/gen-library-jsonld.test.ts::a_whole_library_entry,_through_the_real_branch_—_bean_`p67i`::an_editorial_title-correction.json_titles_a_tabular_entry,_with_its_basis_in_the_manifest
  Scenario: An editorial title correction titles a tabular entry and records its basis
    Given a tabular entry with a "title-correction.json" giving the CODATA 2022 title, its basis, date and bean
    When its nodes are built
    Then the manifest's title is the corrected title
    And its meta has the title source "editorial", from "title-correction.json title", verified
    And its meta title correction carries the basis, "2026-10-12" and "cat-tools-v8wg"

  @test:scripts/tests/gen-library-jsonld.test.ts::a_whole_library_entry,_through_the_real_branch_—_bean_`p67i`::FALSIFICATION:_regenerating_does_not_erase_it_—_the_defect_the_bean_measured
  Scenario: Regenerating keeps the corrected title
    Given a tabular entry with a title correction
    And the manifest from a first build written back into the entry
    When its nodes are built again
    Then the manifest's title is still the corrected title

  @test:scripts/tests/gen-library-jsonld.test.ts::a_whole_library_entry,_through_the_real_branch_—_bean_`p67i`::a_correction_without_its_basis_is_unreadable_—_an_editorial_title_with_no_basis_is_a_guess
  Scenario: A title correction with no basis is unreadable
    Given a tabular entry whose "title-correction.json" has a title and no basis
    When its nodes are built
    Then the state is "unreadable"

  @test:scripts/tests/gen-library-jsonld.test.ts::a_whole_library_entry,_through_the_real_branch_—_bean_`p67i`::a_record_that_is_THERE_and_unreadable_is_`unreadable`,_never_`no-input`
  Scenario: A tabular record that does not parse is unreadable
    Given an entry whose "tabular.jsonld" is not JSON
    When its nodes are built
    Then the state is "unreadable"

  @test:scripts/tests/gen-library-jsonld.test.ts::a_whole_library_entry,_through_the_real_branch_—_bean_`p67i`::a_record_of_an_unrecognised_schema_is_unreadable_too,_not_an_empty_document
  Scenario: A tabular record of an unrecognised schema is unreadable
    Given an entry whose "tabular.jsonld" declares the schema "something-else/v9"
    When its nodes are built
    Then the state is "unreadable"

  @test:scripts/tests/gen-library-jsonld.test.ts::a_whole_library_entry,_through_the_real_branch_—_bean_`p67i`::an_entry_with_no_ingest_input_at_all_is_`no-input`,_which_PASSES
  Scenario: An entry with no ingest input is no-input
    Given an entry holding only a "README.md"
    When its nodes are built
    Then the state is "no-input"

  @test:scripts/tests/gen-library-jsonld.test.ts::a_whole_library_entry,_through_the_real_branch_—_bean_`p67i`::an_unreadable_structure.json_is_`unreadable`_on_the_PAGED_rung_too
  Scenario: A Stage A structure that does not parse is unreadable
    Given an entry whose "structure.json" is not JSON
    When its nodes are built
    Then the state is "unreadable"

  @test:scripts/tests/gen-library-jsonld.test.ts::a_whole_library_entry,_through_the_real_branch_—_bean_`p67i`::a_record_naming_no_file_falls_back_to_the_ENTRY_ID,_not_to_nothing
  Scenario: A tabular record that names no file is titled by the entry id
    Given an entry "an-entry-id" whose tabular record has no source
    When its nodes are built
    Then the state is "built"
    And the manifest's title is "an-entry-id"

  @test:scripts/tests/gen-library-jsonld.test.ts::a_whole_library_entry,_through_the_real_branch_—_bean_`p67i`::a_paged_entry's_title_is_its_PDF_/Title,_never_the_page-1_parse_(#1794)
  Scenario: A paged entry is titled by its PDF Title, not the page-1 parse
    Given a paged entry "d" whose parsed title is "Abies" and whose PDF has no Title
    When its manifest is built
    Then its title is the slug "d", with the title source "slug"
    Given a paged entry whose PDF Title is "JSON-LD 1.1" and whose parsed title runs on
    When its manifest is built
    Then its title is "JSON-LD 1.1", with the title source "pdf-info" from "structure.json metadata.docinfo.Title"

  @test:scripts/tests/gen-library-jsonld.test.ts::a_whole_library_entry,_through_the_real_branch_—_bean_`p67i`::a_paged_entry_still_goes_down_the_paged_rung,_untouched
  Scenario: A paged entry is built on the paged rung with no sheets
    Given an entry with a valid "structure.json"
    When its nodes are built
    Then the state is "built" on the "paged" rung
    And no file is under "sheets/"

  @test:scripts/tests/gen-library-jsonld.test.ts::a_figure_on_a_section_boundary_—_bean_`imen`::is_written_ONCE,_not_once_per_containing_section
  Scenario: A figure on a page two sections share is written once
    Given sections on pages 1 to 3 and 3 to 8, and a figure on page 3
    When the document's nodes are built
    Then "blocks/figure-img-p003-1.jsonld" is emitted exactly once

  @test:scripts/tests/gen-library-jsonld.test.ts::a_figure_on_a_section_boundary_—_bean_`imen`::belongs_to_the_FIRST_containing_section,_which_is_reading_order
  Scenario: A boundary figure is derived from the first section containing it
    Given a figure on page 3, which both sections contain
    When the document's nodes are built
    Then the figure is derived from "library/0110001v3/sections/sec-000"

  @test:scripts/tests/gen-library-jsonld.test.ts::a_figure_on_a_section_boundary_—_bean_`imen`::an_uncontested_figure_is_unaffected
  Scenario: A figure inside one section is derived from that section
    Given a figure on page 5, which only the second section contains
    When the document's nodes are built
    Then the figure is derived from "library/0110001v3/sections/sec-001"

  @test:scripts/tests/gen-library-jsonld.test.ts::a_figure_on_a_section_boundary_—_bean_`imen`::ONE_section_lists_it_—_ownership_is_single,_not_split
  Scenario: Only the owning section lists a boundary figure
    Given a figure on page 3 and a figure on page 5
    When the document's nodes are built
    Then the first section contains the page-3 figure
    And the second section does not contain the page-3 figure
    And the second section contains the page-5 figure

  @test:scripts/tests/gen-library-jsonld.test.ts::the_licence_record_survives_regeneration_(folio-assistant#1492)::an_authored_licence_is_carried_verbatim_as_licenceRecord,_and_read_back_by_the_checker's_accessor
  Scenario: An authored licence record is carried verbatim and read back by the checker
    Given a licence record of status "unknown" with what was searched
    When the document's manifest is built with it
    Then the manifest's licenceRecord equals the record
    And the checker's accessor reads the same record back

  @test:scripts/tests/gen-library-jsonld.test.ts::the_licence_record_survives_regeneration_(folio-assistant#1492)::no_sidecar:_no_licence_anywhere,_so_the_checker_reports_'not_recorded'
  Scenario: With no licence sidecar the manifest names no licence anywhere
    # Gap: the checker's "not recorded" report itself is not run
    Given a document with no licence record
    When its manifest is built
    Then it has no "licenceRecord" and no "license"
    And its meta has no "licence"

  @test:scripts/tests/gen-library-jsonld.test.ts::the_licence_record_survives_regeneration_(folio-assistant#1492)::the_whole_entry_path_reads_licence.json
  Scenario: Building a whole entry reads its licence.json
    Given an entry with a valid "structure.json" and a "licence.json" record
    When its nodes are built
    Then the state is "built"
    And the manifest's licenceRecord equals the record

  @test:scripts/tests/gen-library-jsonld.test.ts::the_licence_record_survives_regeneration_(folio-assistant#1492)::an_unparseable_sidecar_is_carried_as_malformed,_never_as_absent
  Scenario: A licence sidecar that does not parse is read as unparseable
    Given a directory whose "licence.json" is not JSON
    When its licence is read
    Then its status is "unparseable"
    And a directory with no licence file reads as no licence

  @test:scripts/tests/gen-library-jsonld.test.ts::D4:_a_library_item's_licence_is_dcterms:license,_by_the_row_a_glossary_uses_(bean_gzkt)::a_stated_licence_is_written_as_`license`,_outside_meta
  Scenario: A stated licence is written as license, outside meta
    Given a stated licence record with the id "CC-BY-NC-SA-3.0-IGO"
    When the document's manifest is built with it
    Then its license is "CC-BY-NC-SA-3.0-IGO"
    And its licenceRecord equals the record
    And its meta has no "licence"

  @test:scripts/tests/gen-library-jsonld.test.ts::D4:_a_library_item's_licence_is_dcterms:license,_by_the_row_a_glossary_uses_(bean_gzkt)::an_unknown_licence_is_recorded_as_unknown_and_never_named
  Scenario: An unknown licence is recorded but never named
    Given a licence record of status "unknown"
    When its licence properties are derived
    Then there is no "license"
    And the licenceRecord equals the record

  @test:scripts/tests/gen-library-jsonld.test.ts::D4:_a_library_item's_licence_is_dcterms:license,_by_the_row_a_glossary_uses_(bean_gzkt)::a_stated_record_with_no_id_names_nothing_(the_checker_reports_it_malformed)
  Scenario: A stated licence record with no id names no licence
    Given a licence record of status "stated" with a basis and no id
    When its licence properties are derived
    Then there is no "license"

  @test:scripts/tests/gen-library-jsonld.test.ts::D4:_a_library_item's_licence_is_dcterms:license,_by_the_row_a_glossary_uses_(bean_gzkt)::an_unparseable_sidecar_names_no_licence
  Scenario: An unparseable licence record names no licence
    Given a licence record of status "unparseable"
    When its licence properties are derived
    Then there is no "license"

  @test:scripts/tests/gen-library-jsonld.test.ts::D4:_a_library_item's_licence_is_dcterms:license,_by_the_row_a_glossary_uses_(bean_gzkt)::no_record:_nothing_at_all
  Scenario: No licence record yields no licence properties
    Given no licence record
    When its licence properties are derived
    Then they are empty

  @test:scripts/tests/gen-library-jsonld.test.ts::D4:_a_library_item's_licence_is_dcterms:license,_by_the_row_a_glossary_uses_(bean_gzkt)::the_published_context_binds_both_keys_as_the_licence-naming_table_does
  Scenario: The published context binds license and licenceRecord as the licence-naming table does
    Given the "licence-naming" vocabulary mapping table
    When its context bindings are computed
    Then the published content context expands "license" to the bound IRI "http://purl.org/dc/terms/license"
    And it expands "licenceRecord" to the table's bound IRI

  @test:scripts/tests/gen-library-jsonld.test.ts::the_instance_an_entry_belongs_to::a_relative_entry_path_names_the_instance,_not_"."
  Scenario: A relative entry path names the declaring instance
    Given an instance "inst" declaring "library/" and holding the entry "library/d"
    And the working directory is the instance root
    When the instance of "library/d" is read
    Then it is "inst"

  @test:scripts/tests/gen-library-jsonld.test.ts::the_instance_an_entry_belongs_to::the_instance_is_the_declared_name,_not_the_folder_it_was_cloned_into_(bean_j3ls)
  Scenario: The instance is its declared name, not its folder name
    Given a folder "wim" whose declaration names the instance "who-iris"
    When the instance of "wim/library/d" is read
    Then it is "who-iris"

  @test:scripts/tests/gen-library-jsonld.test.ts::the_instance_a_GROUPED_entry_belongs_to_(bean_6fez)::an_entry_in_a_declared_group,_library/<group>/<id>,_names_the_instance
  Scenario: An entry in a declared group names its instance
    Given an instance "inst" whose library declares the group "ui"
    When the instance of "library/ui/d" is read
    Then it is "inst"
    And an entry in the undeclared folder "library/stray/e" names no instance

  @test:scripts/tests/gen-library-jsonld.test.ts::the_instance_an_entry_belongs_to_when_its_library_sits_BELOW_the_instance_(cat-harness#1032)::library/corpus/<group>/<id>_and_library/corpus/<id>_name_the_instance_that_declares_the_corpus
  Scenario: Entries in a library nested below the instance name that instance
    Given an instance "inst" declaring its library at "library/corpus/" with the group "ui"
    When the instances of "library/corpus/ui/d" and "library/corpus/e" are read
    Then each is "inst"
    And an entry under the undeclared "library/other/f" names no instance

  @test:scripts/tests/gen-library-jsonld.test.ts::an_argument_run()_would_not_read_is_refused_before_anything_is_written::--help,_a_typo,_or_a_stray_value_is_named;_the_real_flags_and_their_values_pass
  Scenario: An argument the generator would not read is named
    # Gap: only the argument check is called; run() refusing before writing is not exercised
    Given the arguments "--help", "--chek" and "library/x", each alone
    When the unknown argument is found
    Then it is that argument
    And no arguments, "--check --prune --doc x" and "--entry ingest-staging/x" have no unknown argument

  @test:scripts/tests/gen-library-jsonld.test.ts::a_requirement_candidate_(L1_requirement_ingestion,_2026-11-01)::carries_the_source's_own_number_and_kind,_and_nothing_it_was_not_given
  Scenario: A requirement candidate's meta carries its source number and kind only
    Given a plain remark candidate
    Then it has no candidate meta
    Given an indicator candidate numbered "1-01" of source kind "nhwa-indicator" and aspect "requirements"
    Then its meta is exactly the source number "1-01", the source kind and the aspect

  @test:scripts/tests/gen-library-jsonld.test.ts::a_requirement_candidate_(L1_requirement_ingestion,_2026-11-01)::copies_printed_fields_into_meta_as_strings,_never_over_its_own_keys
  Scenario: Printed fields are copied into meta without overriding its own keys
    Given an indicator candidate numbered "1-01" whose fields include "source_number" of "x" and a blank field
    When its candidate meta is derived
    Then it holds "indicatorId" and "numerator" as given
    And "source_number" stays "1-01"
    And the blank field is dropped

  @test:scripts/tests/gen-library-jsonld.test.ts::a_requirement_candidate_(L1_requirement_ingestion,_2026-11-01)::its_node_keeps_the_section_link_and_gains_the_meta;_one_without_stays_byte-identical
  Scenario: A requirement block keeps its section link and gains meta
    # Gap: a block without meta is checked only for having no meta, not for being byte-identical
    Given the document's candidates plus a recommendation "R1" of strength "should" in the first section
    When the nodes are built
    Then "blocks/recommendation-sec-000-02.jsonld" is derived from "library/0110001v3/sections/sec-000"
    And its meta is the source number "R1" and the strength "should"
    And the remark block "rem-sec-000-01" has no meta

  @test:scripts/tests/gen-library-jsonld.test.ts::a_candidate's_@type_(cat-harness-tools#1356)::a_kind_no_mounted_layer_types_is_still_a_typed_library_block,_never_untyped
  Scenario: A candidate kind no layer types is still a typed block
    Given the kind "no-such-kind-anywhere", which no layer in this checkout contributes
    When its candidate types are read
    Then they are "cat-harness:Block"
    And the kind "theorem" has its own types, without "cat-harness:Block"

  @test:scripts/tests/gen-library-jsonld.test.ts::a_candidate's_@type_(cat-harness-tools#1356)::an_entry_in_a_mounted_layer_resolves_contributed_kinds_and_prefixes_from_that_layer's_dependencies,_not_a_sibling's
  Scenario: A mounted layer's library entry resolves contributed kinds and prefixes from that layer's own dependencies
    Given a layer "dak" contributing the kind "indicator" as "dak:Indicator", a layer "ig" needing "dak", and a sibling layer "iris" that does not need "dak"
    When an entry with an "indicator" candidate is built in "ig/library/d" and in "iris/library/d"
    Then the block in "ig" is typed "dak:Indicator" with the "dak" prefix bound in its local context
    And the block in "iris" is typed "cat-harness:Block" with no "dak" prefix bound

  @test:scripts/tests/gen-library-jsonld.test.ts::non-entry_directories_inside_a_library_are_skipped::libraryEntriesIn_drops_dotfiles_and_directories_declared_for_another_graph_typology
  Scenario: Directories declared for another graph typology inside a library are skipped as entries
    Given an instance declaring "library/" along with "library/processes/" as "processes" and "library/skills/" as "skills", plus the entry "library/doc-1" and ".hidden"
    When the library's entries are listed by libraryEntriesIn
    Then only "doc-1" is returned

  @test:scripts/tests/gen-library-jsonld.test.ts::tables_transcribed_from_a_paged_entry's_pages_are_blocks_(who-iris#224)::each_transcribed_table_is_a_table_block_carrying_its_narrative
  Scenario: A table transcribed from a paged entry's pages is a table block with its narrative
    Given a paged entry whose tabular.csvw.json transcribes "Table 1" on pages 3 and 4, with a draft narrative
    When the document's nodes are built
    Then "blocks/table-001.jsonld" is a "table" block typed "doco:Table"
    And it names its label, caption, CSV, column headers and pages 3 to 4
    And it carries the table's narrative as it is in tabular.csvw.json

  @test:scripts/tests/gen-library-jsonld.test.ts::tables_transcribed_from_a_paged_entry's_pages_are_blocks_(who-iris#224)::a_table_belongs_to_the_FIRST_section_holding_its_first_page,_as_a_figure_does
  Scenario: A transcribed table belongs to the first section holding its first page
    Given sections on pages 1 to 3 and 3 to 8, a table starting on page 3 and a table on page 5
    When the document's nodes are built
    Then the first table is derived from, and listed only by, the first section
    And the second table is listed by the second section

  @test:scripts/tests/gen-library-jsonld.test.ts::tables_transcribed_from_a_paged_entry's_pages_are_blocks_(who-iris#224)::a_table_with_no_label_is_named_by_its_block_id,_and_one_with_no_narrative_carries_none
  Scenario: A transcribed table with no label or narrative is still a block
    Given a transcribed table with no label, no columns and no narrative
    When the document's nodes are built
    Then its block is labelled "table-002" and has no narrative and no headers

  @test:scripts/tests/gen-library-jsonld.test.ts::tables_transcribed_from_a_paged_entry's_pages_are_blocks_(who-iris#224)::a_table_no_section_holds_hangs_off_the_manifest_rather_than_being_dropped
  Scenario: A transcribed table no section holds is kept under the manifest
    Given a transcribed table that names no page
    When the document's nodes are built
    Then its block is derived from the manifest
    And the manifest lists it after the sections

  @test:scripts/tests/gen-library-jsonld.test.ts::tables_transcribed_from_a_paged_entry's_pages_are_blocks_(who-iris#224)::with_no_transcribed_tables_nothing_changes:_no_table_block_is_written
  Scenario: A paged entry with no transcribed tables gets no table blocks
    Given a paged entry with no tabular.csvw.json
    When the document's nodes are built
    Then no "blocks/table-" file is written

  @test:scripts/tests/gen-library-jsonld.test.ts::tables_transcribed_from_a_paged_entry's_pages_are_blocks_(who-iris#224)::the_entry_path_reads_tabular.csvw.json_beside_structure.json,_and_stays_paged
  Scenario: The entry path reads the transcribed tables beside the structure
    Given an entry directory with structure.json and a tabular.csvw.json beside it
    When the entry's nodes are built
    Then the entry is on the "paged" rung
    And "blocks/table-001.jsonld" carries the table's narrative
