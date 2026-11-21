Feature: The review data of an IG change: its change set, outline and rendered impact

  @test:scripts/ig-review-data.test.ts::kramdownId:_the_id_Jekyll_gives_a_heading::kramdownIdsAsPublished
  Scenario: as the Uganda schedule page's headings were published
    Then "Children" becomes "children"
    And headings with parentheses and digits become lowercase hyphenated ids without the punctuation
    And "2. Scope" becomes "scope"

  @test:scripts/ig-review-data.test.ts::splitPage::splitPageAtHeadings
  Scenario: cuts at headings, keeps the text before the first, numbers repeats and ignores fenced code
    Given a page with text before a heading, two headings with the same text and a heading inside fenced code
    When it is split
    Then the parts are "_top", "notes" and "notes-1"
    And the fenced heading stays in the text of the first notes part

  @test:scripts/ig-review-data.test.ts::igChangeSet:_the_default_branch_against_the_working_tree::changeSetSectionsLogicWorkbook
  Scenario: a schedule change reads as one reworded section, the logic file and the binary workbook
    Given a working tree that rewords a schedule section, removes another, changes a CQL file and a binary workbook and adds a page
    When the change set is taken against the default branch
    Then the changes are the added page section, the changed schedule section, the workbook and the CQL file
    And the schedule change is placed on its page, anchor and section
    And the workbook's change is its manifest only and it has no text
    And the schedule section's text holds "9 years" and its HTML omits the kramdown attribute line
    And the summary counts 1 added, 3 changed, 0 removed, 3 unchanged, 2 prose and 1 manifest

  @test:scripts/ig-review-data.test.ts::igChangeSet:_the_default_branch_against_the_working_tree::outlinePagesThenSources
  Scenario: the outline lists the pages, then the sources, keyed as the ChangeSet's sections (bean 0om7)
    Given an IG whose sushi-config is titled "Uganda Immunizations"
    When the change set is taken
    Then the outline's document is titled from sushi-config with the index page
    And its chapters are Pages then Sources
    And the Pages chapter has the schedule section with its blocks, and the Sources chapter the source directories
    And every section the change set uses is in the outline

  @test:scripts/ig-review-data.test.ts::igChangeSet:_the_default_branch_against_the_working_tree::impactNamesPagesAndAnchors
  Scenario: the rendered impact names each page with its changed anchors, and every other source as not mapped (bean 0om7)
    Given a changed schedule page, CQL file and sushi-config, and an added page
    When the change set is taken
    Then the rendered impact is a cone from the IG pages renderer
    And it lists the added page with its anchor and the schedule page with only its remaining changed anchor
    And the CQL file is undetermined because of the IG Publisher, and sushi-config is undetermined for any rendered page

  @test:scripts/ig-review-data.test.ts::igChangeSet:_the_default_branch_against_the_working_tree::unchangedTreeDeterminedEmpty
  Scenario: an unchanged tree is a determined empty, and the files land at the site root
    Given an unchanged working tree
    Then the change set has no changes
    When the review data is written to the site
    Then the change set, its text, the rendered impact with no files or undetermined inputs, and the outline with one document are at the site root

  @test:scripts/ig-review-data.test.ts::openPrFor:_the_PR_a_preview's_banner_names_(bean_zvl0)::prFromEventPayload
  Scenario: a pull_request run reads its PR from the event payload, without asking the API
    Given a pull request event payload naming PR 12
    Then the open PR is read from it without calling the API

  @test:scripts/ig-review-data.test.ts::openPrFor:_the_PR_a_preview's_banner_names_(bean_zvl0)::prFromApiForBranch
  Scenario: a hand-started run asks for the branch's open PR, scoped to the repository owner
    Given a run with no event payload
    When the branch's open PR is asked for
    Then the PR is the one the API returns
    And the API was asked for open PRs of that branch, scoped to the repository owner

  @test:scripts/ig-review-data.test.ts::openPrFor:_the_PR_a_preview's_banner_names_(bean_zvl0)::noPrNeverGuess
  Scenario: no open PR, a refused call and a network error all read as no PR, never a guess
    Then no open PR, a refused call and a network error all give no PR
