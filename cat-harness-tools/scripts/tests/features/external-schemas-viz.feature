# scripts/gen-external-schemas-viz.ts renders the external-schemas viewer page from the real spec records and their declared users,
# and, given a subject, a page for one instance's records. Each Scenario names the test that executes it.
Feature: External-schemas viewer page

  @test:scripts/tests/external-schemas-viz.test.ts::external-schemas_visualiser_wireframe_findings_(folio-assistant-7x7g)::adds_scroll-margin-top_to_section_headings_to_prevent_handle_overlap_(Finding_5)
  Scenario: Section headings carry a scroll margin so the handle does not cover them
    Given the page rendered over the real corpus
    Then an h2 or h3 rule sets "scroll-margin-top: 2rem"

  @test:scripts/tests/external-schemas-viz.test.ts::external-schemas_visualiser_wireframe_findings_(folio-assistant-7x7g)::adds_mobile_scroll_cue_and_table-wrapper_scroll_mask_(Finding_7)
  Scenario: The page has a mobile scroll cue and a masked table wrapper
    Given the page rendered over the real corpus
    Then it contains an element of class "xs-scroll-cue"
    And the ".table-wrapper" rule sets a linear-gradient mask-image

  @test:scripts/tests/external-schemas-viz.test.ts::external-schemas_visualiser_wireframe_findings_(folio-assistant-7x7g)::ensures_state_tag_colors_satisfy_the_4.5:1_contrast_floor_on_dark_backgrounds_(Finding_6)
  Scenario: State tag colours meet 4.5:1 contrast on the dark background
    # Gap: the colours are hard-coded in the test; it does not check the page uses them
    Given the page rendered over the real corpus
    Then it contains a "prefers-color-scheme: dark" rule
    And "#34d399", "#a1a1aa" and "#f87171" each reach at least 4.5:1 contrast against "#27262b"

  @test:scripts/tests/external-schemas-viz.test.ts::external-schemas_visualiser_wireframe_findings_(folio-assistant-7x7g)::converts_all-caps_notes_blocks_to_clean_sentence-case_paragraphs_(Finding_8)
  Scenario: Notes blocks are sentence case, not all caps
    Given the page rendered over the real corpus
    Then it does not contain "THE TRANSCRIPTION CAME FIRST AND THAT WAS THE DEFECT" or "NO XSD IS HELD"
    And it contains "The transcription came first, which was the defect" and "No XSD is held and none is fetched"

  @test:scripts/tests/external-schemas-viz.test.ts::external-schemas_visualiser_wireframe_findings_(folio-assistant-7x7g)::accounts_for_broader_namespace_usages_and_does_not_falsely_claim_DCMI/SKOS_are_unused_(Finding_3)
  Scenario: DCMI and SKOS are not listed as unused namespaces
    Given the page rendered over the real corpus, with BPMN, JSON-LD and mentioned namespaces counted as in use
    When the Namespaces section is read
    Then it does not list the DC elements, DC terms or SKOS core namespace

  @test:scripts/tests/external-schemas-viz.test.ts::external-schemas_visualiser_wireframe_findings_(folio-assistant-7x7g)::qualifies_operative_terms_and_avoids_repeating_identical_placeholder_sentences_(Finding_1)
  Scenario: Operative terms are qualified and the placeholder sentence is gone
    Given the page rendered over the real corpus
    Then it says "operative terms in graph" followed by a count described
    And it does not contain the "what this repository does with it is not yet described" placeholder

  @test:scripts/tests/external-schemas-viz.test.ts::external-schemas_visualiser_wireframe_findings_(folio-assistant-7x7g)::ensures_every_specification_links_to_an_existing_section_anchor
  Scenario: Every specification's link has a matching section anchor
    Given the page rendered over the real corpus
    Then for every specification the page links to "#<id>" and carries the anchor "{#<id>}"

  @test:scripts/tests/external-schemas-viz.test.ts::one_instance's_page_(`subject`):_its_own_records,_the_corpus_reconciliation_left_to_the_full_page::is_titled_for_the_instance,_names_its_directory_and_links_the_full_page
  Scenario: An instance page is titled for the instance and links the full page
    Given a page rendered for the instance "some-layer" titled "Some layer" with directory "some-layer/external-schemas"
    Then its title is "External schemas — Some layer"
    And it names the directory "some-layer/external-schemas"
    And it links the full page at "../../"

  @test:scripts/tests/external-schemas-viz.test.ts::one_instance's_page_(`subject`):_its_own_records,_the_corpus_reconciliation_left_to_the_full_page::draws_the_instance's_records,_and_not_the_namespace_reconciliation,_which_compares_the_corpus_against_the_registry
  Scenario: An instance page draws its records but not the namespace reconciliation
    Given one specification rendered as a full page with an undeclared namespace and as an instance page
    Then the instance page carries the specification's anchor
    And the full page has the section "Namespaces the corpus uses"
    And the instance page has neither that section nor "in use and not declared here"
