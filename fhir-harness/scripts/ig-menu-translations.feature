Feature: A translated IG page's top bar reads in the page's language, and its unreviewed labels count against the page

  The menu gets a gettext catalogue per locale, like the pages. Its review is
  read from the catalogue's translation node; no record that a person
  reviewed it means not reviewed.

  @test:scripts/ig-menu-translations.test.ts::menu_translations_(fhir-harness#417)::the_labels_are_the_title,_then_each_group_and_its_items,_each_once
  Scenario: the menu's template holds the IG title, each group and each item, once each
    Given a menu with a page group and a dropdown group
    Then its labels are the title, then each group followed by its items, with no repeats
    And the template has one empty entry per label

  @test:scripts/ig-menu-translations.test.ts::menu_translations_(fhir-harness#417)::a_menu_catalogue_with_no_review_record_is_not_reviewed
  Scenario: a translated menu with no review record is not reviewed
    Given a French menu catalogue and no translation node for it
    Then the French menu is not reviewed

  @test:scripts/ig-menu-translations.test.ts::menu_translations_(fhir-harness#417)::a_sign-off_against_the_current_labels_is_reviewed,_one_against_older_labels_is_not
  Scenario: a sign-off counts only against the labels as they are now
    Given a translation node signed off against the current labels
    Then the French menu is reviewed
    But a node signed off against older labels leaves it not reviewed

  @test:scripts/ig-menu-translations.test.ts::menu_translations_(fhir-harness#417)::a_catalogue_that_translates_nothing_offers_no_locale
  Scenario: an empty or absent menu catalogue offers no translated menu
    Given a French menu catalogue with no translated entry, or none at all
    Then no locale has a translated menu

  @test:scripts/ig-menu-translations.test.ts::menu_translations_(fhir-harness#417)::the_localised_menu_translates_labels_and_points_links_at_translated_pages_only
  Scenario: the French menu translates labels and links to French pages where they exist
    Given a French menu catalogue and French copies of the home page and "concepts"
    Then the labels are French where translated and English otherwise
    And the links to translated pages point at their French copies, the others at the source pages

  @test:scripts/ig-menu-translations.test.ts::menu_translations_(fhir-harness#417)::the_bar_renders_in_the_page's_language,_marked_when_unreviewed,_and_stays_one_liftable_block
  Scenario: one top bar serves every language, and marks an unreviewed menu
    Given a top bar with an unreviewed French menu
    When a French page renders it
    Then it reads "Exigences métier", links home to the French home page, and carries the not-reviewed mark
    And an English page renders the English labels with no mark
    And the bar is still one block that a composed layout can lift whole

  @test:scripts/ig-menu-translations.test.ts::menu_translations_(fhir-harness#417)::an_unreviewed_menu_makes_every_translated_page_in_its_locale_not_reviewed
  Scenario: a signed-off page under an unreviewed menu is still not reviewed
    Given a French page whose own translation is signed off, under a French menu nobody reviewed
    When the IG site is staged
    Then the French page's front matter says translation_reviewed false

  @test:scripts/ig-menu-translations.test.ts::menu_translations_(fhir-harness#417)::the_template_is_written_for_each_locale,_and_--check_reports_a_stale_one
  Scenario: the menu template is written into each locale and checked for staleness
    Given a translations directory with a French locale and no menu template
    Then the check reports it stale, writing creates it, and the check then passes
