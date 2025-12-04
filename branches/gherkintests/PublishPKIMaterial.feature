Feature: Publish PKI Material

Scenario: Retrieved IPS content is valid
GIVEN the Host Country EMR retrieved IPS Content as JSON
WHEN the EMR validates the IPS content
THEN IPS content validation is successful
AND IPS Content is displayed

Scenario: Retrieved IPS content is invalid
GIVEN the Host Country EMR retrieved IPS Content as JSON
WHEN the EMR validates the IPS content
THEN IPS content validation fails
AND error message is sent