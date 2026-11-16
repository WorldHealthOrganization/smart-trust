Feature: Checking the links of an IG's markdown annexes from their host page

  @test:scripts/check-ig-annex-links.test.ts::a_markdown_annex's_links_are_judged_from_its_HOST_page::resolvesHostAndAnnexLinks
  Scenario: links to the other page's headings and to ids an annex adds resolve; nothing is a finding
    Given two annexes linking to the other page's headings, an id an annex adds, an actor page and the QA page
    When the annex links are checked
    Then 2 annexes and 6 links are checked
    And there are no findings

  @test:scripts/check-ig-annex-links.test.ts::a_markdown_annex's_links_are_judged_from_its_HOST_page::missingTargetsAreFindings
  Scenario: a missing page, a missing anchor and a missing same-page anchor are each findings
    Given an annex linking to a missing page, a missing anchor, a missing same-page anchor and an image
    When the annex links are checked
    Then the findings are the missing page, the missing anchor and the missing same-page anchor
    And every finding names the annex and its host page
    And the image link is listed as not judged

  @test:scripts/check-ig-annex-links.test.ts::a_markdown_annex's_links_are_judged_from_its_HOST_page::noAnnexDirNothingToJudge
  Scenario: an IG with no ig-annex directory has nothing to judge
    Given an IG with no ig-annex directory
    Then the check reports 0 annexes, 0 links checked, nothing unjudged and no findings

  @test:scripts/check-ig-annex-links.test.ts::the_pieces::linkTargetsSkipAbsolute
  Scenario: link targets skip absolute URLs, site-rooted paths and Liquid
    Given markdown with a relative link, an absolute URL, a site-rooted path, a Liquid link and an HTML anchor
    Then the link targets are "x.html#y" and "z.html"

  @test:scripts/check-ig-annex-links.test.ts::the_pieces::pageIdsFromHeadingsAndAttrs
  Scenario: ids: kramdown heading ids, an explicit {#id}, and id=/name= attributes
    Given markdown with a heading, a heading with an explicit id and elements with id and name attributes
    Then the page ids are "chosen", "intro", "n" and "s"
