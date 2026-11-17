# The staging banner client in scripts/staging-banner.ts links the preview's review page,
# run here against fakes of the DOM and fetch. Each Scenario names the test that executes it.
Feature: Staging banner review page link

  @test:scripts/tests/sdlc/staging-banner-review.test.ts::staging_banner:_review_page_link::an_IG's_review_page_at_the_preview_root
  Scenario: An IG's review page at the preview root is linked
    Given a page at "/r/STAGING/b/concepts.html" and a review page at "/r/STAGING/b/review/index.html"
    When the banner client runs
    Then the review link points to "/r/STAGING/b/review/"
    And its text is "🔍 Review changes"

  @test:scripts/tests/sdlc/staging-banner-review.test.ts::staging_banner:_review_page_link::a_folio's_review_page_under_the_page's_locale,_asked_first
  Scenario: A folio's review page under the page's locale is asked for first
    Given a page at "/r/STAGING/b/en/dth-pc/index.html" and review pages under both "en/review/" and "review/"
    When the banner client runs
    Then the first HEAD probe is "/r/STAGING/b/en/review/index.html"
    And the review link points to "/r/STAGING/b/en/review/"

  @test:scripts/tests/sdlc/staging-banner-review.test.ts::staging_banner:_review_page_link::no_review_page,_no_link
  Scenario: No review page means no link
    Given a page at "/r/STAGING/b/en/index.html" and no review page anywhere
    When the banner client runs
    Then exactly 2 HEAD probes are made
    And there is no review link
