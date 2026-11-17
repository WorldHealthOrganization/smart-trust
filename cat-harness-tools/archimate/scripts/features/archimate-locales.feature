# Specifies the ArchiMate pages in every language a layer translates
# (archimate/scripts/archimate-locales.ts, issue #2350): the template, the
# composed strings, and the locale's pages, model and drawings.
Feature: The ArchiMate pages are drawn in every language the layer has a catalogue for

  @test:archimate/scripts/archimate-locales.test.ts::the_words_archimate.js_writes::are_its_T()_and_F()_strings,_those_with_no_words_left_out
  Scenario: The script's words are its T() and F() strings
    Given a script calling T("Views"), F("{0} views · {1} elements", …), F("{0} ({1})", …) and T("None.")
    When its strings are read
    Then they are "Views", "{0} views · {1} elements" and "None."

  @test:archimate/scripts/archimate-locales.test.ts::the_words_archimate.js_writes::are_all_wrapped_in_the_shipped_script
  Scenario: The shipped script's words are wrapped
    When the strings of archimate.js are read
    Then they include "Relationships ({0})", "No documentation." and "Could not load {0}: {1}"

  @test:archimate/scripts/archimate-locales.test.ts::compose::translates_a_page_title,_a_relationship_and_a_typed_name_part_by_part
  Scenario: A composed string is translated part by part
    Given translations of the model's title, "Clinic", "Registry", "Serving" and "Business Actor"
    When "Clinic — <title>", "Serving: Registry → Clinic — <title>" and "Clinic (Business Actor)" are composed
    Then each reads in French, with its separators kept

  @test:archimate/scripts/archimate-locales.test.ts::compose::gives_nothing_when_a_part_has_no_translation,_or_the_type_is_not_the_model's
  Scenario: A string with an untranslated part, or a non-type prefix, is not composed
    When "Serving: Registry → Pharmacy" and "Strategy: what it can do" are composed
    Then neither gives a translation

  @test:archimate/scripts/archimate-locales.test.ts::the_template::holds_the_pages'_words,_the_model's,_the_drawings'_and_the_script's
  Scenario: The template holds every word a reader sees
    Given a layer's pages, model, drawing and the script
    When the template is made
    Then it holds the model's title, names, documentation and folders, the type labels and the script's strings

  @test:archimate/scripts/archimate-locales.test.ts::the_template::leaves_out_what_is_composed_of_other_entries,_and_Archi_ids
  Scenario: Composed strings and Archi ids are not in the template
    When the template is made
    Then it has no page title, relationship label or typed name that its parts compose
    And no msgid starting "id-"

  @test:archimate/scripts/archimate-locales.test.ts::localizedArchimateFiles::writes_each_page_under_the_locale,_translated,_its_title_composed
  Scenario: Each page is written under the locale, translated
    Given a French catalogue
    When the files are localized
    Then the element page under fr/ has lang "fr", the title "Clinique — Démo sur l’AR" and the heading "Clinique"
    And the relationship page's title is composed in French

  @test:archimate/scripts/archimate-locales.test.ts::localizedArchimateFiles::points_the_page_at_the_locale's_model_and_drawing,_and_carries_the_script's_catalogue
  Scenario: A locale's page reads the locale's model and drawing
    When the view page under fr/ is read
    Then its data-kg-model names model.fr.json and its data-kg-svg names v1.fr.svg
    And it carries the am-i18n block with "Views" as "Vues", and an alternate to the English page

  @test:archimate/scripts/archimate-locales.test.ts::localizedArchimateFiles::translates_the_model's_words_and_leaves_its_ids_and_types
  Scenario: The locale's model has its words translated
    When model.fr.json is read
    Then names, documentation and folders are French where the catalogue has them, and ids and types are unchanged

  @test:archimate/scripts/archimate-locales.test.ts::localizedArchimateFiles::draws_the_drawing's_labels_in_the_locale,_its_links_into_the_locale's_pages
  Scenario: The locale's drawing is labelled in the locale and links into its pages
    When v1.fr.svg is read
    Then its text and titles are French and its links go to fr/ pages

  @test:archimate/scripts/archimate-locales.test.ts::localizedArchimateFiles::gives_the_English_pages_their_language_links,_and_leaves_the_thin_pages_at_the_IRIs_alone
  Scenario: English pages gain language links, thin pages stay as they are
    When the files are localized
    Then the English model page has an alternate to fr/
    And the thin page at an element's IRI is unchanged and has no locale copy

  @test:archimate/scripts/archimate-locales.test.ts::localizedArchimateFiles::with_no_catalogue,_writes_the_files_as_they_are
  Scenario: With no catalogue nothing changes
    When the files are localized with no catalogue
    Then they are written as they are
