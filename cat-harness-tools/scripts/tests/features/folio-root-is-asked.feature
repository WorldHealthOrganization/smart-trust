# A ratchet over the TypeScript sources of cat-harness and cat-harness-tools: the folio root is asked for through folioDir
# (schemas/kg/cat-harness.ts), never spelled as a "folio" path literal. Each Scenario names the test that executes it.
Feature: The folio root is asked for, not spelled

  @test:scripts/tests/folio-root-is-asked.test.ts::the_folio_root_is_asked_for,_not_spelled::the_scan_found_files_—_otherwise_nothing_below_proves_anything
  Scenario: The source scan finds files
    Given the non-test TypeScript sources of cat-harness and cat-harness-tools
    Then there are more than 200 of them

  @test:scripts/tests/folio-root-is-asked.test.ts::the_folio_root_is_asked_for,_not_spelled::no_module_outside_`folioDir`_itself_spells_the_folio_root
  Scenario: No module but folioDir's own spells the folio root
    Given the non-test TypeScript sources, except schemas/kg/cat-harness.ts
    When each non-comment line is searched for a join or resolve call ending in a "folio" segment
    Then no line matches

  @test:scripts/tests/folio-root-is-asked.test.ts::the_folio_root_is_asked_for,_not_spelled::`folioDir`_is_actually_used_—_the_rule_is_not_vacuously_satisfied
  Scenario: folioDir is called by more than 30 modules
    Given the non-test TypeScript sources, except schemas/kg/cat-harness.ts
    When the modules calling folioDir are counted
    Then there are more than 30
