# schemas/kg/namespaces.ts tolerates legacy exact-semver spellings of the harness's own BPMN
# extension namespaces during the move to v<major> addresses (bootstrap-tools#39).
# Each Scenario names the test that executes it.
Feature: Own extension namespaces during the v<major> transition

  @test:schemas/namespaces-legacy.test.ts::own_extension_namespaces_during_the_v<major>_transition::every_own_namespace_is_a_v<major>_address,_so_the_tolerance_covers_each
  Scenario: Every own extension namespace carries a v<major> path segment
    Given the list of own BPMN extension namespaces
    Then each one contains a "/v<digits>/" segment

  @test:schemas/namespaces-legacy.test.ts::own_extension_namespaces_during_the_v<major>_transition::the_canonical_v<major>_address_is_ours
  Scenario: The canonical v<major> address is recognised as our own
    Given each own BPMN extension namespace
    When it is checked as an own extension namespace
    Then it is ours

  @test:schemas/namespaces-legacy.test.ts::own_extension_namespaces_during_the_v<major>_transition::the_legacy_exact-semver_spelling_of_the_SAME_major_is_ours
  Scenario: The legacy exact-semver spelling of the same major is recognised as our own
    Given each own namespace with its v<major> segment respelt as "<major>.1.0" and as "<major>.0.0"
    When each is checked as an own extension namespace
    Then both are ours

  @test:schemas/namespaces-legacy.test.ts::own_extension_namespaces_during_the_v<major>_transition::another_major,_a_partial_version,_or_another_path_is_still_foreign
  Scenario: Another major, a partial version or another path stays foreign
    Given each own namespace respelt as "<major+1>.0.0", as "<major>.1", and as "<major>.1.0" with its trailing "ns/" changed to "other/"
    When each is checked as an own extension namespace
    Then none is ours
    And an undefined namespace is not ours

  @test:schemas/namespaces-legacy.test.ts::own_extension_namespaces_during_the_v<major>_transition::a_diagram_binding_the_legacy_spelling_has_its_prefix_read_as_ours
  Scenario: A diagram binding the legacy spelling has its prefix read as ours
    Given a BPMN definitions element binding "cat-harness.processes" to the legacy "<major>.1.0" spelling and "x" to a foreign namespace
    When its own extension prefixes are read
    Then the result is only "cat-harness.processes"
