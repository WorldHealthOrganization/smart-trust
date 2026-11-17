# The partition engine's import extraction sees every import form this
# repository writes, the bare side-effect form included (bean q2wn). Each
# Scenario names the test that executes it.
Feature: Extracting import specifiers for the partition

  @test:scripts/tests/partition-imports.test.ts::the_bare_side-effect_form,_which_is_how_every_registration_edge_is_written::a_bare_import_on_its_own_is_an_edge
  Scenario: A bare import on its own is an edge
    Then import "./x.js"; yields ./x.js

  @test:scripts/tests/partition-imports.test.ts::the_bare_side-effect_form,_which_is_how_every_registration_edge_is_written::a_bare_import_at_the_very_start_of_a_file_is_an_edge
  Scenario: A bare import at the very start of a file is an edge
    Then a file whose first line is a bare import yields it

  @test:scripts/tests/partition-imports.test.ts::the_bare_side-effect_form,_which_is_how_every_registration_edge_is_written::A_BARE_IMPORT_FOLLOWED_BY_A_NORMAL_ONE_YIELDS_BOTH
  Scenario: A bare import followed by a normal one yields both
    Then a bare import of ./a.js then a named import from ./b.js yield both, in order

  @test:scripts/tests/partition-imports.test.ts::the_bare_side-effect_form,_which_is_how_every_registration_edge_is_written::...and_with_no_semicolon_on_the_bare_one,_where_ASI_applies
  Scenario: A bare import with no semicolon followed by a normal one yields both
    Then the bare import without a semicolon and the named import yield both, in order

  @test:scripts/tests/partition-imports.test.ts::the_bare_side-effect_form,_which_is_how_every_registration_edge_is_written::two_bare_imports_before_a_normal_one_lose_TWO_edges,_not_one
  Scenario: Two bare imports before a normal one yield all three
    Then two bare imports and a named import yield ./a.js, ./b.js and ./c.js

  @test:scripts/tests/partition-imports.test.ts::every_other_form_still_resolves,_so_the_fix_only_widens::%s
  Scenario Outline: Every other import form still resolves
    Then the <form> source yields its specifiers

    Examples:
      | form        |
      | named       |
      | two named   |
      | namespace   |
      | type-only   |
      | multiline   |
      | dynamic     |
      | export-from |

  @test:scripts/tests/partition-imports.test.ts::the_forward_scan_does_not_cross_a_statement_end::a_quoted_string_in_prose_after_a_`;`_is_not_an_edge
  Scenario: The forward scan does not cross a statement end
    Given a real import followed by a template literal holding an import statement
    Then only the real import's specifier is extracted

  @test:scripts/tests/partition-imports.test.ts::the_real_corpus_—_a_guard_against_a_regex_that_matches_nothing::the_registration_edge_this_bean_is_about_is_extracted
  Scenario: The registration edge form is extracted
    Then a bare import of ../../schemas/folio-graph-typology.js yields it
    # Gap: the describe says it guards against the regex matching nothing in the real corpus; the test reads a literal string, not the corpus.
