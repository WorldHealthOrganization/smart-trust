Feature: the rendered pages a change to a document folio reaches

  @test:scripts/document-rendered-impact.test.ts::documentRenderedImpact_—_blocks,_from_the_ChangeSet::blocksLandOnOwnPage
  Scenario: an edited, an added and a removed block each land on their own document's page, anchored at the label
    When an edited, an added and a removed block are listed
    Then each lands on its document's page anchored at its label
    And nothing is undetermined

  @test:scripts/document-rendered-impact.test.ts::documentRenderedImpact_—_blocks,_from_the_ChangeSet::reviewListLinksBlocks
  Scenario: the review list links each changed block
    When the review list of an edited block is made
    Then it links the block on its page

  @test:scripts/document-rendered-impact.test.ts::documentRenderedImpact_—_blocks,_from_the_ChangeSet::sitePrefixPlacesPages
  Scenario: the site prefix places the pages where the preview serves them
    When the impact is computed with the site prefix smart-ra
    Then the page is under smart-ra/

  @test:scripts/document-rendered-impact.test.ts::documentRenderedImpact_—_files_the_ChangeSet_does_not_name::manifestMovesPageAndOutline
  Scenario: a chapter manifest moves the page and the outline; the document manifest also the document list
    When a chapter manifest and a document manifest change
    Then the chapter reaches the page and the outline
    And the document manifest also reaches the document list

  @test:scripts/document-rendered-impact.test.ts::documentRenderedImpact_—_files_the_ChangeSet_does_not_name::mediaIsFileAndPage
  Scenario: a media file is the copied file and the page that shows it
    When a media file changes
    Then it reaches the copied file and the page showing it

  @test:scripts/document-rendered-impact.test.ts::documentRenderedImpact_—_files_the_ChangeSet_does_not_name::commentStoreReachesDashboard
  Scenario: the comment store is the public-comment renderer's: the dashboard and every document page
    When a public comment changes
    Then the document renderer and the public-comment renderer both answer
    And the latter reaches the dashboard and every document's comment page

  @test:scripts/document-rendered-impact.test.ts::documentRenderedImpact_—_files_the_ChangeSet_does_not_name::pagesUnderLocaleOutlineWins
  Scenario: pages are under the locale and data is not (#2527); an outline's own page wins
    When the impact is computed with an old outline and with none
    Then the old outline's own pages win
    And without one the pages are under en/

  @test:scripts/document-rendered-impact.test.ts::documentRenderedImpact_—_files_the_ChangeSet_does_not_name::elseUndeterminedAll
  Scenario: anything else is undetermined with scope all, never no change
    When a config file and the platform change
    Then no page is listed and both are undetermined with scope all

  @test:scripts/document-rendered-impact.test.ts::documentRenderedImpact_—_a_file_no_builder_of_the_site_reads_(bean_ehh6)::unreadFileReachesNoPage
  Scenario: an undeclared directory or a root Markdown note is an input that reaches no page
    When files no builder reads change
    Then they are inputs that reach no page and are undetermined

  @test:scripts/document-rendered-impact.test.ts::documentRenderedImpact_—_a_file_no_builder_of_the_site_reads_(bean_ehh6)::platformAndConfigMayBeRead
  Scenario: the platform, a declared graph, the build definition and a root config stay any page
    When files are checked against what the site reads
    Then the platform, a declared graph, the workflows and root configs may be read
    And beans, AGENTS.md and test results may not

  @test:scripts/document-rendered-impact.test.ts::documentRenderedImpact_—_a_file_no_builder_of_the_site_reads_(bean_ehh6)::nothingDeclaredNothingExcluded
  Scenario: with nothing declared to read, nothing is excluded: doubt carries
    When a bean changes with nothing declared as read
    Then it may be read and is undetermined

  @test:scripts/document-rendered-impact.test.ts::documentRenderedImpact_—_a_file_no_builder_of_the_site_reads_(bean_ehh6)::siteReadsOf:_what_the_build_command's_builders_say_they_read::buildStepsScriptsAndArgs
  Scenario: each step's script and its arguments; a step that runs no script is undefined
    When a build command is split into steps
    Then each bun step gives its script and arguments and a jekyll step is undefined

  @test:scripts/document-rendered-impact.test.ts::documentRenderedImpact_—_a_file_no_builder_of_the_site_reads_(bean_ehh6)::siteReadsOf:_what_the_build_command's_builders_say_they_read::commandUnionOfReads
  Scenario: with a command: the union of its builders' reads, and a declared directory no builder reads is not read
    When the reads of a command of two builders are asked
    Then they are the union of the builders' reads, with the submodule
    And a bean is not read and a todo item is

  @test:scripts/document-rendered-impact.test.ts::documentRenderedImpact_—_a_file_no_builder_of_the_site_reads_(bean_ehh6)::siteReadsOf:_what_the_build_command's_builders_say_they_read::nonBuilderExcludesNothing
  Scenario: a step that is not a builder exporting siteReads, or a missing script: nothing excluded
    When reads are asked of commands with a non-builder, a jekyll step and a missing script
    Then each gives undefined

  @test:scripts/document-rendered-impact.test.ts::documentRenderedImpact_—_a_file_no_builder_of_the_site_reads_(bean_ehh6)::siteReadsOf:_what_the_build_command's_builders_say_they_read::noCommandDeclaredDirs
  Scenario: no command: the declared directories stand in
    When reads are asked with no command
    Then the declared directories stand in

  @test:scripts/document-rendered-impact.test.ts::documentRenderedImpact_—_a_file_no_builder_of_the_site_reads_(bean_ehh6)::siteReadsOf:_what_the_build_command's_builders_say_they_read::noDeclarationUndefined
  Scenario: no declaration: undefined, so nothing is excluded
    When reads are asked in a directory with no declaration
    Then the answer is undefined

  @test:scripts/document-rendered-impact.test.ts::documentRenderedImpact_—_a_lazy_page_(bean_v433)::lazyTextEditChunkAndHydrated
  Scenario: a text edit is its chunk and the hydrated page, not the shell
    When a block's text changes on a lazy page
    Then its chunk and the hydrated page change, not the shell

  @test:scripts/document-rendered-impact.test.ts::documentRenderedImpact_—_a_lazy_page_(bean_v433)::lazyAddedBlockShiftsChunks
  Scenario: an added block reshapes the shell and shifts every chunk from its own on
    When a block is added on a lazy page
    Then the following chunks, the shell and the hydrated page change

  @test:scripts/document-rendered-impact.test.ts::documentRenderedImpact_—_a_lazy_page_(bean_v433)::nonLazyUnchanged
  Scenario: a page that is not lazy is unchanged by any of this
    When a block of a page that is not lazy is removed
    Then only that page is reached

  @test:scripts/document-rendered-impact.test.ts::documentRenderedImpact_—_a_lazy_page_(bean_v433)::commentStoreReachesLazyNotes
  Scenario: the comment store also reaches the lazy page's notes and its hydrated page
    When a public comment changes with a lazy page
    Then the page's notes and its hydrated page are reached

  @test:scripts/document-rendered-impact.test.ts::documentRenderedImpact_—_a_folio's_library_(library-site)::libraryStructureReachesPage
  Scenario: an entry's structure reaches its page, its data and the library index; another file only its data
    When an entry's structure and another entry's section change
    Then the library renderer answers too, nothing undetermined
    And the structure reaches the entry's page, its data and the library index; the section only its data

  @test:scripts/document-rendered-impact.test.ts::documentRenderedImpact_—_a_folio's_library_(library-site)::reviewAnchorsReachEntry
  Scenario: a folio's review anchors reach the entry they name (its edit links), not every page
    When a folio's review anchors change
    Then nothing is undetermined and the named entry's data is reached

  @test:scripts/document-rendered-impact.test.ts::documentRenderedImpact_—_a_folio's_library_(library-site)::libraryOfReadsDeclared
  Scenario: libraryOf reads the declared library directories and the entry an anchors file names
    Given a declaration with a library and a folio, and review anchors naming entry v1
    When libraryOf is asked
    Then it gives the library directory and the entry the anchors name
