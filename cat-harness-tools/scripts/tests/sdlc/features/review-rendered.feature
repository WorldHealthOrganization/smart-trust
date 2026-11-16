# scripts/review-rendered.ts builds the review page's rendered list from rendered-impact files,
# and the measured check of missed pages from rendered-measured. Each Scenario names the test that executes it.
Feature: Review page rendered-pages model

  @test:scripts/tests/sdlc/review-rendered.test.ts::renderedModel::one_row_per_anchor,_linked_on_the_preview_and_on_the_before_side,_index_files_counted_not_listed
  Scenario: One row per anchor, linked on the preview and the before side, with index files counted not listed
    Given a document-site impact with a changed index "outline.json", a changed content page with anchors "prose:a" and "prose:b", and an added data file
    When the model is built against the main site "https://x.github.io/smart-ra"
    Then there are rows for each anchor of "dpi-h-ra/index.html", linked as "../dpi-h-ra/index.html#prose%3Aa" on the preview and under the main site on the before side
    And the added "dpi-h-ra/media/f.png" has a preview link and no before link
    And the index file is counted once and not listed
    And the renderers are "document-site"

  @test:scripts/tests/sdlc/review-rendered.test.ts::renderedModel::an_input_no_renderer_could_place_is_carried_as_not_known,_with_its_scope
  Scenario: An input no renderer could place is carried as not known, with its scope
    Given the same impact, which names "dpi-h-ra.config.json" as undetermined, site-wide, scope "all"
    When the model is built
    Then the unknown list holds that input with renderer "document-site", reason "site-wide" and scope "all"

  @test:scripts/tests/sdlc/review-rendered.test.ts::renderedModel::links_each_page_from_the_site_root_the_review_page_found,_under_the_locale_since_#2527
  Scenario: Pages are linked from the site root the review page found, under the locale
    Given an impact on "en/dpi-h-ra/index.html" with anchor "prose:a" and a site root of "../../"
    When the model is built
    Then the preview link is "../../en/dpi-h-ra/index.html#prose%3Aa" and the before link is under the main site's "en/" path
    And a measured model with root "../../" links the missed "en/x/index.html" as "../../en/x/index.html"

  @test:scripts/tests/sdlc/review-rendered.test.ts::renderedModel::a_single_impact_object_is_accepted_as_well_as_an_array;_no_main_site_means_no_before_links
  Scenario: A single impact object is accepted as well as an array, and no main site means no before links
    Given the impact as one object rather than an array, and no main site
    When the model is built
    Then it has 3 rows
    And no row has a before link

  @test:scripts/tests/sdlc/review-rendered.test.ts::measuredModel_(bean_ehh6)::known,_with_misses:_each_missed_page_linked_on_the_preview,_in_path_order;_a_removed_one_is_not_linked
  Scenario: Known misses are each linked on the preview in path order, and a removed page is not linked
    Given a known measurement that missed "z/index.html", "gone.js" and "a.html", where "gone.js" was removed and "a.html" added
    When the measured model is built
    Then its state is "missed"
    And the misses are "a.html", "gone.js", "z/index.html" in that order
    And "a.html" and "z/index.html" are linked on the preview, and "gone.js" is not

  @test:scripts/tests/sdlc/review-rendered.test.ts::measuredModel_(bean_ehh6)::known,_with_none:_clean
  Scenario: A known measurement with no misses is clean
    Given a known measurement with no misses
    When the measured model is built
    Then its state is "clean"

  @test:scripts/tests/sdlc/review-rendered.test.ts::measuredModel_(bean_ehh6)::a_before_side_that_is_not_the_base:_the_pages_are_shown_and_the_commit_named,_but_nothing_is_counted_missed
  Scenario: A before side that is not the base shows the pages and names the commit, without counting them missed
    Given a measurement with status "not-base", before commit "bcd7e92ab5b841eb" and "index.html" listed
    When the measured model is built
    Then its state is "not-base", not "missed"
    And the before commit is shortened to "bcd7e92"
    And "index.html" is still shown

  @test:scripts/tests/sdlc/review-rendered.test.ts::measuredModel_(bean_ehh6)::no_file,_or_one_without_a_check:_not_measured,_never_clean
  Scenario: No file, or one without a check, is not measured and never clean
    Given no measurement file
    When the measured model is built, its state is "not-measured"
    And a known measurement with no check is also "not-measured"
