# pipeline/reference-entries.ts reads a folio's bibliography in both layouts at once: one CSL-JSON
# file per entry under references/, and the ref({…}) calls left in schema/references.ts.
# Each Scenario names the test that executes it.
Feature: Reading a folio's reference entries

  @test:pipeline/reference-entries.test.ts::referenceEntries::module_entries_the_files_do_not_already_hold_are_added;_unparseable_files_skipped
  Scenario: Module entries the files lack are added and unparseable files are skipped
    Given a folio with reference files "garoufalidis2004.json", "who2014.json" and an unparseable "broken.json"
    And a references module whose ref({…}) calls name "leitner2026" then "garoufalidis2004", with a commented-out "ghost"
    When the reference entries are read
    Then the entries are file "garoufalidis2004", file "who2014" and module "leitner2026"

  @test:pipeline/reference-entries.test.ts::referenceEntries::ordered_as_the_module_orders_them;_entries_it_does_not_name_follow_by_name
  Scenario: Entries follow the module's order, then the rest by name
    Given a folio with reference files "garoufalidis2004.json", "who2014.json" and an unparseable "broken.json"
    And a references module whose ref({…}) calls name "leitner2026" then "garoufalidis2004", with a commented-out "ghost"
    When the reference entries are read
    Then the ids are in the order "leitner2026", "garoufalidis2004", "who2014"

  @test:pipeline/reference-entries.test.ts::referenceEntries::the_conventional_directory_is_found_when_nothing_is_declared
  Scenario: The conventional references directory is found when none is declared
    Given a folio with reference files "garoufalidis2004.json", "who2014.json" and an unparseable "broken.json"
    And a references module whose ref({…}) calls name "leitner2026" then "garoufalidis2004", with a commented-out "ghost"
    When the reference directories are resolved
    Then the only directory is "folio/references" under the root

  @test:pipeline/reference-entries.test.ts::referenceEntries::fields_read_the_same_from_a_file_and_from_a_ref({…})_body
  Scenario: Fields read the same from a file and from a ref({…}) body
    Given a folio with reference files "garoufalidis2004.json", "who2014.json" and an unparseable "broken.json"
    And a references module whose ref({…}) calls name "leitner2026" then "garoufalidis2004", with a commented-out "ghost"
    When the entries' fields are read
    Then the title of "garoufalidis2004" is read from its file and the title of "leitner2026" has its escaped quotes unescaped
    And the issued years are "2004", "2026" and none for "who2014"
    And the author names are "Garoufalidis", "World Health Organization" (a literal) and "Leitner"
    And the URLs are the DOI URL for "garoufalidis2004", the URL field for "who2014" and for "leitner2026"

  @test:pipeline/reference-entries.test.ts::referenceEntries::a_folio_with_only_the_module_still_reads_every_entry_(the_layout_before_a_split)
  Scenario: A folio with only the module still reads every entry
    Given a folio with only the references module
    When the reference entries are read
    Then the ids are "leitner2026" and "garoufalidis2004"

  @test:pipeline/reference-entries.test.ts::referenceEntries::a_folio_with_neither_reads_nothing
  Scenario: A folio with neither layout reads nothing
    Given a folio with no reference files and no references module
    When the reference entries are read
    Then there are no entries

  @test:pipeline/reference-entries.test.ts::referenceEntries::a_ref({…})_named_in_a_comment_is_not_an_entry,_and_does_not_swallow_the_ones_after_it
  Scenario: A ref({…}) inside a comment is not an entry and swallows nothing after it
    Given a folio with only the references module, whose comment names ref({ id: "ghost" })
    When the reference entries are read
    Then "ghost" is not among the ids
    And the ids are still "leitner2026" and "garoufalidis2004"

  @test:pipeline/reference-entries.test.ts::source-ledger-index_reads_split_references::ids,_URLs_and_arXiv_ids_come_from_the_files_and_the_module_alike
  Scenario: The source ledger index reads ids, URLs and arXiv ids from files and module alike
    Given a folio with reference files "garoufalidis2004.json" and "who2014.json" and the references module
    When the source ledger index reads its references
    Then the ids are "garoufalidis2004", "leitner2026" and "who2014"
    And arXiv id "2601.00001" maps to "leitner2026"
    And the URL of "garoufalidis2004" is its DOI URL

  @test:pipeline/reference-entries.test.ts::source-ledger-index_reads_split_references::reads_.jsonld_Reference_nodes_and_resolves_cites-resolve_against_them_alongside_the_registry
  Scenario: JSON-LD Reference nodes are read and satisfy cites-resolve alongside the registry
    Given a folio with "garoufalidis2004.json" and a JSON-LD Reference node "knuth1984.jsonld"
    When the reference entry ids and all resolvable reference ids are read
    Then the entry ids are "garoufalidis2004" and "knuth1984"
    And both are among the resolvable ids
    And the cites-resolve rule passes a theorem citing both
    And it reports "missing2099" for a theorem citing that id
