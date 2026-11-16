Feature: the glossary translation templates

  @test:scripts/glossary-pot.test.ts::glossary_.pot:_authored_terms_only::floorOfCoreTerms
  Scenario: has a floor: at least the 7 core terms, each with a label and a definition
    When the authored terms and template messages are counted
    Then there are at least 7 terms and 14 messages

  @test:scripts/glossary-pot.test.ts::glossary_.pot:_authored_terms_only::exactlyAuthoredText
  Scenario: holds exactly the authored terms' labels and definitions
    When the template messages are compared with the authored terms
    Then they are exactly their labels and definitions

  @test:scripts/glossary-pot.test.ts::glossary_.pot:_authored_terms_only::noCandidateText
  Scenario: holds no candidate text, and no extracted scheme has a template
    When the templates are checked for extracted schemes and candidate text
    Then no extracted scheme has a template
    And more than 1000 candidate texts exist and none is in a template

  @test:scripts/glossary-pot.test.ts::glossary_.pot:_authored_terms_only::termIriIsComment
  Scenario: every term IRI is the translator comment, and is unique
    When the translator comments are read
    Then there is one term IRI per authored term, all unique

  @test:scripts/glossary-pot.test.ts::glossary_.pot:_authored_terms_only::everyLocaleCarriesSet
  Scenario: the committed templates in every locale carry that set
    When the committed templates of ar, es, fr, ru and zh are read
    Then each exists and carries the same messages

  @test:scripts/glossary-pot.test.ts::the_locale_page's_chrome_template_(bean_c592)::localePageChromeTemplate
  Scenario: holds exactly the page's own strings, as ui-strings, and no term text
    When the locale page template is read
    Then it holds exactly the page's own strings, as ui-strings

  @test:scripts/glossary-pot.test.ts::potEntries_on_a_mixed_scheme::mixedSchemeAuthoredOnly
  Scenario: extracts the authored term's source-language label, alt label and definition, and nothing else
    When template entries are made from a mixed scheme
    Then they are the authored term's label, alt label and definition only

  @test:scripts/glossary-pot.test.ts::the_check_is_blind_to_where_a_layer_sits_in_the_checkout_(owner_card_Q-TRAIN-8)::checkBlindToPath
  Scenario: the same template, checked out under a different path, is current
    When the same template is checked at two paths
    Then the results are equal

  @test:scripts/glossary-pot.test.ts::the_check_is_blind_to_where_a_layer_sits_in_the_checkout_(owner_card_Q-TRAIN-8)::changedMsgidOutOfDate
  Scenario: a changed msgid is still out of date
    When templates with different messages are checked
    Then the results differ
