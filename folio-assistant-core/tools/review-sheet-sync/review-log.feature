Feature: a review log archived into the repository, and an offline copy imported back

  @test:tools/review-sheet-sync/review-log.test.ts::review-log_archive_(#682)::roles_come_from_the_header_colours,_as_the_sheet's_legend_says
  Scenario: a column's role comes from its header colour
    Given a review sheet whose header row sits under an instructions row, coloured grey, blue, orange and green
    When the sheet is read
    Then the header row is the second
    And the columns' roles are script, human, human, editor, agent and human
    And no colour, or white, gives no role

  @test:tools/review-sheet-sync/review-log.test.ts::review-log_archive_(#682)::a_feedback_basis_like_2:245177_stays_text,_never_a_time
  Scenario: a feedback basis like 2:245177 stays text
    When a cell holding "2:245177" is read
    Then its value is the text "2:245177"
    And a cell holding a number is read as that number

  @test:tools/review-sheet-sync/review-log.test.ts::review-log_archive_(#682)::private_tabs_are_left_out_and_email_addresses_removed
  Scenario: private tabs are left out and email addresses are removed
    Given a sheet with a review tab, a Watch tab and a Public Comment Source tab
    When it is read for the archive and redacted
    Then only the review tab is kept
    And the submitter email column is emptied and the two addresses in a note and a cell are replaced by "[email removed]"

  @test:tools/review-sheet-sync/review-log.test.ts::review-log_archive_(#682)::the_workbook_round-trips_its_values_and_is_byte-identical_when_rebuilt
  Scenario: the archived workbook round-trips and rebuilds byte-identical
    When the same log is written to a workbook twice
    Then the two files are byte-identical
    And reading one back gives the tab's name and values
    And the workbook carries the cells' notes as comments

  @test:tools/review-sheet-sync/review-log.test.ts::review-log_archive_(#682)::one_file_per_log,_overwritten_only_when_it_changed,_the_commit_message_lists_the_cells
  Scenario: one archive file per log, rewritten only when it changed
    When a log is archived for the first time
    Then it is written to review/public-comment/logs/<log>.xlsx with a review-log/1.0.0 node recording each column's role
    And archiving it again unchanged changes nothing
    And after one cell is changed and one row added, the commit message counts them and lists the changed cell with its old and new value

  @test:tools/review-sheet-sync/review-log.test.ts::review-log_archive_(#682)::diffLogs_keys_rows_by_their_id,_not_their_position
  Scenario: rows are compared by their id, not their position
    Given two copies of a tab whose rows are reordered and one cell changed
    When they are compared
    Then the only change is that cell, under its row's id
    And the commit message says one cell changed
    And a header row under a one-cell title row is the second

  @test:tools/review-sheet-sync/review-log.test.ts::review-log_import_(#683)::the_returned_file_must_match_the_template
  Scenario: a returned file must match the log's template
    When a returned file with another tab is checked
    Then it is reported as not this log's template
    And the import plans no writes

  @test:tools/review-sheet-sync/review-log.test.ts::review-log_import_(#683)::numbers_are_hints:_same_number_and_title_adds;_another_title_conflicts;_same_words_is_a_duplicate;_new_is_numbered_by_the_master
  Scenario: change-set numbers in a returned copy are hints
    Given a returned copy with a row of the same number and title, one of the same number and another title, one of another number and the same words, and an unnumbered row
    When it is checked
    Then they are an add, a conflict, a possible duplicate of the master's row and a new row
    And the review list names the possible duplicate
    And importing the add and the new row writes the add's human cell and puts the new row below the master's last, never writing the editor's column
    And importing the conflict is refused

  @test:tools/review-sheet-sync/review-log.test.ts::review-log_import_(#683)::a_filled_cell_may_only_be_extended_offline,_unless_the_base_copy_shows_who_changed_it
  Scenario: a filled cell may only be extended offline
    Given a master row with a filled cell
    When a returned copy replaces that cell's text
    Then it is a conflict
    And a returned copy that extends that text is an add
    And with a base copy where the cell was empty, a change in both is a conflict
    And with the returned copy equal to the base, the row is unchanged

  @test:tools/review-sheet-sync/review-log.test.ts::review-log_import_(#683)::the_PDF_feedback_template:_page_and_line_are_checked_against_the_frozen_review_version
  Scenario: the PDF feedback template's page and line are checked against the frozen review version
    Given a map of the review version's printed pages and their lines
    When a citation of a printed page and a line range, or a line inside a table reference, is checked
    Then there is no problem
    And a line not on that page, and a page not in the review version, are each reported
    And titles differing only in case are fully similar
    And an intake CSV quotes a comment holding commas and quotes
