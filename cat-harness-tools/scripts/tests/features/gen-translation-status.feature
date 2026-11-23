# scripts/gen-translation-status.ts counts the entries of each locale's .po catalogues (translated, fuzzy,
# untranslated), works out each locale's officiality, and renders the themed translation status page.
# Each Scenario names the test that executes it.
Feature: Translation status counts and page

  @test:scripts/tests/gen-translation-status.test.ts::the_header_entry_is_metadata,_not_a_string::a_catalogue_with_ONLY_a_header_has_no_entries
  Scenario: A catalogue with only a header has no entries
    Given a catalogue holding only its header entry
    When it is counted
    Then it has 0 entries, 0 translated, 0 fuzzy and 0 untranslated

  @test:scripts/tests/gen-translation-status.test.ts::the_header_entry_is_metadata,_not_a_string::and_it_does_not_shift_the_count_of_the_entries_that_follow
  Scenario: The header does not shift the count of the entries that follow
    Given a catalogue with a header and one entry "Hello" translated as "Hola"
    When it is counted
    Then it has 1 entry, 1 translated

  @test:scripts/tests/gen-translation-status.test.ts::fuzzy_is_counted_APART_from_translated::a_fuzzy_entry_is_neither_translated_nor_untranslated
  Scenario: A fuzzy entry is neither translated nor untranslated
    Given a catalogue with one translated entry flagged "#, fuzzy"
    When it is counted
    Then it has 1 entry, 0 translated, 1 fuzzy and 0 untranslated

  @test:scripts/tests/gen-translation-status.test.ts::fuzzy_is_counted_APART_from_translated::a_flag_line_carrying_other_flags_still_registers_fuzzy
  Scenario: A flag line carrying other flags still registers fuzzy
    Given an entry flagged "#, fuzzy, c-format"
    When the catalogue is counted
    Then it has 1 fuzzy entry

  @test:scripts/tests/gen-translation-status.test.ts::fuzzy_is_counted_APART_from_translated::a_comment_merely_CONTAINING_the_word_fuzzy_is_not_a_flag
  Scenario: A translator comment containing the word fuzzy is not a flag
    Given a translated entry with the comment "# this one was fuzzy last week"
    When the catalogue is counted
    Then it has 0 fuzzy and 1 translated

  @test:scripts/tests/gen-translation-status.test.ts::plural_forms_live_in_msgstr[n],_not_msgstr::a_translated_plural_counts_as_translated
  Scenario: A translated plural counts as translated
    Given a plural entry with both msgstr[0] and msgstr[1] filled
    When the catalogue is counted
    Then it has 1 entry, 1 translated, 0 fuzzy and 0 untranslated

  @test:scripts/tests/gen-translation-status.test.ts::plural_forms_live_in_msgstr[n],_not_msgstr::an_empty_plural_set_counts_as_untranslated
  Scenario: An empty plural set counts as untranslated
    Given a plural entry with empty msgstr[0] and msgstr[1]
    When the catalogue is counted
    Then it has 1 entry, 0 translated, 0 fuzzy and 1 untranslated

  @test:scripts/tests/gen-translation-status.test.ts::continuation_lines_are_part_of_the_value::a_long_translation_split_over_lines_is_translated
  Scenario: A long translation split over continuation lines is translated
    Given an entry whose msgstr is "" followed by two continuation lines of text
    When the catalogue is counted
    Then it has 1 translated and 0 untranslated

  @test:scripts/tests/gen-translation-status.test.ts::continuation_lines_are_part_of_the_value::a_genuinely_empty_msgstr_is_still_untranslated
  Scenario: A genuinely empty msgstr is untranslated
    Given an entry whose msgstr is "" with no continuation lines
    When the catalogue is counted
    Then it has 1 entry, 0 translated, 0 fuzzy and 1 untranslated

  @test:scripts/tests/gen-translation-status.test.ts::the_whole_is_the_sum_of_its_entries::a_mixed_catalogue_adds_up,_and_the_three_states_partition_the_entries
  Scenario: A mixed catalogue adds up and the three states partition the entries
    Given a catalogue with one translated, one fuzzy and one empty entry
    When it is counted
    Then it has 3 entries, 1 translated, 1 fuzzy and 1 untranslated
    And translated plus fuzzy plus untranslated equals the entries

  @test:scripts/tests/gen-translation-status.test.ts::a_share_over_an_empty_denominator_has_NO_BASIS::zero_denominator_is_null,_never_0
  Scenario: A share over a zero denominator is null
    When the share of 0 over 0 and of 5 over 0 is taken
    Then both are null

  @test:scripts/tests/gen-translation-status.test.ts::a_share_over_an_empty_denominator_has_NO_BASIS::a_real_share_is_a_percentage_to_one_decimal
  Scenario: A real share is a percentage to one decimal
    When shares are taken
    Then 1 of 3 is 33.3, 19 of 318 is 6 and 4 of 4 is 100

  @test:scripts/tests/gen-translation-status.test.ts::a_share_over_an_empty_denominator_has_NO_BASIS::zero_of_something_is_0,_which_is_NOT_the_same_as_no_basis
  Scenario: Zero of a real denominator is 0, not null
    When the share of 0 over 40 is taken
    Then it is 0

  @test:scripts/tests/gen-translation-status.test.ts::the_date_on_the_page_is_when_the_numbers_CHANGED::two_runs_on_different_days_render_identically_apart_from_the_date
  Scenario: Two runs on different days render identically apart from the date
    Given one locale's counts
    When the status page is rendered with change dates 2026-01-05 and 2026-09-22
    Then the two pages differ
    And they are equal once every ISO date is blanked

  @test:scripts/tests/gen-translation-status.test.ts::the_date_on_the_page_is_when_the_numbers_CHANGED::a_changed_COUNT_survives_the_blanking,_so_the_check_still_fires
  Scenario: A changed count survives the date blanking
    Given one locale's counts and the same locale with one more translated string
    When both pages are rendered on the same date and their dates are blanked
    Then the two pages differ

  @test:scripts/tests/gen-translation-status.test.ts::the_date_on_the_page_is_when_the_numbers_CHANGED::the_page_is_THEMED,_so_it_carries_the_site's_top_band_(2026-10-07)
  Scenario: The status page is themed and carries the site's top band
    # Gap: the top band is not rendered; only the default layout front matter is checked
    When the status page is rendered
    Then it starts with front matter naming "layout: default"
    And it has no doctype, html, head, body or main element
    And it contains the heading with id "ts-title"
    And it has no CSS selector outside ".ts-page"
    And it has no script

  @test:scripts/tests/gen-translation-status.test.ts::the_date_on_the_page_is_when_the_numbers_CHANGED::the_skill_link_climbs_to_the_SITE_ROOT_from_the_page's_own_depth_(folio-assistant#2527)
  Scenario: The skill link climbs to the site root from the page's own depth
    When the status page is rendered with no site root given
    Then the translation-manager skill link is "../../../reference/skill-instructions/translation-manager.html"
    And there is no link starting "../reference/"
    And with site root "../../" the link is "../../reference/skill-instructions/translation-manager.html"

  @test:scripts/tests/gen-translation-status.test.ts::the_date_on_the_page_is_when_the_numbers_CHANGED::the_SCOPE_is_on_the_page,_so_a_number_cannot_be_read_as_covering_everything
  Scenario: The scope is shown on the page
    When the status page is rendered with scope "cat-harness/translations"
    Then the page contains "cat-harness/translations"

  @test:scripts/tests/gen-translation-status.test.ts::another_instance's_catalogues_are_measured,_in_their_own_table_—_issue_#2228::a_sibling_instance_that_declares_translation-sources_is_found,_and_the_handler_itself_is_not
  Scenario: A sibling instance that declares translation-sources is found, and the handler itself is not
    Given a repository with instances "handler" and "inst" declaring a translation-sources directory and "undeclared" declaring none, each with one fr catalogue
    When the other instances are looked up from "handler"
    Then only "inst" is found
    And its fr locale has 1 catalogue, 1 entry and 1 translated

  @test:scripts/tests/gen-translation-status.test.ts::another_instance's_catalogues_are_measured,_in_their_own_table_—_issue_#2228::each_instance_is_its_own_table,_with_ids_that_do_not_collide_with_the_first
  Scenario: Each instance gets its own table with ids that do not collide
    Given a fr locale for this instance and for instance who-iris
    When the status page is rendered
    Then it contains id "locale-fr" and id "who-iris-locale-fr"
    And it names the scope "who-iris/translations" in code

  @test:scripts/tests/gen-translation-status.test.ts::translation_status_visualiser_wireframe_findings_(bgrz)::finding_1:_table_has_horizontal_scroll_wrapper,_scroll_hint,_and_mobile_breathing_room
  Scenario: The table has a horizontal scroll wrapper, a scroll hint and a minimum width
    # Gap: the page is not laid out; only the markup and CSS text are checked
    When the status page is rendered for ar, es and fr
    Then it contains the classes "ts-table-wrapper" and "ts-scroll-hint"
    And it contains "overflow-x: auto", "min-width: 36rem" and "fa-scroll-cue"

  @test:scripts/tests/gen-translation-status.test.ts::translation_status_visualiser_wireframe_findings_(bgrz)::finding_2:_styles_support_prefers-color-scheme:_light_without_overriding_explicit_dark_theme
  Scenario: The styles support a light colour scheme and the explicit dark and light themes
    # Gap: that the light media query does not override an explicit dark theme is not checked; only the selectors' presence
    When the status page is rendered
    Then it contains "@media (prefers-color-scheme: light)"
    And it contains selectors for data-fa-scheme "dark" and "light"

  @test:scripts/tests/gen-translation-status.test.ts::translation_status_visualiser_wireframe_findings_(bgrz)::finding_3:_languageName_renders_human-readable_language_names_alongside_locale_codes
  Scenario: Language names are rendered alongside locale codes
    When language names are looked up
    Then ar, es, fr, ru and zh are Arabic, Spanish, French, Russian and Chinese
    And an unknown locale has no name
    And the rendered page shows each locale code followed by its language name in a "ts-lang-name" span

  @test:scripts/tests/gen-translation-status.test.ts::translation_status_visualiser_wireframe_findings_(bgrz)::finding_4:_visual_separation_between_catalogue_availability_(Q1)_and_string_metrics_(Q2)
  Scenario: Catalogue availability and string metrics are marked as separate questions
    # Gap: the visual separation is not rendered; only the markup text is checked
    When the status page is rendered
    Then it contains the "ts-questions-legend" class with "Question 1 (Availability)" and "Question 2 (Completeness)"
    And it contains the column classes "ts-col-catalogues" and "ts-col-strings"
    And it contains "Q1: availability" and "Q2: strings"

  @test:scripts/tests/gen-translation-status.test.ts::translation_status_visualiser_wireframe_findings_(bgrz)::finding_5:_onward_links_to_translation-manager_skill_and_source_files
  Scenario: The page links onward to the translation-manager skill and the source files
    When the status page is rendered
    Then it links to "../../../reference/skill-instructions/translation-manager.html"
    And it has an element with id "onward-links"
    And it links to the cat-harness/translations tree on GitHub and to its fr folder

  @test:scripts/tests/gen-translation-status.test.ts::translation_status_visualiser_wireframe_findings_(bgrz)::finding_6:_accessibility_markup_is_preserved_(th_scope=col_and_th_scope=row)
  Scenario: Table headers carry column and row scope
    When the status page is rendered for three locales
    Then it has 7 column headers with scope col
    And it has 3 row headers with scope row, one per locale

  @test:scripts/tests/gen-translation-status.test.ts::officiality_per_locale,_from_BOTH_records_(bean_cat-tools-bbnd)::silence_on_both_sides_is_unofficial,_which_is_the_state_everywhere_today
  Scenario: Silence on both records is unofficial
    Given a locale with one catalogue claiming nothing and no status.json
    When its officiality is read
    Then it is unofficial with 0 official catalogues and 0 findings

  @test:scripts/tests/gen-translation-status.test.ts::officiality_per_locale,_from_BOTH_records_(bean_cat-tools-bbnd)::status.json_official,_named,_and_every_catalogue_agreeing_is_official
  Scenario: An official, named status.json with every catalogue agreeing is official
    Given a locale whose catalogue claims official and whose status.json is official, signed off by "Dr. A" on 2026-10-01
    When its officiality is read
    Then it is official, signed off by "Dr. A" on 2026-10-01, with 1 official catalogue and 0 findings
    And its label is "official, signed off by Dr. A on 2026-10-01"

  @test:scripts/tests/gen-translation-status.test.ts::officiality_per_locale,_from_BOTH_records_(bean_cat-tools-bbnd)::a_catalogue_claiming_official_with_no_status.json_is_a_DISAGREEMENT,_never_official
  Scenario: A catalogue claiming official with no status.json is a disagreement
    Given a locale with one catalogue claiming official, one claiming nothing, and no status.json
    When its officiality is read
    Then its state is "disagree" with 1 finding
    And its label contains "records disagree"

  @test:scripts/tests/gen-translation-status.test.ts::officiality_per_locale,_from_BOTH_records_(bean_cat-tools-bbnd)::each_catalogue_is_listed_with_its_counts_and_its_own_header,_for_the_per-row_drawer
  Scenario: Each catalogue is listed with its counts and its own header
    Given a fr locale with a.po claiming official and b.po claiming nothing
    When the locale statuses are read
    Then fr lists a.po with 1 translated and official "yes", and b.po with 1 translated and no official claim

  @test:scripts/tests/gen-translation-status.test.ts::officiality_per_locale,_from_BOTH_records_(bean_cat-tools-bbnd)::an_unreadable_status.json_is_could-not-determine,_not_unofficial
  Scenario: An unreadable status.json is could-not-determine, not unofficial
    Given a locale whose status.json is not valid JSON
    When its officiality is read
    Then its state is "unreadable"

  @test:scripts/tests/gen-translation-status.test.ts::officiality_per_locale,_from_BOTH_records_(bean_cat-tools-bbnd)::the_status_table_carries_a_signed-off_column_with_the_state_as_data
  Scenario: The status table carries the officiality state as data
    Given a fr locale that is unofficial
    When the status page is rendered
    Then it contains data-fa-tr-locale "fr" and data-fa-tr-officiality "unofficial"
    And it contains "not signed off"
