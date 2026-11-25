Feature: the README page — every README on one page

  @test:scripts/readme-book.test.ts::the_README_page_—_every_README_on_one_page::rootFirstThenByPath
  Scenario: root first, then by path
    Given the files b/README.md, README.md, a/x/README.md, a/README.md and a/notes.md
    When the READMEs are ordered
    Then the order is README.md, a/README.md, a/x/README.md, b/README.md, and a/notes.md is left out

  @test:scripts/readme-book.test.ts::the_README_page_—_every_README_on_one_page::sectionIdsFromDirectory
  Scenario: section ids come from the directory
    Then the section id of README.md is "readme"
    And of schemas/README.md is "schemas"
    And of "a/B c/README.md" is "a-b-c"

  @test:scripts/readme-book.test.ts::the_README_page_—_every_README_on_one_page::githubSlug
  Scenario: GitHub's slug
    Then the slug of "Who takes part" is "who-takes-part"
    And the slug of "FR-1: `x`" is "fr-1-x"

  @test:scripts/readme-book.test.ts::the_README_page_—_every_README_on_one_page::tocFragmentsLand
  Scenario: a TOC lists each README and its level-2 headings, and every fragment on the page lands
    Given a root README and a skills README, each with an "Every file" level-2 heading and links to each other
    When the book is built
    Then its table of contents lists "Top" and "skills", each with its "Every file" heading
    And no fragment on the page dangles
    And there are no problems

  @test:scripts/readme-book.test.ts::the_README_page_—_every_README_on_one_page::headingsDemotedNotInCode
  Scenario: headings are demoted under their section; a heading in code is not touched
    When the same book is built
    Then the skills README's "Every file" becomes a level-3 heading with its own section anchor
    And the "## not a heading" line inside a code block is unchanged

  @test:scripts/readme-book.test.ts::the_README_page_—_every_README_on_one_page::readmeLinksBecomeAnchors
  Scenario: links between READMEs become anchors; other relative links resolve from the root
    When the same book is built
    Then the link to skills/README.md#every-file becomes "#skills--every-file"
    And the link back to ../README.md#every-file becomes "#readme--every-file"
    And the link to skills/a.md stays "skills/a.md"

  @test:scripts/readme-book.test.ts::the_README_page_—_every_README_on_one_page::deadLinkIsProblem
  Scenario: a link to nothing is a problem, not a silent pass
    Given a README linking to a missing file and to a missing anchor
    When the book is built
    Then it reports 2 problems
