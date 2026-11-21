Feature: Seeding the FHIR package cache from npm, a site repository and a mirror

  @test:scripts/fhir-cache-seed-npm.test.ts::fhir-cache-seed-npm::validPart::validPartAcceptsSafe
  Scenario: accepts safe names and versions
    Then package names, semantic versions, a ballot version and "current" are valid parts

  @test:scripts/fhir-cache-seed-npm.test.ts::fhir-cache-seed-npm::validPart::validPartRefusesDangerous
  Scenario: refuses dangerous strings that could cause traversal or command injection
    Then an empty string, option-like strings, path traversal, separators, a NUL and leading or trailing spaces are not valid parts

  @test:scripts/fhir-cache-seed-npm.test.ts::fhir-cache-seed-npm::exact::exactAcceptsConcrete
  Scenario: recognizes concrete semantic versions and current
    Then concrete versions, a ballot version, a date-like version and "current" are exact

  @test:scripts/fhir-cache-seed-npm.test.ts::fhir-cache-seed-npm::exact::exactRefusesRanges
  Scenario: refuses wildcards and ranges
    Then "1.0.x", "^1.0.0", "~1.0.0", "latest" and "dev" are not exact

  @test:scripts/fhir-cache-seed-npm.test.ts::fhir-cache-seed-npm::parseSushiConfigDeps::parsesSushiDeps
  Scenario: extracts fhirVersion and dependencies from sushi-config.yaml
    Given a sushi-config.yaml with a FHIR version and dependencies in both short and long form
    When its dependencies are parsed
    Then they include the core package for 4.0.1 and each dependency at its version

  @test:scripts/fhir-cache-seed-npm.test.ts::fhir-cache-seed-npm::parseSushiConfigDeps::parseIgnoresComments
  Scenario: ignores comments and comment blocks without breaking early
    Given a sushi-config.yaml whose dependencies are interleaved with commented-out entries
    When its dependencies are parsed
    Then they are exactly the core package, the terminology package and crmi

  @test:scripts/fhir-cache-seed-npm.test.ts::fhir-cache-seed-npm::checkCached::checkCachedAcceptsMatch
  Scenario: accepts matching package entry
    Given a cached package whose package.json names "a.b" at "1.0.0"
    Then checking it for "a.b" at "1.0.0" finds no problem

  @test:scripts/fhir-cache-seed-npm.test.ts::fhir-cache-seed-npm::checkCached::checkCachedAcceptsScoped
  Scenario: accepts @hl7/ scoped name
    Given a cached package whose package.json names "@hl7/hl7.fhir.r4.core"
    Then checking it for "hl7.fhir.r4.core" at "4.0.1" finds no problem

  @test:scripts/fhir-cache-seed-npm.test.ts::fhir-cache-seed-npm::checkCached::checkCachedRefusesMismatch
  Scenario: refuses mismatched version or name
    Given a cached package whose package.json has version "2.0.0"
    Then checking it for version "1.0.0" finds a problem

  @test:scripts/fhir-cache-seed-npm.test.ts::fhir-cache-seed-npm::tarball_reading_&_unpacking::readsPackageJsonFromTgz
  Scenario: reads package.json in memory from tgz buffer
    Given a package tarball for "my.pkg" at "1.2.3" with one dependency
    When its package.json is read in memory
    Then it names "my.pkg" at "1.2.3" with the dependency "dep.a" at "1.0.0"

  @test:scripts/fhir-cache-seed-npm.test.ts::fhir-cache-seed-npm::tarball_reading_&_unpacking::unpacksTgzSafely
  Scenario: unpacks files into target directory safely
    Given a package tarball
    When it is unpacked into a target directory
    Then its package.json is there and the cache check finds no problem

  @test:scripts/fhir-cache-seed-npm.test.ts::fhir-cache-seed-npm::site_repositories_(--site-repo)::parsesSiteRepoArgs
  Scenario: parses PREFIX=OWNER/REPO[@BRANCH], repeatable
    When the arguments carry two --site-repo options, one with a branch
    Then both prefixes map to their repositories

  @test:scripts/fhir-cache-seed-npm.test.ts::fhir-cache-seed-npm::site_repositories_(--site-repo)::noSiteRepoUnlessMapped
  Scenario: no site repository unless the caller maps the prefix
    Then a package with no site repository mapping, or a mapping for another prefix, is not fetched from a site

  @test:scripts/fhir-cache-seed-npm.test.ts::fhir-cache-seed-npm::site_repositories_(--site-repo)::refusesMalformedSiteRepo
  Scenario: refuses a malformed repository before any network call
    Then a mapping to "not a repo" fetches nothing

  @test:scripts/fhir-cache-seed-npm.test.ts::fhir-cache-seed-npm::fromMirror::mirrorAcceptsMatchingHash
  Scenario: accepts file matching SHA512SUMS and internal package.json
    Given a mirror holding a package tarball listed with its sha512 in SHA512SUMS
    When the package is taken from the mirror
    Then it returns the data with the file name as provenance

  @test:scripts/fhir-cache-seed-npm.test.ts::fhir-cache-seed-npm::fromMirror::mirrorRefusesBadHash
  Scenario: refuses file with mismatched hash or missing from SHA512SUMS
    Given a mirror whose SHA512SUMS lists a wrong hash for the tarball
    When the package is taken from the mirror
    Then it returns an error

  @test:scripts/fhir-cache-seed-npm.test.ts::fhir-cache-seed-npm::recursive_transitive_dependency_resolution::followsTransitiveDeps
  Scenario: recursively follows dependencies across cache and mirror and outputs missing packages to --missing-out
    Given a cached package depending on two mirrored packages, one of which depends on a third mirrored package and the other on a package nowhere
    When the cache is seeded with the first package and nothing is on npm
    Then the exit code is 1
    And the cached package and the three mirrored packages are installed
    And the only missing package is "pkg.d#2.0.0", and the missing-out file holds it

  @test:scripts/fhir-cache-seed-npm.test.ts::fhir-cache-seed-npm::recursive_transitive_dependency_resolution::refusesShortMirrorCommit
  Scenario: refuses an abbreviated --mirror-commit by name instead of dropping the mirror
    When the cache is seeded with a mirror pinned to the short commit "c344c47"
    Then a log line says the mirror commit must be a full 40-character commit SHA
    And the wanted package is missing
    And the full-commit pattern refuses the short sha and accepts a 40-character one

  @test:scripts/fhir-cache-seed-npm.test.ts::fhir-cache-seed-npm::recursive_transitive_dependency_resolution::cyclicDepsTerminate
  Scenario: terminates without infinite loop on cyclic dependencies
    Given two cached packages that depend on each other
    When the cache is seeded with one of them
    Then the exit code is 0, both are installed and nothing is missing

  @test:scripts/fhir-cache-seed-npm.test.ts::fhir-cache-seed-npm::recursive_transitive_dependency_resolution::listsAbsentHl7Packages
  Scenario: correctly lists the 4 HL7 packages an IG depends on when they are absent from mirror and npm
    Given an IG's sushi-config with six dependencies, of which the mirror holds one and the cache holds the core and cpg packages, and none are on npm
    When the cache is seeded from that config
    Then the exit code is 1
    And the terminology, cql, crmi and sdc packages are missing, and each is listed in the missing-out file

  @test:scripts/fhir-cache-seed-npm.test.ts::fhir-cache-seed-npm_--lock::parses_the_format,_sha512_integrity_or_hex_sha256,_and_refuses_what_it_cannot_pin
  Scenario: the package lock is parsed with a hex sha256 or a sha512 integrity, and what it cannot pin is refused
    Then an entry with a sha256 keeps that sha256, and one with a sha512 integrity keeps that integrity
    And an entry with no hash, a plain-http tarball, a version range or tag, a path-like name, or a non-sha512 integrity is refused
    And a lock with no packages list is refused

  @test:scripts/fhir-cache-seed-npm.test.ts::fhir-cache-seed-npm_--lock::a_sha256_match_installs_the_package_from_the_lock's_URL_and_records_it
  Scenario: a sha256 match installs the package from the lock's URL and records its provenance
    Given a lock pinning a package's tarball by sha256
    When the cache is seeded from the lock
    Then only the lock's URL is fetched, and the package is installed at its version, without following its dependencies
    And its provenance records the lock as the source, with the tarball URL and the sha256
    And a second run fetches nothing and still succeeds

  @test:scripts/fhir-cache-seed-npm.test.ts::fhir-cache-seed-npm_--lock::an_sha512_integrity_match_installs,_as_in_this_layer's_own_lock_format
  Scenario: a sha512 integrity match installs the package
    Given a lock pinning the tarball by its sha512 integrity
    When the cache is seeded from the lock
    Then it succeeds and the package is in the cache

  @test:scripts/fhir-cache-seed-npm.test.ts::fhir-cache-seed-npm_--lock::a_mismatch_is_refused,_installs_nothing,_and_falls_back_to_no_other_source
  Scenario: a hash mismatch is refused, installs nothing, and tries no other source
    Given a served tarball whose content differs from the one the lock pins, by sha256 or by integrity
    When the cache is seeded from the lock
    Then it fails, the package is missing with a lock mismatch as the reason, and nothing is installed
    And npm is never asked
    And the mismatch check names a sha256 mismatch

  @test:scripts/fhir-cache-seed-npm.test.ts::fhir-cache-seed-npm_--lock::a_tarball_that_names_another_package_is_refused_even_when_its_hash_is_pinned
  Scenario: a tarball that names another package is refused even when its hash is the pinned one
    Given a lock whose pinned hash is of a tarball for another package
    When the cache is seeded from the lock
    Then it fails, and the reason names the other package

  @test:scripts/fhir-cache-seed-npm.test.ts::fhir-cache-seed-npm_--lock::a_cache_entry_the_lock_did_not_install_is_replaced_by_the_pinned_one
  Scenario: a cache entry the lock did not install is replaced by the pinned one
    Given a cache already holding the package, fetched by something else
    When the cache is seeded from the lock
    Then the lock's URL is fetched and the stale entry's extra file is gone

  @test:scripts/fhir-cache-seed-npm.test.ts::fhir-cache-seed-npm_--lock::an_unreadable_lock_is_a_usage_error,_before_anything_is_fetched
  Scenario: an unusable lock is a usage error, before anything is fetched
    Given a lock whose entry pins no hash
    When the cache is seeded from it
    Then the exit code is 2 and nothing is fetched

  @test:scripts/fhir-cache-seed-npm.test.ts::fhir-cache-seed-npm_--lock::with_no_lock,_nothing_changes:_--lock_is_unset_and_a_cached_package_is_used_as_before
  Scenario: with no lock, nothing changes
    Then --lock is unset unless given, and is read when given
    And with no lock, a package already in the cache is used as before, without fetching
