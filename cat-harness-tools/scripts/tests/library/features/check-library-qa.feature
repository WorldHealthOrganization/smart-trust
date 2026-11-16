# Library entry QA (issue #1794, bean 8iqc). Each fixture reproduces a defect
# measured on main on 2026-10-01. Each Scenario names its test.
Feature: Library entry QA

  @test:scripts/tests/library/check-library-qa.test.ts::title-missing::the_slug_standing_in_for_a_title_is_a_finding
  Scenario: A title equal to the slug is missing
    Given an entry whose title is its slug "rfc2119-key-words"
    When its title is checked for absence
    Then the finding says "equals the slug"

  @test:scripts/tests/library/check-library-qa.test.ts::title-missing::a_source_file_name_is_a_finding_(codata-2022)
  Scenario: A title equal to a source file name is missing
    Given an entry titled "allascii-codata-2022.txt", which is its source file
    When its title is checked for absence
    Then the finding names a "source file name"

  @test:scripts/tests/library/check-library-qa.test.ts::title-missing::absent_is_a_finding,_and_a_real_title_is_not
  Scenario: An absent title is missing, a real one is not
    Given an entry with a null title
    Then the finding says "absent"
    And an entry titled "Decision Model and Notation (DMN)" has no finding

  @test:scripts/tests/library/check-library-qa.test.ts::title-implausible::Abies:_a_single_short_token,_and_it_disagrees_with_the_Dublin_Core_record
  Scenario: "Abies" is a short token disagreeing with the Dublin Core title
    Given an entry titled "Abies" whose Dublin Core title is "WHO editorial style manual"
    When its title's plausibility is checked
    Then the findings are "a single short token" and "disagrees with the source's own metadata"

  @test:scripts/tests/library/check-library-qa.test.ts::title-implausible::a_doubled_word
  Scenario: A doubled word is implausible
    Given an entry titled "LeanArchitect LeanArchitect"
    When its title's plausibility is checked
    Then the first finding mentions "doubled"

  @test:scripts/tests/library/check-library-qa.test.ts::title-implausible::a_truncated_title_disagrees_with_the_PDF_Info_/Title
  Scenario: A truncated title gives one finding against the PDF /Title
    # Gap: the title says the finding is a disagreement with /Title; the body checks only the count, not what the finding says.
    Given an entry titled "Algorithmic Approaches to" whose PDF Info /Title is the full title
    When its title's plausibility is checked
    Then there is exactly one finding

  @test:scripts/tests/library/check-library-qa.test.ts::title-implausible::extraction_damage_alone_does_not_count_as_disagreement
  Scenario: Case and hyphenation damage is not disagreement
    Given an upper-cased, hyphen-broken title of the same words as its PDF /Title
    When its title's plausibility is checked
    Then there is no finding
    And two titles differing by one inserted word are more than 0.9 similar

  @test:scripts/tests/library/check-library-qa.test.ts::title-implausible::an_authoring_tool's_file_name_in_/Title_is_not_a_source_title
  Scenario: An authoring tool's file name in /Title is not usable
    Then "Microsoft Word - draft3.docx" is not a usable source title
    And "JSON-LD 1.1" is

  @test:scripts/tests/library/check-library-qa.test.ts::reading_an_entry::the_Dublin_Core_record_outranks_the_PDF_Info_/Title_(iris-dspace_R8)
  Scenario: The Dublin Core title is read ahead of the PDF /Title
    Given an entry with a catalogue Dublin Core record (title and issued date) and a PDF structure with a /Title
    When its facts are read
    Then its source titles come in the order dc.title, metadata.docinfo.Title
    And its readable year is "1993" and nothing is unreadable

  @test:scripts/tests/library/check-library-qa.test.ts::reading_an_entry::a_PDF_source_with_no_extraction_to_read_is_could-not-determine,_never_a_pass
  Scenario: A PDF source with no structure.json is unreadable
    Given an entry whose source is a PDF and that holds no structure.json
    When its facts are read
    Then the unreadable files are exactly structure.json

  @test:scripts/tests/library/check-library-qa.test.ts::reading_an_entry::an_unparseable_structure.json_is_could-not-determine
  Scenario: An unparseable structure.json is unreadable
    Given an entry whose structure.json is not JSON
    When its facts are read
    Then one file is unreadable, because it "will not parse"

  @test:scripts/tests/library/check-library-qa.test.ts::reading_an_entry::a_text_source's_declared_title_is_a_source_title,_tagged_text-heading
  Scenario: A text source's title is a text-heading source title
    Given an entry over README.md whose manifest records title_source text-heading and a text structure titled "beans"
    When its facts are read
    Then nothing is unreadable
    And its one source title is tagged text-heading
    And its expected title is "beans" from text-heading

  @test:scripts/tests/library/check-library-qa.test.ts::reading_an_entry::the_page-1_parse_of_a_PDF_is_never_offered_as_a_source_title
  Scenario: A PDF's page-1 title parse is not a source title
    Given an entry whose PDF structure parsed "Abies" from page 1, with no /Title, and a slug title_source
    When its facts are read
    Then it has no source titles
    And its expected title is "abies" from slug

  @test:scripts/tests/library/check-library-qa.test.ts::judge_—_titles_against_their_provenance_(owner_ruling_2026-10-01)::a_slug-sourced_title_is_title-missing
  Scenario: A slug-sourced title is title-missing
    Given an entry whose manifest records title_source slug
    When the library is judged
    Then title-missing lists the entry, citing manifest.jsonld meta.title_source

  @test:scripts/tests/library/check-library-qa.test.ts::judge_—_titles_against_their_provenance_(owner_ruling_2026-10-01)::a_PDF_/Title_over_a_Dublin_Core_record_is_title-implausible_—_the_record_outranks_it
  Scenario: A PDF /Title used over a Dublin Core record is title-implausible
    Given an entry titled from pdf-info while a catalogue Dublin Core record gives another title
    When the library is judged
    Then a title-implausible finding mentions "from dc-record"

  @test:scripts/tests/library/check-library-qa.test.ts::judge_—_titles_against_their_provenance_(owner_ruling_2026-10-01)::the_resolver's_own_output_is_clean,_and_a_pdf-info_title_is_listed_as_self-declared
  Scenario: A pdf-info title matching /Title is clean and self-declared
    Given an entry titled from pdf-info, equal to its PDF /Title
    When the library is judged
    Then title-missing and title-implausible are empty
    And title-self-declared lists it with source pdf-info

  @test:scripts/tests/library/check-library-qa.test.ts::judge_—_titles_against_their_provenance_(owner_ruling_2026-10-01)::a_manifest_recording_no_title_source_is_title-implausible
  Scenario: A manifest recording no title_source is title-implausible
    Given an entry whose manifest records no title_source
    When the library is judged
    Then a title-implausible finding mentions "no meta.title_source"

  @test:scripts/tests/library/check-library-qa.test.ts::bibliographic-missing::both_halves_are_required
  Scenario: Both author/publisher and year are required
    Given declared facts with no agent and no year
    Then both "author/publisher" and "year" are missing
    And with a publisher but no year, only "year" is missing

  @test:scripts/tests/library/check-library-qa.test.ts::bibliographic-missing::an_explicit_reason_clears_it
  Scenario: An explicit reason clears missing bibliographic facts
    Given declared facts with no agent and no year, and a recorded reason
    Then nothing is missing

  @test:scripts/tests/library/check-library-qa.test.ts::bibliographic-missing::a_year_is_read_out_of_a_date
  Scenario: A year is read out of a date
    Then the year of "2013-12" is "2013"
    And the year of a ctime-style date in 2001 is "2001"
    And "v5.0.0" has no year

  @test:scripts/tests/library/check-library-qa.test.ts::judge_—_block-no-content::a_withheld_entry's_pages_carry_no_content_while_it_holds_words_—_a_finding_naming_why
  Scenario: A withheld entry's empty page blocks are one finding naming why
    Given a withheld entry with two page blocks that hold words
    When the library is judged
    Then block-no-content has one finding, of 2 blocks, withheld for "copyright refused"

  @test:scripts/tests/library/check-library-qa.test.ts::judge_—_block-no-content::the_same_entry,_not_withheld,_carries_its_text_and_is_clean
  Scenario: The same entry not withheld is clean
    Given an entry that is not withheld with two page blocks that hold words
    When the library is judged
    Then block-no-content is empty

  @test:scripts/tests/library/check-library-qa.test.ts::judge_—_block-no-content::a_heading-only_section_is_not_counted
  Scenario: An entry with a heading-only page is clean
    # Gap: the entry is not withheld, so its blocks carry content and the result would be empty whether or not an empty page is counted; the body does not isolate the heading-only case.
    Given an entry that is not withheld, one page empty and one holding words
    When the library is judged
    Then block-no-content is empty

  @test:scripts/tests/library/check-library-qa.test.ts::judge_—_block-no-content::the_summary_backlog_is_counted_per_entry
  Scenario: The summary backlog is counted per entry
    Given an entry with two unsummarised page blocks
    When the library is judged
    Then the summary-backlog finding for it counts 2
