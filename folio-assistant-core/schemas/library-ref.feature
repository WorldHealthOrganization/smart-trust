Feature: resolving a reference into a layer's library

  @test:schemas/library-ref.test.ts::instance_discovery::findsInstancesByDeclaredName
  Scenario: finds layers by their DECLARED name, not by their published stub
    When the layer roots of the checkout are found
    Then cat-harness is the platform directory and folio-assistant is not
    And folio-assistant-core is found at its own directory

  @test:schemas/library-ref.test.ts::instance_discovery::findsPlatformInstance
  Scenario: finds the platform layer, whose directory is `cat-harness`
    When the layer roots are found
    Then cat-harness resolves to the platform directory

  @test:schemas/library-ref.test.ts::instance_discovery::indexRootIsNoInstance
  Scenario: the index ROOT is no layer, and the harness layer keeps its own name
    When the layer roots are found
    Then folio-assistant is not a layer and the index root is not among the roots
    And cat-harness keeps its own name

  @test:schemas/library-ref.test.ts::library_location_is_read_from_the_declaration::resolvesDeclaredLibrary
  Scenario: resolves a content layer's declared library graph
    When the library directory of who-iris is read
    Then it is who-iris/library

  @test:schemas/library-ref.test.ts::library_location_is_read_from_the_declaration::platformLibraryOnlyCitedSources
  Scenario: the PLATFORM's library holds ONLY sources its methodologies cite
    When the platform's library entries are compared with the sources its methodologies cite
    Then every entry is cited, held or awaiting citation by its declaration

  @test:schemas/library-ref.test.ts::library_location_is_read_from_the_declaration::noLibraryGraphUndefined
  Scenario: returns undefined for a layer that declares no library graph
    When the library directory of a layer that declares none is read
    Then it is undefined

  @test:schemas/library-ref.test.ts::resolution_keeps_four_failures_apart::resolvesBareAgainstCitingInstance
  Scenario: resolves a bare reference against the citing layer
    When a bare reference is resolved from who-iris
    Then it resolves

  @test:schemas/library-ref.test.ts::resolution_keeps_four_failures_apart::namedInstanceSameAsBare
  Scenario: resolves the SAME reference when the layer is named explicitly
    When the same reference is resolved bare and with layer who-iris named
    Then the named one resolves to the same path

  @test:schemas/library-ref.test.ts::resolution_keeps_four_failures_apart::platformMustNameWhoIris
  Scenario: the platform citing a WHO document must NAME who-iris — and does resolve
    When the platform resolves the reference naming who-iris
    Then it resolves to who-iris/library/wpr-rdo-2020-003-eng

  @test:schemas/library-ref.test.ts::resolution_keeps_four_failures_apart::unknownInstanceNotLocal
  Scenario: an unknown layer is never silently treated as local
    When a reference naming "no-such-instance" is resolved
    Then it fails as unknown-instance
    And the explanation mentions the DECLARED NAME

  @test:schemas/library-ref.test.ts::resolution_keeps_four_failures_apart::noLibraryGraphFinding
  Scenario: a known layer with no library graph is its own finding
    When a reference naming bootstrap is resolved
    Then it fails as no-library-graph

  @test:schemas/library-ref.test.ts::resolution_keeps_four_failures_apart::bareFromPlatformNotIngested
  Scenario: a BARE reference from the platform now says `not-ingested`, and that is WORSE
    When the bare reference is resolved from the platform
    Then it fails as not-ingested

  @test:schemas/library-ref.test.ts::resolution_keeps_four_failures_apart::neverIngestedDistinct
  Scenario: a document that was never ingested is distinct from a missing section
    When a reference to "never-ingested" is resolved from who-iris
    Then it fails as not-ingested

  @test:schemas/library-ref.test.ts::resolution_keeps_four_failures_apart::missingSectionFourthCase
  Scenario: a missing section in an ingested document is the fourth case
    When section page-999 of an ingested document is resolved
    Then it fails as no-such-section

  @test:schemas/library-ref.test.ts::resolution_keeps_four_failures_apart::everyFailureExplainsItself
  Scenario: every failure explains itself in one actionable line
    When each of the four failing references is resolved
    Then each fails with an explanation longer than 40 characters

  @test:schemas/library-ref.test.ts::an_instance's_library_is_ITS_OWN,_not_the_first_one_declared::ignoresRepositoryScopedFirst
  Scenario: ignores a repository-scoped entry even when it is declared FIRST
    Given a layer declaring a repository-scoped library first and its own second
    When its library directory is read
    Then it is its own library/

  @test:schemas/library-ref.test.ts::an_instance's_library_is_ITS_OWN,_not_the_first_one_declared::orderDoesNotMatter
  Scenario: and the answer does not change when the order does
    Given a layer declaring its own library first and a repository-scoped one second
    When its library directory is read
    Then it is its own library/

  @test:schemas/library-ref.test.ts::an_instance's_library_is_ITS_OWN,_not_the_first_one_declared::refusesTwoOwnLibraries
  Scenario: REFUSES when a layer declares two of its own, rather than picking
    Given a layer declaring two libraries of its own
    When its library directory is read
    Then it throws "no single answer"

  @test:schemas/library-ref.test.ts::an_instance's_library_is_ITS_OWN,_not_the_first_one_declared::realInstancesResolveOwn
  Scenario: every real layer here resolves its own library, or declares none
    When the library directories of the real layers are read
    Then cat-harness, who-iris and folio-assistant-sci each resolve to their own library
    And smart-l1 has none

  @test:schemas/library-ref.test.ts::an_entry_filed_in_a_concern_group_resolves_(bean_6fez)::groupedEntryResolves
  Scenario: finds `library/<group>/<id>/` when the library declares the group, and only then
    Given a library declaring concern group "kg" with entry doc, and an entry in an undeclared group
    When the entries are resolved
    Then doc resolves to library/kg/doc/structure.json, and its section sec-001 resolves
    And the entry in the undeclared group is not-ingested

  @test:schemas/library-ref.test.ts::a_corpus_in_an_opt-in_group_the_mount_left_out_is_not_checked_here::leftOutByTheLockIsNotMounted
  Scenario: a corpus the lock says the mount left out is not mounted, and is not checked here
    Given a layer switching on an opt-in library group whose corpus is absent
    And a lock saying the mount did not choose that group
    When the corpus is looked up and a reference into it is resolved
    Then the corpus directory is reported as left out by that lock
    And the reference fails as library-not-mounted, explained as "Not checked here"

  @test:schemas/library-ref.test.ts::a_corpus_in_an_opt-in_group_the_mount_left_out_is_not_checked_here::switchedOffAndLeftOutIsNotMounted
  Scenario: a layer switching the group off still follows the lock's answer
    Given a layer switching its opt-in library group off, with the corpus absent
    When the corpus is looked up
    Then a lock saying the mount left it out reports it left out by that lock
    And a lock saying the mount took it reports nothing left out

  @test:schemas/library-ref.test.ts::a_corpus_in_an_opt-in_group_the_mount_left_out_is_not_checked_here::takenByTheMountAndGoneIsStillAFinding
  Scenario: a corpus the mount took and is gone is still a finding
    Given a layer with an opt-in library group whose corpus is absent
    And a lock saying the mount took that group
    When the corpus is looked up and a reference into it is resolved
    Then nothing is reported left out
    And the reference fails as no-library-graph

  @test:schemas/library-ref.test.ts::a_corpus_in_an_opt-in_group_the_mount_left_out_is_not_checked_here::noLockIsStillAFinding
  Scenario: with no lock, an absent corpus is not excused
    Given a layer with an opt-in library group whose corpus is absent, and no lock
    When the corpus is looked up
    Then nothing is reported left out

  @test:schemas/library-ref.test.ts::a_corpus_in_an_opt-in_group_the_mount_left_out_is_not_checked_here::aMountedCorpusResolvesAsBefore
  Scenario: a mounted corpus resolves as before
    Given a layer with an opt-in library group whose corpus is present
    When its library directory is read
    Then it is the corpus directory
    And nothing is reported left out, even by a lock saying the group was not chosen
