# pipeline/bibtex-format.ts formats CSL-JSON references as BibTeX with pure functions,
# and export-bibtex.ts heads the file with the folio's own title.
# Each Scenario names the test that executes it.
Feature: CSL-JSON to BibTeX formatting

  @test:pipeline/bibtex-format.test.ts::cslToBibtex::a_journal_article,_fields_aligned,_pages_with_an_en_dash
  Scenario: A journal article formats with aligned fields and an en-dash page range
    Given the CSL article "garoufalidis2004" with one author, a journal, year, volume, pages "291-309" and a DOI
    When it is formatted as BibTeX
    Then the output is exactly an "@article{garoufalidis2004," entry with its field names padded to one column
    And the title is double-braced
    And the pages read "291--309"

  @test:pipeline/bibtex-format.test.ts::cslToBibtex::an_annotation,_when_given,_is_a_field;_absent,_it_is_not
  Scenario: An annotation is a field only when one is given
    Given the CSL article "garoufalidis2004"
    When it is formatted with the annotation "[Verified] 50% sure"
    Then the entry holds "annotation = {[Verified] 50\% sure},"
    And when it is formatted with a null annotation the entry has no annotation field

  @test:pipeline/bibtex-format.test.ts::cslToBibtex::an_organisation_author_stays_whole,_and_a_thesis's_publisher_is_its_school
  Scenario: An organisation author stays whole and a thesis's publisher becomes its school
    Given a thesis "who2014" by the literal author "World Health Organization" published by "Université"
    When it is formatted as BibTeX
    Then the author field is "World Health Organization" unsplit
    And the school field is the TeX-escaped "Université"
    And the entry starts with "@phdthesis{who2014,"

  @test:pipeline/bibtex-format.test.ts::helpers::texEscape_escapes_&_and_%_and_accents
  Scenario: TeX escaping covers ampersands, percent signs and accents
    When "A & B 5% é" is TeX-escaped
    Then the ampersand and percent sign are backslash-escaped
    And the "é" becomes a braced TeX acute accent

  @test:pipeline/bibtex-format.test.ts::helpers::formatPerson:_family,_given;_particle;_suffix
  Scenario: A person is formatted family first, with particle and suffix placed
    When a person with family "Neumann" and given "Walter" is formatted
    Then it reads "Neumann, Walter"
    And a non-dropping particle "de" leads the family name, giving "de Bruijn, N. G."
    And a suffix "Jr." follows the family name, giving "King, Jr., Martin"

  @test:pipeline/bibtex-format.test.ts::helpers::ordinal
  Scenario: Numbers get English ordinal suffixes
    When 1, 2, 3, 4, 11, 21 and 112 are made ordinal
    Then they read "1st", "2nd", "3rd", "4th", "11th", "21st" and "112th"

  @test:pipeline/bibtex-format.test.ts::export-bibtex_header_(de-hardcoded_title)::uses_the_folio_config_title_when_declared,_never_a_hardcoded_folio_name
  Scenario: The BibTeX header names the folio's configured title, never a hardcoded one
    Given an empty folio directory
    Then the header is "% Bibliography" and does not name "Quantum Observable Universe"
    When a config declaring the title "Sample Folio" is written
    Then the header is "% Bibliography for Sample Folio"
    And a bibliography built in that folio carries that header and the "@article{garoufalidis2004," entry
