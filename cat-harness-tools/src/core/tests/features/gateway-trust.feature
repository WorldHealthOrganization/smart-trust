# src/core/gateway-trust.ts lets the HTTP server serve /mcp, and believe X-User-* headers,
# only for the auth-gateway, and binds to loopback by default. Each Scenario names the test that executes it.
Feature: Only the auth-gateway is trusted

  @test:src/core/tests/gateway-trust.test.ts::refuseMcp::refuses_any_bearer_header_when_a_secret_is_configured_and_not_presented
  Scenario: /mcp refuses any bearer header when a secret is configured and not presented
    Given a gateway secret is configured and the server binds 0.0.0.0
    When /mcp is asked with an Authorization bearer header, or with the wrong gateway header
    Then each is refused with 401

  @test:src/core/tests/gateway-trust.test.ts::refuseMcp::serves_the_gateway's_request
  Scenario: /mcp serves the gateway's request
    Given a gateway secret is configured and the server binds 0.0.0.0
    When /mcp is asked with that secret in the gateway header
    Then it is not refused

  @test:src/core/tests/gateway-trust.test.ts::refuseMcp::with_no_secret,_serves_only_a_loopback_bind
  Scenario: With no secret, /mcp is served only on a loopback bind
    Given no gateway secret
    When /mcp is asked on a 0.0.0.0 bind
    Then it is refused with 401
    And on a 127.0.0.1 bind it is not refused

  @test:src/core/tests/gateway-trust.test.ts::trustedRequest::drops_X-User-*_from_a_request_the_gateway_did_not_send
  Scenario: X-User-* headers are dropped from a request the gateway did not send
    Given a request carrying x-user-role and x-user-actor but no gateway header
    When it is made trusted with a secret configured
    Then neither header remains

  @test:src/core/tests/gateway-trust.test.ts::trustedRequest::keeps_them_on_the_gateway's_request
  Scenario: X-User-* headers are kept on the gateway's request
    Given the same request carrying the gateway secret
    When it is made trusted
    Then it is from the gateway and keeps x-user-role "owner"

  @test:src/core/tests/gateway-trust.test.ts::trustedRequest::with_no_secret,_keeps_them_only_on_loopback
  Scenario: With no secret, X-User-* headers are kept only on loopback
    Given no gateway secret
    Then on a 0.0.0.0 bind the x-user-role header is dropped
    And on a 127.0.0.1 bind it is kept as "owner"

  @test:src/core/tests/gateway-trust.test.ts::bind_address::is_loopback_unless_FOLIO_BIND_HOST_says_otherwise
  Scenario: The bind host is loopback unless FOLIO_BIND_HOST says otherwise
    Then with no environment the bind host is "127.0.0.1"
    And with FOLIO_BIND_HOST "0.0.0.0" it is "0.0.0.0"

  @test:src/core/tests/gateway-trust.test.ts::bind_address::%s_binds_bindHostname()_and_guards_/mcp
  Scenario: Each server binds bindHostname() and guards /mcp
    # Gap: a source-text check; no server is started and no route is called
    Given the source of each of "src/server.ts" and "adapters/mcp-server/server.ts"
    Then it has two Bun.serve calls, each passing hostname
    And it calls refuseMcp
    And it never returns httpTransport.handleRequest(req) directly
