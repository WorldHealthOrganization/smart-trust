# src/auth/gateway.ts is the auth gateway in front of folio-assistant: it owns the
# identity headers, gates /mcp by bearer token or session, and runs the Google OAuth
# login; the deploy files route through it. Each Scenario names the test that executes it.
Feature: Auth gateway identity, login and deployment routing

  @test:test/auth-gateway.test.ts::identity_headers_are_the_gateway's_alone_(H2)::drops_a_client_X-User-Actor_and_X-User-Role_on_the_session_path
  Scenario: Client identity headers are dropped on the session path
    Given a request to "/api/git/status" with a viewer session cookie
    And client headers "x-user-actor: owner", "x-user-role: owner" and "X-User-Extra"
    When the gateway handles the request
    Then the upstream request carries no "x-user-actor" and no "x-user-extra"
    And its "x-user-role" is "viewer", taken from the session
    And its "x-folio-gateway" is the gateway secret

  @test:test/auth-gateway.test.ts::identity_headers_are_the_gateway's_alone_(H2)::drops_client_X-User-*_on_the_bearer_path_and_vouches_for_the_request
  Scenario: Client identity headers are dropped on the bearer path and the gateway vouches for the request
    Given a request to "/mcp" with the right bearer token
    And client headers "x-user-role: owner" and a forged "x-folio-gateway"
    When the gateway handles the request
    Then the upstream request carries no "x-user-role"
    And its "x-folio-gateway" is the real gateway secret

  @test:test/auth-gateway.test.ts::identity_headers_are_the_gateway's_alone_(H2)::refuses_a_wrong_bearer_token_and_a_missing_session_without_calling_upstream_(H1)
  Scenario: A wrong bearer token or no session is refused without reaching upstream
    Given a request to "/mcp" with bearer token "x", and one with no credentials
    When the gateway handles each
    Then both answer 401
    And upstream receives no request

  @test:test/auth-gateway.test.ts::OAuth_login_(H6)::refuses_a_callback_whose_state_was_not_issued_to_this_browser
  Scenario: A callback whose state was not issued to this browser is refused
    Given a login started at "/auth/google/start" that redirects with a state and sets an HttpOnly "folio_oauth_state" cookie
    When the callback arrives with that state but no state cookie
    Then no "folio_session" cookie is set
    And the response says "Invalid or expired login attempt"
    And a callback whose state cookie names a different state gets the same refusal

  @test:test/auth-gateway.test.ts::OAuth_login_(H6)::refuses_a_Google_account_whose_email_is_not_verified
  Scenario: A Google account with an unverified email is refused
    Given Google answers with "unverified@example.org" and verified_email false
    And the email is on the viewers allowlist
    When the callback arrives from the browser that started the login
    Then no "folio_session" cookie is set
    And the response says "Failed to authenticate with Google"

  @test:test/auth-gateway.test.ts::OAuth_login_(H6)::signs_in_a_verified,_allowlisted_account_from_the_browser_that_started
  Scenario: A verified, allowlisted account is signed in from the browser that started
    Given Google answers with "viewer@example.org" and verified_email true
    When the callback arrives with the state and its matching state cookie
    Then the response is a 302 redirect
    And it sets a live "folio_session" cookie
    And it clears the "folio_oauth_state" cookie with Max-Age=0

  @test:test/auth-gateway.test.ts::deployment_routes_/mcp_through_the_gateway_(H1,_H3,_H6)::Caddy_sends_nothing_but_/health_straight_to_folio-assistant
  Scenario: Caddy proxies only /health straight to folio-assistant
    Given the deploy Caddyfile.template
    When its text is read
    Then exactly one reverse_proxy line points at folio-assistant
    And it sits inside the "route /health" block
    And the file does not contain "@has_token"

  @test:test/auth-gateway.test.ts::deployment_routes_/mcp_through_the_gateway_(H1,_H3,_H6)::compose_gives_both_services_the_gateway_secret,_the_right_upstream_name,_and_a_container_bind
  Scenario: Compose wires the gateway secret, upstream name and container bind
    Given the deploy docker-compose.yml
    When its text is read
    Then it does not contain "PAPER_ASSISTANT_UPSTREAM"
    And it contains "FOLIO_UPSTREAM=http://folio-assistant:"
    And "FOLIO_GATEWAY_SECRET" is required by two services
    And it contains "FOLIO_BIND_HOST=0.0.0.0"
