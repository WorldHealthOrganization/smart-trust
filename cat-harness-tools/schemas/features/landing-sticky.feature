# schemas/content/landing-sticky.ts and schemas/content/sticky-contribution.ts build the landing page's stickies from the cards each layer declares: composition, order, ids, body text, anchors, links and source links.
# The content checks read the real bootstrap, cat-harness and folio-assistant-core declarations.
# Each Scenario names the test that executes it.
Feature: Landing stickies composed from layer contributions

  @test:schemas/landing-sticky.test.ts::a_published_card_id_does_not_move_with_its_directory::the_declarations_are_actually_being_read_—_not_an_empty_sweep
  Scenario: Three or more declared sticky ids are read from the real declarations
    Given the declarations of "bootstrap", "cat-harness" and "folio-assistant-core"
    When every (layer directory, sticky id) pair is collected
    Then there are at least 3 pairs

  @test:schemas/landing-sticky.test.ts::a_published_card_id_does_not_move_with_its_directory::EXACTLY_the_known_divergence,_named_—_collapsing_it_turns_this_red
  Scenario: Exactly folio-assistant-core's card id differs from its directory
    Given every (layer directory, sticky id) pair from the three declarations
    When the pairs whose id differs from their directory are listed
    Then the list is exactly ["folio-assistant-core"]

  @test:schemas/landing-sticky.test.ts::a_published_card_id_does_not_move_with_its_directory::...and_every_other_instance's_card_id_DOES_match,_which_is_the_contrast
  Scenario: Every other layer's card id matches its directory
    Given every (layer directory, sticky id) pair from the three declarations
    When the pairs whose id equals their directory are listed
    Then the list is exactly ["bootstrap", "cat-harness"]

  @test:schemas/landing-sticky.test.ts::a_sticky_is_a_CONTRIBUTION_from_a_layer,_not_an_entry_in_one_list::cat-harness_contributes_its_own,_and_bootstrap_contributes_its_own
  Scenario: cat-harness and bootstrap each contribute their own stickies
    Given the sticky contributions declared by cat-harness and by bootstrap
    Then each layer contributes at least one sticky
    And every cat-harness contribution is declared by "cat-harness"
    And every bootstrap contribution is declared by "bootstrap"

  @test:schemas/landing-sticky.test.ts::a_sticky_is_a_CONTRIBUTION_from_a_layer,_not_an_entry_in_one_list::the_built_sticky_records_which_layer_contributed_it
  Scenario: A built sticky records the layer that contributed it
    Given the composed bootstrap and cat-harness contributions
    When the stickies are built
    Then the "bootstrap" sticky is contributed by "bootstrap"
    And the "cat-harness" sticky is contributed by "cat-harness"

  @test:schemas/landing-sticky.test.ts::a_sticky_is_a_CONTRIBUTION_from_a_layer,_not_an_entry_in_one_list::no_layer's_declaration_names_another_layer's_sticky
  Scenario: No bootstrap sticky id appears among cat-harness's sticky ids
    Given the sticky ids cat-harness declares
    When each bootstrap contribution's id is looked up among them
    Then none is found

  @test:schemas/landing-sticky.test.ts::bootstrap_has_its_OWN_cat,_not_cat-harness's::bootstrap_declares_a_theme,_and_it_is_not_the_one_cat-harness_uses
  Scenario: Bootstrap declares a theme that cat-harness does not use
    Given bootstrap's and cat-harness's sticky contributions
    Then bootstrap declares at least one sticky
    And no bootstrap themeId is among the cat-harness themeIds

  @test:schemas/landing-sticky.test.ts::bootstrap_has_its_OWN_cat,_not_cat-harness's::its_theme_resolves_to_its_OWN_art,_not_the_default_cloud's
  Scenario: Bootstrap's theme resolves to its own three-crop art
    Given cat-harness's declared images and each bootstrap contribution's themeId
    When the theme is found and its backdrop resolved
    Then the theme exists
    And the backdrop is not none and holds 3 art crops
    And every crop's src contains "bootstrap"

  @test:schemas/landing-sticky.test.ts::bootstrap_has_its_OWN_cat,_not_cat-harness's::the_schema_gives_`theme`_no_default,_so_a_layer_cannot_inherit_a_cat_by_silence
  Scenario: A sticky contribution without a theme is refused
    Given a contribution with id, order and body but no theme
    When StickyContributionSchema parses it
    Then it throws

  @test:schemas/landing-sticky.test.ts::bootstrap_has_its_OWN_cat,_not_cat-harness's::every_backdrop_role_a_theme_names_has_all_three_crops,_or_it_serves_none
  Scenario: Every used theme with a backdrop has no missing crops
    Given cat-harness's declared images and every theme used by any contribution
    When each theme that names a backdrop is resolved
    Then its list of missing crops is empty

  @test:schemas/landing-sticky.test.ts::order_is_DECLARED,_not_inherited_from_dependency_resolution::the_description_comes_first_and_bootstrap's_card_comes_last
  Scenario: The cat-harness card comes first and bootstrap's card last
    Given the contributions listed bootstrap first, then core, then cat-harness
    When the stickies are composed and built
    Then the first sticky id is "cat-harness"
    And the last sticky id is "bootstrap"

  @test:schemas/landing-sticky.test.ts::order_is_DECLARED,_not_inherited_from_dependency_resolution::the_order_survives_the_layers_being_read_in_the_other_sequence
  Scenario: The built order does not depend on the order layers are read
    Given all contributions in two different read orders
    When each is composed and built
    Then both give the same sequence of sticky ids

  @test:schemas/landing-sticky.test.ts::order_is_DECLARED,_not_inherited_from_dependency_resolution::a_tie_breaks_on_layer_then_id,_so_the_board_is_never_read-order_dependent
  Scenario: Contributions with equal order are sorted by layer, then by id
    Given order-50 contributions "b-layer/zebra", "a-layer/yak" and "a-layer/ant"
    When composeContributions sorts them
    Then the result is "a-layer/ant", "a-layer/yak", "b-layer/zebra"

  @test:schemas/landing-sticky.test.ts::order_is_DECLARED,_not_inherited_from_dependency_resolution::bootstrap_declares_the_trailing_order,_and_it_is_the_shared_constant
  Scenario: Bootstrap uses the trailing order and cat-harness the leading order
    Given the declared contributions
    Then bootstrap's orders are exactly [STICKY_ORDER_TRAILING]
    And cat-harness's first contribution has STICKY_ORDER_LEADING

  @test:schemas/landing-sticky.test.ts::two_layers_cannot_claim_one_sticky_id::a_duplicate_is_REFUSED_rather_than_letting_the_last_writer_win
  Scenario: Two layers declaring one sticky id are refused
    Given layers "one" and "two" both contributing the sticky id "landing"
    When composeContributions composes them
    Then it throws a StickyIdConflictError

  @test:schemas/landing-sticky.test.ts::two_layers_cannot_claim_one_sticky_id::the_error_names_both_layers,_so_the_reader_knows_where_to_look
  Scenario: The duplicate-id error names both layers
    Given layers "alpha" and "beta" both contributing the sticky id "landing"
    When composeContributions composes them
    Then the error message contains "alpha"
    And the error message contains "beta"

  @test:schemas/landing-sticky.test.ts::two_layers_cannot_claim_one_sticky_id::the_live_board_has_no_duplicate
  Scenario: The live declarations hold no duplicate sticky id
    Given all contributions from cat-harness, folio-assistant-core and bootstrap
    When composeContributions composes them
    Then it does not throw

  @test:schemas/landing-sticky.test.ts::`body`_and_`bodyFrom`_are_exclusive_—_both_is_a_contradiction,_neither_has_no_words::both_is_refused
  Scenario: A contribution with both body and bodyFrom is refused
    Given a contribution with body "w" and bodyFrom "description"
    When StickyContributionSchema parses it
    Then it throws

  @test:schemas/landing-sticky.test.ts::`body`_and_`bodyFrom`_are_exclusive_—_both_is_a_contradiction,_neither_has_no_words::neither_is_refused
  Scenario: A contribution with neither body nor bodyFrom is refused
    Given a contribution with id, order and theme but no body or bodyFrom
    When StickyContributionSchema parses it
    Then it throws

  @test:schemas/landing-sticky.test.ts::`body`_and_`bodyFrom`_are_exclusive_—_both_is_a_contradiction,_neither_has_no_words::a_misspelled_key_is_refused_rather_than_silently_dropped
  Scenario: A contribution with an unknown key is refused
    Given a contribution carrying the misspelled key "onboardingLink"
    When StickyContributionSchema parses it
    Then it throws

  @test:schemas/landing-sticky.test.ts::`bodyFrom`_reads_the_DECLARING_layer's_fields::bootstrap's_card_carries_bootstrap's_sentence,_not_this_instance's
  Scenario: Bootstrap's card starts with bootstrap's own description
    Given the built "bootstrap" sticky
    Then its comment starts with bootstrap's declared description
    And it does not start with cat-harness's declared description

  @test:schemas/landing-sticky.test.ts::`bodyFrom`_reads_the_DECLARING_layer's_fields::this_instance's_card_carries_its_summary_and_its_spellings,_the_landing's_text
  Scenario: The cat-harness card carries its summary and its Also written spellings
    Given the built "cat-harness" sticky and the cat-harness declaration
    Then the comment starts with the declaration's reader text and with its summary
    And the comment contains "Also written:"
    And it contains each of "caaat-harness", "ca&at-harness" and "c@t-harness" in backticks
    And it contains a newline

  @test:schemas/landing-sticky.test.ts::`bodyFrom`_reads_the_DECLARING_layer's_fields::an_instance_with_no_description_falls_back_to_its_NAME_rather_than_failing
  Scenario: A layer with no description falls back to its name
    Given a bodyFrom "description" contribution declared by "some-instance" with no description
    When the sticky is built
    Then its comment is "some-instance"

  @test:schemas/landing-sticky.test.ts::`bodyFrom`_reads_the_DECLARING_layer's_fields::a_whitespace-only_description_falls_back_too
  Scenario: A whitespace-only description also falls back to the layer name
    Given a bodyFrom "description" contribution declared by "some-instance" whose description is only whitespace
    When the sticky is built
    Then its comment is "some-instance"

  @test:schemas/landing-sticky.test.ts::it_is_page-global_BY_TYPE,_not_by_convention::the_built_sticky_carries_a_page_anchor
  Scenario: A built sticky is anchored to the landing page
    Given the built "cat-harness" sticky
    Then its anchor is kind "page" on LANDING_STICKY_PAGE

  @test:schemas/landing-sticky.test.ts::it_is_page-global_BY_TYPE,_not_by_convention::a_BLOCK_anchor_is_refused
  Scenario: A landing sticky with a block anchor is refused
    Given the built "cat-harness" sticky with its anchor replaced by a block anchor
    When LandingStickySchema parses it
    Then it throws

  @test:schemas/landing-sticky.test.ts::it_is_page-global_BY_TYPE,_not_by_convention::the_`none`_anchor_is_refused_too
  Scenario: A landing sticky with a none anchor is refused
    Given the built "cat-harness" sticky with its anchor replaced by kind "none"
    When LandingStickySchema parses it
    Then it throws

  @test:schemas/landing-sticky.test.ts::it_is_page-global_BY_TYPE,_not_by_convention::an_ABSENT_anchor_is_refused,_unlike_on_the_base_note
  Scenario: A landing sticky with no anchor is refused
    Given the built "cat-harness" sticky with its anchor removed
    When LandingStickySchema parses it
    Then it throws

  @test:schemas/landing-sticky.test.ts::building_it_twice_produces_the_same_node_—_the_idempotency_key::two_calls_with_the_same_input_are_identical
  Scenario: Building the board twice gives identical stickies
    Given all declared contributions
    When the stickies are built twice
    Then both results are equal

  @test:schemas/landing-sticky.test.ts::building_it_twice_produces_the_same_node_—_the_idempotency_key::the_id_is_declared,_not_derived_from_the_description
  Scenario: The sticky id is the declared id whatever the description says
    Given the "cat-harness" contribution with its description replaced by "something else entirely"
    When the sticky is built
    Then its id is still "cat-harness"

  @test:schemas/landing-sticky.test.ts::building_it_twice_produces_the_same_node_—_the_idempotency_key::`createdAt`_is_an_argument,_so_the_node_does_not_move_on_its_own
  Scenario: createdAt is taken from the argument
    Given the first cat-harness contribution
    When the sticky is built with createdAt "2020-01-01T00:00:00.000Z"
    Then its createdAt is "2020-01-01T00:00:00.000Z"

  @test:schemas/landing-sticky.test.ts::an_href_may_not_resolve_by_luck_—_bean_blv9::accepts_%s
  Scenario: Site-root and https hrefs are accepted
    Given each href "/guides/index.html", "https://example.org/x" and "HTTPS://EXAMPLE.ORG/x"
    When LandingLinkSchema parses a link with that href
    Then it does not throw

  @test:schemas/landing-sticky.test.ts::an_href_may_not_resolve_by_luck_—_bean_blv9::refuses_%s
  Scenario: Relative and empty hrefs are refused
    Given each href "guides/index.html", "installation.html", "./x.html", "../x.html" and the empty string
    When LandingLinkSchema parses a link with that href
    Then it throws

  @test:schemas/landing-sticky.test.ts::an_href_may_not_resolve_by_luck_—_bean_blv9::every_default_link_is_accepted_by_that_rule
  Scenario: Every default onboarding link passes the href rule
    Given each of DEFAULT_ONBOARDING_LINKS
    When LandingLinkSchema parses it
    Then it does not throw

  @test:schemas/landing-sticky.test.ts::an_href_may_not_resolve_by_luck_—_bean_blv9::every_link_in_every_live_declaration_is_accepted_by_that_rule
  Scenario: Every link in the live declarations passes the href rule
    Given every link of every declared contribution
    Then there is at least one link
    And LandingLinkSchema accepts each of them

  @test:schemas/landing-sticky.test.ts::an_href_may_not_resolve_by_luck_—_bean_blv9::external_links_are_DERIVED_from_the_scheme,_not_declared
  Scenario: A link is external exactly when its href has a scheme
    Given links to "https://example.org" and "/guides/index.html"
    When isExternalLink checks each
    Then the https link is external
    And the site-root link is not

  @test:schemas/landing-sticky.test.ts::an_href_may_not_resolve_by_luck_—_bean_blv9::no_default_link_is_external,_so_all_four_take_`relative_url`
  Scenario: No default onboarding link is external
    Given DEFAULT_ONBOARDING_LINKS
    When they are filtered by isExternalLink
    Then none remain

  @test:schemas/landing-sticky.test.ts::the_four_default_links_point_at_pages_that_EXIST::%s_resolves_to_a_source_page
  Scenario: Each default onboarding link resolves to a source page
    Given each default onboarding href and this layer's declared site directory
    When the href is mapped to "<stem>.md", "<stem>/index.md" or "<stem>.html"
    Then at least one of those files exists

  @test:schemas/landing-sticky.test.ts::the_four_default_links_point_at_pages_that_EXIST::the_check_CAN_fire
  Scenario: The page-existence check fails for a missing page
    Given this layer's site directory
    Then "definitely-not-a-page.md" does not exist there

  @test:schemas/landing-sticky.test.ts::the_four_default_links_point_at_pages_that_EXIST::there_are_four_of_them,_in_the_order_a_reader_meets_them
  Scenario: There are four default onboarding links in reader order
    Given DEFAULT_ONBOARDING_LINKS
    Then there are 4
    And their hrefs are "/guides/beans-and-todos.html", "/start/getting-started.html", "/concepts/content-types.html" and "/guides/index.html" in that order

  @test:schemas/landing-sticky.test.ts::EVERY_declared_link_resolves_to_a_page_that_exists::there_are_site_links_to_check
  Scenario: The declarations hold more than three site links
    Given every non-external link of every declared contribution
    Then there are more than 3

  @test:schemas/landing-sticky.test.ts::EVERY_declared_link_resolves_to_a_page_that_exists::%s_->_%s_resolves_to_a_source_page
  Scenario: Each declared site link resolves to a source page
    Given each declared non-external link's label and href
    When its stem is looked up as "<stem>.md", "<stem>/index.md" or "<stem>.html" in the site directory
    And, for a multi-segment path, under the docs sources declared by the layer its first segment names
    Then at least one candidate file exists

  @test:schemas/landing-sticky.test.ts::EVERY_declared_link_resolves_to_a_page_that_exists::every_absolute_link_is_https,_not_a_bare_host_or_http
  Scenario: Every declared external link uses https
    Given every external link of every declared contribution
    Then there is at least one
    And each href starts with "https://"

  @test:schemas/landing-sticky.test.ts::`onboardingLinks`_asks_for_the_SET_rather_than_copying_it::the_flag_appends_all_four,_AFTER_the_layer's_own_links
  Scenario: The onboarding flag appends all four default links after the card's own
    Given the "cat-harness" contribution and its declared links
    Then it declares at least one link
    And the built sticky's links are its own links followed by DEFAULT_ONBOARDING_LINKS

  @test:schemas/landing-sticky.test.ts::`onboardingLinks`_asks_for_the_SET_rather_than_copying_it::no_declaration_copies_the_onboarding_SET,_which_would_be_the_BLOCK_KINDS_shape
  Scenario: No declaration copies the whole onboarding set
    Given every declared contribution
    When its links whose href is an onboarding href are counted
    Then the count is below the size of the onboarding set

  @test:schemas/landing-sticky.test.ts::`onboardingLinks`_asks_for_the_SET_rather_than_copying_it::without_the_flag_a_sticky_carries_exactly_its_declared_links_and_no_more
  Scenario: Without the flag a sticky has exactly its declared links
    Given the "folio-assist-core" contribution
    Then its onboardingLinks flag is unset or false
    And the built sticky's links equal its declared links

  @test:schemas/landing-sticky.test.ts::it_is_recognised_by_its_declared_tag,_not_by_its_shape::the_built_sticky_is_recognised
  Scenario: A built sticky is recognised as a landing sticky
    Given the built "cat-harness" sticky
    When isLandingSticky checks it
    Then it is recognised

  @test:schemas/landing-sticky.test.ts::it_is_recognised_by_its_declared_tag,_not_by_its_shape::a_note_that_merely_has_the_id_is_NOT
  Scenario: A note that only has a landing id is not a landing sticky
    Given the object with id "landing" and summary "x"
    When isLandingSticky checks it
    Then it is not recognised

  @test:schemas/landing-sticky.test.ts::it_is_recognised_by_its_declared_tag,_not_by_its_shape::null_and_undefined_do_not_throw
  Scenario: isLandingSticky answers false for null and undefined
    When isLandingSticky checks null and undefined
    Then both are not recognised, without throwing

  @test:schemas/landing-sticky.test.ts::it_is_recognised_by_its_declared_tag,_not_by_its_shape::the_tag_is_what_the_schema_requires
  Scenario: A built sticky carries the landing sticky schema tag
    Given the built "cat-harness" sticky
    Then its $schema is LANDING_STICKY_SCHEMA_TAG

  @test:schemas/landing-sticky.test.ts::the_summary_is_derived,_not_a_second_field_to_keep_in_step::it_is_the_body's_first_non-blank_line_when_none_is_declared
  Scenario: A sticky's summary is the first line of its body when it declares none
    Given a bodyFrom "summary" contribution with no summary of its own, from a layer with summary "First line." and alsoWritten "s0me-instance"
    When the sticky is built
    Then its summary is "First line."
    And its comment is "First line." followed by a blank line and "Also written: `s0me-instance`"

  @test:schemas/landing-sticky.test.ts::the_summary_is_derived,_not_a_second_field_to_keep_in_step::a_declared_summary_wins
  Scenario: A declared summary wins
    Given the built "folio-assist-core" sticky
    Then its summary is "What a folio is"

  @test:schemas/landing-sticky.test.ts::the_sub-graphs_card_says_what_the_owner_asked_for::it_names_all_four_sub-graphs,_including_`process`
  Scenario: The sub-graphs card names Content, Skills, Processes and Tools
    Given the built "folio-assist-core" sticky
    Then its comment contains "Content", "Skills", "Processes" and "Tools"

  @test:schemas/landing-sticky.test.ts::the_sub-graphs_card_says_what_the_owner_asked_for::each_of_the_four_is_LINKED,_not_merely_named
  Scenario: The sub-graphs card links each of the four sub-graphs
    Given the built "folio-assist-core" sticky's links
    Then their labels include "Content", "Skills", "Processes" and "Tools"

  @test:schemas/landing-sticky.test.ts::the_sub-graphs_card_says_what_the_owner_asked_for::acquisition_is_described_as_a_STEP,_not_a_fifth_graph_typology
  Scenario: The sub-graphs card calls acquisition a step, not a graph typology
    Given the built "folio-assist-core" sticky
    Then its comment contains "acquisition"
    And it says acquisition is a "step rather than a graph typology"

  @test:schemas/landing-sticky.test.ts::the_sub-graphs_card_says_what_the_owner_asked_for::it_says_where_acquisition's_two_ends_are,_since_they_are_real_directories
  Scenario: The sub-graphs card names uploads/ and library/
    # Gap: only the text is checked; the directories' existence is not
    Given the built "folio-assist-core" sticky
    Then its comment contains "uploads/"
    And it contains "library/"

  @test:schemas/landing-sticky.test.ts::the_cat's_introduction_keeps_the_owner's_own_words::verbatim,_down_to_the_shape_of_the_sentence
  Scenario: The cat-harness card keeps the owner's introduction of the cat verbatim
    Given the built "cat-harness" sticky
    Then its comment contains "Please be introduced to a cat who acquires things, for whatever purpose — maybe somebody knows."

  @test:schemas/landing-sticky.test.ts::the_cat's_introduction_keeps_the_owner's_own_words::every_card_of_this_harness_takes_ONE_theme_—_the_convention
  Scenario: Every cat-harness card uses the one theme grumpy-cyborg-agents
    Given the cat-harness contributions
    When their theme ids are collected
    Then the only theme id is "grumpy-cyborg-agents"

  @test:schemas/landing-sticky.test.ts::the_cat's_introduction_keeps_the_owner's_own_words::bootstrap_does_NOT_share_it,_which_is_what_makes_the_theme_the_harness's_own
  Scenario: Bootstrap does not use the grumpy-cyborg-agents theme
    Given bootstrap's contributed theme ids
    Then none is "grumpy-cyborg-agents"

  @test:schemas/landing-sticky.test.ts::the_cat's_introduction_keeps_the_owner's_own_words::its_source_link_is_absolute_and_does_not_point_at_this_site
  Scenario: The cat-harness card's external source link is not the site's own URL
    Given the built "cat-harness" sticky's links
    Then one of them is external
    And its href is not cat-harness's declared canonicalUrl

  @test:schemas/landing-sticky.test.ts::the_cat's_introduction_keeps_the_owner's_own_words::it_also_carries_an_RTFM_link_to_this_harness's_own_docs
  Scenario: The cat-harness card carries an RTFM link
    Given the built "cat-harness" sticky's links
    Then one label mentions "RTFM", case-insensitively

  @test:schemas/landing-sticky.test.ts::bootstrap's_card_links_to_its_source_and_does_NOT_invent_a_site::it_offers_a_source_link
  Scenario: Bootstrap's card offers an external source link
    Given the built "bootstrap" sticky's links
    Then there is at least one link
    And one is external with an href containing "/bootstrap"

  @test:schemas/landing-sticky.test.ts::bootstrap's_card_links_to_its_source_and_does_NOT_invent_a_site::it_offers_no_link_to_a_bootstrap_site,_because_there_is_none
  Scenario: Bootstrap's card links nothing under the declared site
    Given cat-harness's declared canonicalUrl
    Then no link on the built "bootstrap" sticky starts with it

  @test:schemas/landing-sticky.test.ts::sourceLinks_—_where_a_card's_declaration_can_be_read_and_edited::both_forms,_because_reading_and_editing_are_different_acts
  Scenario: sourceLinks gives both a view and an edit URL
    Given the forge "https://github.com/litlfred/folio-assistant" and branch "main"
    When sourceLinks is asked for "index.config.json"
    Then the view URL is under "/blob/main/index.config.json"
    And the edit URL is under "/edit/main/index.config.json"

  @test:schemas/landing-sticky.test.ts::sourceLinks_—_where_a_card's_declaration_can_be_read_and_edited::a_file_in_a_remote_mount_is_read_and_edited_in_the_mount's_own_repository
  Scenario: A file in a remote mount links into the mount's own repository
    # Skipped: when not running inside the aggregate checkout
    Given the folio-assistant forge and branch "main"
    When sourceLinks is asked for "cat-harness/cat-harness.json"
    Then the view URL is "https://github.com/litlfred/cat-harness/blob/main/cat-harness.json"
    And the edit URL is "https://github.com/litlfred/cat-harness/edit/main/cat-harness.json"

  @test:schemas/landing-sticky.test.ts::sourceLinks_—_where_a_card's_declaration_can_be_read_and_edited::a_file_in_a_submodule_is_read_and_edited_in_the_submodule's_own_repository
  Scenario: A file in a submodule links into the submodule's own repository
    Given the folio-assistant forge and branch "main"
    When sourceLinks is asked for "bootstrap/bootstrap.json"
    Then the view URL is "https://github.com/litlfred/bootstrap/blob/main/bootstrap.json"
    And the edit URL is "https://github.com/litlfred/bootstrap/edit/main/bootstrap.json"

  @test:schemas/landing-sticky.test.ts::sourceLinks_—_where_a_card's_declaration_can_be_read_and_edited::with_NO_forge,_it_is_ABSENT_rather_than_broken
  Scenario: With no forge there are no source links
    Given no forge
    When sourceLinks is asked for "bootstrap/bootstrap.json"
    Then the result is undefined

  @test:schemas/landing-sticky.test.ts::sourceLinks_—_where_a_card's_declaration_can_be_read_and_edited::the_path_is_the_CONTRIBUTING_instance's,_not_a_default
  Scenario: Each contributing layer's declaration gets its own edit URL
    # Skipped: when not running inside the aggregate checkout
    Given the folio-assistant forge and branch "main"
    When sourceLinks is asked for "cat-harness/cat-harness.json" and "folio-assistant-core/folio-assistant-core.json"
    Then the two edit URLs differ
    And the first is "https://github.com/litlfred/cat-harness/edit/main/cat-harness.json"
    And the second is "https://github.com/litlfred/folio-assistant-core/edit/main/folio-assistant-core.json"

  @test:schemas/landing-sticky.test.ts::sourceLinks_—_where_a_card's_declaration_can_be_read_and_edited::a_branch_other_than_main_is_honoured
  Scenario: A branch other than main appears in the edit URL
    Given the folio-assistant forge and branch "claude/x"
    When sourceLinks is asked for "index.config.json"
    Then the edit URL is under "/edit/claude/x/index.config.json"

  @test:schemas/landing-sticky.test.ts::sourceLinks_—_where_a_card's_declaration_can_be_read_and_edited::a_path_segment_with_a_space_survives_as_an_escape,_not_as_a_break
  Scenario: A space in a path is percent-encoded
    Given the folio-assistant forge and branch "main"
    When sourceLinks is asked for "some dir/some dir.json"
    Then the view URL ends "/blob/main/some%20dir/some%20dir.json"
