Feature: Building an IG instance's artifact index at publish

  @test:scripts/build-ig-indexes.test.ts::igTargets::targetsBuildableSkipsWithReason
  Scenario: builds every instance that needs the layer, has a repository and an AST family; says why each other one is skipped
    Given instances that need the layer, some without a repository, an AST branch family, or a readable declaration
    When the targets are chosen
    Then "ig" and "overlay-ig" are built from their AST branches
    And "bare", "broken", "overlay" and "seedless" are skipped, each with its reason
    And an instance that does not need the layer is not listed as skipped

  @test:scripts/build-ig-indexes.test.ts::igTargets::refusesUnsafeInstanceName
  Scenario: refuses an instance name that is not one safe path segment, and says why
    Given instances named "..", "../x", "a/b", "it's", "-x" and ""
    When the targets are chosen
    Then none is a target and each is skipped as not a single safe path segment
    And a hyphenated name and "ig.v2_x" are safe names

  @test:scripts/build-ig-indexes.test.ts::igTargets::onlyNarrowsToOne
  Scenario: --only narrows to one instance
    When the targets are chosen with only "overlay-ig"
    Then the only target is "overlay-ig"

  @test:scripts/build-ig-indexes.test.ts::publishedBase::publishedBasePrecedence
  Scenario: prefers the committed copy's published site, then the declaration's iriBase, else none
    Then a committed copy from gh-pages gives its site as the base
    And a committed copy from sushi-config gives the declaration's iriBase
    And with neither there is no base

  @test:scripts/build-ig-indexes.test.ts::publishedBase::namesTheLayoutOfTheSiteItLinks
  Scenario: names the layout of the site the base links
    Then a committed copy from gh-pages is a Publisher layout
    And a declaration's iriBase is the harness's own site layout
    And with neither, no layout is named

  @test:scripts/build-ig-indexes.test.ts::publishedBase::rebasesPagesOnMountedRepo
  Scenario: re-bases the declared repository's own Pages address on the repository the checkout mounts
    Given a declaration for "alpha/ig" whose iriBase is its Pages address
    Then mounted from "beta/ig", the base is beta's Pages address and says it came from "beta/ig"
    And mounted from "alpha/ig", or with no mount, the base stays alpha's
    And a committed copy's site still wins over the re-based address

  @test:scripts/build-ig-indexes.test.ts::rebaseOnMount::rebasesOwnPagesKeepingPath
  Scenario: re-bases only the declared repository's own Pages address, keeping the path under it
    Then alpha's Pages address with a path is re-based on the mounted repository, lowercased, keeping the path
    And a different repository name is used in the re-based address

  @test:scripts/build-ig-indexes.test.ts::rebaseOnMount::keepsOtherAddresses
  Scenario: keeps any other address: a site the IG chose is not the owner's to move
    Then a custom domain is kept
    And a Pages address for another repository is kept
    And with no declared or no mounted repository the address is kept

  @test:scripts/build-ig-indexes.test.ts::instancesIn::readsDeclarationBySelfName
  Scenario: reads an instance's declaration by the name it gives itself, not by the directory it is checked out in
    Given an IG checked out in a directory "fa" whose declaration file is "ig-x.json"
    When the instances are read
    Then the instance at that directory is named "ig-x", needs "fhir-harness" and has the repository "alpha/ig-x"

  @test:scripts/build-ig-indexes.test.ts::lockedRepositories::lockedRepositoriesFromLock
  Scenario: reads each instance's mounted repository from the checkout's lock, and nothing without one
    Then a checkout with no lock has no locked repositories
    Given a lock with a valid repository, an invalid repository and an instance with none
    Then only "ig" from "beta/ig" is read

  @test:scripts/build-ig-indexes.test.ts::packFromAst::packIsReproducible
  Scenario: packs the same AST into the same bytes, a second later (cat-harness-tools#1230)
    Given an AST of two value sets and a sushi-config.yaml
    When it is packed twice, a second apart
    Then the two packages are byte for byte equal

  @test:scripts/build-ig-indexes.test.ts::packFromAst::refusesFilesOutsideAst
  Scenario: refuses a manifest file outside the AST, by path or by symlink
    Given an AST manifest naming a file above the AST, a symlink to a file outside it and a file inside it
    When it is packed
    Then 1 resource is packed
    And the package holds only the inside value set and package.json
    And 2 refusals are logged and the outside file is not staged

  @test:scripts/build-ig-indexes.test.ts::packFromAst::packsTypeIdWithPackageJson
  Scenario: packs each AST resource at package/<Type>-<id>.json, with a package.json from sushi-config.yaml
    Given an AST manifest naming one present value set and one missing file, and a sushi-config.yaml
    When it is packed
    Then 1 resource is packed, as "package/ValueSet-vs.json" beside package.json
    And package.json names "ex.ig" at "1.0.0" with the FHIR version "4.0.1"

  @test:scripts/build-ig-indexes.test.ts::contextsFrom_and_fhirVersionsOf::indexesContextOnlyJsonld
  Scenario: indexes each context-only .jsonld under input/images, skips data, and reads the FHIR version
    Given a context-only .jsonld, a data .jsonld and a broken .jsonld under input/images
    When the contexts are collected
    Then only "ctx/v1" is indexed, with its published url and local path
    And an IG with no images has no contexts
    And the FHIR version read from sushi-config.yaml is "4.0.1", and an IG without one has none

  @test:scripts/build-ig-indexes.test.ts::hubFrom::hubNamesMarkerPage
  Scenario: names the IG's page holding the descriptor's marker, with the descriptor's label, only when a layer left a descriptor
    Given an IG page holding a marker comment
    Then with no descriptor there is no hub
    Given a descriptor with a label and that marker
    Then the hub is the page holding the marker, with the descriptor's label, under the published base or relative without one
    Given an empty descriptor
    Then the hub is the default ig-api page under the published base

  @test:scripts/build-ig-indexes.test.ts::referenceAbsent::referencesAbsentBytes
  Scenario: keeps an artefact whose bytes are under the instance root, and references one whose bytes are not
    Given two materialized artefacts, one whose bytes are under the instance root and one whose bytes are not
    When absent bytes are referenced
    Then 1 artefact is changed
    And the first stays materialized
    And the second is referenced upstream with a note naming the source revision

  @test:scripts/build-ig-indexes.test.ts::referenceAbsent::leavesNonMaterializedAlone
  Scenario: leaves records that are not materialized alone
    Given an artefact that is already referenced
    When absent bytes are referenced
    Then nothing is changed

  @test:scripts/build-ig-indexes.test.ts::lockedMounts_and_cloneAt_(bean_fwtz:_the_IG_is_read_at_its_pin)::lockedMountsFullShaOnly
  Scenario: reads each instance's pinned commit from the lock, and only a full sha
    Given a lock with one instance pinned by a full sha and one by a short sha
    Then the first is read with its repository and sha, the second with its repository only

  @test:scripts/build-ig-indexes.test.ts::lockedMounts_and_cloneAt_(bean_fwtz:_the_IG_is_read_at_its_pin)::fetchesPinnedCommit
  Scenario: fetches the pinned commit rather than cloning the default branch
    When a repository is cloned at a pinned sha
    Then git initialises, adds the origin, fetches that sha shallowly and checks out FETCH_HEAD
    When it is cloned with no sha
    Then git makes one shallow clone of the default branch

  @test:scripts/build-ig-indexes.test.ts::lockedMounts_and_cloneAt_(bean_fwtz:_the_IG_is_read_at_its_pin)::stopsAtFirstFailingGit
  Scenario: stops at the first git step that fails
    Given a git whose third step fails with "not our ref"
    When a repository is cloned at a pinned sha
    Then the failure is returned and git was called 3 times

  @test:scripts/build-ig-indexes.test.ts::pinnedAt_and_astAgainstPin_(bean_fwtz:_a_pinned_read_writes_the_same_bytes_any_day)::stampsPinnedCommitTime
  Scenario: stamps the pinned commit's time, never the clock
    Then the stamp is the time git reports for the pinned commit
    And when git fails there is no stamp

  @test:scripts/build-ig-indexes.test.ts::pinnedAt_and_astAgainstPin_(bean_fwtz:_a_pinned_read_writes_the_same_bytes_any_day)::saysWhetherAstMatchesPin
  Scenario: says whether the restored AST was compiled from the pin
    Then a directory with no manifest says nothing
    Given a manifest compiled from an older revision
    Then against the pin it reports that revision and no match
    And against that revision it reports a match
    And with no pin it reports only the revision

  @test:scripts/build-ig-indexes.test.ts::withWorkDir::removesWorkDirOnFailure
  Scenario: removes the directory it made when the build fails partway, leaving os.tmpdir() clean
    Given the temporary directory points at an empty test directory
    When a build given no work directory writes a half file and then fails with "clone failed"
    Then the failure is raised
    And the temporary directory is empty again

  @test:scripts/build-ig-indexes.test.ts::withWorkDir::removesWorkDirOnSuccess
  Scenario: removes it after a build that succeeds too
    Given the temporary directory points at an empty test directory
    When a build given no work directory writes a file and returns 7
    Then 7 is returned
    And the temporary directory is empty again

  @test:scripts/build-ig-indexes.test.ts::withWorkDir::keepsNamedWorkDir
  Scenario: keeps a directory --work names
    Given a work directory the caller names
    When a build in it fails
    Then the failure is raised
    And the named directory still exists
