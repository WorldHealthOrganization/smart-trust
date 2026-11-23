Feature: The IG's package dependencies table

  @test:scripts/ig-dependencies.test.ts::the_IG's_package_dependencies_(dependency-table.xhtml,_bean_4475)::declaredFromIgOrSushi
  Scenario: declared from the ImplementationGuide, or from sushi-config's map in both of its shapes
    Then an ImplementationGuide's dependsOn gives each package with its version and canonical, skipping one with no package id
    And sushi-config's dependencies give packages in both the short and the long form
    And a sushi-config with no dependencies gives none

  @test:scripts/ig-dependencies.test.ts::the_IG's_package_dependencies_(dependency-table.xhtml,_bean_4475)::nestedFromPackageCache
  Scenario: nested from the package cache; a package the cache lacks is SAID, a repeat is not expanded twice, core is a leaf
    Given a package cache holding two declared packages and the core package
    When the dependency rows are built
    Then each dependency is nested under the package that needs it
    And a package the cache lacks is marked unresolved
    And a package already listed is marked as a repeat and not expanded
    And the first row carries its title, canonical and FHIR version

  @test:scripts/ig-dependencies.test.ts::the_IG's_package_dependencies_(dependency-table.xhtml,_bean_4475)::templateRendersThreeForms
  Scenario: the template renders all three forms, and says when there is nothing
    Given the dependency table template
    Then it starts with a Liquid comment
    And the full form links a resolved package's title, links an unresolved one to its registry page and says it is not in the package cache
    And the short form lists only the top-level packages
    And the non-technical form lists the titles
    And with no dependencies it says the IG declares no package dependencies
