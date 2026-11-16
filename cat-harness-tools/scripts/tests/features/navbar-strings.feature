# The rail in the page's language (owner, 2026-11-12): a site's navbar.po
# becomes a strings file, and the rail swaps labels by exact match. Each
# Scenario names the test that executes it.
Feature: Navbar strings in the page's language

  @test:scripts/tests/navbar-strings.test.ts::the_rail's_own_words_are_declared_once::lists_every_section_label_and_both_control_names
  Scenario: The rail's own words are declared once
    Then the rail chrome strings list every section label and both control names
    And every POT entry for them is a ui-string with a comment

  @test:scripts/tests/navbar-strings.test.ts::the_rail's_own_words_are_declared_once::the_drawn_rail_and_the_inlined_drag_edge_say_the_declared_names
  Scenario: The drawn rail and the drag edge say the declared names
    Then the inlined drag-edge code holds the declared resize label
    And a drawn rail holds the declared toggle label

  @test:scripts/tests/navbar-strings.test.ts::a_site's_navbar.po_becomes_a_strings_file::keeps_translated_entries_only_—_no_empty,_no_fuzzy,_no_header
  Scenario: Only translated entries are kept
    When a navbar.po with a header, an empty translation and a fuzzy entry is read
    Then the map holds only the two translated entries

  @test:scripts/tests/navbar-strings.test.ts::a_site's_navbar.po_becomes_a_strings_file::writes_strings-<locale>.js_for_a_locale_with_translations,_and_nothing_for_one_without
  Scenario: A strings file is written for a locale with translations, and nothing for one without
    Given translations for ar, an es navbar.po with no translations, and fr with no navbar.po
    When the navbar strings are written
    Then ar is written and es reported empty
    And the ar file is the strings body for the ar map, assigning into the global, and no es file exists

  @test:scripts/tests/navbar-strings.test.ts::a_site's_navbar.po_becomes_a_strings_file::a_checkout_with_no_translations_writes_nothing
  Scenario: A checkout with no translations writes nothing
    When the navbar strings are written from a translations directory that does not exist
    Then nothing is written and nothing is empty

  @test:scripts/tests/navbar-strings.test.ts::which_pages_ask_for_a_file::a_non-English_<html_lang>;_never_English_or_none
  Scenario: Only a non-English html lang asks for a file
    Then ar and zh ask for their files
    And EN, en-GB, the empty string and null do not

  @test:scripts/tests/navbar-strings.test.ts::which_pages_ask_for_a_file::builds_the_file's_address_only_from_a_language_tag_and_a_relative_root
  Scenario: The file's address is built only from a language tag and a relative root
    Then pt-br is a locale, while a tag carrying markup or a path is not
    And ., .., ../.., ../../ and the empty string are root paths, ../.. kept as it is
    And an absolute URL, a protocol-relative URL, an absolute path, ../x and a javascript: URL are not

  @test:scripts/tests/navbar-strings.test.ts::the_swap_is_exact_match_or_nothing::replaces_a_whole_label,_keeps_its_surrounding_space,_and_leaves_an_unknown_one_English
  Scenario: The rail swaps whole labels and leaves unknown ones in English
    Given rail labels " Pages ", "Business Requirements", "Business" and "Fictional Countries"
    When the rail is localised
    Then two are swapped, " Pages " keeping its surrounding space, and the partial and unknown labels stay English

  @test:scripts/tests/navbar-strings.test.ts::the_swap_is_exact_match_or_nothing::translates_names_and_tooltips_the_same_way
  Scenario: Names and tooltips are translated the same way
    Given an element whose aria-label and tooltip are the toggle label, and one with an unknown title
    When the rail is localised
    Then both attributes of the first are translated and the second is unchanged

  @test:scripts/tests/navbar-strings.test.ts::the_page's_top_bar_takes_the_same_map::swaps_whole_labels_at_any_depth,_never_script_text_or_a_partial_match
  Scenario: The page's top bar swaps whole labels at any depth, never script text or a partial match
    Given a top bar with the home label, a nested summary and list item, a partial match, a script, and a search placeholder
    When the page bar is localised
    Then four are swapped: the home label, the summary keeping its space, the list item, and the placeholder
    And the partial match and the script text are unchanged

  @test:scripts/tests/navbar-strings.test.ts::the_page's_top_bar_takes_the_same_map::a_page_with_no_top_bar_is_left_alone
  Scenario: A page with no top bar is left alone
    When a page with no top bar is localised
    Then nothing is swapped
