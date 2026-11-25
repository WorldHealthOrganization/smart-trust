# The text structure of a library entry built from text files.
# Each Scenario names the test that executes it.
Feature: Text structure

  Background:
    Given a Markdown file "ref.md" with front matter titled "Gherkin Reference", a "# Keywords" heading, a fenced block holding a "#" line, and a "## Feature" heading

  @test:scripts/tests/text-structure.test.ts::a_Markdown_file_is_divided_by_its_own_headings::a_`#`_line_inside_fenced_code_is_not_a_heading
  Scenario: A "#" line in fenced code is not a heading
    Then its headings are "Keywords" and "Feature"

  @test:scripts/tests/text-structure.test.ts::a_Markdown_file_is_divided_by_its_own_headings::the_preamble_is_titled_by_the_front_matter,_and_keeps_it_verbatim
  Scenario: The preamble is titled by the front matter
    When its entry is built
    Then the sections are "Gherkin Reference", "Keywords" and "Feature"
    And the first section's text holds "title: Gherkin Reference"
    And the entry's title is "Gherkin Reference"

  @test:scripts/tests/text-structure.test.ts::a_Markdown_file_is_divided_by_its_own_headings::line_ranges_tile_the_file
  Scenario: Line ranges tile the file
    Then the sections span lines 1–5, 6–11 and 12–13

  @test:scripts/tests/text-structure.test.ts::a_Markdown_file_is_divided_by_its_own_headings::a_single_file's_digest_is_the_file's_own
  Scenario: A single file's digest is its own
    Then the source sha256 is the file's sha256 and the digest kind is "file"

  @test:scripts/tests/text-structure.test.ts::a_Markdown_file_is_divided_by_its_own_headings::it_reads_back_through_the_shared_accessor_as_the_text_variant,_with_no_pages
  Scenario: The structure reads back as the text variant
    When the structure is read through the shared accessor
    Then it is the "text" variant
    And the second section's locator is lines 6–11 of "ref.md", with no pages

  @test:scripts/tests/text-structure.test.ts::any_other_text_is_one_section,_verbatim::markup_that_opens_with_`<`_is_never_divided,_even_if_a_line_looks_like_a_heading
  Scenario: Markup is one verbatim section
    Given an XML file with a line starting "# not a heading"
    Then its format is "verbatim"
    And its entry has one section of unit "file", a table of contents from "files", whose text is the XML in an xml code fence

  @test:scripts/tests/text-structure.test.ts::several_files_are_one_source::the_digest_is_that_of_the_sha256sum_listing,_in_files_order_—_recomputable_without_this_code
  Scenario: Several files are digested as a sha256sum listing
    Given an entry of "d/a.md", "d/b.xml" and the image "d/p.png"
    Then the source sha256 is the sha256 of their sha256sum listing in that order, and the digest kind is "listing"

  @test:scripts/tests/text-structure.test.ts::several_files_are_one_source::an_image_is_recorded_with_its_digest_and_never_sectioned
  Scenario: An image is recorded but not sectioned
    # Gap: the title says the image is recorded with its digest; only its format is checked.
    Then the files' formats are markdown, verbatim and image
    And the sections are of "d/a.md" and "d/b.xml" only

  @test:scripts/tests/text-structure.test.ts::several_files_are_one_source::images_present_means_images_could_not_be_determined,_never_`none`
  Scenario: Images present are undetermined
    Then the images list is null with a reason naming "1 image file(s)"

  @test:scripts/tests/text-structure.test.ts::several_files_are_one_source::no_image_at_all_is_the_determined_empty_list
  Scenario: No image is the empty list
    Then an entry of one Markdown file has an empty images list

  @test:scripts/tests/text-structure.test.ts::the_schema::refuses_an_upstream_commit_that_is_not_a_full_sha
  Scenario: An upstream commit must be a full sha
    Then building an entry with upstream commit "abc" throws

  @test:scripts/tests/text-structure.test.ts::the_schema::refuses_a_section_that_ends_before_it_starts
  Scenario: A section ending before it starts is refused
    Then a structure whose first section ends on line 0 fails the schema

  @test:scripts/tests/text-structure.test.ts::the_schema::front-matter_titles_are_unquoted
  Scenario: Front-matter titles are unquoted
    Then front matter 'title: "Quoted"' gives the title "Quoted"

  @test:scripts/tests/text-structure.test.ts::formatOf_reads_the_extension_before_the_content::a_Python_file_with_#_comments_is_verbatim,_not_markdown
  Scenario: A Python file is verbatim
    Then a Python script with "#" comments, given a ".py" path, is "verbatim"

  @test:scripts/tests/text-structure.test.ts::formatOf_reads_the_extension_before_the_content::without_a_path,_content_still_decides_(unchanged_behaviour)
  Scenario: Without a path the content decides
    Then the same Python script with no path is "markdown"

  @test:scripts/tests/text-structure.test.ts::formatOf_reads_the_extension_before_the_content::a_.md_file_with_headings_is_markdown
  Scenario: A .md file with headings is markdown
    Then "# Title" text at "docs/page.md" is "markdown"

  @test:scripts/tests/text-structure.test.ts::formatOf_reads_the_extension_before_the_content::buildEntry_keeps_a_.py_file_as_one_verbatim_section
  Scenario: A .py file is one section
    # Gap: the title says the section is verbatim; only the section count is checked.
    Then an entry built from "gen.py" has one section
