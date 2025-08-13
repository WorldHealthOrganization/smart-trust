Feature: Retrieve Trust List

Scenario: Retrieve Trust List - DID
GIVEN a Trust Network Participant has onboard to the Trust Network
WHEN the Trust Network Participant is connected to the Trust Network using a secure mTLS connection
THEN the Trust Network Participant is able to retrieve the Trust List in DID format


Scenario: Retrieve Trust List - API