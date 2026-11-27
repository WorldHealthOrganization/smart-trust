# Specifies buildExport (scripts/kg-export.ts): the default export's
# dangling links, and, in the checkout-scope graph, the who-iris package's id
# and members.
Feature: The KG export keeps links resolving and names a package by its manifest

  @test:test/coordinator/kg-export-checkout.test.ts::kg_export::internal_links_resolve,_bar_the_known_data_defects
  Scenario: Dangling links are at most four, all of known kinds
    Given the default KG export
    When its dangling links are read
    Then there are at most 4
    And each is on a "declaresSkill" or "providesCapability" edge

  @test:test/coordinator/kg-export-checkout.test.ts::a_package's_id_is_declared,_not_derived_from_its_path::a_package_is_named_by_its_manifest,_not_by_its_directory
  Scenario: The who-iris package is named by its manifest, not its directory
    Given the checkout-scope KG export
    When the SkillPackage whose id ends "/package/who-iris" is found
    Then it exists and its name is "who-iris"
    And its path contains "who-iris/skills"
    And its name is not "skills"

  @test:test/coordinator/kg-export-checkout.test.ts::a_package's_id_is_declared,_not_derived_from_its_path::its_members_are_that_package's_own_skills_and_nothing_else
  Scenario: The package's members are exactly its manifest's skills
    Given the checkout-scope KG export and who-iris/skills/package-manifest.json
    When the nodes in the who-iris package are collected
    Then they are exactly "skill/<name>" for every skill the manifest lists

  @test:test/coordinator/kg-export-checkout.test.ts::a_package's_id_is_declared,_not_derived_from_its_path::`corpus-grep`_is_NOT_among_them_—_the_contamination_the_merge_caused
  Scenario: corpus-grep is not a member of the who-iris package
    Given the checkout-scope KG export
    When the nodes in the who-iris package are collected
    Then they do not include "skill/corpus-grep"
