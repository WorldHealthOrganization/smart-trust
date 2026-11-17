# schemas/content/document-image.ts is the image schema of a library document: a role decided from
# geometry, inspection or a caller's threshold, with its basis; pipeline/gen-library-jsonld.ts turns
# figures into blocks and finds orphaned blocks. Each Scenario names the test that executes it.
Feature: Document image roles, their basis and their blocks

  @test:scripts/tests/document-image.test.ts::what_geometry_implies::a_near-full-bleed_image_alone_on_its_page_is_the_page
  Scenario: A near-full-bleed image alone on its page is a page scan
    Given a geometry basis with coverage 0.998 and one image on the page
    When the role is derived from it
    Then the role is "page-scan"

  @test:scripts/tests/document-image.test.ts::what_geometry_implies::the_half-page_figure_measured_in_9789241548960_eng_is_a_figure
  Scenario: The half-page figure measured in 9789241548960_eng is a figure
    Given a geometry basis with coverage 0.495 and one image on page 12
    When the role is derived from it
    Then the role is "figure"

  @test:scripts/tests/document-image.test.ts::what_geometry_implies::a_full-bleed_image_SHARING_its_page_is_not_the_page
  Scenario: A full-bleed image sharing its page is a figure, not the page
    Given a geometry basis with coverage 0.998 and two images on the page
    When the role is derived from it
    Then the role is "figure"

  @test:scripts/tests/document-image.test.ts::what_geometry_implies::the_threshold_is_a_boundary,_not_a_vibe
  Scenario: The page coverage threshold is an exact boundary
    Given a lone image on its page
    When its coverage equals the page coverage threshold
    Then the role is "page-scan"
    And at the threshold minus 1e-9 the role is "figure"

  @test:scripts/tests/document-image.test.ts::what_geometry_implies::no_basis_is_UNDETERMINED,_never_a_default_role
  Scenario: No basis yields undetermined, never a default role
    When the role is derived with no basis
    Then the role is "undetermined"
    And "undetermined" is one of the image roles

  @test:scripts/tests/document-image.test.ts::a_verdict_must_show_its_working::a_decided_role_with_no_basis_is_refused
  Scenario: A decided role with no basis is refused
    Given a figure entry with its basis removed
    When it is parsed by the document image schema
    Then parsing fails
    And the issues mention the basis or the working

  @test:scripts/tests/document-image.test.ts::a_verdict_must_show_its_working::`undetermined`_WITH_a_basis_is_also_refused
  Scenario: An undetermined role with a basis is refused
    Given a figure entry with a geometry basis whose role is set to "undetermined"
    When it is parsed by the document image schema
    Then parsing fails

  @test:scripts/tests/document-image.test.ts::a_verdict_must_show_its_working::undetermined_without_a_basis_is_fine
  Scenario: An undetermined role without a basis is accepted
    Given a figure entry with its basis removed and role "undetermined"
    When it is parsed by the document image schema
    Then parsing succeeds

  @test:scripts/tests/document-image.test.ts::only_a_figure_is_worth_describing::a_page_scan_carrying_a_narrative_is_refused
  Scenario: A page scan carrying a narrative is refused
    Given a page-scan entry with a geometry basis and a "not-authored" narrative
    When it is parsed by the document image schema
    Then parsing fails
    And the issues mention a "scanned page"

  @test:scripts/tests/document-image.test.ts::only_a_figure_is_worth_describing::a_figure_carrying_one_is_accepted
  Scenario: A figure carrying a narrative is accepted
    Given a figure entry with a "not-authored" narrative
    When it is parsed by the document image schema
    Then parsing succeeds

  @test:scripts/tests/document-image.test.ts::only_a_figure_is_worth_describing::`withEmptyNarrative`_gives_a_slot_to_figures_and_to_nothing_else
  Scenario: withEmptyNarrative gives a narrative slot to figures and to nothing else
    When withEmptyNarrative is applied to a figure
    Then its narrative state is "not-authored"
    And applied to a page scan, it leaves no narrative

  @test:scripts/tests/document-image.test.ts::only_a_figure_is_worth_describing::DESCRIBABLE_ROLES_is_derived,_and_excludes_the_two_that_earn_nothing
  Scenario: The describable roles are figure, logo and decorative, excluding page-scan and undetermined
    # Gap: that the list is derived from IMAGE_ROLES rather than written out is not checked
    When the describable roles are read
    Then they are exactly "figure", "logo" and "decorative"
    And they contain neither "page-scan" nor "undetermined"

  @test:scripts/tests/document-image.test.ts::could-not-determine_is_not_emptiness::`images:_null`_must_say_why
  Scenario: A sidecar with images null must give a reason
    Given a sidecar of schema "folio-document-images/v1" with images null and no undetermined reason
    When it is parsed by the images sidecar schema
    Then parsing fails

  @test:scripts/tests/document-image.test.ts::could-not-determine_is_not_emptiness::an_empty_array_is_a_FINDING_and_needs_no_reason
  Scenario: An empty images array is a finding and needs no reason
    Given a sidecar with an empty images array and no reason
    When it is parsed by the images sidecar schema
    Then parsing succeeds

  @test:scripts/tests/document-image.test.ts::could-not-determine_is_not_emptiness::a_reason_WITHOUT_null_is_refused
  Scenario: An undetermined reason without images null is refused
    Given a sidecar with an empty images array and the undetermined reason "some reason"
    When it is parsed by the images sidecar schema
    Then parsing fails

  @test:scripts/tests/document-image.test.ts::the_extractor's_real_output_satisfies_the_schema::milnorlink's_sidecar_parses,_and_is_19_scans_+_1_figure
  Scenario: The extractor's sidecar for milnorlink parses and holds 19 page scans and 1 figure
    # Skipped: when uploads/milnorlink.pdf is absent
    Given the PDF uploads/milnorlink.pdf
    When scripts/pdf-images.py runs on it with --dry-run --json
    Then it exits 0 or 2
    And its output parses as an images sidecar
    And if images is null, the sidecar gives an undetermined reason
    And otherwise it holds 19 page scans and 1 figure
    And every entry has a basis exactly when its role is not "undetermined"

  @test:scripts/tests/document-image.test.ts::figures_reach_the_manifest_as_blocks::a_figure_becomes_a_block,_typed_as_a_figure_in_both_vocabularies
  Scenario: A figure becomes a block, typed as a figure in both vocabularies
    Given a sidecar whose figure img-p008-1 sits on page 8
    When the document nodes are built
    Then "blocks/figure-img-p008-1.jsonld" is written with kind "figure"
    And its types are "folio-assistant-core:Figure" and "doco:Figure"
    And its file is "../images/img-p008-1.png", relative to the block
    And its start page is 8

  @test:scripts/tests/document-image.test.ts::figures_reach_the_manifest_as_blocks::a_PAGE_SCAN_never_becomes_a_block,_even_on_a_page_that_has_a_section
  Scenario: A page scan never becomes a block, even on a page that has a section
    Given a sidecar with two figures and a page scan on page 12, which has a section
    When the document nodes are built
    Then no block "blocks/figure-img-p012-1.jsonld" is written
    And exactly two figure blocks are written

  @test:scripts/tests/document-image.test.ts::figures_reach_the_manifest_as_blocks::the_figure_is_contained_by_the_section_whose_pages_hold_it
  Scenario: A figure is contained by the section whose pages hold it
    Given figure img-p008-1 on page 8 and sections for pages 8 and 9
    When the document nodes are built
    Then section "page-008" contains "library/d/blocks/figure-img-p008-1"
    And section "page-009" does not

  @test:scripts/tests/document-image.test.ts::figures_reach_the_manifest_as_blocks::narrative_STATE_travels,_so_absence_is_distinguishable_from_rejection
  Scenario: A figure's narrative state travels to its block
    Given figure img-p008-1 with a "not-authored" narrative and figure img-p009-1 with none
    When the document nodes are built
    Then the img-p008-1 block carries the narrative with text null and state "not-authored"
    And the img-p009-1 block carries no narrative

  @test:scripts/tests/document-image.test.ts::figures_reach_the_manifest_as_blocks::no_sidecar_means_no_figure_blocks_—_and_no_crash
  Scenario: No images sidecar means no figure blocks and no crash
    When the document nodes are built with no sidecar
    Then no written path names a figure

  @test:scripts/tests/document-image.test.ts::a_judgement_is_not_a_measurement::a_`logo`_backed_by_geometry_is_refused
  Scenario: A logo backed by geometry is refused
    Given a "logo" entry with a geometry basis
    When it is parsed by the document image schema
    Then parsing fails
    And the issues mention looking or the emblem

  @test:scripts/tests/document-image.test.ts::a_judgement_is_not_a_measurement::...and_backed_by_inspection_is_accepted
  Scenario: A logo backed by inspection is accepted
    Given a "logo" entry with an inspection basis by an agent naming its model, saying what it saw
    When it is parsed by the document image schema
    Then parsing succeeds

  @test:scripts/tests/document-image.test.ts::a_judgement_is_not_a_measurement::`decorative`_is_the_same_—_unreachable_from_a_rectangle
  Scenario: A decorative image is likewise unreachable from geometry
    Given a "decorative" entry
    When it is parsed with a geometry basis
    Then parsing fails
    And with an inspection basis that saw "children on a dirt road", parsing succeeds

  @test:scripts/tests/document-image.test.ts::a_judgement_is_not_a_measurement::`figure`_and_`page-scan`_still_accept_geometry_—_the_cheap_path_stays
  Scenario: Figure and page-scan still accept a geometry basis
    When a "figure" entry with a geometry basis is parsed
    Then parsing succeeds
    And a "page-scan" entry with a geometry basis of coverage 0.998 also parses

  @test:scripts/tests/document-image.test.ts::a_judgement_is_not_a_measurement::an_inspection_must_name_WHO_looked,_and_an_agent_must_name_its_model
  Scenario: An agent's inspection must name its model
    # Gap: an inspection naming no one at all is not checked; only an agent without a model is
    Given a "logo" entry whose inspection basis is by an agent "claude" with no model
    When it is parsed by the document image schema
    Then parsing fails

  @test:scripts/tests/document-image.test.ts::a_judgement_is_not_a_measurement::an_inspection_must_say_what_was_SEEN_—_the_reason,_not_the_description
  Scenario: An inspection must say what was seen
    Given a "logo" entry whose inspection basis has no "saw"
    When it is parsed by the document image schema
    Then parsing fails

  @test:scripts/tests/document-image.test.ts::a_judgement_is_not_a_measurement::roleFor_cannot_be_handed_an_inspection_basis_at_all
  Scenario: roleFor never returns a role that requires inspection
    # Gap: that roleFor rejects an inspection basis at compile time is not checked
    Given a geometry basis
    When the role is derived from it
    Then that role does not require inspection
    And "logo" requires inspection while "figure" does not

  @test:scripts/tests/document-image.test.ts::generated_blocks_nothing_points_at::a_block_no_section_contains_is_reported
  Scenario: A block no section contains is reported as orphaned
    Given section s1 containing figure-a, and blocks figure-a and figure-b
    When the orphaned blocks of "d" are found
    Then only "figure-b" is reported

  @test:scripts/tests/document-image.test.ts::generated_blocks_nothing_points_at::a_block_that_IS_contained_is_not
  Scenario: A block a section contains is not reported
    Given section s1 containing figure-a, and the block figure-a
    When the orphaned blocks of "d" are found
    Then none is reported

  @test:scripts/tests/document-image.test.ts::generated_blocks_nothing_points_at::an_UNREADABLE_section_makes_it_refuse_to_judge,_not_report_everything
  Scenario: An unreadable section makes it refuse to judge rather than report every block
    Given section s1 holding invalid JSON, and blocks figure-a and figure-b
    When the orphaned blocks of "d" are found
    Then none is reported

  @test:scripts/tests/document-image.test.ts::generated_blocks_nothing_points_at::no_sections_directory_at_all_is_a_determined_empty,_not_a_refusal:_its_blocks_are_reported
  Scenario: With no sections directory, every block is reported
    Given blocks containing figure-a and no sections directory
    When the orphaned blocks of "d" are found
    Then "figure-a" is reported

  @test:scripts/tests/document-image.test.ts::generated_blocks_nothing_points_at::non-jsonld_files_in_blocks/_are_ignored
  Scenario: Non-jsonld files in blocks/ are ignored
    Given an empty sections directory and blocks/ holding "figure-a.jsonld", "figure-a.md" and "README"
    When the orphaned blocks of "d" are found
    Then only "figure-a" is reported

  @test:scripts/tests/document-image.test.ts::generated_blocks_nothing_points_at::a_CSV's_table,_contained_by_the_MANIFEST_alone,_is_not_orphaned
  Scenario: A CSV's table contained by the manifest alone is not orphaned
    Given the block table-001 and a manifest containing it directly, with no sections or sheets
    When the orphaned blocks of "d" are found
    Then none is reported

  @test:scripts/tests/document-image.test.ts::generated_blocks_nothing_points_at::a_workbook's_table,_contained_through_sheets/,_is_not_orphaned
  Scenario: A workbook's table contained through sheets/ is not orphaned
    Given a manifest containing sheet-001, which contains the block table-001
    When the orphaned blocks of "d" are found
    Then none is reported

  @test:scripts/tests/document-image.test.ts::generated_blocks_nothing_points_at::a_table_nothing_points_at_is_STILL_reported_—_the_widening_is_not_an_amnesty
  Scenario: A table nothing points at is still reported
    Given a manifest containing sheet-001, which contains table-001 but not table-002
    When the orphaned blocks of "d" are found
    Then only "table-002" is reported

  @test:scripts/tests/document-image.test.ts::generated_blocks_nothing_points_at::an_UNREADABLE_manifest_is_the_same_refusal_an_unreadable_section_is
  Scenario: An unreadable manifest makes it refuse to judge, as an unreadable section does
    Given the block table-001 and a manifest holding invalid JSON
    When the orphaned blocks of "d" are found
    Then none is reported

  @test:scripts/tests/document-image.test.ts::generated_blocks_nothing_points_at::a_manifest_pointing_at_SECTIONS_adds_no_block_reference
  Scenario: A manifest pointing at sections adds no block reference
    Given an empty sections directory, the block page-001, and a manifest containing the section page-001
    When the orphaned blocks of "d" are found
    Then "page-001" is reported

  @test:scripts/tests/document-image.test.ts::blockRefIn_—_only_a_reference_that_names_a_block_is_one::a_block_reference_yields_its_id
  Scenario: A block reference yields its id
    When the block reference in "library/d/blocks/table-001" is read
    Then it is "table-001"

  @test:scripts/tests/document-image.test.ts::blockRefIn_—_only_a_reference_that_names_a_block_is_one::a_section_reference_yields_nothing
  Scenario: A section reference yields no block id
    When the block reference in "library/d/sections/page-001" is read
    Then it is undefined

  @test:scripts/tests/document-image.test.ts::blockRefIn_—_only_a_reference_that_names_a_block_is_one::a_sheet_reference_yields_nothing
  Scenario: A sheet reference yields no block id
    When the block reference in "library/d/sheets/sheet-001" is read
    Then it is undefined

  @test:scripts/tests/document-image.test.ts::blockRefIn_—_only_a_reference_that_names_a_block_is_one::a_bare_id,_with_no_directory_to_judge_by,_yields_nothing
  Scenario: A bare id with no directory yields no block id
    When the block reference in "table-001" is read
    Then it is undefined

  @test:scripts/tests/document-image.test.ts::a_caller-supplied_threshold_reaches_`furniture`,_and_only_it_does::`furniture`_on_a_threshold_basis_is_accepted
  Scenario: Furniture on a caller-supplied threshold basis is accepted
    Given a "furniture" entry with a threshold basis of value 0.5 supplied by "caller"
    When it is parsed by the document image schema
    Then parsing succeeds

  @test:scripts/tests/document-image.test.ts::a_caller-supplied_threshold_reaches_`furniture`,_and_only_it_does::`furniture`_on_any_other_basis_is_refused_—_the_cutoff's_call_cannot_be_forged
  Scenario: Furniture on a geometry or inspection basis is refused
    Given a "furniture" entry
    When it is parsed with a geometry basis, and again with a human inspection basis
    Then parsing fails each time

  @test:scripts/tests/document-image.test.ts::a_caller-supplied_threshold_reaches_`furniture`,_and_only_it_does::a_threshold_basis_decides_nothing_but_`furniture`
  Scenario: A threshold basis decides nothing but furniture
    Given a "figure" entry with a caller-supplied threshold basis
    When it is parsed by the document image schema
    Then parsing fails

  @test:scripts/tests/document-image.test.ts::a_caller-supplied_threshold_reaches_`furniture`,_and_only_it_does::the_basis_must_say_the_CALLER_supplied_it
  Scenario: A threshold basis must say the caller supplied it
    Given a "furniture" entry with a threshold basis supplied by "inspector"
    When it is parsed by the document image schema
    Then parsing fails

  @test:scripts/tests/document-image.test.ts::a_caller-supplied_threshold_reaches_`furniture`,_and_only_it_does::`furniture`_is_settled_and_owes_no_narrative
  Scenario: Furniture is settled by computation and owes no narrative
    When the roles settled by computation and the describable roles are read
    Then the settled roles contain "furniture"
    And the describable roles do not
