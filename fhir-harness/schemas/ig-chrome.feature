Feature: The IG chrome file: its schema, the CSS it emits and how readers find it

  @test:schemas/ig-chrome.test.ts::the_schema::refusesChromeWithNoLayer
  Scenario: a chrome with no layer is refused — provenance is the point of the file
    Given a chrome with an empty list of layers
    Then the schema refuses it

  @test:schemas/ig-chrome.test.ts::the_schema::refusesTokenWithoutDashes
  Scenario: a token name without its leading `--` is refused
    Given a chrome whose token is named "navbar-bg-color" without the leading "--"
    Then the schema refuses it

  @test:schemas/ig-chrome.test.ts::the_schema::refusesTruncatedLayerRef
  Scenario: a layer with a truncated ref is refused — a 4-character sha is not provenance
    Given a chrome whose layer ref is the 4-character "849a"
    Then the schema refuses it

  @test:schemas/ig-chrome.test.ts::the_schema::acceptsMalformedConflictWithOneSite
  Scenario: a `malformed` conflict may name ONE site, which a min(2) would have made unrepresentable
    Given a chrome with a "malformed" conflict that names a single site
    Then the schema accepts it

  @test:schemas/ig-chrome.test.ts::the_schema::refusesConflictWithNoSite
  Scenario: a conflict with no site at all is still refused
    Given a chrome with a "malformed" conflict that names no site
    Then the schema refuses it

  @test:schemas/ig-chrome.test.ts::tokensByPackage::countsTokensWonPerPackage
  Scenario: counts what each layer actually WON, not what it declared
    Given three tokens, one of them declared by two packages and won by "acme.template.root"
    When the tokens are counted by package
    Then "acme.template.root" has 2 and "fhir.base.template" has 1

  @test:schemas/ig-chrome.test.ts::chromeCss::neverEmitsBareRoot
  Scenario: never emits a bare `:root` — these pages are ours, not the IG's
    When the CSS of a chrome is emitted for the scope ".st-ig"
    Then it contains ".st-ig {"
    And it has no bare ":root {" rule

  @test:schemas/ig-chrome.test.ts::chromeCss::emitsConflictedTokenWithNote
  Scenario: a conflicted token is EMITTED with a note, never dropped
    Given a token "--toc-box-border" that also has a shape conflict
    When the CSS is emitted
    Then it contains "--toc-box-border: navy;"
    And it contains "shape conflict"

  @test:schemas/ig-chrome.test.ts::chromeCss::scopesMirroredRule
  Scenario: a mirrored rule is scoped too, so `#publish-box` cannot escape onto the site
    Given a mirrored rule for the selector "#publish-box"
    When the CSS is emitted for ".st-ig"
    Then it contains ".st-ig #publish-box {"

  @test:schemas/ig-chrome.test.ts::tokenOf::tokenOfFindsOrUndefined
  Scenario: finds a token, and returns undefined rather than a default for one that is absent
    Then looking up "--navbar-bg-color" gives the value "#00477d"
    And looking up "--nope" gives undefined

  @test:schemas/ig-chrome.test.ts::chromeFileFor::resolvesThroughDeclaration
  Scenario: resolves through the DECLARATION, so a directory that moves moves for every reader
    Given an instance "acme-base" that declares the directory "somewhere-else" holding a chrome.json
    When the chrome file of "acme-base" is looked up
    Then it is the chrome.json in "somewhere-else"

  @test:schemas/ig-chrome.test.ts::chromeFileFor::ignoresSameDirDifferentName
  Scenario: ignores an instance with the same DIRECTORY but a different name
    Given an instance named "acme-ig" whose declared directory holds a chrome.json
    When the chrome file of "acme-base" is looked up
    Then it is undefined

  @test:schemas/ig-chrome.test.ts::chromeFileFor::declaredDirWithoutChromeIsUndefined
  Scenario: a declared directory with no chrome.json yields undefined, not a path that does not exist
    Given an instance "acme-base" whose declared directory has no chrome.json
    When its chrome file is looked up
    Then it is undefined

  @test:schemas/ig-chrome.test.ts::chromeFileFor::pathReachesNestedInstance
  Scenario: a PATH reaches an instance the one-level scan cannot: the platform as a submodule in a fork (n3ni stage E)
    Given a fork where the platform is a submodule and "base-harness" sits two levels down with a chrome.json
    When the chrome file is looked up by the name "base-harness"
    Then it is undefined
    When it is looked up by the path "platform/base-harness"
    Then it is the chrome.json under that instance's themes directory

  @test:schemas/ig-chrome.test.ts::chromeFileFor::pathWithoutInstanceIsUndefined
  Scenario: a path to a directory that declares no instance yields undefined, never a guess
    Given a chrome.json under a directory that declares no instance
    Then looking up "nowhere" gives undefined
    And looking up "x/nowhere" gives undefined
