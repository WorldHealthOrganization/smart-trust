Feature: Cutting an IG release as a GitHub draft that carries its files

  @test:scripts/ig-release.test.ts::ig-release::kindFromSushiConfig
  Scenario: a ballot, draft or CI-build version is a pre-release
    Then version "1.0.0" labelled "STU1" or "trial-use" is a release
    And version "1.0.0-ballot", or a "ci-build" or "Draft for comment" label, is a pre-release

  @test:scripts/ig-release.test.ts::ig-release::gathersPackagesAndAst
  Scenario: a release carries the packages and the AST, with their digests
    Given a Publisher output with package.tgz, package.r4.tgz and full-ig.zip, and an AST
    When the release files are gathered
    Then they are package.tgz, package.r4.tgz and ast-data.zip, listed in SHA256SUMS
    And the AST is not changed, and zips to the same bytes again

  @test:scripts/ig-release.test.ts::ig-release::refusesBuildWithoutPackage
  Scenario: a build with no package.tgz is not released
    Then gathering refuses it

  @test:scripts/ig-release.test.ts::ig-release::bodyListsFilesAndAuthorisation
  Scenario: the release says what it carries and who publishes it
    Then its description lists each file's size and SHA-256 and names draft-to-publication.bpmn

  @test:scripts/ig-release.test.ts::ig-release::makesDraftAndUploads
  Scenario: a new tag gets a draft release with every file uploaded
    Then the release is made as a draft and the four files are uploaded

  @test:scripts/ig-release.test.ts::ig-release::refusesPublishedRelease
  Scenario: a published release is never changed
    Then a tag whose release is published is refused

  @test:scripts/ig-release.test.ts::ig-release::refreshesExistingDraft
  Scenario: a draft for the tag has its files replaced
    Then the draft is updated and only the files this run carries are replaced

  @test:scripts/ig-release.test.ts::ig-release_check:_the_catch-up_when_the_current_version_is_untagged_or_unreleased_(owner,_2026-11-10)::untaggedVersionNamesTheCommitThatSetIt
  Scenario: an untagged current version names the commit to tag, and nothing is tagged
    Given an IG whose version 0.2.0 was set two commits before HEAD, with releaseLabel ci-build
    When the release check runs
    Then it reports that version 0.2.0 is untagged and that the owner tags the commit that set it with v0.2.0, a pre-release
    And no tag is made

  @test:scripts/ig-release.test.ts::ig-release_check:_the_catch-up_when_the_current_version_is_untagged_or_unreleased_(owner,_2026-11-10)::taggedWithoutReleaseSaysRunTheReleaseByHand
  Scenario: a tag with no release says to run the release workflow by hand
    Given the commit tagged v0.2.0 and no release for that tag
    Then the check says to run "IG release (draft)" by hand with tag v0.2.0

  @test:scripts/ig-release.test.ts::ig-release_check:_the_catch-up_when_the_current_version_is_untagged_or_unreleased_(owner,_2026-11-10)::draftOrPublishedReleaseIsInOrder
  Scenario: a draft is reported as waiting for the owner, a published release as in order
    Given the tag and a draft release, then a published one, then an unreadable release list
    Then the draft is waiting for the owner, the published release reports nothing, and an unreadable list is unknown

  @test:scripts/ig-release.test.ts::ig-release_check:_the_catch-up_when_the_current_version_is_untagged_or_unreleased_(owner,_2026-11-10)::shallowHistoryFallsBackToHead
  Scenario: when the history cannot say which commit set the version, HEAD is named and said to be
    Given a checkout whose history does not show the version being set
    Then the check names HEAD and says the history did not say
