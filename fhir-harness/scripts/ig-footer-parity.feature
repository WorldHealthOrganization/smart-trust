Feature: An IG site's artefact pages carry the site's footer

  @test:scripts/ig-footer-parity.test.ts::an_IG_site's_artefact_pages_carry_the_site's_footer,_not_one_of_their_own::artefactPagesFlagSiteFooter
  Scenario: every artefact page flags the site's footer and draws none itself
    Given the generated artefact pages
    Then there is at least one
    And each asks for the site's footer with its root, and draws no footer or footer script of its own
    And the package's footer facts are written and no footer script is

  @test:scripts/ig-footer-parity.test.ts::an_IG_site's_artefact_pages_carry_the_site's_footer,_not_one_of_their_own::artefactPagesBuildIntoSite
  Scenario: the artefact pages build into the site that holds the footer's one data object
    Given the artefact pages copied into the staged IG site
    Then there are no collisions
    And the site footer holds the source's copyright year and publisher with the package's id and version
    And it links the Table of Contents, which the site holds
    And every artefact page is in the site

  @test:scripts/ig-footer-parity.test.ts::an_IG_site's_artefact_pages_carry_the_site's_footer,_not_one_of_their_own::bothFootersResolveSame
  Scenario: rendered through the one include, both footers resolve to the same facts and the same targets
    Given the site footer data
    When the footer template is rendered through Ruby Liquid for the index page and for an artefact page
    Then both ask for the footer and render without errors
    And both footers have the same tag, stylesheets, band and links once resolved against their URLs
    And the band shows the copyright year, and the links reach the Table of Contents and the License
