# scripts/lib/jekyll-pages-nav.ts builds the rail's "Pages" section from a Jekyll site:
# the pages the theme's navigation lists, in its tree and order, at the addresses
# Jekyll publishes them. Each Scenario names the test that executes it.
Feature: The rail's Pages section from a Jekyll site

  @test:scripts/tests/jekyll-pages-nav.test.ts::jekyllNavPages_—_what_the_theme's_navigation_lists::titled_pages_only;_nav_exclude,_untitled,_underscore_and_asset_paths,_and_front-matter-less_files_are_out
  Scenario: Only titled navigation pages are listed
    Given a site with titled pages, a nav_exclude page, an untitled page, pages under _includes and assets, and an HTML file with no front matter
    When its navigation pages are read
    Then the titles are exactly About, CLI, Custom, Guide, Home, Install, Stray, Use and zebra

  @test:scripts/tests/jekyll-pages-nav.test.ts::jekyllNavPages_—_what_the_theme's_navigation_lists::addresses_are_Jekyll's:_permalink_honoured,_index_pages_as_their_directory
  Scenario: Page addresses are Jekyll's, honouring permalinks and directory indexes
    Given the same site
    When the navigation pages are read
    Then Home is at "/" and Guide at "/guide/"
    And Install is at "/guide/install.html"
    And Custom, with a permalink, is at "/elsewhere/"

  @test:scripts/tests/jekyll-pages-nav.test.ts::pagesNav_—_the_theme's_tree_and_order,_as_rail_rows::top_level_by_nav_order,_then_title_case-insensitively
  Scenario: The top level is ordered by nav_order, then by title case-insensitively
    Given the site's navigation pages under prefix ".."
    When the Pages rows are built
    Then the top-level labels are Home, Guide, Custom, About, Stray, zebra

  @test:scripts/tests/jekyll-pages-nav.test.ts::pagesNav_—_the_theme's_tree_and_order,_as_rail_rows::children_and_grandchildren_nest,_folded_with_a_count
  Scenario: Children and grandchildren nest, folded with a count
    Given the Pages rows of the site
    When the Guide row is read
    Then its children are Install and Use, folded as "2 pages"
    And Use's child is CLI
    And Guide links to "../guide/"

  @test:scripts/tests/jekyll-pages-nav.test.ts::pagesNav_—_the_theme's_tree_and_order,_as_rail_rows::a_page_whose_parent_is_not_listed_stays_reachable,_and_is_reported
  Scenario: A page whose parent is not listed stays reachable and is reported
    Given the Pages rows of the site
    Then Stray is among the top-level rows
    And the orphans are exactly "stray.md"

  @test:scripts/tests/jekyll-pages-nav.test.ts::pagesNav_—_the_theme's_tree_and_order,_as_rail_rows::the_current_page_is_drawn_as_'you_are_here',_not_a_link
  Scenario: The current page is drawn as you-are-here, not a link
    Given the Pages rows built with here "/guide/install.html"
    When the Install row under Guide is read
    Then it is marked current
    And it has no href

  @test:scripts/tests/jekyll-pages-nav.test.ts::the_rail_carries_Pages,_from_shared_data_too::server-rendered_and_browser-drawn_rails_both_show_Pages,_between_the_page's_section_and_Folders
  Scenario: Server-rendered and shared-data rails both show Pages between the page's section and Folders
    Given a page and the site's Pages rows
    When the rail is injected server-side, and again through emitted shared rail data expanded in the page
    Then in both the group labels are the Pages label then the Folders label
    And both link to "../guide/install.html"

  @test:scripts/tests/jekyll-pages-nav.test.ts::xka5_—_Pages_grouped_by_harness_from_the_URL,_with_sub-doc_graphs_from__config.yml_defaults::harnessOfUrl_derives_the_harness_from_/docs/<h>/,_/<outer>/docs/<h>/,_and_/<h>/docs/
  Scenario: The harness is derived from the URL
    When the harness of each URL is read
    Then "/docs/cat-harness/start/" gives cat-harness and "/docs/who-iris/ingest.html" gives who-iris
    And "/cat-harness/docs/smart-base/overview.html" and "/smart-base/docs/index.html" give smart-base
    And "/" and "/guide/install.html" give none

  @test:scripts/tests/jekyll-pages-nav.test.ts::xka5_—_Pages_grouped_by_harness_from_the_URL,_with_sub-doc_graphs_from__config.yml_defaults::_config.yml_defaults_supply_parent_and_nav_exclude;_parent:_''_keeps_a_group_index_at_its_harness_root
  Scenario: _config.yml defaults supply parent and nav_exclude, and parent "" keeps a group index at its harness root
    Given a harness site whose _config.yml defaults set parents by path and exclude */README.md
    When its navigation pages are read
    Then "Start README" is not listed
    And "Start here", with parent "", has no parent
    And Installation's parent is "Start here" and Architecture's is "Concepts"

  @test:scripts/tests/jekyll-pages-nav.test.ts::xka5_—_Pages_grouped_by_harness_from_the_URL,_with_sub-doc_graphs_from__config.yml_defaults::top_level_is_Home_plus_the_harnesses_derived_from_the_URL;_sub-doc_graphs_nest_below_each_harness
  Scenario: The top level is Home plus the harnesses from the URL, with sub-doc graphs nested below each
    Given the harness site's Pages rows, with here on the theming page and locale "en"
    Then there are no orphans and the top level is Home, cat-harness, WHO IRIS
    And cat-harness folds "2 pages", with children Concepts and Start here
    And Start here is at depth 1 with Getting started and Installation at depth 2
    And Architecture is at depth 2 under Concepts, and Theming at depth 3 under it, marked current
    And WHO IRIS links to "../docs/who-iris/" with the child Ingestion

  @test:scripts/tests/jekyll-pages-nav.test.ts::xka5_—_order_within_a_level_is_alphabetical_in_the_reader's_locale::English_('en')_sorts_Ångström_with_A_before_apple_and_Zebra;_Swedish_('sv')_sorts_Ångström_after_Zebra
  Scenario: Order within a level is alphabetical in the reader's locale
    Given pages titled Home, Ångström, apple and Zebra, with Zebra's children beta and Alpha
    When the Pages rows are built for locales "en" and "sv"
    Then English orders Home, Ångström, apple, Zebra
    And Swedish orders Home, apple, Zebra, Ångström
    And Zebra's children in English are Alpha then beta

  @test:scripts/tests/jekyll-pages-nav.test.ts::xka5_—_order_within_a_level_is_alphabetical_in_the_reader's_locale::pageLangOf_reads_<html_lang='…'>_and_defaults_to_'en'
  Scenario: A page's language is read from its html lang, defaulting to en
    When the language of a page with lang "sv" is read
    Then it is "sv"
    And a page with no lang attribute gives "en"

  @test:scripts/tests/jekyll-pages-nav.test.ts::#1261_—_Bibliography:_…_and_Tools_—_…_pages_fold_under_one_parent::one_Bibliography_and_one_Tools_row;_a_family_of_one_stays_flat
  Scenario: Bibliography and Tools families fold to one row each, while a family of one stays flat
    Given pages titled "Bibliography: ...", "Tools — ...", a Tools page, Glossary, Home and "Note: alone"
    When the Pages rows are built
    Then the top level is Bibliography, Glossary, Home, Note: alone, Tools

  @test:scripts/tests/jekyll-pages-nav.test.ts::#1261_—_Bibliography:_…_and_Tools_—_…_pages_fold_under_one_parent::with_no_Bibliography_page,_the_parent_is_a_label-only_fold
  Scenario: With no Bibliography page the parent is a label-only fold
    Given the same family rows
    When the Bibliography row is read
    Then it has no href and folds "2 pages"
    And its children are library/w3c and library/who at depth 1, linking to their bib pages

  @test:scripts/tests/jekyll-pages-nav.test.ts::#1261_—_Bibliography:_…_and_Tools_—_…_pages_fold_under_one_parent::the_Tools_page_is_the_parent_and_keeps_its_link;_the_current_page_stays_current_inside
  Scenario: The Tools page is the parent and keeps its link, with the current page current inside
    Given the same family rows with here on the who-iris tools page
    When the Tools row is read
    Then it links to "../tools/"
    And its children are cat-harness and who-iris
    And who-iris is marked current

  @test:scripts/tests/jekyll-pages-nav.test.ts::bibliography_pages_nest_under_Bibliography_by_parent_(owner,_2026-11-10)::only_Home_and_Bibliography_at_the_top;_entries_two_levels_down
  Scenario: Bibliography pages nest under Bibliography by parent
    Given bibliography pages for a catalogue and a library, each with a nested entry
    When the Pages rows are built
    Then there are no orphans and the top level is Bibliography and Home
    And Bibliography's children are library and si-catalogue at depth 1
    And si-catalogue holds "Open Health Information Exchange" at depth 2
    And library holds "knot"

  @test:scripts/tests/jekyll-pages-nav.test.ts::bibliography_pages_nest_under_Bibliography_by_parent_(owner,_2026-11-10)::labelUnder_drops_only_what_the_parent_already_says
  Scenario: A label under a parent drops only what the parent already says
    When labels are shortened under their parent
    Then "Bibliography: x" under Bibliography is "x"
    And "Bibliography: x/y" under "Bibliography: x" is "y"
    And "WHO: a handbook" and "Plain" are unchanged

  @test:scripts/tests/jekyll-pages-nav.test.ts::a_page_that_declares_its_own_navigation_gives_its_Pages_subtree_(owner,_2026-11-14)::declaredNavsIn_reads_a_parent_page's_declaration_with_site-absolute_hrefs;_anchors_and_leaf_pages_give_none
  Scenario: A parent page's declared navigation is read with site-absolute hrefs
    Given a site whose section page "Guide" declares a menu in its built page, and a leaf page that declares only an in-page anchor
    When the declarations are read for the site's pages
    Then only "/" has one, with entries Home, Framework and Indices
    And Home's items link to "/index.html", "/dependencies.html" and "/faq.html"
    And Framework links to "/framework.pdf" and the off-site Bibliography keeps its URL
    And a declaration of in-page anchors gives none

  @test:scripts/tests/jekyll-pages-nav.test.ts::a_page_that_declares_its_own_navigation_gives_its_Pages_subtree_(owner,_2026-11-14)::the_declaring_page's_children_are_the_declaration:_same_entries,_order_and_nesting,_unsorted_and_unfolded;_stubs_gone,_uncovered_pages_kept_after
  Scenario: The declaring page's Pages children are its declaration
    Given the same site's Pages rows with its declarations and locale "en"
    Then Guide's children are Home, Framework, Indices in the declared order, then Notes
    And Home holds Summary, Dependencies and FAQ, and Indices holds Artifact Index, Bibliography, "Profile: B" and "Profile: A", neither sorted nor folded
    And the stub group pages are not drawn, and Notes, which the declaration does not reach, is kept

  @test:scripts/tests/jekyll-pages-nav.test.ts::a_page_that_declares_its_own_navigation_gives_its_Pages_subtree_(owner,_2026-11-14)::without_declarations_the_front-matter_tree_is_unchanged:_stubs_as_groups,_sorted_in_the_reader's_locale
  Scenario: Without declarations the front-matter tree is unchanged
    Given the same site's Pages rows without declarations
    Then Guide's children are Home, Indices and Notes, sorted in the reader's locale
    And Home links to its stub page
