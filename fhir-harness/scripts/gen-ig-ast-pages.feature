Feature: The IG AST viewer pages

  @test:scripts/gen-ig-ast-pages.test.ts::gen-ig-ast-pages_--site::toolDeclaresKindAndSiteFlag
  Scenario: the Tool declares the kind it renders and the site flag a site build passes
    Given the "ig-ast-pages" Tool
    Then it renders "ig-ast"
    And its site input passes the flag "--site"
    And it has no required input

  @test:scripts/gen-ig-ast-pages.test.ts::gen-ig-ast-pages_--site::writesHubAndDeclaredPages
  Scenario: writes the hub and one page per declaring instance at the declared route, and nothing else
    Given the pages written for a site
    Then the run exits 0
    And the files are the hub and one page each for a held and a remote AST directory
    And every file says it is rendered by ig-ast-pages

  @test:scripts/gen-ig-ast-pages.test.ts::gen-ig-ast-pages_--site::astOnDiskPage
  Scenario: an AST on disk: package id from its ImplementationGuide, counts, edges and plan
    Given the page for an AST held on disk
    Then it names the package "hl7.fhir.uv.ips"
    And it shows 3 resources across 3 types, 2 dependency edges with 1 resolved inside the IG, an incremental plan with 1 resource to rebuild
    And it says the AST is a cache, never an authority

  @test:scripts/gen-ig-ast-pages.test.ts::gen-ig-ast-pages_--site::remoteDirIsUnknown
  Scenario: a declared directory not in the build is unknown, never zero, and names its family
    Given the page for a declared directory not in the build
    Then it says the AST count is unknown, not none, and never shows 0
    And it names the AST branch family and links the repository's branch search
    And the hub says it is unknown, not in this build, and counts 1 AST and 3 resources

  @test:scripts/gen-ig-ast-pages.test.ts::gen-ig-ast-pages_--site::authoredTextNeverLiquid
  Scenario: authored text never reaches Liquid
    Then every written page's front matter turns Liquid off

  @test:scripts/gen-ig-ast-pages.test.ts::gen-ig-ast-pages_--site::checkPassesThenFails
  Scenario: --check passes on what it wrote and fails on a changed or orphaned page
    Then a check of what was written passes
    When a page is changed
    Then the check fails
    When the pages are rewritten and an orphaned page is added
    Then the check fails
    When the pages are rewritten
    Then only the hub and the two pages remain

  @test:scripts/gen-ig-ast-pages.test.ts::astsIn::astsInNullOrEmpty
  Scenario: is null for a directory not on disk, and [] for one holding no manifest
    Then a directory not on disk gives null
    And an empty directory gives no ASTs and its verdict says it holds no AST

  @test:scripts/gen-ig-ast-pages.test.ts::astsIn::astsInKeyedByDir
  Scenario: reads one AST per member directory, keyed by the directory name when the AST names no package
    Given a family directory with a complete AST and one missing its dependencies
    When the ASTs are read
    Then each is keyed by its directory name, and only the broken one has an error

  @test:scripts/gen-ig-ast-pages.test.ts::fhir-harness_declares_the_viewer_it_draws::declaresViewer
  Scenario: a visualiser rendered by ig-ast-pages, covering ig-ast per instance, whose writer is a checkout script and not declared built at publish here
    Then the declaration has a visualiser rendered by ig-ast-pages covering "ig-ast" per instance, written by gen-ig-ast-pages.ts
    And the package's checkout script "ig-ast:pages" runs that script
    And it is not declared as built at publish

  @test:scripts/gen-ig-ast-pages.test.ts::an_IG_repository_inherits_its_AST_listing_from_needing_this_layer::needingFollowsNeeds
  Scenario: needing follows needs through the layers above, and excludes the layer itself
    Then the instances needing "fhir-harness", through layers above, are held, ig, overlay and overlay-ig

  @test:scripts/gen-ig-ast-pages.test.ts::an_IG_repository_inherits_its_AST_listing_from_needing_this_layer::inheritedSubjectsAsksUndeclared
  Scenario: asks only undeclared instances that need the layer, keys each family, and says a failed lookup
    When inherited subjects are found with "held" already declared
    Then only the undeclared repositories needing the layer are asked
    And the subjects are "ig" and "overlay-ig"
    And ig's directory is the AST family keyed by "hl7.fhir.uv.ips", and its verdict says inherited
    And overlay-ig's failed lookup is recorded and its verdict says unknown

  @test:scripts/gen-ig-ast-pages.test.ts::an_IG_repository_inherits_its_AST_listing_from_needing_this_layer::pageLinksBranchesUnknown
  Scenario: the page links each branch and calls the AST unknown, not none
    When the page of the inherited "ig" subject is written
    Then it links the branch, says inherited and calls the AST unknown, not none
