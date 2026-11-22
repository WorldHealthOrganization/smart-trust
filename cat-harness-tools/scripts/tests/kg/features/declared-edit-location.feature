# scripts/gen-docs-pages.ts links a page to the repository its layer declares, not to the
# origin of whichever checkout generated it (bean 5o5c, cat-harness#1150).
# Each Scenario names the test that executes it.
Feature: Edit and source links name the declared repository

  @test:scripts/tests/kg/declared-edit-location.test.ts::declaredEditLocation_(bean_5o5c)::a_narrative_block's_link_names_the_harness's_declared_repository,_path_unchanged
  Scenario: A narrative block's edit link names the harness's declared repository with its path unchanged
    Given the harness declaration names a repository
    And a narrative markdown block found under the harness's "docs/source/" page directories
    When the declared edit location of "docs/source/<page>/<block>" is asked
    Then its source is that same path
    And its repo is the declared repository

  @test:scripts/tests/kg/declared-edit-location.test.ts::baseLayerWeb_(cat-harness#1150)::names_the_base_layer's_declared_repository,_whatever_the_checkout
  Scenario: The base layer's web link names its declared repository
    # Gap: only the current checkout is exercised, not a different checkout root
    Given the harness declaration names a repository
    When the base layer's web link is asked
    Then it is "https://github.com/" followed by the declared repository
