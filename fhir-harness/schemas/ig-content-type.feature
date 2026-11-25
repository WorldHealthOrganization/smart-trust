Feature: The ig content type and the contentTypes.ig section of index.config.json

  @test:schemas/ig-content-type.test.ts::the_ig_marker::registeredAsIndexSection
  Scenario: is a section of index.config.json, registered as { indexSection: 'ig' }
    Given a new content type registry
    When the ig content type is registered in it
    Then its "ig" type's filename is the index section "ig"
    When it is registered a second time
    Then the registry still lists only "ig"

  @test:schemas/ig-content-type.test.ts::the_ig_marker::contentTypesIgMarksAnIg
  Scenario: a repository with contentTypes.ig is an IG; one without is not
    Given a registry with the ig content type
    Then a repository declaring contentTypes.ig is described as an IG with the marker "index.config.json#contentTypes.ig"
    And a repository declaring only another content type has no types

  @test:schemas/ig-content-type.test.ts::the_ig_marker::sushiConfigAloneIsNotIg
  Scenario: a sushi-config.yaml alone does not make a repository an IG
    Given a repository with a sushi-config.yaml and no contentTypes.ig
    Then it is described with no types

  @test:schemas/ig-content-type.test.ts::the_section_declares_what_the_harness_reads::coversDeclaredFilesAndDirs
  Scenario: covers a declared file and everything under a declared directory
    Given a section that declares sushi-config.yaml and input directories
    Then sushi-config.yaml, a file under input/fsh, "./input/pagecontent/index.md" and "input/fsh" are all declared

  @test:schemas/ig-content-type.test.ts::the_section_declares_what_the_harness_reads::doesNotCoverUndeclared
  Scenario: does not cover what is not declared
    Then an image, a file under "input/fshx" and "sushi-config.yaml.bak" are not declared
    And asserting that README.md is declared throws "not declared in contentTypes.ig.include"

  @test:schemas/ig-content-type.test.ts::the_section_declares_what_the_harness_reads::bareSectionDeclaresNothing
  Scenario: a bare section declares nothing, and is not read as everything
    Then a section with no include parses to a problem saying include is missing
    And a section with an empty include parses to a problem saying include is empty

  @test:schemas/ig-content-type.test.ts::the_section_declares_what_the_harness_reads::refusesEscapingOrAmbiguousEntries
  Scenario: refuses entries that leave the repository or name a place two ways
    Given includes "/etc/x", "../other/", "input//fsh/", a backslash path and "ok/"
    When the section is parsed
    Then it has 4 problems

  @test:schemas/ig-content-type.test.ts::the_section_declares_what_the_harness_reads::readsSectionFromIndexConfig
  Scenario: reads the section from index.config.json
    Then a repository declaring contentTypes.ig reads back that section
    And a repository with empty contentTypes reads as undefined
    And an index.config.json that is not JSON reads as a problem saying it does not parse

  @test:schemas/ig-content-type.test.ts::trustedScripts:_same-site_scripts_an_IG's_pages_load::readsAValidList
  Scenario: reads a valid trustedScripts list, and drops an empty one
    Given a section whose trustedScripts are "demo/widget.js" and "a.mjs"
    When the section is parsed
    Then the section carries the include and those trustedScripts
    And a section with an empty trustedScripts list parses to the include alone

  @test:schemas/ig-content-type.test.ts::trustedScripts:_same-site_scripts_an_IG's_pages_load::refusesAnythingNotARelativeSameSiteScript
  Scenario: refuses a trusted script that is not a relative same-site script
    Given trustedScripts entries that are an absolute or protocol-relative URL, a rooted or climbing path, a "./" segment, a stylesheet, a query, a space, empty, or not a string
    When each is parsed
    Then each is a problem naming contentTypes.ig.trustedScripts[0]
    And a trustedScripts that is not a list is the problem "contentTypes.ig.trustedScripts is not a list"

  @test:schemas/ig-content-type.test.ts::trustedSvgs:_same-site_SVG_drawings_an_IG's_pages_embed_with_<object>::readsAValidList
  Scenario: reads a valid trustedSvgs list, and drops an empty one
    Given a section whose trustedSvgs are "GDHCN.ONB.svg" and "img/a-b_c.svg"
    When the section is parsed
    Then the section carries the include and those trustedSvgs
    And a section with an empty trustedSvgs list parses to the include alone

  @test:schemas/ig-content-type.test.ts::trustedSvgs:_same-site_SVG_drawings_an_IG's_pages_embed_with_<object>::refusesAnythingNotARelativeSameSiteSvg
  Scenario: refuses a trusted SVG that is not a relative same-site SVG
    Given trustedSvgs entries that are empty, a rooted or climbing path, a "./" segment, an absolute URL, a query, an HTML or script file, or not a string
    When each is parsed
    Then each is a problem naming contentTypes.ig.trustedSvgs[0]
    And a trustedSvgs that is not a list is the problem "contentTypes.ig.trustedSvgs is not a list"
