# scripts/check-folio-mount.ts reports the HTML pages under a layer's declared folio-mount roots that lack the mount,
# honouring declared exemptions, including one that sits inside a root.
# Each Scenario names the test that executes it.
Feature: The folio mount check honours an exemption inside a root

  @test:scripts/tests/check-folio-mount.test.ts::a_page_under_an_exemption_inside_a_root_is_not_reported_missing
  Scenario: A page under an exemption inside a root is not reported missing
    Given layer "x" declaring the root "docs/" and exempting "docs/wireframes/"
    And an unmounted page at "docs/page.html" and another under "docs/wireframes/catalogue/"
    When the folio mount report for "x" is built
    Then only "x/docs/page.html" is reported missing
    And the exemption "docs/wireframes/" is listed as used
    And no exemption is stale
