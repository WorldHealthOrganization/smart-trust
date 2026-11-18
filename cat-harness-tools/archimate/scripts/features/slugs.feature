# Specifies the page slugs of ArchiMate views and elements: slugify and
# planSlugs (archimate/schemas/slugs.ts), and the pages gen-archimate-pages.ts
# writes at those slugs, alone and in a site.
Feature: ArchiMate views and elements get readable page slugs, and their pages live there

  @test:archimate/scripts/slugs.test.ts::slugify::makes_lower-case_words_joined_by_dashes,_accents_dropped
  Scenario: A name becomes lower-case words joined by dashes, accents dropped
    When "1. Central Health Workforce Registry", "  Équipe de santé (draft) " and "Registry <script>" are slugified
    Then they give "1-central-health-workforce-registry", "equipe-de-sante-draft" and "registry-script"

  @test:archimate/scripts/slugs.test.ts::slugify::cuts_a_long_name_at_a_word_break
  Scenario: A long name is cut at a word break
    When a fourteen-word name is slugified
    Then the slug is no longer than the slug maximum
    And it is "budget-execution-reports-with-actionable-insights-by-program"

  @test:archimate/scripts/slugs.test.ts::slugify::gives_nothing_for_a_name_with_nothing_readable,_or_one_that_looks_like_an_Archi_id
  Scenario: An unreadable name or one like an Archi id gives no slug
    When "", "—" and "id-007936f8c2424b96ad1893ef0ff66059" are slugified
    Then each gives nothing

  @test:archimate/scripts/slugs.test.ts::planSlugs::slugs_every_named_view_and_element;_a_clash_gives_the_later_one_its_id's_first_hex
  Scenario: Every named object gets a slug; a clash gives the later one its id's first hex
    Given elements "id-aaaa1111" and "id-bbbb2222" both named "Business Service", an unnamed element "id-c", and a view "id-v" also named "Business Service"
    When the slugs are planned
    Then "id-aaaa1111" is "business-service", "id-bbbb2222" is "business-service-bbbb" and "id-v" is "business-service"
    And "id-c" has no slug

  @test:archimate/scripts/slugs.test.ts::planSlugs::is_the_same_every_time_for_the_same_model
  Scenario: The plan is the same for the same model
    Given a model with two elements both named "Lookup"
    When the slugs are planned twice
    Then the two plans are equal, in the same order

  @test:archimate/scripts/slugs.test.ts::planSlugs::an_author's_`slug`_property_wins,_even_over_an_earlier_object's_name;_a_malformed_or_doubled_one_is_refused
  Scenario: An author's slug property wins; a malformed or doubled one is refused
    Given element "id-a" named "Hwr" and a later element "id-b" with slug property "hwr"
    When the slugs are planned
    Then "id-b" is "hwr" and "id-a" is "hwr-a"
    And a slug property "Not A Slug" throws saying it is not lower-case words
    And two elements with slug property "hwr" throw saying it is also chosen by "id-a"

  @test:archimate/scripts/slugs.test.ts::pages_at_slugs::puts_each_view_and_element_page_at_its_slug,_keeps_the_id_IRI,_and_leaves_nothing_at_the_id_path
  Scenario: View and element pages sit at their slugs, the IRI stays the id, and nothing is at the id path
    Given a throwaway instance with one ArchiMate model: a component "Health Worker Registry", two services named "Lookup" ("id-b" and "id-c9"), one serving relationship "id-r1", and a view "1. Central Health Workforce Registry" ("id-v1")
    When its pages are generated
    Then the view page is at "views/1-central-health-workforce-registry/" and its page config names "id-v1" with its JSON-LD and SVG one level up
    And the element pages are at "elements/lookup/" and "elements/lookup-c9/"
    And the relationship page stays at "relationships/id-r1/"
    And there is no page at "views/id-v1/" or "elements/id-a/"
    And the view's JSON-LD "@id" is still its id IRI
    And the view's SVG links "../elements/health-worker-registry/", the model index links "./views/1-central-health-workforce-registry/", and model.json records the slugs of "id-v1" and "id-c9"

  @test:archimate/scripts/slugs.test.ts::pages_at_slugs::in_a_site,_every_link_a_page_or_a_drawing_makes_reaches_a_file_the_run_writes
  Scenario: In a site, every relative link of a page or drawing reaches a written file
    Given the same throwaway instance
    When its pages are generated for a site
    Then every relative href, src and data attribute (without "#" or ":") in each page and SVG, and each "node", "model" and "svg" of a non-root page's config, resolves to a written file or to a written folder's "index.html"

  @test:archimate/scripts/slugs.test.ts::the_Archi_model_file_a_model_page_links::is_listed_for_the_site_build_at_its_data_path,_so_the_link_is_not_a_404
  Scenario: The model's Archi file is listed for the site build at its data path
    Given the throwaway instance
    When its model files are listed
    Then the only file is "1.0.0/model.archimate"
    And its source is the instance's "archimate/1.0.0/model.archimate"
