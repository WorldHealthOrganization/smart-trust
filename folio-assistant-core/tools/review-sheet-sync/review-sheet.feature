Feature: the review sheet script, built and run against a fake sheet

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs,_built_and_run_against_a_fake_sheet::noTemplatePlaceholderLeft
  Scenario: the built script has no template placeholder left
    When the script is built
    Then no placeholder or stamp is left, and it states its version and commit
    And it offers "Which version is this?", declares @OnlyCurrentDoc and uses no fetch, mail or file service

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs,_built_and_run_against_a_fake_sheet::rpcNoLinksCommentPage
  Scenario: RPC No. links to the comment's page, and stays a number
    When Review Public Comments is refreshed
    Then each No. is a HYPERLINK to its comment's page that shows the number

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs,_built_and_run_against_a_fake_sheet::rpcSectionsLinkPdfPages
  Scenario: RPC Sections link each section and chapter to its first PDF page
    When Review Public Comments is refreshed
    Then each section and chapter links its first PDF page
    And a row with no known section has no link

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs,_built_and_run_against_a_fake_sheet::rpcPageAtOffset
  Scenario: RPC Page links printed pages at the printed-to-PDF offset
    When Review Public Comments is refreshed
    Then each printed page links the PDF page at the printed-to-PDF offset

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs,_built_and_run_against_a_fake_sheet::rpcLinesToPage
  Scenario: RPC lines go to the page that holds them
    When Review Public Comments is refreshed
    Then each cited line links the PDF page that holds it

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs,_built_and_run_against_a_fake_sheet::rcsJoinsComments
  Scenario: RCS joins its comments, each No. n linking to its RPC row, status bold
    When Review Change Sets is refreshed
    Then its Public Comments cell joins its comments, each No. n linking its row, with the status bold
    And suggested revisions, committee feedback and dispositions are joined the same way

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs,_built_and_run_against_a_fake_sheet::rcsSectionsPagesUnion
  Scenario: RCS Sections and Pages are the union over its comments, linked
    When Review Change Sets is refreshed
    Then its Sections and Pages are the union over its comments, linked where known

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs,_built_and_run_against_a_fake_sheet::agenticStatusBothTabs
  Scenario: Agentic status, on both tabs, is each PR linked, its status and completion time bold, and what it changed
    When both tabs are refreshed
    Then Agentic status lists each PR linked, its status and completion time bold, and what it changed

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs,_built_and_run_against_a_fake_sheet::noPrStatusAlone
  Scenario: with no PR, Agentic status is the status alone
    When a change set with no PR is refreshed
    Then Agentic status is the status alone

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs,_built_and_run_against_a_fake_sheet::quoteCannotBreakFormula
  Scenario: security: a quote in No. cannot break out of the HYPERLINK formula
    Given a No. holding a quote and an IMPORTXML call
    When the sheet is refreshed
    Then the quotes are doubled inside the HYPERLINK, so no formula escapes

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs,_built_and_run_against_a_fake_sheet::oldDataNamesWork
  Scenario: a Config written with the old short DATA names (K, ABBR, LP, OFFSET, MAX) still works
    When the Config is written with the old short DATA names
    Then the script writes exactly what it writes with the new names

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs,_built_and_run_against_a_fake_sheet::filterStatusPlain
  Scenario: Agentic status (filter) holds one plain status per change set, for a filter view
    When Review Change Sets has an Agentic status (filter) column
    Then it holds one plain status per change set

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs,_built_and_run_against_a_fake_sheet::colourKeyRowNoChange
  Scenario: a Colour key row above RPC's and RCS's headers changes nothing the script writes
    When a Colour key row is added above both tabs' headers
    Then Review Public Comments is written the same and Review Change Sets only shifts its row links by one

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs,_built_and_run_against_a_fake_sheet::architectFeedbackHeaderWorks
  Scenario: a sheet still headed Architect Feedback (the name before 2026-10-31) works the same
    When the tabs are still headed Architect Feedback
    Then the committee feedback is joined the same

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs,_built_and_run_against_a_fake_sheet::renameMarksNothingStale
  Scenario: renaming Architect Feedback to Committee Feedback marks no proposal stale
    Given a proposal whose basis was made under the Architect Feedback headers
    When the headers are renamed Committee Feedback
    Then the proposal is not stale and Ready for agent is not written
    And a changed feedback cell then marks it stale and sets Ready for agent to No

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs,_built_and_run_against_a_fake_sheet::slowSheetFlagsStaleAtOnce
  Scenario: on a slow sheet, an edit of Review Change Sets flags a stale proposal at once, before the timer
    Given a slow sheet and a changed committee feedback cell
    When Review Change Sets is edited
    Then the sheet is marked dirty and the proposal is flagged stale at once

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs,_built_and_run_against_a_fake_sheet::readyShownAtOnce
  Scenario: an Editor setting Ready for agent shows in the agent's feedback at once, even on a slow sheet (owner, 2026-10-31)
    Given a slow sheet
    When an Editor sets Ready for agent, and in another run edits another column
    Then the time is recorded and the agent's feedback says the agent will act on it
    And editing another column records no time

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs,_built_and_run_against_a_fake_sheet::oneAgentTabWorks
  Scenario: a sheet with both agent tables on one Agent tab, as before 2026-10-31, works the same
    When both agent tables are on one Agent tab
    Then both review tabs are written the same

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs,_built_and_run_against_a_fake_sheet::quickRebuildAtOnce
  Scenario: an edit rebuilds at once while a rebuild is quick
    When an edit is made while rebuilds are quick
    Then the sheet is rebuilt at once and not marked dirty

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs,_built_and_run_against_a_fake_sheet::slowRebuildMarksDirty
  Scenario: once a rebuild is slow, an edit marks the sheet dirty, and the timer rebuilds once
    Given rebuilds are slow
    When the source tab and then the agent tab are edited, then the timer runs
    Then the source edit marks nothing, the agent edit marks the sheet dirty
    And the timer rebuilds once and clears the mark

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs,_built_and_run_against_a_fake_sheet::timerRebuildsOnAgentChange
  Scenario: the agent's API writes to Agent fire no edit, so the timer rebuilds when Agent changed, and only then
    When the timer runs, runs again with nothing changed, then runs after the agent's API changed a cell
    Then it rebuilds the first time, not the second, and again the third

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs_in_drafting_mode::draftingNoTabsMessage
  Scenario: in a sheet without its tabs it stops with a plain message
    When the drafting script runs in a sheet without its tabs
    Then it stops saying the Config is for a drafting sheet with no Contributor Feedback tab

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs_in_drafting_mode::draftingNoConfigMessage
  Scenario: without a Config tab it says so
    When it runs without a Config tab
    Then it says there is no Config tab

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs_in_drafting_mode::tabInstructionsShortRows
  Scenario: each tab's Instructions say how that tab works, in the sheet's own words, and the Config tab's are short rows
    When the drafting Config rows are read
    Then the first rows are the instructions for the sheet, the script, the dropdown and the editors, then Key
    And each says how its tab works, including the install steps, Google's warning and its help link, in at most 10 lines
    And the public-comment Config has no dropdown instructions and the Contributor Feedback notes describe its columns

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs_in_drafting_mode::scriptSameForEveryDocument
  Scenario: the script is the same for every document: nothing of the folio is in it
    When the script and the Config rows are read
    Then the script holds nothing of the folio
    And the Config holds only instructions, Key, an empty EDITORS and data rows, with CFG in drafting mode

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs_in_drafting_mode::scriptPlainAscii
  Scenario: the built script is plain ASCII, so a paste cannot mangle it
    When the built script is read
    Then it is plain ASCII

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs_in_drafting_mode::tocChaptersSections
  Scenario: the TOC has chapters and sections, without commas, each with its anchor
    When the TOC is written
    Then it lists chapters and indented sections, without commas, each with its open link
    And the TOC tab is hidden

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs_in_drafting_mode::nextIdForUsedRow
  Scenario: a used row without a Change-set gets the next id; an empty row does not
    When Contributor Feedback is refreshed
    Then used rows get CS-004 and CS-005 and the empty row nothing

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs_in_drafting_mode::sectionLinksPerPick
  Scenario: Section links has each picked section linked, one per line; unknown picks are left out; Sections is not rewritten
    When Contributor Feedback is refreshed
    Then Section links has each picked section linked, one per line, without unknown picks
    And Sections is not rewritten

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs_in_drafting_mode::selectedSectionsKeptValid
  Scenario: Selected Sections is kept valid: a bare pick gets its mark, a gone one is flagged in Section links
    When Contributor Feedback is refreshed
    Then a bare pick gets its indent mark and a gone pick is flagged in Section links
    And the TOC is written with the section's row

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs_in_drafting_mode::agentTocRowsMatchScript
  Scenario: the agent's TOC rows are the ones the script's refresh writes, so a linked copy's dropdown works before the script is pasted
    When the agent's TOC rows are made from the drafting Config
    Then they equal the rows the script writes
    And the public-comment Config has none

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs_in_drafting_mode::oldMarkRewritten
  Scenario: a pick with the old └ mark is rewritten to the indented name
    When a pick carries the old └ mark
    Then it is rewritten to the indented name

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs_in_drafting_mode::renamedPickFollowsAnchor
  Scenario: a pick of a section renamed since follows it, by its anchor
    When a pick names a section renamed since
    Then it follows the anchor to the new name

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs_in_drafting_mode::editorsLockReady
  Scenario: EDITORS locks each Ready column to the owner and those emails; empty leaves the owner alone
    When EDITORS lists two emails and one invalid entry, then is emptied
    Then each Ready column is locked to the owner and the two emails, and the invalid entry is reported
    And a second refresh keeps two locks, and empty EDITORS leaves the owner alone

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs_in_drafting_mode::yesAfterCompletion
  Scenario: a Yes first seen on a row the agent already completed counts from that completion
    When a Yes is first seen on a row the agent already completed
    Then it counts from that completion and the status is not Waiting

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs_in_drafting_mode::filledRowGetsId
  Scenario: any filled row gets a Change-set; one holding only No does not
    When rows are filled, one holding only No
    Then every filled row gets a Change-set except the one holding only No

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs_in_drafting_mode::instructionsRowAboveHeader
  Scenario: an Instructions row above the header changes nothing the script writes, and edits and locks start below it
    When an Instructions row is added above the header
    Then the script writes the same and locks start below it
    And an edit of the instructions row rebuilds nothing, and an edit below it rebuilds that row

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs_in_drafting_mode::editRebuildsOnlyItsRows
  Scenario: an edit rebuilds only its rows; an Agent change reaches its change set's row on the timer
    When a row is edited, then the timer runs with nothing changed, then with an Agent change
    Then only the edited row is rebuilt
    And the timer rebuilds nothing, then only the changed change set's row

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs_in_drafting_mode::staleOnBlueChange
  Scenario: the agent's proposal is flagged stale once a blue cell changes, and unflagged when it matches again
    When a blue cell changes, then is set back with the stale text kept
    Then the proposal is flagged stale, then unflagged when it matches again

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs_in_drafting_mode::feedbackAgentColumnRead
  Scenario: the agent column under its new name, Feedback (agent), is read the same, and never counts as a person's feedback
    When the agent column is named Feedback (agent)
    Then it is not stale at first and goes stale when the title changes

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs_in_drafting_mode::newEmptyColumnNoStale
  Scenario: a new empty feedback column marks nothing stale, and a basis written the older way still matches
    When a basis written the older way is used, then a new empty feedback column is added
    Then neither marks the proposal stale

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs_in_drafting_mode::staleSetsReadyNoOnce
  Scenario: a proposal turning stale sets Ready for agent back to No, once, so an Editor's new Yes stays
    When the proposal turns stale, then an Editor sets Yes again
    Then Ready for agent is set to No once
    And the new Yes stays

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs_in_drafting_mode::stagingStaleWhenPrChanged
  Scenario: the staging review link is marked stale when a PR changed after the preview was built
    When the preview was built before the PR changed, then after
    Then the staging review link is marked stale with the build time
    And then it is the plain review link

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs_in_drafting_mode::stagingComparesCommits
  Scenario: the staging review link compares commits when the agent records them
    When the agent records the built commit, the PR head and the deploy state
    Then the link is plain when they match and stale when they differ
    And a deploy in progress, waiting, building, failed or not ready for merge is said in words

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs_in_drafting_mode::pcEditKeptWhenLocked
  Scenario: a public-comment edit is kept for the next tick when the rebuild cannot start
    When a public-comment rebuild cannot take the lock, then can
    Then the dirty mark is kept and nothing is written
    And on the next tick it rebuilds and clears the mark

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs_in_drafting_mode::dispositionBlurbFromAgent
  Scenario: the change set's Dispositions blurb is shown from the Agent tab (owner, 2026-10-31)
    When the Agent tab carries a Disposition for the change set
    Then it is shown in Disposition (agent)

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs_in_drafting_mode::oneDispositionPerComment
  Scenario: each comment of the change set needs one disposition; an overall statement is allowed (owner, 2026-10-31)
    When dispositions are checked
    Then a complete set with an overall statement and a decision history passes
    And missing, wrongly worded, foreign and doubled numbers are each flagged
    And unconfirmed and disagreeing dispositions are flagged against the people's Disposition

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs_in_drafting_mode::typedTextNeverFormula
  Scenario: security: text a person or the agent typed is never written back as a formula
    When a proposal and a pick holding formulas are refreshed
    Then the proposal's formula stays text
    And the pick is written with a leading quote

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs_in_drafting_mode::largePasteRebuildsAll
  Scenario: security: a large paste rebuilds everything rather than overflow a property
    When a paste of 50000 rows is marked
    Then no row list is stored and everything is rebuilt

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs_in_drafting_mode::filterStatusDrafting
  Scenario: Agentic status (filter) holds the change set's plain status, for a filter view
    When Contributor Feedback has an Agentic status (filter) column
    Then it holds the change set's plain status

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs_in_drafting_mode::issueAndStatusFromAgent
  Scenario: Issue and Agentic status come from the Agent tab by change set
    When Contributor Feedback is refreshed
    Then Issue links the change set's issue and Agentic status lists its PR
    And a row with no change set has no issue

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs_in_drafting_mode::stagingReviewFromAgent
  Scenario: Staging review links the change set's preview, from the Agent tab
    When Contributor Feedback is refreshed
    Then Staging review links the change set's preview, and is empty for a row without one

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs_in_drafting_mode::feedbackOrAgentEditRefreshes
  Scenario: an edit to Contributor Feedback or Agent refreshes at once; another tab's does not
    When the Config tab and then Contributor Feedback are edited
    Then the Config edit refreshes nothing and the Contributor Feedback edit refreshes at once

  @test:tools/review-sheet-sync/review-sheet.test.ts::review-sheet.gs_in_drafting_mode::agentColumnNotPeoplesFeedback
  Scenario: the agent's Contributor Feedback (agent) column is neither people's feedback nor makes a row used
    When a row holds only the agent's proposal
    Then it gets no Change-set

  @test:tools/review-sheet-sync/review-sheet.test.ts::a_"2:"_basis:_a_proposal_also_goes_stale_on_the_grey_content_its_comments_join_(#348)::greyBasisStaleOnJoinedCell
  Scenario: a 2: basis is stale when a joined grey cell changes, and not when it does not
    Given a 2: basis
    When a joined grey cell changes
    Then the proposal goes stale, and not before

  @test:tools/review-sheet-sync/review-sheet.test.ts::a_"2:"_basis:_a_proposal_also_goes_stale_on_the_grey_content_its_comments_join_(#348)::greyBasisIgnoresAgentColumns
  Scenario: the agent's own columns are not part of it
    Given a 2: basis
    When the agent's own column changes
    Then the proposal is not stale

  @test:tools/review-sheet-sync/review-sheet.test.ts::a_"2:"_basis:_a_proposal_also_goes_stale_on_the_grey_content_its_comments_join_(#348)::olderBasisIgnoresGrey
  Scenario: an older basis (no 2:) ignores grey content, and still goes stale on a blue cell
    Given an older basis without 2:
    When a grey cell changes, then a blue cell
    Then the grey change leaves the proposal current and the blue change makes it stale

  @test:tools/review-sheet-sync/review-sheet.test.ts::sheet-sync_URLs_relative_to_the_folio's_site::urlsResolveAgainstIriBase
  Scenario: resolve against the layer's iriBase, so a move to another org changes one line
    Given a folio whose layer declares an iriBase and a relative section URL
    When the Config is built
    Then the section URL is resolved against the iriBase

  @test:tools/review-sheet-sync/review-sheet.test.ts::sheet-sync_URLs_relative_to_the_folio's_site::absoluteKeptRelativeNeedsBase
  Scenario: an absolute URL is kept; a relative one without an iriBase says what is missing
    When the Config is built with an absolute URL, then with a relative one and no iriBase
    Then the absolute URL is kept
    And the relative one throws saying no iriBase is declared

  @test:tools/review-sheet-sync/review-sheet.test.ts::the_Config_tab's_rows::configRowsReadableJson
  Scenario: are indented JSON a person can read, and read back the same
    When the Config rows are read back
    Then CFG is indented JSON and CFG, COLS and DATA parse back to the same values

  @test:tools/review-sheet-sync/review-sheet.test.ts::the_Config_tab's_rows::longValueCutBetweenLines
  Scenario: a long value is cut between lines, and every cell fits
    When a long JSON value is cut into chunks
    Then it is cut at line starts into cells of at most 40000 characters and 40 lines
    And the chunks join back to the same JSON

  @test:tools/review-sheet-sync/review-sheet.test.ts::the_Config_tab's_rows::readableShortListsOneLine
  Scenario: readable() keeps short lists on one line and means the same as JSON
    When values are written readably
    Then short lists stay on one line and the text parses to the same value

  @test:tools/review-sheet-sync/review-sheet.test.ts::the_Config_tab's_rows::oneLongLineStillCut
  Scenario: a single line longer than a cell is still cut and still parses
    When a single 90000-character line is cut
    Then it gives three chunks that join back to the same JSON

  @test:tools/review-sheet-sync/review-sheet.test.ts::the_colour_key_in_Instructions_text::keyPhrasesColouredWhole
  Scenario: each key phrase on the first line is coloured whole, in key order, naming no colour
    When the colour key's first line is coloured
    Then each key phrase is coloured whole, in key order, with four colours and naming none

  @test:tools/review-sheet-sync/review-sheet.test.ts::the_colour_key_in_Instructions_text::columnNamesColouredLikeHeader
  Scenario: column names are coloured like their header, whole words, longest first
    When the column names in the Instructions are coloured
    Then each takes its header's key colour, whole words, without overlapping runs

  @test:tools/review-sheet-sync/review-sheet.test.ts::the_colour_key_in_Instructions_text::headerFillsMapToKey
  Scenario: header fills map to the key colour
    When header fills are mapped
    Then blue, orange, green and grey fills map to their group and white to none

  @test:tools/review-sheet-sync/review-sheet.test.ts::the_colour_key_in_Instructions_text::plainTextNoRuns
  Scenario: text without a colour word or column name gets no runs
    When text with no colour word or column name is coloured
    Then it gets no runs

  @test:tools/review-sheet-sync/review-sheet.test.ts::a_copy_that_is_not_linked_to_a_repository_yet::unlinkedCopySaysSo
  Scenario: says so, with this sheet's ID, instead of failing on a missing row
    When the script runs in a copy whose Config has no rows of its own
    Then it stops asking the agent to link this sheet, with its ID

  @test:tools/review-sheet-sync/review-sheet.test.ts::a_copy_that_is_not_linked_to_a_repository_yet::toastLeadsShort
  Scenario: the toast leads with the action and is short enough not to be cut off (owner, 2026-11-01)
    When the unlinked toast is read
    Then it leads with the action and is under 100 characters

  @test:tools/review-sheet-sync/review-sheet.test.ts::a_copy_that_is_not_linked_to_a_repository_yet::unlinkedFirstLineOnce
  Scenario: an unlinked sheet says what to do first on the first line of each tab's Instructions, once
    When an unlinked sheet is set up twice
    Then each tab's Instructions open with one step-1 warning, keeping the rest

  @test:tools/review-sheet-sync/review-sheet.test.ts::a_copy_that_is_not_linked_to_a_repository_yet::linkedUninstalledInstallStep
  Scenario: linked but not installed: the line moves on to Install, and the links appear
    When a linked sheet without the script installed is set up
    Then the first line moves on to step 2, Install

  @test:tools/review-sheet-sync/review-sheet.test.ts::a_copy_that_is_not_linked_to_a_repository_yet::installedShowsLinks
  Scenario: once installed, the warning goes and the document's site and repository are shown
    When an installed sheet is set up twice
    Then the warning is gone and the document's site, repository and Folio Assistant page are shown

  @test:tools/review-sheet-sync/review-sheet.test.ts::the_colour_key_under_a_setup_line::colourKeyUnderSetupLine
  Scenario: is still coloured segment by segment when a ⚠ line sits above it
    When the colour key sits under a setup line
    Then its runs are the same, shifted by the setup line

  @test:tools/review-sheet-sync/review-sheet.test.ts::linking_a_copied_template_(owner,_2026-11-01:_make_it_mechanical)::sheetIdFromLinkOrId
  Scenario: a sheet link or a bare id gives the spreadsheet id
    When a sheet link and a bare id are read
    Then both give the spreadsheet id and other text throws

  @test:tools/review-sheet-sync/review-sheet.test.ts::linking_a_copied_template_(owner,_2026-11-01:_make_it_mechanical)::pagesSiteNamesRepo
  Scenario: a GitHub Pages site names its repository; another host names none
    When sites are read for their repository
    Then a GitHub Pages site names its repository and another host or none names nothing

  @test:tools/review-sheet-sync/review-sheet.test.ts::linking_a_copied_template_(owner,_2026-11-01:_make_it_mechanical)::draftingSheetSyncFromName
  Scenario: a drafting sheet-sync.json follows from the document's name
    When the drafting settings are made for dth-phc and a sheet link
    Then they name the document's anchors, section URL and sheet id

  @test:tools/review-sheet-sync/review-sheet.test.ts::linking_a_copied_template_(owner,_2026-11-01:_make_it_mechanical)::configShowsSiteRepoSettings
  Scenario: the Config tab shows the site, the repository and the settings file, from repository or iriBase
    Given a folio declaring a GitHub Pages iriBase
    When the Config is built
    Then it carries the site and repository URLs
    And its links lines name the document, repository and settings file, before Key

  @test:tools/review-sheet-sync/review-sheet.test.ts::the_Config_tab's_colours::configTabColours
  Scenario: Key is a Grey header, EDITORS Orange, and the agent's rows (CFG, COLS, DATA) Grey
    When the sheet is refreshed
    Then Key is grey, EDITORS orange and the agent's rows light grey, with Instructions uncoloured

  @test:tools/review-sheet-sync/review-sheet.test.ts::running_the_script_from_the_editor::installNeverWaitsOnDialog
  Scenario: Install never waits on a dialog, which hangs a run started from the editor (owner, 2026-10-31)
    When the script's functions are searched for alert dialogs
    Then only showAbout and showVersion use one

  @test:tools/review-sheet-sync/review-sheet.test.ts::running_the_script_from_the_editor::installTriggersFirst
  Scenario: installTriggers is the first function, so the editor's Run button picks it
    When the script's first function is read
    Then it is installTriggers

  @test:tools/review-sheet-sync/review-sheet.test.ts::running_the_script_from_the_editor::helperRunByHandSaysWhich
  Scenario: a helper run by hand says which function to run instead
    When a helper is run by hand
    Then it says to pick installTriggers

  @test:tools/review-sheet-sync/review-sheet.test.ts::the_Watch_hash_on_a_public-comment_sheet_(owner,_2026-11-04)::refreshWritesCellsHash
  Scenario: the refresh writes Cells hash to Watch!F1:I1
    When a public-comment sheet is refreshed
    Then Watch!F1:I1 holds Cells hash, the hash and the check time

  @test:tools/review-sheet-sync/review-sheet.test.ts::the_Watch_hash_on_a_public-comment_sheet_(owner,_2026-11-04)::personCellChangesHash
  Scenario: a person-set cell on either tab changes it
    When person-set cells on either tab change
    Then the hash changes

  @test:tools/review-sheet-sync/review-sheet.test.ts::the_Watch_hash_on_a_public-comment_sheet_(owner,_2026-11-04)::editWritesHashAtOnce
  Scenario: an edit writes it at once, even when a slow sheet leaves the rebuild to the timer (owner, 2026-11-05)
    Given a slow sheet
    When Review Change Sets is edited
    Then the sheet is marked dirty and the hash is written at once

  @test:tools/review-sheet-sync/review-sheet.test.ts::the_Watch_hash_on_a_public-comment_sheet_(owner,_2026-11-04)::heartbeatHash
  Scenario: a timer tick with nothing to rebuild still writes it, as a heartbeat
    When a timer tick has nothing to rebuild
    Then the hash is still written

  @test:tools/review-sheet-sync/review-sheet.test.ts::the_Watch_hash_on_a_public-comment_sheet_(owner,_2026-11-04)::insertAndAgentNoHashChange
  Scenario: an inserted row, the agent's columns and the script's do not
    When a row is inserted and the agent's and script's columns change
    Then the hash is unchanged

  @test:tools/review-sheet-sync/review-sheet.test.ts::the_committed_Code.gs_people_copy::distCodeCurrent
  Scenario: dist/Code.gs is current: run build-review-sheet-script.ts --dist after changing review-sheet.gs
    When the committed dist/Code.gs is compared with a fresh build
    Then they are equal

  @test:tools/review-sheet-sync/review-sheet.test.ts::the_committed_Code.gs_people_copy::installLinksStubAndLibrary
  Scenario: the install steps link the stub and the library, not the whole script
    When the install instructions are read
    Then they link the stub and the library, not the whole script

  @test:tools/review-sheet-sync/review-sheet.test.ts::Ready_for_agent_after_the_preview_was_built_(owner,_2026-10-31)::stagingWarnsReadyAfterBuild
  Scenario: Staging review warns when Ready for agent was set after the build
    When the staging warning is computed with no Ready, a Ready after the build and one before
    Then only the Ready after the build warns of missing feedback

  @test:tools/review-sheet-sync/review-sheet.test.ts::Ready_for_agent_after_the_preview_was_built_(owner,_2026-10-31)::feedbackSaysWherePr
  Scenario: the agent's feedback says where the PR and preview are (owner, 2026-10-31)
    When progress lines are made for the PR and preview states
    Then each says where the PR and preview are, whether the agent is late, will merge or is waiting on the QA gate
    And a merged PR or none gives no line

  @test:tools/review-sheet-sync/review-sheet.test.ts::Ready_for_agent_after_the_preview_was_built_(owner,_2026-10-31)::progressReplacedInPlace
  Scenario: the progress line is replaced in place, below a stale mark, and never added to an empty cell
    When the progress line is put into feedback cells
    Then it goes on top, replaces an old one below a stale mark, and an empty line removes it
    And an empty cell stays empty

  @test:tools/review-sheet-sync/review-sheet.test.ts::Ready_for_agent_after_the_preview_was_built_(owner,_2026-10-31)::agenticQueuedThenWho
  Scenario: Agentic status says the row is queued, then who has it
    When Agentic status is made while queued, while an agent has a step, and while working
    Then it says it is waiting since the Ready, then which agent since when
    And times are labelled today, yesterday or days ago, and an older step still reads as waiting
    And a working agent links its conversation and a done row starts with its PR

  @test:tools/review-sheet-sync/review-sheet.test.ts::the_library_stub_each_sheet_keeps_(owner,_2026-10-31:_library,_latest_code)::stubCallsExist
  Scenario: every library function the stub calls exists in Code.gs
    When the library functions the stub calls are looked for
    Then each exists in Code.gs

  @test:tools/review-sheet-sync/review-sheet.test.ts::the_library_stub_each_sheet_keeps_(owner,_2026-10-31:_library,_latest_code)::menuAndTriggersInStub
  Scenario: every menu item and trigger handler names a stub function
    When the menu items and trigger handlers are read
    Then there are more than three and each names a stub function

  @test:tools/review-sheet-sync/review-sheet.test.ts::the_library_stub_each_sheet_keeps_(owner,_2026-10-31:_library,_latest_code)::distStubCurrent
  Scenario: dist/Stub.gs is current
    When dist/Stub.gs is compared with stub.gs
    Then they are equal

  @test:tools/review-sheet-sync/review-sheet.test.ts::the_QA_gate_before_Ready_for_merge_(owner,_2026-10-31)::qaPassOnlyForHead
  Scenario: a pass counts only for the PR's head commit
    When the QA gate is read for a pass at the head, an older commit, no commit, a failure, nothing and junk
    Then only a pass naming the PR's head commit counts, each other case saying why
    And with no PR there is nothing to say

  @test:tools/review-sheet-sync/review-sheet.test.ts::the_QA_gate_before_Ready_for_merge_(owner,_2026-10-31)::stagingLinksQaReport
  Scenario: Staging review links the QA report and shows the gate
    When the staging cell is made with a QA report
    Then it links the review and the QA report and shows the gate

  @test:tools/review-sheet-sync/review-sheet.test.ts::the_library's_Update_from_GitHub_(owner,_2026-10-31,_option_B)::updaterDistCurrent
  Scenario: dist/Updater.gs and dist/library-appsscript.json are current
    When dist/Updater.gs and dist/library-appsscript.json are compared with their sources
    Then they are equal

  @test:tools/review-sheet-sync/review-sheet.test.ts::the_library's_Update_from_GitHub_(owner,_2026-10-31,_option_B)::updaterRecognisesCode
  Scenario: it recognises the published Code.gs, and nothing else
    When files are checked for being the published Code.gs
    Then only the published Code.gs is recognised

  @test:tools/review-sheet-sync/review-sheet.test.ts::the_library's_Update_from_GitHub_(owner,_2026-10-31,_option_B)::updaterFetchesBuiltFile
  Scenario: it fetches the file it was built beside, and the manifest grants what it calls
    When the updater and its manifest are read
    Then it fetches the raw Code.gs it was built beside
    And the manifest grants script projects and external requests

  @test:tools/review-sheet-sync/review-sheet.test.ts::Needs_human_says_what_the_person_must_do_(owner,_2026-10-31)::needsHumanOpensWithAsk
  Scenario: Agentic status opens with the ask
    When Agentic status is made for Needs human
    Then its first line asks the person to answer the Decision needed and set Ready for agent

  @test:tools/review-sheet-sync/review-sheet.test.ts::only_the_tags_are_bold_in_the_agent's_feedback_(owner,_2026-11-01)::decisionTagBold
  Scenario: the Decision needed tag is bold, its question and options are not
    When the agent's feedback with a decision block is styled
    Then only the tags and the No. reference are bold

  @test:tools/review-sheet-sync/review-sheet.test.ts::only_the_tags_are_bold_in_the_agent's_feedback_(owner,_2026-11-01)::statusTagsBold
  Scenario: the status line bolds its tag only
    When status lines are styled
    Then only their tags are bold, and an option's parenthesis is not

  @test:tools/review-sheet-sync/review-sheet.test.ts::the_ask_comes_first_in_the_agent's_feedback_(owner,_2026-11-01)::bareProposalReviewAsk
  Scenario: a bare proposal gets the review ask on top
    When a bare proposal gets its progress line
    Then it opens asking for a review of the proposed direction

  @test:tools/review-sheet-sync/review-sheet.test.ts::the_ask_comes_first_in_the_agent's_feedback_(owner,_2026-11-01)::noDecisionNoAskLine
  Scenario: no Decision needed block, no Decision needed status line
    When a Needs you line is added to feedback without a Decision needed block
    Then the line is dropped

  @test:tools/review-sheet-sync/review-sheet.test.ts::the_ask_comes_first_in_the_agent's_feedback_(owner,_2026-11-01)::decisionKeepsAskLine
  Scenario: a real Decision needed block keeps its status line
    When it is added to feedback with a Decision needed block
    Then the line is kept on top

  @test:tools/review-sheet-sync/review-sheet.test.ts::the_timer_runs_every_minute_(owner,_2026-10-31)::timerMovesToOneMinute
  Scenario: a sheet on the old 5-minute timer moves itself to 1 minute, once
    When a sheet on the 5-minute timer is upgraded twice
    Then the old timer is removed and a 1-minute one made, once

  @test:tools/review-sheet-sync/review-sheet.test.ts::one_agent_column,_status_on_top_(owner,_2026-10-31,_option_A)::statusBlockLines
  Scenario: the block is the ⏳ line and one linked line per PR
    When the status block is made
    Then it is the ⏳ line and one linked line per PR

  @test:tools/review-sheet-sync/review-sheet.test.ts::one_agent_column,_status_on_top_(owner,_2026-10-31,_option_A)::statusBlockReplaces
  Scenario: it replaces the old block and never stacks, under the stale mark
    When the status block is put into a cell twice under a stale mark
    Then it replaces the old block and does not stack

  @test:tools/review-sheet-sync/review-sheet.test.ts::one_agent_column,_status_on_top_(owner,_2026-10-31,_option_A)::peoplesAskShows
  Scenario: the people's ask shows when they must answer
    When the status block is made for Needs human
    Then it carries the ask

  @test:tools/review-sheet-sync/review-sheet.test.ts::one_agent_column,_status_on_top_(owner,_2026-10-31,_option_A)::missingDispositionCompact
  Scenario: a missing disposition names the comments compactly
    When comment numbers are named
    Then they are grouped compactly in order

  @test:tools/review-sheet-sync/review-sheet.test.ts::Ready_for_agent:_Yes,_No,_Completed_(owner,_2026-10-31)::completedAfterPushAndPreview
  Scenario: Completed once the agent pushed after the Ready and the preview of it is live
    When the agent pushed after the Ready and the preview is live
    Then Ready for agent becomes Completed

  @test:tools/review-sheet-sync/review-sheet.test.ts::Ready_for_agent:_Yes,_No,_Completed_(owner,_2026-10-31)::notCompletedWhileRestaging
  Scenario: not while the preview is restaging, nor before the agent has acted
    When the preview is restaging, or the agent has not acted since the Ready
    Then Ready for agent is left alone

  @test:tools/review-sheet-sync/review-sheet.test.ts::Disposition_(agent)_shows_its_structure_(owner,_2026-10-31)::dispositionLabelsBold
  Scenario: labels and disposition words are bold
    When the disposition cell is styled
    Then its labels and disposition words are bold

  @test:tools/review-sheet-sync/review-sheet.test.ts::structured_overflow_lines_(owner,_2026-10-31)::semicolonsBullets
  Scenario: a; b; c becomes one bullet per line
    When "a (No. 326); b; c" and one item are turned into description text
    Then the list becomes one bullet per line and one item stays inline

  @test:tools/review-sheet-sync/review-sheet.test.ts::structured_overflow_lines_(owner,_2026-10-31)::labelsAndNoRefsBold
  Scenario: line-start labels and No. references are bold
    When overflow lines with labels and No. references are styled
    Then the labels and the references are bold

  @test:tools/review-sheet-sync/review-sheet.test.ts::hover_text_on_every_column_head_(owner,_2026-10-31)::everyHeadHasNote
  Scenario: every column of the six sheets' known heads has a note
    When the hover notes of every known column head are read
    Then each has a note, and Disposition mentions the committee only on the public-comment tab

  @test:tools/review-sheet-sync/review-sheet.test.ts::hover_text_on_every_column_head_(owner,_2026-10-31)::noNoteNamesColour
  Scenario: no note names a colour
    When the hover notes are read
    Then none names a colour

  @test:tools/review-sheet-sync/review-sheet.test.ts::hover_text_on_every_column_head_(owner,_2026-10-31)::knownHeadsNoted
  Scenario: known heads get their note; an unknown head keeps its own, and loses an old script note
    When the header notes are written to a tab with known, own and old-script notes
    Then known heads get their note, a person's own note is kept and an old script note is cleared

  @test:tools/review-sheet-sync/review-sheet.test.ts::a_PR's_change_list_may_run_over_several_lines_(owner,_2026-10-31)::prChangeListKeptTogether
  Scenario: bullets and a label line stay with their PR
    When PR descriptions are split
    Then bullets and a label line stay with their PR

  @test:tools/review-sheet-sync/review-sheet.test.ts::a_PR's_change_list_may_run_over_several_lines_(owner,_2026-10-31)::labelHeadsBullets
  Scenario: the label heads the bullets
    When a labelled bullet list is turned into description text
    Then the label heads the bullets

  @test:tools/review-sheet-sync/review-sheet.test.ts::unconfirmed_dispositions_are_flagged_and_block_the_merge_(owner,_2026-10-31,_option_A)::unconfirmedListed
  Scenario: a comment whose committee Disposition is Pending or empty is listed
    When dispositions are checked against Pending and empty committee dispositions
    Then those comments are listed as not confirmed, and none is with no committee disposition

  @test:tools/review-sheet-sync/review-sheet.test.ts::unconfirmed_dispositions_are_flagged_and_block_the_merge_(owner,_2026-10-31,_option_A)::mergeWaitsForConfirmed
  Scenario: Ready for merge waits for confirmed dispositions
    When Ready for merge is set while dispositions are not confirmed
    Then the line says it will not merge until every disposition is complete and confirmed

  @test:tools/review-sheet-sync/review-sheet.test.ts::Dispositions_confirmed,_an_Editor's_multi-select_(owner,_2026-10-31)::confirmedNosParsed
  Scenario: Yes (or All) confirms every comment; No none; typed numbers confirm those
    When Dispositions confirmed is read as All, Yes, No and typed numbers
    Then All and Yes confirm every comment, No none, and typed numbers those

  @test:tools/review-sheet-sync/review-sheet.test.ts::Dispositions_confirmed,_an_Editor's_multi-select_(owner,_2026-10-31)::confirmedNotFlagged
  Scenario: confirmed comments are no longer flagged; a stray number is
    When confirmed comments are checked
    Then they are no longer flagged, and a confirmed number outside the change set is

  @test:tools/review-sheet-sync/review-sheet.test.ts::rows_on_the_people's_tabs_are_at_most_10_lines_high_(owner,_2026-10-31)::rowLinesFromWidth
  Scenario: lines are estimated from the column width
    When row heights are estimated
    Then a tall cell gives 10 lines and a short one 1

  @test:tools/review-sheet-sync/review-sheet.test.ts::rows_on_the_people's_tabs_are_at_most_10_lines_high_(owner,_2026-10-31)::consecutiveRowsOneCall
  Scenario: consecutive rows are set in one call
    When rows 9, 3, 4 and 5 are grouped
    Then they give the runs 3 to 5 and 9

  @test:tools/review-sheet-sync/review-sheet.test.ts::the_⏳_line_says_where_the_agent_is_(owner,_2026-10-31)::newerStepShows
  Scenario: a step newer than the last push shows, with its time
    When the agent's step is newer than the last push
    Then the ⏳ line shows it with its time

  @test:tools/review-sheet-sync/review-sheet.test.ts::the_⏳_line_says_where_the_agent_is_(owner,_2026-10-31)::idleOlderUnknownNothing
  Scenario: idle, an older step, or an unknown word shows nothing new
    When the step is idle, an unknown word, or older than the push
    Then nothing new is shown

  @test:tools/review-sheet-sync/review-sheet.test.ts::the_⏳_line_says_where_the_agent_is_(owner,_2026-10-31)::questionFirst
  Scenario: a question for a person comes first
    When a row needs a human answer while the agent has a step
    Then the ⏳ line asks the person first

  @test:tools/review-sheet-sync/review-sheet.test.ts::the_⏳_line_says_where_the_agent_is_(owner,_2026-10-31)::toolStepsKnown
  Scenario: every step the tool writes is one the sheet knows
    When the steps agent-record writes are compared with the sheet's
    Then each is known

  @test:tools/review-sheet-sync/review-sheet.test.ts::the_status_line_comes_back_after_the_agent_rewrites_its_cell_(owner,_2026-10-31)::ownLinesNotAgentChange
  Scenario: the script's own lines do not count as the agent's change
    When the script's own lines are removed from a cell
    Then only the agent's text is left

  @test:tools/review-sheet-sync/review-sheet.test.ts::the_status_line_comes_back_after_the_agent_rewrites_its_cell_(owner,_2026-10-31)::draftedProposalSaysReady
  Scenario: a drafted proposal says to set Ready for agent
    When the agent has proposed
    Then the ⏳ line says the proposal is ready and to set Ready for agent

  @test:tools/review-sheet-sync/review-sheet.test.ts::data_rows_look_like_data_rows_(owner,_2026-10-31:_"why_row_3_bold")::headerLookRowRestored
  Scenario: a row that took the header's look gets the last row's format back; plain rows are left
    When the data rows' formats are checked
    Then the one row that took the header's look gets a plain row's format back, and the others are left

  @test:tools/review-sheet-sync/review-sheet.test.ts::Agentic_status_sits_left_of_its_filter_column_(owner,_2026-10-31)::statusMovedBeforeFilter
  Scenario: moves it from after Issue to just before the filter
    When Agentic status sits after Issue
    Then it is moved to just before its filter column

  @test:tools/review-sheet-sync/review-sheet.test.ts::Agentic_status_sits_left_of_its_filter_column_(owner,_2026-10-31)::titleRowUnmergedRemerged
  Scenario: unmerges the title row (B1) for the move and merges it again, keeping its text
    When the column is moved under a merged title row
    Then the title is unmerged, the column moved, and the title merged again with its text

  @test:tools/review-sheet-sync/review-sheet.test.ts::Agentic_status_sits_left_of_its_filter_column_(owner,_2026-10-31)::alreadyPlacedLeft
  Scenario: leaves it when it is already there
    When Agentic status already sits before its filter
    Then nothing moves

  @test:tools/review-sheet-sync/review-sheet.test.ts::the_Selected_Sections_dropdown_reminder_(core#472)::multiPickRowsNamed
  Scenario: names the rows holding two sections, which a single-pick rule marks Invalid
    When the Selected Sections cells are checked
    Then the rows holding two sections are named

  @test:tools/review-sheet-sync/review-sheet.test.ts::the_Selected_Sections_dropdown_reminder_(core#472)::reminderSkippedOnlyWhenDone
  Scenario: two picks are not taken as proof the tick is on: the reminder is skipped only when the person said it is done
    When the reminder's code is read
    Then it is skipped only when the person said the dropdown is done, never on two picks

  @test:tools/review-sheet-sync/review-sheet.test.ts::the_Selected_Sections_dropdown_reminder_(core#472)::reminderToLog
  Scenario: the reminder also goes to the execution log, for an Install run from the editor
    When the reminder's code is read
    Then it logs the message as well as showing it

  @test:tools/review-sheet-sync/review-sheet.test.ts::the_Folio_Assistant_menu_and_version_check_(owner,_2026-11-01)::menuFolioAssistant
  Scenario: the menu is named Folio Assistant and has an About item
    When the menu is added
    Then it is Folio Assistant with refresh, install, version and About

  @test:tools/review-sheet-sync/review-sheet.test.ts::the_Folio_Assistant_menu_and_version_check_(owner,_2026-11-01)::configCarriesNewestBuild
  Scenario: the Config tab carries the newest build, and a matching sheet says it is up to date
    When the version is shown with no newest build, then with a matching one
    Then the Config carries the newest build
    And without it the dialog points at the copy page, and a match says it is up to date with the project link

  @test:tools/review-sheet-sync/review-sheet.test.ts::the_Folio_Assistant_menu_and_version_check_(owner,_2026-11-01)::olderSheetToldNewBuild
  Scenario: an older sheet is told a new build is available and how to get it
    When the version is shown on a sheet older than the newest build
    Then it says a new build is available and how to get it

  @test:tools/review-sheet-sync/review-sheet.test.ts::Needs_you_only_with_a_question_(Q-FBK-1_A)::keepsAskWithQuestion
  Scenario: keeps the line when the feedback holds a Decision needed block
    When the feedback holds a Decision needed block
    Then the Needs you line is kept

  @test:tools/review-sheet-sync/review-sheet.test.ts::Needs_you_only_with_a_question_(Q-FBK-1_A)::dropsAskWithoutQuestion
  Scenario: drops the Needs you line when there is no question
    When the feedback holds no question
    Then the Needs you line is dropped

  @test:tools/review-sheet-sync/review-sheet.test.ts::Needs_you_only_with_a_question_(Q-FBK-1_A)::dropsAskSubLineKeepsLink
  Scenario: drops the Needs you sub-line and keeps the PR link on the right text
    When the status block's ask sub-line is dropped
    Then the PR link stays on the PR's text

  @test:tools/review-sheet-sync/review-sheet.test.ts::Where_to_review_and_PR_links_(Q-FBK-3_A)::whereLinksPreview
  Scenario: links each selected section on the preview while there is one
    When the where-to-review line is made with a preview
    Then each selected section links its place on the preview

  @test:tools/review-sheet-sync/review-sheet.test.ts::Where_to_review_and_PR_links_(Q-FBK-3_A)::whereFallsBackPublished
  Scenario: falls back to the published draft, and flags no section
    When it is made with no preview, and with no section
    Then sections link the published draft, and no section is flagged

  @test:tools/review-sheet-sync/review-sheet.test.ts::Where_to_review_and_PR_links_(Q-FBK-3_A)::finishedRowNoWarning
  Scenario: a finished row with no section gets no warning; an open one does
    When it is made for a closed row, an open row and a reverted row
    Then the closed row gets nothing, the open row is warned and the reverted row still gets its sections

  @test:tools/review-sheet-sync/review-sheet.test.ts::Where_to_review_and_PR_links_(Q-FBK-3_A)::repoRefsLinked
  Scenario: every repo#n becomes a link
    When text with repo#n references is linked
    Then each becomes a link to its issue

  @test:tools/review-sheet-sync/review-sheet.test.ts::a_refresh_keeps_the_links_an_agent_put_in_its_feedback_(owner,_2026-11-01:_"Dont_know_where_link_is")::keptLinksFoundInOrder
  Scenario: each linked label is found again in the new text, in order
    When the agent's links are found again in new text
    Then each label is found in order

  @test:tools/review-sheet-sync/review-sheet.test.ts::a_refresh_keeps_the_links_an_agent_put_in_its_feedback_(owner,_2026-11-01:_"Dont_know_where_link_is")::goneLabelDropped
  Scenario: a label no longer in the text is dropped
    When a label is no longer in the text
    Then its link is dropped

  @test:tools/review-sheet-sync/review-sheet.test.ts::a_refresh_keeps_the_links_an_agent_put_in_its_feedback_(owner,_2026-11-01:_"Dont_know_where_link_is")::noRichTextNoRuns
  Scenario: a cell without rich text gives no runs
    When link runs are read from cells without rich text, with an error, and with runs
    Then the first two give none and the third gives only the linked run with text

  @test:tools/review-sheet-sync/review-sheet.test.ts::finished_change_sets_are_hidden_and_struck_through::finishedRowsHidden
  Scenario: Change merged and Closed rows are struck through across the row and hidden; others untouched
    When change sets are merged, open and closed
    Then the merged and closed rows are struck through and hidden, and remembered

  @test:tools/review-sheet-sync/review-sheet.test.ts::finished_change_sets_are_hidden_and_struck_through::reopenedRowShown
  Scenario: an unchanged row is not touched again, and a reopened row is shown with the line removed
    When a remembered row is unchanged and another is reopened
    Then the unchanged row is not touched and the reopened row is shown without the line

  @test:tools/review-sheet-sync/review-sheet.test.ts::people_make_change_sets_(Q-CS-1_C)::titleOnlyRowGetsId
  Scenario: a row with only a Title gets the next id over both tabs
    When a row holds only a Title
    Then it gets the next id over both tabs and the agent's other change set is appended

  @test:tools/review-sheet-sync/review-sheet.test.ts::people_make_change_sets_(Q-CS-1_C)::agentSetNotAddedTwice
  Scenario: an agent change set already on the sheet is not added again, and a typed Title is kept
    When the agent's change set is already on the sheet with the people's title
    Then nothing is given or appended

  @test:tools/review-sheet-sync/review-sheet.test.ts::people_make_change_sets_(Q-CS-1_C)::humanCsParsed
  Scenario: Change Set (human) takes ids, several ids or new
    When Change Set (human) is read as empty, one id, several ids, new and unknown
    Then it gives nothing, the ids, a new note, or a note that the id is not a change set

  @test:tools/review-sheet-sync/review-sheet.test.ts::Review_Change_Sets_rows_people_start,_in_a_run::runAddsIdAndAgentSet
  Scenario: a Title-only row gets an id and a new agent change set is added at the end
    When a sheet with a Title-only row and a new agent change set is refreshed
    Then the row gets CS-008 and the agent's change set is added with its title

  @test:tools/review-sheet-sync/review-sheet.test.ts::Title_opens_in_a_template's_whole-tab_lock_(Q-TBL-1_A)::addsTitleToExceptions
  Scenario: Title is added to a whole-tab lock's open ranges
    Given a tab locked whole with two open ranges, neither covering the Title column
    When the Title column is opened from the first data row
    Then the lock's open ranges are set once, to the two kept and a third in column B from that row

  @test:tools/review-sheet-sync/review-sheet.test.ts::Title_opens_in_a_template's_whole-tab_lock_(Q-TBL-1_A)::leavesAnOpenColumnAlone
  Scenario: a Title column already open is left alone
    Given a tab locked whole whose open ranges already cover the Title column from the first data row
    When the Title column is opened
    Then the lock's open ranges are not changed
