Feature: the closure gate and the import closure walker, tested with planted violations

  @test:scripts/check-closure.test.ts::check-closure::ownFilesZodBuiltinsPass
  Scenario: its own files, zod and node: builtins pass
    Given a planted bootstrap-tools package whose files import zod, a node: builtin and each other
    When the closure is checked
    Then there are no findings

  @test:scripts/check-closure.test.ts::check-closure::relativeImportOutsideFails
  Scenario: a relative import out of the package fails
    Given a planted package with a file importing "../../above/x.ts"
    When the closure is checked
    Then the one finding is "leaves bootstrap-tools (../above/x.ts)"

  @test:scripts/check-closure.test.ts::check-closure::onlyAllowedPackagesPass
  Scenario: liquidjs and @playwright/test are allowed, any other package fails, and a test may add only bun:test and ajv
    Given a source file importing liquidjs, lodash and @playwright/test
    And a test file importing bun:test, ajv and playwright
    When the closure is checked
    Then the findings are exactly lodash in the source file and playwright in the test file

  @test:scripts/check-closure.test.ts::check-closure::commentImportIgnored
  Scenario: an import quoted in a comment is not an import; dynamic and re-exports are
    Then imports written inside block and line comments yield no specifiers
    And a re-export from "./a.ts" and a dynamic import of "./b.ts" yield both specifiers

  @test:scripts/check-closure.test.ts::strings_are_data,_not_imports::stringImportIgnored
  Scenario: a fixture that builds an import inside a string is not read as one
    Given source whose import statements appear only inside a string and a template literal
    Then it yields no specifiers

  @test:scripts/check-closure.test.ts::importClosure:_the_transitive_walk::followsRelativeImports
  Scenario: follows relative imports transitively, across directories, with .js → .ts and JSON as a leaf
    Given an entry that imports a .js path backed by a .ts file, which imports JSON data and re-exports from a third directory, beside a file nothing imports
    When the import closure of the entry is walked
    Then the files reached are the entry, the .ts file, the JSON file and the re-exported file, in that order
    And nothing is unresolved or missing

  @test:scripts/check-closure.test.ts::importClosure:_the_transitive_walk::bareImportExternalUnlessMapped
  Scenario: a bare import is external unless resolveBare maps it; a mapped one is followed; a claimed one that names nothing is unresolved
    Given a file importing zod, a mapped "@fx/lib/s.js" and a mapped "@fx/lib/gone.js" that names no file
    When the import closure is walked with a resolveBare that maps "@fx/lib/"
    Then the files reached are the entry, lib/s.ts and lib/t.ts
    And zod is external
    And "@fx/lib/gone.js" is unresolved

  @test:scripts/check-closure.test.ts::importClosure:_the_transitive_walk::reportsUnresolvedImports
  Scenario: an unresolved relative import, a missing entry and a computed import() are each reported, never dropped
    Given a file importing a relative path that does not exist and calling import() on a variable
    When the import closure is walked from it and from an entry that does not exist
    Then "./nope.ts" is unresolved
    And the absent entry is missing
    And the file is listed as having a computed import

  @test:scripts/check-closure.test.ts::importClosure:_the_transitive_walk::followAndDeclaredEdges
  Scenario: `follow` records an edge without walking past it; `declaredEdges` walks a declared computed target
    Given a file inside "in" importing a file outside it, which imports a deeper file
    When the closure is walked with follow limited to "in"
    Then the files reached are the inside file and the outside file it imports, but not the deeper one
    Given a loader with a computed import() and a declared edge to a plugin
    When the closure of the loader is walked with that declared edge
    Then the files reached are the loader and the plugin

  @test:scripts/check-closure.test.ts::importClosure:_the_transitive_walk::readsThroughHost
  Scenario: it reads through a host, so a caller can walk a tree it has not checked out
    Given an in-memory host where "/v/a.ts" imports "./b.js" and "/v/b.ts" exists
    When the import closure of "/v/a.ts" is walked through the host
    Then the files reached are "/v/a.ts" and "/v/b.ts"
    And the one edge is a relative import from "/v/a.ts" by "./b.js" to "/v/b.ts"
