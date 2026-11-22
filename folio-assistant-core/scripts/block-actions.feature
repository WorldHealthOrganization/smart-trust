Feature: the edit and feedback links on every block

  @test:scripts/block-actions.test.ts::block-actions_(REQ-17,_bean_uphx)::editOpensGithubEditor
  Scenario: [edit] opens the block's source in GitHub's editor on main
    When the edit and source URLs of a block are made
    Then edit opens the source in GitHub's editor on main, or on the named branch
    And source opens the blob on main

  @test:scripts/block-actions.test.ts::block-actions_(REQ-17,_bean_uphx)::noRepoNoLinks
  Scenario: no repository, no links: nothing is drawn rather than a broken link
    When block actions are made with no repository
    Then there is no edit URL and no HTML, and nothing is inserted into a page

  @test:scripts/block-actions.test.ts::block-actions_(REQ-17,_bean_uphx)::feedbackWithoutFormBody
  Scenario: [feedback] without a form puts the block's facts in the body
    When a feedback URL is made without a form
    Then it opens a new issue titled with the section and label
    And its body names the block, its source and its page anchor

  @test:scripts/block-actions.test.ts::block-actions_(REQ-17,_bean_uphx)::feedbackCodedWithContent
  Scenario: [feedback] is coded with the content slug: title, body, and a form's content field
    When feedback URLs are made with a content slug, with and without a form
    Then the title and body carry the slug
    And the form's content field is prefilled with it

  @test:scripts/block-actions.test.ts::block-actions_(REQ-17,_bean_uphx)::formPrefillsDeclaredFields
  Scenario: [feedback] with a form prefills only the fields the form declares
    When a feedback URL is made with a form declaring block and source
    Then the template, block, source and labels are set
    And section and body are not

  @test:scripts/block-actions.test.ts::block-actions_(REQ-17,_bean_uphx)::formFieldsReadFromIssueForm
  Scenario: the form's field ids are read from the folio's issue form, and its absence is undefined
    When the issue form is read before and after .github/ISSUE_TEMPLATE/block-feedback.yml exists
    Then before, it is undefined
    And after, its field ids are block and feedback

  @test:scripts/block-actions.test.ts::block-actions_(REQ-17,_bean_uphx)::linksAfterAnchorOnce
  Scenario: the links go right after the block's anchor, once, and the style once
    When block actions are injected for a present and a missing block
    Then one is inserted, right after the block's anchor
    And the actions and the style appear once, with edit and feedback links

  @test:scripts/block-actions.test.ts::the_browser_builds_the_same_URLs_(bean_v433)::browserBuildsSameUrls[${[JSON.stringify(cfg),_b.label,_b.section_??_"(no_section)"].join("|").replace(/\s+/g,_"_")}]
  Scenario Outline: <config> <label> <section>
    Given the link configuration <config> and a block with <label> and <section>
    When the browser's faBlockUrls builds the URLs
    Then the edit URL equals the server's
    And the feedback URL equals the server's

    Examples:
      | config | label | section |
      | each of five link configurations | the block's label, or "tbl:a b&c" | the block's section, or "(no section)" |

  @test:scripts/block-actions.test.ts::the_browser_builds_the_same_URLs_(bean_v433)::compactCarriesFacts
  Scenario: the compact form carries the facts, not the URLs, and adds the filler once
    When block actions are injected in compact form
    Then the block's source is carried as data and no edit or feedback href is written
    And the URL builder and its configuration are added once
