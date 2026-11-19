# A Jupyter notebook ingested by its own headings: sections, code fenced and
# never run, and routing by content (bean rkqp). Each Scenario names the test
# that executes it.
Feature: Notebook structure

  @test:scripts/tests/notebook-structure.test.ts::sections_follow_the_author's_headings::a_preamble_before_the_first_heading_is_kept_as_its_own_section
  Scenario: A preamble before the first heading is its own section
    Given a notebook with intro text, a Title heading, a code cell and a Part heading
    When its entry is built
    Then the sections are Preamble, Title and Part, from headings

  @test:scripts/tests/notebook-structure.test.ts::sections_follow_the_author's_headings::cell_ranges_tile_the_notebook,_and_code_cells_are_counted_where_they_sit
  Scenario: Cell ranges tile the notebook and code cells are counted where they sit
    Then the sections cover cells 0-0, 1-2 and 3-3, with one code cell in the second

  @test:scripts/tests/notebook-structure.test.ts::sections_follow_the_author's_headings::code_is_fenced_with_the_declared_language_and_never_run
  Scenario: Code is fenced with the declared language
    Then the Title section's body holds the code cell in a python fence

  @test:scripts/tests/notebook-structure.test.ts::sections_follow_the_author's_headings::the_output_reads_back_through_the_shared_accessor_as_the_notebook_variant
  Scenario: The output reads back as the notebook variant
    When the structure is read through the shared accessor
    Then its variant is notebook

  @test:scripts/tests/notebook-structure.test.ts::a_notebook_with_no_heading::is_one_section,_and_says_no_structure_was_inferred
  Scenario: A notebook with no heading is one section and says so
    When the entry of a notebook with no markdown heading is built
    Then the TOC source is none, there is one section, and the note says there is no markdown heading

  @test:scripts/tests/notebook-structure.test.ts::what_opens_a_section::only_a_markdown_cell_whose_first_line_is_a_heading
  Scenario: Only a markdown cell whose first line is a heading opens a section
    Then "## A heading" opens a level-2 section titled "A heading"
    And a markdown cell with a heading on a later line, and a code cell starting with #, open none

  @test:scripts/tests/notebook-structure.test.ts::ingest-document_routes_a_notebook_by_its_CONTENT_(bean_rkqp)::JSON_with_nbformat_and_cells_goes_to_the_notebook_rung,_whatever_its_name
  Scenario: JSON with nbformat and cells is routed to the notebook rung whatever its name
    Given a notebook saved as a .txt file
    When its ingest plan is made
    Then its rung is notebook and its first step runs notebook-structure.ts

  @test:scripts/tests/notebook-structure.test.ts::ingest-document_routes_a_notebook_by_its_CONTENT_(bean_rkqp)::JSON_that_is_not_a_notebook_is_not_routed_there
  Scenario: JSON that is not a notebook is not routed there
    Then a .ipynb holding cells but no nbformat is not a notebook
    And a .ipynb that is not JSON is not a notebook

  @test:scripts/tests/notebook-structure.test.ts::the_images_sidecar_says_only_what_the_notebook_supports::no_image_anywhere_is_the_determined_empty_list
  Scenario: No image anywhere is the determined empty list
    When the entry of a notebook with no image is built
    Then its images list is empty

  @test:scripts/tests/notebook-structure.test.ts::the_images_sidecar_says_only_what_the_notebook_supports::an_image_output_or_a_markdown_image_is_COULD_NOT_DETERMINE,_with_the_count
  Scenario: An image output or a markdown image is could-not-determine, with the count
    Given a notebook with a markdown image and a code cell with an image output
    When its entry is built
    Then its images are null and the reason counts 1 image output and 1 markdown image

  @test:scripts/tests/notebook-structure.test.ts::the_PDF-only_arms_never_run_on_a_notebook_(bean_rkqp)::a_notebook_gets_its_rung_and_l1-blocks,_and_no_image,_table_or_vector_arm
  Scenario: A notebook gets its rung and l1-blocks, and no PDF-only arm
    When the plan of a notebook is extended with its derived arms
    Then its scripts are notebook-structure.ts, l1-blocks.ts and extract-candidates.py
