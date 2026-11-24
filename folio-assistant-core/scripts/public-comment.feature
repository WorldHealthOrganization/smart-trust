Feature: the public comment store, its lifecycle and its change-sets

  @test:scripts/public-comment.test.ts::citation_parsing::lineRangesParsed
  Scenario: line ranges, in every way a reviewer writes them
    When line citations are parsed
    Then ranges with dashes, a shortened end, "l." and lists give their line ranges
    And no citation gives none

  @test:scripts/public-comment.test.ts::citation_parsing::captionRefsParsed
  Scenario: table and figure references
    When caption references are parsed
    Then tables and figures are normalised and plain lines give none

  @test:scripts/public-comment.test.ts::citation_parsing::sectionNumbersParsed
  Scenario: section numbers
    When section references are parsed
    Then §3.4.5, "Section 2.1." and "Appendix C" give their numbers

  @test:scripts/public-comment.test.ts::resolveAnchor::pageLinesLandOnParagraph
  Scenario: printed page and lines land on the paragraph, and the section agrees
    When section 1.1.2, page 9, lines 42-46 are resolved
    Then the paragraph is found by page and line with high confidence

  @test:scripts/public-comment.test.ts::resolveAnchor::secondPageOfBlock
  Scenario: a line on the second page of a block that crosses a page
    When page 21, line 3 is resolved
    Then the block that crosses onto that page is found

  @test:scripts/public-comment.test.ts::resolveAnchor::citedTableWins
  Scenario: a cited table is the table, whatever the line column says
    When "Table 2.2" in the lines column is resolved
    Then the table is found by caption

  @test:scripts/public-comment.test.ts::resolveAnchor::sectionAloneAnchorsSection
  Scenario: a section alone anchors to the section
    When section 3.4 alone is resolved
    Then it anchors to the section

  @test:scripts/public-comment.test.ts::resolveAnchor::quotationFound
  Scenario: a quotation is found in the text
    When a comment quoting the text is resolved
    Then the quoted paragraph is found

  @test:scripts/public-comment.test.ts::resolveAnchor::nothingIsUnplaced
  Scenario: nothing resolvable is unplaced, not guessed
    When a comment citing nothing is resolved
    Then it is unplaced

  @test:scripts/public-comment.test.ts::resolveAnchor::disagreeingSectionReported
  Scenario: a section that disagrees with the page is reported, not trusted
    When a section that disagrees with page and lines is resolved
    Then the confidence is low and the note says it does not agree

  @test:scripts/public-comment.test.ts::intake::commentMatrixIntake
  Scenario: the WHO comment matrix: reviewer block above, example row skipped
    When the WHO comment matrix is read
    Then one row is read with its reviewer and the example row is skipped

  @test:scripts/public-comment.test.ts::intake::formExportIntake
  Scenario: a form export: reviewer columns on every row
    When a form export is read
    Then the reviewer and the section come from each row

  @test:scripts/public-comment.test.ts::intake::narrativeSplitAtCitations
  Scenario: a narrative is split only where it cites something
    When a narrative letter is split
    Then there are three comments, the uncited text a general one
    And the others carry section 3.4 and page 9 lines 42-46

  @test:scripts/public-comment.test.ts::the_store_and_the_lifecycle::importNumbersNoEmail
  Scenario: import numbers comments, keeps the unplaced, and never writes an email
    When rows are imported
    Then comments PC-0001 and PC-0002 are created, the second unplaced
    And no email or name is written, and both share a reviewer id
    And the same rows imported again are already imported

  @test:scripts/public-comment.test.ts::the_store_and_the_lifecycle::movesAreDiagramTasks
  Scenario: every move is a task in the diagram its transition names
    When each transition's diagram is read
    Then it holds the named process and task

  @test:scripts/public-comment.test.ts::the_store_and_the_lifecycle::processCallsChangePhase
  Scenario: the public comment process calls its change phase
    When public-comment.bpmn is read
    Then it calls the change process

  @test:scripts/public-comment.test.ts::the_store_and_the_lifecycle::fullLifecycle
  Scenario: triage → assign → recommend → decide → edit (author) → incorporate
    When a comment is triaged, assigned, recommended, decided, edited and incorporated
    Then a not-accepted decision without a reason, and an edit without a branch, are refused
    And it ends incorporated with its change-set, assignees and full history
    And it cannot then be withdrawn

  @test:scripts/public-comment.test.ts::the_store_and_the_lifecycle::onlyAcceptedIncorporated
  Scenario: only an accepted decision is incorporated
    When a noted comment is edited or incorporated
    Then both are refused

  @test:scripts/public-comment.test.ts::the_store_and_the_lifecycle::reassignKeepsStatus
  Scenario: reassign moves the anchor and keeps the status
    When an unplaced comment is reassigned to a section
    Then it keeps status received and its anchor method becomes manual

  @test:scripts/public-comment.test.ts::the_store_and_the_lifecycle::listByPageSectionUnplaced
  Scenario: list by page and line, by section, and the unplaced
    When comments are listed by page and line, by section and unplaced
    Then each list gives the right comment and the summary counts them

  @test:scripts/public-comment.test.ts::GitHub_tags::githubTagParsed
  Scenario: parse
    When GitHub comment tags are parsed
    Then a pc tag with a recommendation gives refs, verb, code and text
    And untagged text gives null, a cs tag gives change-sets and #7 gives an issue
    And an unknown code is an error

  @test:scripts/public-comment.test.ts::GitHub_tags::ownerIsDefaultEditor
  Scenario: by default the editor is the repository's owner, and only the owner decides
    When a collaborator and the owner tag a decision with no editors configured
    Then the collaborator is refused and the owner's decision is applied

  @test:scripts/public-comment.test.ts::GitHub_tags::collaboratorsDefaultCommittee
  Scenario: by default the committee is the repository's collaborators
    When an outsider and a collaborator recommend with no committee configured
    Then the outsider is refused and the collaborator's recommendation applied
    And a decision by someone not an editor is refused

  @test:scripts/public-comment.test.ts::GitHub_tags::committeeRecommendsEditorDecides
  Scenario: a committee member recommends; only an editor decides; strangers are refused
    When committee members, strangers and editors tag comments
    Then a member's recommendation is applied and a member's decision refused
    And a stranger is refused and an editor's decision is recorded with its reason

  @test:scripts/public-comment.test.ts::a_consolidated_review_log_(the_DPI-H_master_log,_2026-10-05)::logCommentTypeAndLabels
  Scenario: the comment type is the COMMENT type, not the stakeholder type; the rest are labels
    When a consolidated review log is read
    Then five rows are read, the comment type kept apart from the stakeholder type, the rest as labels
    And reviewer names in either order match

  @test:scripts/public-comment.test.ts::a_consolidated_review_log_(the_DPI-H_master_log,_2026-10-05)::logStatusesRecordedNotDecided
  Scenario: the log's own statuses are recorded, never decisions: the comment arrives triaged with the log's words
    When the log is imported
    Then a log status is only a proposed decision
    And rows with a status arrive triaged with the log's words, never decided
    And the channel and reviewer name are kept and no email is written

  @test:scripts/public-comment.test.ts::a_consolidated_review_log_(the_DPI-H_master_log,_2026-10-05)::resentLogAddsNew
  Scenario: a re-sent copy of the same log adds only the rows it has not seen
    When a later copy of the log with one new row is imported
    Then five rows are known and one is created

  @test:scripts/public-comment.test.ts::a_consolidated_review_log_(the_DPI-H_master_log,_2026-10-05)::linesOnlyWhenSaid
  Scenario: a lines cell gives line numbers only when it says lines
    When lines cells are read
    Then ranges and L-numbers give lines, and requirement or annex numbers give none

  @test:scripts/public-comment.test.ts::a_consolidated_review_log_(the_DPI-H_master_log,_2026-10-05)::sectionByTitleOrAcronym
  Scenario: a section named by title or acronym, and a page with no usable line
    When sections are named by acronym or title and a page has no usable line
    Then the section is found by acronym and by title
    And the page alone resolves with medium confidence

  @test:scripts/public-comment.test.ts::change-sets_and_their_issues_(issue_#2183)::proposalHasNoIssue
  Scenario: an agent's proposal has no issue; the comment's change-sets are derived, never stored on it
    When the store's change-sets are read
    Then an agent's proposal has no issue
    And a comment's change-sets are derived, not stored on it
    And the seed lists the unassigned comments and the check finds no error

  @test:scripts/public-comment.test.ts::change-sets_and_their_issues_(issue_#2183)::discussFormAdoptsIssue
  Scenario: the Discuss form adopts its issue; a second issue on the same change-set is linked, not adopted
    When a Discuss form opens an issue, and a second issue names the same change-set
    Then the first issue is adopted and marked, with the discussion
    And the second is linked, the first noting it, and is not adopted

  @test:scripts/public-comment.test.ts::change-sets_and_their_issues_(issue_#2183)::decisionOpensIssue
  Scenario: a decision anywhere opens the change-set's issue, and says why there
    When a decision is tagged on a comment
    Then the change-set's issue is opened and says who decided what
    And a decision in that issue applies to the change-set's comments

  @test:scripts/public-comment.test.ts::change-sets_and_their_issues_(issue_#2183)::mentionLinksIssue
  Scenario: a mention links an issue to a change-set, and opens at most a few issues at once
    When an issue mentions a comment, and another mentions too many
    Then the first is linked to the change-set
    And too many mentions open no issue and say so

  @test:scripts/public-comment.test.ts::change-sets_and_their_issues_(issue_#2183)::commandsFromCommittee
  Scenario: commands change the record, from the committee only, and re-render it
    When a stranger and a committee member give change-set commands
    Then the stranger is refused
    And the member's add, remove, requirements, merge and split change the record and re-render it

  @test:scripts/public-comment.test.ts::change-sets_and_their_issues_(issue_#2183)::newChangeSetFromForm
  Scenario: a new change-set from the dashboard's picks: the form makes it and adopts its issue
    When the new change-set form is opened with picked comments
    Then a change-set is made with them and adopts the issue

  @test:scripts/public-comment.test.ts::change-sets_and_their_issues_(issue_#2183)::handEditReplaced
  Scenario: a hand edit of the rendered section is replaced; an edit below it is the person's own
    When the rendered section is edited by hand, then text is added below it
    Then the edit is replaced and the added text is kept as the person's own

  @test:scripts/public-comment.test.ts::change-sets_and_their_issues_(issue_#2183)::prClosesLinkedIssue
  Scenario: the PR that closes a linked issue: editing, then incorporated; closed unmerged goes back
    When a PR closing the linked issue is opened, closed unmerged, reopened and merged
    Then the change-set goes editing, back to discussing, and then incorporated, closing its issue

  @test:scripts/public-comment.test.ts::change-sets_and_their_issues_(issue_#2183)::mergeWithUndecidedStaysOpen
  Scenario: a merge with comments still undecided leaves the change-set open and its issue open (D-1, bean uphx)
    When a PR is merged while a comment is undecided
    Then the decided comment is incorporated, the change-set and issue stay open, and the log says so

  @test:scripts/public-comment.test.ts::change-sets_and_their_issues_(issue_#2183)::prLinksOnlyFromCommittee
  Scenario: a PR links change-sets only when its author is on the committee or an editor; a merge is allowed
    When PRs are opened by a stranger, by someone with no role, and by committee members
    Then the stranger's and the unauthorised PR link nothing
    And a committee member's PR links the change-set, and its merge incorporates it

  @test:scripts/public-comment.test.ts::change-sets_and_their_issues_(issue_#2183)::editByOtherRecordsNothing
  Scenario: an issue edited by someone other than its author records nothing
    When an issue is edited to add a decision by someone else, then by its author
    Then the other's edit records nothing and the author's decides

  @test:scripts/public-comment.test.ts::change-sets_and_their_issues_(issue_#2183)::onlyKeywordLinks
  Scenario: only a keyword links a PR to a change-set; a prose mention does not (bean 6xdf)
    When PR bodies are read for linked change-sets
    Then keyword links and a cs: line link, a prose mention does not

  @test:scripts/public-comment.test.ts::change-sets_and_their_issues_(issue_#2183)::settledNeverRelinked
  Scenario: a settled change-set is never re-linked by another PR, even one that names it with a keyword (bean 6xdf)
    When later PRs name an incorporated change-set
    Then it stays incorporated with its first PR and the log says it does not re-link

  @test:scripts/public-comment.test.ts::change-sets_and_their_issues_(issue_#2183)::writerKeepsSchema
  Scenario: the record writer keeps $schema (bean 6xdf)
    When a change-set record is written and saved again
    Then its $schema stays changeset/1.0.0

  @test:scripts/public-comment.test.ts::change-sets_and_their_issues_(issue_#2183)::reopenedBackToDiscussing
  Scenario: reopening an incorporated change-set's issue puts it back to discussing (CS-236/237)
    When an incorporated change-set's issue is reopened
    Then it is back to discussing

  @test:scripts/public-comment.test.ts::change-sets_and_their_issues_(issue_#2183)::closedByHandReopened
  Scenario: a primary issue closed by hand: reopened while comments still need a change; closed when none do
    When a primary issue is closed by hand while comments need a change, then after they are decided
    Then it is reopened the first time and the change-set closed the second

  @test:scripts/public-comment.test.ts::change-sets_and_their_issues_(issue_#2183)::installWritesTemplates
  Scenario: install writes the issue forms and workflows with the platform path filled, and keeps what is there
    When the templates are installed twice
    Then the issue forms and workflows are written with the platform path filled
    And the decision form has its labels and the second install keeps all five

  @test:scripts/public-comment.test.ts::change-sets_and_their_issues_(issue_#2183)::checkFindsContradictions
  Scenario: check finds contradictions; the reconcile opens an issue for a change-set decided outside GitHub
    When a proposed change-set has an issue and another is decided outside GitHub
    Then the check finds the contradiction and warns about the other
    And the reconcile plan opens an issue for it

  @test:scripts/public-comment.test.ts::change-sets_and_their_issues_(issue_#2183)::personReroutesCommittee
  Scenario: a person in the committee or editor lane can re-route a change-set to another committee with a reason; the move survives re-ingest, and agents cannot make it (bean se3i, issue #197)
    When a committee member re-routes a change-set with a reason, then again, then the store is re-ingested
    Then the committee and its move history are recorded and shown in the issue
    And the moves survive re-ingest
    And a move with no reason, to an unknown group, or by an outsider is refused
