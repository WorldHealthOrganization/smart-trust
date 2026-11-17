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
    And pack/ is one row reading "nothing declares what this holds", with no count

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
    Then pack/'s row reads "nothing declares what this holds"

  @test:scripts/subgraph-readmes.test.ts::a_subdirectory_row_says_what_it_IS_when_the_caller_resolved_one::emptyDescriptionFallsBack
  Scenario: an empty string is not a description — it falls back
    Given the caller resolves pack with an empty description
    When the READMEs are planned
    Then pack/'s row reads "nothing declares what this holds"

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
