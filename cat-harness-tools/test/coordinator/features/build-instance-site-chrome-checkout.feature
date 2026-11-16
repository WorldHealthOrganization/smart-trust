# Specifies chromeLayers (scripts/compose-docs.ts) and chromeArtefacts
# (scripts/build-instance-site.ts) over this checkout's declarations.
Feature: The site build's chrome layer and its publish-time artefacts come from the declarations

  @test:test/coordinator/build-instance-site-chrome-checkout.test.ts::the_chrome's_publish-time_artefacts,_from_the_declarations::the_chrome_layer_is_site-chrome,_not_the_harness's_site_directory
  Scenario: The only chrome layer is cat-harness/site-chrome
    Given the checkout
    When its chrome layers are listed relative to the checkout
    Then they are exactly "cat-harness/site-chrome"

  @test:test/coordinator/build-instance-site-chrome-checkout.test.ts::the_chrome's_publish-time_artefacts,_from_the_declarations::avatars.css_is_one_of_them,_written_by_avatars:css,_and_no_page_of_the_docs/_site_is
  Scenario: avatars.css is a chrome artefact written by avatars:css, and nothing outside site-chrome is
    Given the checkout
    When its chrome artefacts are listed
    Then they include "cat-harness/site-chrome/assets/css/avatars.css" written by "avatars:css"
    And every artefact's path starts with "site-chrome/"
