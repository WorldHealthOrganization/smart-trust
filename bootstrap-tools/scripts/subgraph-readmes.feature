Feature: subgraph-readmes — one README per declared directory, from the declaration

  Background:
    Given a fixture instance "Demo" in a temporary directory declaring skills (titled "Skills", described "What to do."), notes (no title or description), kept (described "Hand written.") and gone (absent on disk)
    And skills holds a.md, pack/b.md and a README with text around an old generated region; notes holds a note; kept holds a hand-written README

  @test:scripts/subgraph-readmes.test.ts::splice::spliceCreatesRegionOnly
  Scenario: no README: a file holding only the region
    When "x" is spliced into no README
    Then the result is the begin marker, x, a blank line and the end marker

  @test:scripts/subgraph-readmes.test.ts::splice::spliceReplacesRegion
  Scenario: markers: the region is replaced and the rest kept
    When "new" is spliced into a README with text around a region holding "old"
    Then the region holds "new" followed by a blank line, and the text around it is kept

  @test:scripts/subgraph-readmes.test.ts::splice::spliceWithoutMarkersUndefined
  Scenario: no markers: undefined, meaning leave it alone
    When a body is spliced into a README written by a person with no markers
    Then the result is undefined

  @test:scripts/subgraph-readmes.test.ts::splice::blankLineBeforeEndMarker
  Scenario: a blank line stands before the end marker, so kramdown reads a closing table as a table
    When a table is spliced into no README, and into a README with an existing region
    Then in both results the table's last row is followed by a blank line before the end marker

  @test:scripts/subgraph-readmes.test.ts::splice::respliceIsStable
  Scenario: re-splicing is stable: the blank line is not doubled
    Given a table spliced into no README
    When the same table is spliced into that result
    Then the result is unchanged

  @test:scripts/subgraph-readmes.test.ts::splice::emptyRegionOneBlankLine
  Scenario: an empty region is the two markers around one blank line
    When an empty body is spliced into no README
    Then the result is the begin marker, one blank line and the end marker

  @test:scripts/subgraph-readmes.test.ts::plan,_on_a_fixture::headingFromDeclaration
  Scenario: heading and paragraph are the declared title and description
    When the READMEs are planned for the fixture
    Then the skills README has the heading "Skills" and the paragraph "What to do."
    And it says it is part of Demo, declared as skills, holding skills

  @test:scripts/subgraph-readmes.test.ts::plan,_on_a_fixture::textAroundMarkersSurvives
  Scenario: the text around the markers survives
    When the READMEs are planned for the fixture
    Then the skills README still starts "Intro above." and contains "Outro below."
    And the old region content is gone

  @test:scripts/subgraph-readmes.test.ts::plan,_on_a_fixture::tableEndsInBlankLine
  Scenario: the generated table ends in a blank line before the end marker — folio-assistant#2529
    When the READMEs are planned for the fixture
    Then in the skills README the line before the end marker is blank
    And the line before that is a table row

  @test:scripts/subgraph-readmes.test.ts::plan,_on_a_fixture::subdirectoryIsOneRow
  Scenario: files are described from themselves; a subdirectory is one row, with no count
    When the READMEs are planned for the fixture
    Then a.md's row reads "Does A."
    And pack/ is one row reading "holds `.md` files" — the kinds it holds, with no count

  @test:scripts/subgraph-readmes.test.ts::plan,_on_a_fixture::countsInPlan
  Scenario: the counts the README no longer prints are in the plan — bean ba9e
    When the READMEs are planned for the fixture
    Then the plan counts 1 file directly in skills and 1 in pack

  @test:scripts/subgraph-readmes.test.ts::plan,_on_a_fixture::missingReadmeCreated
  Scenario: a missing README is created; the heading falls back to the id
    When the READMEs are planned for the fixture
    Then the notes README starts with the generated front matter followed by the begin marker
    And its heading is "notes"
    And it says no description is declared for notes

  @test:scripts/subgraph-readmes.test.ts::plan,_on_a_fixture::gapsAreFindings
  Scenario: every gap is a finding, and a hand-written README is left untouched
    When the READMEs are planned for the fixture
    Then nothing is written to kept's README
    And the no-title findings are kept and notes
    And the no-description finding is notes
    And the absent-directory finding is gone
    And the unmarked-readme finding is kept

  @test:scripts/subgraph-readmes.test.ts::plan,_on_a_fixture::planningWritesNothing
  Scenario: nothing was written by planning
    When the READMEs are planned for the fixture
    Then the skills README on disk still holds the old region content
    And no notes README exists on disk

  @test:scripts/subgraph-readmes.test.ts::a_subdirectory_row_says_what_it_IS_when_the_caller_resolved_one::descriptionReplacesCount
  Scenario: the description replaces the count
    Given the caller resolves skills' subdirectory pack as "A bundle of related skills."
    When the READMEs are planned
    Then pack/'s row reads "A bundle of related skills."

  @test:scripts/subgraph-readmes.test.ts::a_subdirectory_row_says_what_it_IS_when_the_caller_resolved_one::countIsGone
  Scenario: and the count is GONE, not merely accompanied
    Given the caller resolves pack's description
    When the READMEs are planned
    Then the skills README does not contain "1 file"

  @test:scripts/subgraph-readmes.test.ts::a_subdirectory_row_says_what_it_IS_when_the_caller_resolved_one::nameFallbackHasNoCount
  Scenario: a name with no description falls back to a value that does not count
    Given the caller resolves only an unrelated subdirectory name, not pack
    When the READMEs are planned
    Then pack/'s row reads "holds `.md` files", read from what it holds

  @test:scripts/subgraph-readmes.test.ts::a_subdirectory_row_says_what_it_IS_when_the_caller_resolved_one::emptyDescriptionFallsBack
  Scenario: an empty string is not a description — it falls back
    Given the caller resolves pack with an empty description
    When the READMEs are planned
    Then pack/'s row reads "holds `.md` files", read from what it holds

  @test:scripts/subgraph-readmes.test.ts::a_README_is_invariant_under_adding_a_file_—_bean_ba9e::addingFileChangesNoReadme
  Scenario: adding a file under a subdirectory changes no README
    Given the skills README planned for the fixture
    When a file is added under skills/pack and the READMEs are planned again
    Then the skills README is unchanged

  @test:scripts/subgraph-readmes.test.ts::a_README_is_invariant_under_adding_a_file_—_bean_ba9e::addingFileMovesPlanCount
  Scenario: but the count in the plan moves
    Given a file added under skills/pack
    When the READMEs are planned again
    Then the plan counts 2 files in pack

  @test:scripts/subgraph-readmes.test.ts::over_the_list_limit,_the_summary_names_kinds,_never_numbers_—_bean_ba9e::overLimitNamesKinds
  Scenario: the kinds, in name order, and no count
    Given 151 more files in notes, alternately .txt and .md
    When the READMEs are planned
    Then the notes README says there are more than 150 files directly here, too many to list, of kinds .md and .txt
    And it does not print 151 or the per-kind counts

  @test:scripts/subgraph-readmes.test.ts::in_a_git_work_tree,_only_the_committed_tree_is_counted_—_bean_ba9e,_Train_6::untrackedFileNotCounted
  Scenario: an untracked file changes neither the README nor the counts
    Given the fixture committed in a git work tree, and its plan
    When untracked files are left in skills/pack and skills, and the READMEs are planned again
    Then the skills README and its counts are the same as before

  @test:scripts/subgraph-readmes.test.ts::in_a_git_work_tree,_only_the_committed_tree_is_counted_—_bean_ba9e,_Train_6::untrackedFileReported
  Scenario: it is reported, by path
    Given the same untracked files
    Then the untracked-not-counted finding for skills names demo/skills/pack/transient.md and demo/skills/stray.md

  @test:scripts/subgraph-readmes.test.ts::in_a_git_work_tree,_only_the_committed_tree_is_counted_—_bean_ba9e,_Train_6::stagedFileCounts
  Scenario: staging it is what makes it count
    When the untracked file in skills/pack is staged and the READMEs are planned again
    Then the plan counts 2 files in pack

  @test:scripts/subgraph-readmes.test.ts::a_wholly_generated_README_declares_itself_in_front_matter_—_owner_decision_4a,_2026-10-16::createdReadmeHasFrontMatter
  Scenario: a README created from nothing opens with it, then the region
    When the READMEs are planned for the fixture
    Then the notes README declares a generated key in its front matter
    And its first four lines are the front matter opening, a generated line naming scripts/subgraph-readmes.ts, the front matter closing and the begin marker

  @test:scripts/subgraph-readmes.test.ts::a_wholly_generated_README_declares_itself_in_front_matter_—_owner_decision_4a,_2026-10-16::partlyAuthoredNotGenerated
  Scenario: a partly authored README never claims to be generated
    When the READMEs are planned for the fixture
    Then the skills README declares no generated key in front matter

  @test:scripts/subgraph-readmes.test.ts::a_wholly_generated_README_declares_itself_in_front_matter_—_owner_decision_4a,_2026-10-16::regenerateIsFixedPoint
  Scenario: regenerating is a fixed point: no second block, nothing stale
    Given the planned notes README written to disk
    When the READMEs are planned again
    Then the notes README is identical
    And it has exactly two front matter fence lines

  @test:scripts/subgraph-readmes.test.ts::a_wholly_generated_README_declares_itself_in_front_matter_—_owner_decision_4a,_2026-10-16::authoredTextDropsFrontMatter
  Scenario: a page that gains authored text loses it
    Given the notes README written to disk with a line written by a person appended
    When the READMEs are planned again
    Then the notes README declares no generated key in front matter
    And it starts with the begin marker
    And it says the section was generated

  @test:scripts/subgraph-readmes.test.ts::a_wholly_generated_README_declares_itself_in_front_matter_—_owner_decision_4a,_2026-10-16::foreignFrontMatterKept
  Scenario: front matter somebody else wrote is kept as it is, and none is added
    Given a notes README with authored front matter (title and nav_order) followed by an empty region
    When the READMEs are planned again
    Then the notes README starts with that same front matter and the begin marker
    And it has exactly two front matter fence lines
    And it declares no generated key in front matter

  @test:scripts/subgraph-readmes.test.ts::an_undeclared_subdirectory_is_described_from_itself_—_owner,_2026-11-18::manifestNamedAfterDirectory
  Scenario: a manifest named after the subdirectory describes it by its doc comment's first paragraph
    Given skills holds paper/paper.ts whose doc comment opens "A Paper Title" above a paragraph of prose
    When the READMEs are planned for the fixture
    Then paper/'s row reads "A Paper Title (from paper.ts)"

  @test:scripts/subgraph-readmes.test.ts::an_undeclared_subdirectory_is_described_from_itself_—_owner,_2026-11-18::selfDescribingJsonTitleWins
  Scenario: a self-describing JSON file's title wins over another's paragraph, and a pipe cannot break the row
    Given skills holds doc/manifest.json titled "On | Pipes" and doc/summary.json with a brief
    When the READMEs are planned for the fixture
    Then doc/'s row reads "On \| Pipes (from manifest.json)"

  @test:scripts/subgraph-readmes.test.ts::an_undeclared_subdirectory_is_described_from_itself_—_owner,_2026-11-18::structureJsonIsNotADirectoryDescription
  Scenario: a library entry's structure.json is not read as a description of its directory
    Given skills holds entry/structure.json with a title and nothing else
    When the READMEs are planned for the fixture
    Then entry/'s row is described by the kinds of file it holds, not by that title

  @test:scripts/subgraph-readmes.test.ts::an_undeclared_subdirectory_is_described_from_itself_—_owner,_2026-11-18::readmeFirstParagraph
  Scenario: a subdirectory README is read for its first paragraph of prose
    Given skills holds told/README.md with front matter, a comment, a banner, a heading and a paragraph
    When the READMEs are planned for the fixture
    Then told/'s row links its README and reads the paragraph's first sentence, from README.md

  @test:scripts/subgraph-readmes.test.ts::an_undeclared_subdirectory_is_described_from_itself_—_owner,_2026-11-18::readmeHeadingWhenNoProse
  Scenario: a README with no paragraph of prose is read for its heading
    Given skills holds titled/README.md with a heading and a list
    When the READMEs are planned for the fixture
    Then titled/'s row reads the heading, from README.md

  @test:scripts/subgraph-readmes.test.ts::an_undeclared_subdirectory_is_described_from_itself_—_owner,_2026-11-18::kindsInNameOrder
  Scenario: with nothing to read, the row names the kinds of file it holds, in name order
    Given skills holds mixed/ with a .lean and a .ts file
    When the READMEs are planned for the fixture
    Then mixed/'s row reads "holds .lean and .ts files"

  @test:scripts/subgraph-readmes.test.ts::an_undeclared_subdirectory_is_described_from_itself_—_owner,_2026-11-18::declaredStillWins
  Scenario: a description the caller resolved still wins over one read from the subdirectory
    When the READMEs are planned with paper/ declared "Declared."
    Then paper/'s row reads "Declared." with no source

  @test:scripts/subgraph-readmes.test.ts::many_subdirectories_fold_under_a_disclosure,_every_row_kept_—_owner,_2026-11-18::foldedUnderDetails
  Scenario: more subdirectories than the limit fold under a details disclosure, every row kept
    Given notes holds one more subdirectory than the limit
    When the READMEs are planned for the fixture
    Then the notes README holds a details disclosure with a subdirectory table naming every one

  @test:scripts/subgraph-readmes.test.ts::many_subdirectories_fold_under_a_disclosure,_every_row_kept_—_owner,_2026-11-18::filesStayAboveTheFold
  Scenario: the file table stays above the fold
    When the READMEs are planned for the fixture
    Then n.md's row comes before the disclosure

  @test:scripts/subgraph-readmes.test.ts::many_subdirectories_fold_under_a_disclosure,_every_row_kept_—_owner,_2026-11-18::foldPrintsNoCount
  Scenario: the fold says expand, never how many — bean ba9e
    When the READMEs are planned for the fixture
    Then the notes README does not print the number of subdirectories

  @test:scripts/subgraph-readmes.test.ts::a_directory's_visualisers,_as_the_caller_resolved_them_—_owner,_2026-11-18::linkedWhenResolved
  Scenario: a resolved visualiser is linked under the "Part of" line
    When the READMEs are planned with skills rendered by a visualiser at an address, and owing one
    Then the skills README links it after "See it rendered:"
    And there is no no-visualiser finding

  @test:scripts/subgraph-readmes.test.ts::a_directory's_visualisers,_as_the_caller_resolved_them_—_owner,_2026-11-18::owedAndMissingIsAFinding
  Scenario: a directory that owes a visualiser and has none says so, and is a finding
    When the READMEs are planned with skills owing a visualiser and none resolved
    Then the skills README says no visualiser renders it though its kind needs one
    And the no-visualiser finding is skills

  @test:scripts/subgraph-readmes.test.ts::a_directory's_visualisers,_as_the_caller_resolved_them_—_owner,_2026-11-18::notOwedAndMissingIsSilent
  Scenario: a directory that owes none and has none says nothing
    When the READMEs are planned with skills owing no visualiser and none resolved
    Then the skills README does not mention a visualiser
    And there is no no-visualiser finding

  @test:scripts/subgraph-readmes.test.ts::a_directory's_visualisers,_as_the_caller_resolved_them_—_owner,_2026-11-18::unresolvedAddressIsPrintedAndAFinding
  Scenario: a visualiser with no address prints could not determine, and is a finding
    When the READMEs are planned with skills rendered by a visualiser whose address is undetermined
    Then the skills README prints its title and could not determine its address, with the reason
    And the unresolved-visualiser finding is skills

  @test:scripts/subgraph-readmes.test.ts::a_directory's_visualisers,_as_the_caller_resolved_them_—_owner,_2026-11-18::callerSaidNothing
  Scenario: a caller that resolved no visualisers gets no line and no finding
    When the READMEs are planned for the fixture
    Then the skills README has no "See it rendered" line
    And there is no no-visualiser finding
