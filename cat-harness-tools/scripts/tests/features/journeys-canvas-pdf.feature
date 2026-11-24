# scripts/journeys/assets/canvas-pdf.js writes a workshop's canvas out as an editable,
# pre-filled PDF: an AcroForm field per key the browser keeps, filled with its answer,
# written by hand. Each Scenario names the test that executes it.
Feature: The canvas as an editable, pre-filled PDF

  @test:scripts/tests/journeys-canvas-pdf.test.ts::the_canvas_as_an_editable,_pre-filled_PDF::a_well-formed_PDF:_every_xref_offset_lands_on_its_object,_the_trailer_names_the_catalog,_all_ASCII_after_the_header
  Scenario: The PDF is well formed
    Given a canvas of a cover and a sixty-row sheet, and some kept answers
    When the PDF is written
    Then it starts with the PDF 1.7 header and ends with %%EOF
    And every xref entry's offset lands on its own object, and the trailer's size is the xref's count
    And every byte after the header comment is ASCII, so each stream's /Length is its byte count

  @test:scripts/tests/journeys-canvas-pdf.test.ts::the_canvas_as_an_editable,_pre-filled_PDF::an_AcroForm_with_every_field,_drawn_by_the_reader_(/NeedAppearances),_on_A3_landscape_pages;_a_long_sheet_runs_on
  Scenario: An AcroForm with every field, on A3 landscape pages
    Given the same canvas
    Then the catalog's AcroForm lists the fields, sets NeedAppearances and names Helvetica and ZapfDingbats
    And the pages are A3 landscape, at least two, the long sheet running on
    And there is one text field per write-in: two on the cover, sixty in the grid, one in the annex
    And an A4 canvas is written on A4 landscape pages

  @test:scripts/tests/journeys-canvas-pdf.test.ts::the_canvas_as_an_editable,_pre-filled_PDF::each_field_is_named_by_its_key_and_holds_the_browser's_answer:_text_in_UTF-16,_a_tick_/Yes,_a_choice_and_a_gap_row_as_a_radio_group
  Scenario: Each field is named by its key and holds the browser's answer
    Given the kept answers
    Then the country is a single-line text field whose value is its UTF-16 text, the use case a multi-line one with no value
    And a ticked option and a ticked grid cell are /Yes with their appearances, an unticked one /Off
    And a choice is a radio group whose parent holds /scale and whose kids are pilot (off) and scale (on)
    And the gap strip's row holds /part, and an annex question's field name has "_" for "."

  @test:scripts/tests/journeys-canvas-pdf.test.ts::the_canvas_as_an_editable,_pre-filled_PDF::the_page's_own_text_is_WinAnsi:_Latin_kept,_a_dash_in_its_code,_a_character_outside_it_a_question_mark
  Scenario: The page's own text is WinAnsi
    Given the cover's intro with an em dash, and a sheet titled in Chinese
    Then the dash is written as its WinAnsi code
    And each character outside WinAnsi is a question mark
