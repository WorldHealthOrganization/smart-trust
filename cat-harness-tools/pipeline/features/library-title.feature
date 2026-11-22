# pipeline/library-title.ts resolves a library entry's title by a fixed authority order:
# editor's correction, catalogue record, referenced.json, PDF Info /Title, text heading,
# corroborated extraction, then the slug. Each Scenario names the test that executes it.
Feature: Library title authority order

  @test:pipeline/library-title.test.ts::resolveLibraryTitle_—_the_order::the_order_is_exactly_the_rulings',_with_the_slug_as_the_floor
  Scenario: The authority order is exactly the rulings', with the slug as the floor
    Given the title authority list
    Then it is editorial, dc-record, referenced, pdf-info, text-heading, corroborated in that order
    And the last library title source is "slug"

  @test:pipeline/library-title.test.ts::resolveLibraryTitle_—_the_order::the_Dublin_Core_record_outranks_everything
  Scenario: The Dublin Core record outranks the other sources given
    # Gap: no editorial correction is given; a later Scenario shows editorial outranks the record
    Given a slug, a dc-record, a referenced title, a PDF Info title and a text heading
    When the title is resolved
    Then the title is "WHO editorial style manual" from "dc-record"

  @test:pipeline/library-title.test.ts::resolveLibraryTitle_—_the_order::referenced.json_outranks_the_PDF
  Scenario: referenced.json outranks the PDF
    Given every source except the dc-record
    When the title is resolved
    Then the title is "A referenced title" from "referenced"

  @test:pipeline/library-title.test.ts::resolveLibraryTitle_—_the_order::the_PDF_Info_/Title_outranks_the_slug
  Scenario: The PDF Info /Title outranks the slug
    Given a slug and a PDF Info title "Link Groups"
    When the title is resolved
    Then the title is "Link Groups" from "pdf-info"

  @test:pipeline/library-title.test.ts::resolveLibraryTitle_—_the_order::nothing_usable_leaves_the_slug,_said_as_such
  Scenario: With nothing usable the slug is the title, said as such
    Given only the slug "9789240010567-eng"
    When the title is resolved
    Then the title is the slug from "slug"
    And a blank dc-record and a null referenced title also fall to the slug

  @test:pipeline/library-title.test.ts::resolveLibraryTitle_—_the_order::a_junk_/Title_falls_through_to_the_slug_rather_than_becoming_the_title
  Scenario: A junk /Title falls through to the slug
    Given a slug and a PDF Info title "Microsoft Word - gurel_emet.doc"
    When the title is resolved
    Then the title is the slug "gurel-tat-2017-swot-analysis" from "slug"

  @test:pipeline/library-title.test.ts::resolveLibraryTitle_—_the_order::a_record_is_taken_as_written,_even_where_the_junk_filter_would_refuse_it
  Scenario: A catalogue record is taken as written even where the junk filter would refuse it
    Given a slug and a dc-record of "Untitled"
    When the title is resolved
    Then the source is "dc-record"

  @test:pipeline/library-title.test.ts::resolveLibraryTitle_—_the_order::an_editor's_correction_outranks_even_the_catalogue_record_(w6fu)
  Scenario: An editor's correction outranks even the catalogue record
    Given every source plus an editorial title "An editor's title"
    When the title is resolved
    Then the title is "An editor's title" from "editorial"

  @test:pipeline/library-title.test.ts::resolveLibraryTitle_—_the_order::a_corroborated_extraction_ranks_below_every_other_source_and_above_the_slug_(w6fu)
  Scenario: A corroborated extraction ranks below every other source and above the slug
    Given a slug, a PDF Info title and a corroborated title
    When the title is resolved
    Then the source is "pdf-info"
    And with only a slug and a corroborated "Agent Skill best practices", that title is used from "corroborated"

  @test:pipeline/library-title.test.ts::resolveLibraryTitle_—_the_order::a_corroborated_extraction_still_passes_the_junk_filter
  Scenario: A corroborated extraction still passes the junk filter
    Given a slug and a corroborated title "Microsoft Word - dp1.doc"
    When the title is resolved
    Then the source is "slug"

  @test:pipeline/library-title.test.ts::resolveLibraryTitle_—_the_order::whitespace_inside_a_title_is_collapsed
  Scenario: Whitespace inside a title is collapsed
    Given a PDF Info title "JSON-LD" and "1.1" separated by a newline and spaces
    When the title is resolved
    Then the title is "JSON-LD 1.1"

  @test:pipeline/library-title.test.ts::structureTitleCandidates_—_the_page-1_parse_is_never_a_title::a_pdf-structure_offers_its_Info_/Title_and_NOT_metadata.title
  Scenario: A pdf-structure without an Info /Title offers no title from its page-1 parse
    Given a pdf-structure whose metadata.title is "Abies" and whose docinfo has no Title
    When its title candidates are read
    Then it offers no pdf-info and no text-heading candidate
    And the title resolves to the slug "who-pub-tps-931"

  @test:pipeline/library-title.test.ts::structureTitleCandidates_—_the_page-1_parse_is_never_a_title::a_pdf-structure_with_a_/Title_offers_it,_with_where_it_was_read
  Scenario: A pdf-structure with a /Title offers it with where it was read
    Given a pdf-structure whose docinfo Title is "JSON-LD 1.1" and whose metadata.title is longer page-1 text
    When its title candidates are read
    Then the pdf-info candidate is "JSON-LD 1.1"
    And it was read from "structure.json metadata.docinfo.Title"

  @test:pipeline/library-title.test.ts::structureTitleCandidates_—_the_page-1_parse_is_never_a_title::an_UNVERIFIED_metadata.title_is_still_the_page-1_parse_and_is_never_offered
  Scenario: An unverified metadata.title is not offered as corroborated
    # Gap: only the corroborated candidate is checked; other candidates are not asserted absent
    Given a pdf-structure whose metadata.title is marked title_verified false
    When its title candidates are read
    Then there is no corroborated candidate

  @test:pipeline/library-title.test.ts::structureTitleCandidates_—_the_page-1_parse_is_never_a_title::a_VERIFIED_metadata.title_is_offered_as_corroborated_(w6fu)
  Scenario: A verified metadata.title is offered as corroborated
    Given a pdf-structure whose metadata.title "Agent Skills" is verified from a heading
    When its title candidates are read
    Then the corroborated candidate is "Agent Skills"
    And it was read from "structure.json metadata.title"

  @test:pipeline/library-title.test.ts::structureTitleCandidates_—_the_page-1_parse_is_never_a_title::an_editor's_title_correction_is_offered_as_editorial,_on_any_variant_(w6fu)
  Scenario: An editor's title_correction is offered as editorial
    # Gap: only a pdf-structure is tried, not every structure variant
    Given a pdf-structure with a title_correction of "Digital implementation investment guide (DIIG)"
    When its title candidates are read
    Then the editorial candidate is that corrected title
    And the title resolves from "editorial"

  @test:pipeline/library-title.test.ts::structureTitleCandidates_—_the_page-1_parse_is_never_a_title::a_text_or_notebook_structure_offers_its_declared_title_as_text-heading
  Scenario: A text structure offers its declared title as a text heading
    # Gap: only a text-structure is tried, not a notebook structure
    Given a text-structure for reference.md titled "Gherkin Reference"
    When its title candidates are read
    Then the text-heading candidate is "Gherkin Reference"
    And there is no pdf-info candidate

  @test:pipeline/library-title.test.ts::structureTitleCandidates_—_the_page-1_parse_is_never_a_title::a_text_heading_that_is_only_the_file_name_is_refused
  Scenario: A text heading that is only the file name is refused
    Given a notebook-structure for nb.ipynb titled "nb"
    When the title is resolved from its candidates
    Then the source is "slug"

  @test:pipeline/library-title.test.ts::pdfInfoTitleJunk_—_measured_on_this_corpus::refuses_%p
  Scenario: Each junk /Title seen in the corpus is refused
    Given a /Title from the corpus, with its file names and slug
    When it is checked for junk
    Then it is refused
    # Rows include "Microsoft Word - gurel_emet.doc", "How AI-Mediated RACI Matrix.pdf", an arXiv stamp, "untitled", "Untitled document", "", "12", "2026-07-28", a title equal to its file name, and a title equal to its slug

  @test:pipeline/library-title.test.ts::pdfInfoTitleJunk_—_measured_on_this_corpus::accepts_%p
  Scenario: Each usable /Title is accepted
    Given a /Title such as "Link Groups", "JSON-LD 1.1", an RFC title or a WHO SMART guidelines title
    When it is checked for junk with file "x.pdf" and slug "x"
    Then it is accepted
