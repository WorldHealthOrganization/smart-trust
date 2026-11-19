# IRIS extraction quality (owner, 2026-11-11, who-iris card Q-ODD-1 = A):
# failing pages go to OCR; errata and footnotes join the L1 document schema.
Feature: IRIS extraction quality

  @test:scripts/tests/library/iris-extraction.test.ts::failing_pages_go_to_OCR::no_failing_page,_no_OCR
  Scenario: No failing page, no OCR
    Given a probe with no page failing the text-layer check
    Then no page is sent to OCR

  @test:scripts/tests/library/iris-extraction.test.ts::failing_pages_go_to_OCR::a_few_failing_pages_in_a_document_with_an_outline:_OCR,_then_pdf-structure_--ocr
  Scenario: A few failing pages keep the outline
    Given a document with a usable outline and one failing page
    When it is planned
    Then the rung is pdf-ocr then pdf-structure --ocr

  @test:scripts/tests/library/iris-extraction.test.ts::failing_pages_go_to_OCR::most_pages_failing,_no_outline:_the_whole_document_from_OCR
  Scenario: Most pages failing and no outline
    Given a document with no outline and three of four pages failing
    Then the whole document is read from OCR by pdf-pages

  @test:scripts/tests/library/iris-extraction.test.ts::failing_pages_go_to_OCR::the_languages_reach_pdf-structure_as_well_as_pdf-ocr
  Scenario: The page check knows the document's languages
    Given a plan of pdf-ocr then pdf-structure
    When the languages fr,en are applied
    Then both steps end with --lang-hint fr,en

  @test:scripts/tests/library/iris-extraction.test.ts::failing_pages_go_to_OCR::the_Python_checks_hold_(scripts/tests/iris-extraction-quality.test.py)
  Scenario: The Python checks hold
    When iris-extraction-quality.test.py runs
    Then all its checks pass

  @test:scripts/tests/library/iris-extraction.test.ts::errata_in_the_L1_document_schema::an_erratum_names_where_it_is,_quotes_the_source,_and_carries_a_note
  Scenario: An erratum names where it is
    Given an erratum with a block, a quote, evidence and a draft note
    Then the schema accepts it
    And refuses one with neither block nor page, or two with one id

  @test:scripts/tests/library/iris-extraction.test.ts::errata_in_the_L1_document_schema::the_L1_check_reports_errata,_and_fails_on_a_block_the_entry_does_not_have
  Scenario: The L1 check reports errata
    Given an entry with one block
    Then no errata file is no requirement
    And a valid errata file is met
    And an erratum on a missing block is unmet

  @test:scripts/tests/library/iris-extraction.test.ts::footnotes_and_their_marks_in_the_L1_document_schema::a_footnote_is_called_from_the_text;_an_uncalled_note_is_kept_apart
  Scenario: A footnote is called from the text
    Given a footnote with one mark and an uncalled note
    Then the schema accepts it
    And refuses a footnote that no mark calls

  @test:scripts/tests/library/iris-extraction.test.ts::footnotes_and_their_marks_in_the_L1_document_schema::the_L1_check_reports_the_counts_and_refuses_another_entry's_file
  Scenario: The L1 check reports footnotes
    Given an entry with a footnotes file
    Then the requirement is met
    And a file naming another entry is unmet

  @test:scripts/tests/library/iris-extraction.test.ts::how_an_oversized_section_was_cut::every_way_pdf-structure.py_reports_is_one_the_schema_accepts
  Scenario: Every way pdf-structure.py reports an oversized cut is one the schema accepts
    # Gap: the Python is not run; the "by" values are read from its source text
    Given the source of "pdf-structure.py"
    When every "by = ..." value it writes is collected
    Then they are exactly "headings", "pages" and "running heads"
    And an oversized_split entry with each of them passes the PDF diagnostics schema
