Feature: watching a review log and its repository's issues

  @test:tools/review-log-watch/watch.test.ts::review-log-watch::firstCheckAppendsUnlinked
  Scenario: first check: every open issue no row links is to append, pull requests and no-sheet issues left out
    When the first check runs over the sheet and issues
    Then the open issue no row links is to append, leaving out pull requests and no-sheet issues
    And it is a baseline that reports the opened issues

  @test:tools/review-log-watch/watch.test.ts::review-log-watch::sameInputUnchanged
  Scenario: same sheet and issues as the last check: unchanged, and no state is needed but the digest
    When the same sheet and issues are checked again
    Then the result is unchanged with the digest

  @test:tools/review-log-watch/watch.test.ts::review-log-watch::readyCellOrIssueUpdateChanges
  Scenario: an edited Ready for agent cell or an updated issue is a change; the agent's own column is not
    When the agent's column is edited, then Ready for agent and the issue are updated
    Then the agent's edit is unchanged
    And the update reports the updated issue and the changed cell

  @test:tools/review-log-watch/watch.test.ts::review-log-watch::closedIssueRowStruck
  Scenario: a closed issue is reported, and the row linking it is to hide and strike through
    When a linked issue is closed, and another issue disappears
    Then the closed issue is reported and its row is to strike through
    And the vanished issue is reported closed

  @test:tools/review-log-watch/watch.test.ts::review-log-watch::closedUnlinkedAppendedAuthorFilter
  Scenario: an existing closed issue no row links is appended as closed; an author filter leaves others' issues out
    When the first check runs with a closed unlinked issue and an author filter
    Then the closed issue is appended as closed and others' issues are left out

  @test:tools/review-log-watch/watch.test.ts::review-log-watch::appendedRowFillsThree
  Scenario: the appended row fills Title, the first Contributor Feedback column and Issue only
    When a row is made for an issue
    Then it fills only Title, the first feedback column and Issue

  @test:tools/review-log-watch/watch.test.ts::review-log-watch::appendedRowNextCsAndAgent
  Scenario: an appended row gets the next Change-set id and an Agent row with its Issue, since the script fills Issue from the Agent tab
    When issues are appended after rows CS-001 and CS-007
    Then they get CS-008 and CS-009 with Agent rows carrying their issues
    And without a Change-set column no Agent row is made

  @test:tools/review-log-watch/watch.test.ts::review-log-watch::insertedRowMovesBelow
  Scenario: a row someone inserts moves the rows below it, and nothing is reported but what changed
    When a blank row is inserted, then a cell changes, then an issue closes
    Then the insertion alone is unchanged
    And only the changed cell is reported, at its new row
    And the closed issue's row is its new row

  @test:tools/review-log-watch/watch.test.ts::review-log-watch::oldStateIsBaseline
  Scenario: state from before cells were keyed by Change-set id is taken as a baseline, not as changes
    When the last state keyed cells by row number
    Then it is taken as a baseline with no changes

  @test:tools/review-log-watch/watch.test.ts::review-log-watch::linksFromHeaderRow
  Scenario: links and cells are read from the header row, wherever it is
    When links and cells are read
    Then issues are read from the Issue column in full or short form, for this repository only
    And cells are keyed by Change-set id, or by row without one

  @test:tools/review-log-watch/watch.test.ts::review-log-watch::sheetHashIssueColumnOnly
  Scenario: with the sheet script's hash, a poll needs only the Issue column
    When the sheet is read with only its Issue column and a script hash
    Then the unlinked issue is appended
    And the same hash is unchanged and a new hash is reported

  @test:tools/review-log-watch/watch.test.ts::review-log-watch::peopleColumnsWake
  Scenario: a public-comment log: its people's columns wake it, the agent's do not (owner, 2026-11-04)
    When headers are checked for being watched
    Then the people's columns wake the watch and the agent's do not

  @test:tools/review-log-watch/watch.test.ts::review-log-watch::noIssueColumnChangeSetIssues
  Scenario: a read with no Issue column tracks only change-set issues, and reports them rather than appending rows
    When a public-comment log without an Issue column is checked
    Then nothing is appended, only change-set issues are tracked, and an unlinked one is reported
    And a committee feedback change is reported
    And with a label filter only labelled issues are appended

  @test:tools/review-log-watch/watch.test.ts::review-log-watch::summaryCleansText
  Scenario: summary skips form headings and empty answers, and cuts long text
    When summaries are made
    Then form headings and empty answers are skipped, long text is cut to 300 characters, and markup removed

  @test:tools/review-log-watch/watch.test.ts::review-log-watch::linksBecomeRuns
  Scenario: Markdown links become clickable runs over their label; bare URLs link themselves
    When rich summaries are made from Markdown links, bare URLs and a feedback cell
    Then link labels become link runs and bare URLs link themselves

  @test:tools/review-log-watch/watch.test.ts::review-log-watch::appendedRowCarriesLinks
  Scenario: an appended row carries its feedback cell's links
    When an issue with a link is appended
    Then its feedback cell carries the link run
