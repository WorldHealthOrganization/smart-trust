Feature: the links on a site's landing page

  @test:scripts/landing-links.test.ts::landingLinks::writerPageLinked
  Scenario: a page built at publish by a writer that exists is linked, as its directory
    When a page built at publish by a writer that exists is listed
    Then it is linked as its directory

  @test:scripts/landing-links.test.ts::landingLinks::noPageNoWriterNotLinked
  Scenario: a page that neither exists nor has a writer that exists is not linked
    When neither the page nor its writer exists
    Then it is not linked

  @test:scripts/landing-links.test.ts::landingLinks::stagingAbsoluteClimbingNotLinked
  Scenario: staging-only, absolute and climbing refs are never linked from the landing
    When staging-only, absolute and climbing refs are listed
    Then none is linked

  @test:scripts/landing-links.test.ts::landingLinks::bareStringTitleAndMarkdown
  Scenario: a bare string visualiser takes the directory id as its title; markdown maps to its served page
    When a bare Markdown visualiser is listed
    Then it takes the directory id as title and links the served page

  @test:scripts/landing-links.test.ts::landingLinks::noDeclarationNoLinks
  Scenario: no declaration, no links
    When there is no declaration
    Then there are no links

  @test:scripts/landing-links.test.ts::landingPage::landingPageRawBody
  Scenario: is a Jekyll page in the named layout, its body held raw
    When a landing page is made
    Then it is a Jekyll page in the named layout with the body held raw

  @test:scripts/landing-links.test.ts::landingPage::endrawCannotClose
  Scenario: an endraw inside the body cannot close the raw block early, and renders unchanged
    When a body containing endraw is made into a landing page
    Then the raw block's content renders back to the body unchanged

  @test:scripts/landing-links.test.ts::landingPage::badLayoutRefused
  Scenario: a layout that is not a bare name is refused
    When a layout holding a newline is used
    Then it throws
