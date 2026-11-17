# scripts/strip-preview-seo.ts removes a preview's identity claims (canonical link, og:url and
# jekyll-seo-tag JSON-LD) from its HTML, leaving every other tag and a folio's own JSON-LD alone.
# Each Scenario names the test that executes it.
Feature: A staging preview does not claim to be canonical

  @test:scripts/tests/sdlc/strip-preview-seo.test.ts::stripSeo::removes_all_three_claims_and_counts_each
  Scenario: The canonical link, og:url and schema.org JSON-LD are removed and counted
    Given a head holding a canonical link, an og:url meta and a schema.org WebPage JSON-LD with a url
    When the SEO claims are stripped
    Then one of each is counted as removed
    And the result contains no "canonical", "og:url" or "ld+json"
    And the "<head>" and "</head>" tags remain

  @test:scripts/tests/sdlc/strip-preview-seo.test.ts::stripSeo::leaves_every_other_rel,_property_and_meta_alone
  Scenario: Other link rels, og properties and metas are left alone
    Given links with rel "icon" and "stylesheet", og:title and og:locale metas and a description meta
    When the SEO claims are stripped
    Then nothing is counted as removed
    And the HTML is unchanged

  @test:scripts/tests/sdlc/strip-preview-seo.test.ts::stripSeo::a_folio's_own_JSON-LD_is_content_and_is_never_touched
  Scenario: A folio's own knowledge-graph JSON-LD is left alone
    Given a JSON-LD script with a cat namespace context and an "@graph"
    When the SEO claims are stripped
    Then no JSON-LD is counted as removed
    And the HTML is unchanged

  @test:scripts/tests/sdlc/strip-preview-seo.test.ts::stripSeo::a_schema.org_block_with_no_url_is_left_alone_too
  Scenario: A schema.org JSON-LD block with no url is left alone
    Given a schema.org Organization JSON-LD with a name and no url
    When the SEO claims are stripped
    Then no JSON-LD is counted as removed

  @test:scripts/tests/sdlc/strip-preview-seo.test.ts::stripSeo::running_twice_is_a_no-op
  Scenario: Stripping twice changes nothing the second time
    Given a head with a canonical link and an og:url meta, stripped once
    When it is stripped again
    Then nothing is counted as removed
    And the HTML equals the once-stripped HTML

  @test:scripts/tests/sdlc/strip-preview-seo.test.ts::stripSeo::single_quotes_and_mixed_case_are_matched
  Scenario: Single-quoted and upper-case tags are matched
    Given an upper-case LINK with REL='canonical' and an upper-case META with PROPERTY='og:url'
    When the SEO claims are stripped
    Then one canonical and one og:url are counted as removed, and no JSON-LD

  @test:scripts/tests/sdlc/strip-preview-seo.test.ts::runStripPreviewSeo::walks_the_tree,_writes,_and_reports_what_it_removed
  Scenario: The run strips every HTML page in the site and reports the counts
    Given a site with "index.html" holding a canonical link, "guides/a.html" holding an og:url and JSON-LD, a CSS file and "folio.jsonld"
    When the strip is run over the site
    Then it exits 0 having seen 2 files and changed 2
    And one canonical, one og:url and one JSON-LD are removed
    And "index.html" no longer contains "canonical"
    And "folio.jsonld" is unchanged

  @test:scripts/tests/sdlc/strip-preview-seo.test.ts::runStripPreviewSeo::--dry-run_reports_without_writing
  Scenario: A dry run reports without writing
    Given a site whose "index.html" holds a canonical link
    When the strip is run as a dry run
    Then one canonical is counted and the text says "would remove"
    And "index.html" still contains "canonical"

  @test:scripts/tests/sdlc/strip-preview-seo.test.ts::runStripPreviewSeo::an_unreadable_site_is_an_error,_not_a_clean_pass
  Scenario: An unreadable site is an error
    Given a site path that does not exist
    When the strip is run over it
    Then it exits 2 and the text says "could not read"
    And nothing is counted as removed

  @test:scripts/tests/sdlc/strip-preview-seo.test.ts::runStripPreviewSeo::a_site_with_no_claims_exits_0_and_says_so
  Scenario: A site with no claims exits 0 and says so
    Given a site whose only page has just a title
    When the strip is run over it
    Then it exits 0 having changed no files
    And the text says "1 page(s) seen, 0 changed"
