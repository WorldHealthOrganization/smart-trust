
Instance:   request-vdhc
InstanceOf: Requirements
Usage: #definition
* title = "Request Verifiable Digital Health Certificate"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Request a Verifiable Digital Health Certificate from an Issuer"
* actor[+] = Canonical(Holder)


Instance:   issue-vdhc
InstanceOf: Requirements
Usage: #definition
* title = "Issue Verifiable Digital Health Certificate"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Issue a Verifiable Digital Health Certificate to a Holder"
* actor[+] = Canonical(Issuer)

Instance:   receive-vdhc
InstanceOf: Requirements
Usage: #definition
* title = "Receive Verifiable Digital Health Certificate"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Receive a Verifiable Digital Health Certificate from an Issuer"
* actor[+] = Canonical(Holder)

Instance:   provide-vdhc
InstanceOf: Requirements
Usage: #definition
* title = "Provide Verifiable Digital Health Certificate"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Provide a Verifiable Digital Health Certificate to a Receiver"
* actor[+] = Canonical(Holder)


Instance:   verify-vdhc
InstanceOf: Requirements
Usage: #definition
* title = "Verify Verifiable Digital Health Certificate"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Verify a Verifiable Digital Health Certificate that was provided by a Holder"
* actor[+] = Canonical(Receiver)


Instance:   utilize-vdhc
InstanceOf: Requirements
Usage: #definition
* title = "Utilize Verifiable Digital Health Certificate"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Utilize a Verifiable Digital Health Certificate that was provided by a Holder"
* actor[+] = Canonical(Receiver)

Instance:   utilize-vdhc-execute-business-rule
InstanceOf: Requirements
Usage: #definition
* title = "Utilize Verifiable Digital Health Certificate by executing a business rule"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Utilize a Verifiable Digital Health Certificate that was provided by a Holder"
* actor[+] = Canonical(Receiver)




Instance:   publish-business-rules
InstanceOf: Requirements
Usage: #definition
* title = "Publish business rules"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Publish business rules to a Trust Anchor"
* actor[+] = Canonical(Issuer)


Instance:   publish-business-rules-cert-logic
InstanceOf: Requirements
Usage: #definition
* title = "Publish Cert Logic business rules"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Publish Cert Logic business rules to a Trust Anchor"
* actor[+] = Canonical(Issuer)
* derivedFrom = Canonical(publish-business-rules)

Instance:   publish-business-rules-fhir
InstanceOf: Requirements
Usage: #definition
* title = "Publish HL7 FHIR business rules"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Publish business rules to a Trust Anchor using HL7 FHIR"
* actor[+] = Canonical(Issuer)
* derivedFrom = Canonical(publish-business-rules)



Instance:   receive-business-rules
InstanceOf: Requirements
Usage: #definition
* title = "Receive business rules"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Receive business rules from a Trust Network Participant, for distribution within the Trust Network"
* actor[+] = Canonical(TrustNetworkAnchor)

Instance:   receive-business-rules-cert-logic
InstanceOf: Requirements
Usage: #definition
* title = "Receive CertLogic business rules"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Receive CertLogic business rules from a Trust Network Participant, for distribution within the Trust Network"
* actor[+] = Canonical(TrustNetworkAnchor)
* derivedFrom = Canonical(receive-business-rules)

Instance:   receive-business-rules-fhir
InstanceOf: Requirements
Usage: #definition
* title = "Receive HL7 FHIR business rules"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Receive business rules from a Trust Network Participant, for distribution within the Trust Network using HL7 FHIR standard"
* actor[+] = Canonical(TrustNetworkAnchor)
* derivedFrom = Canonical(receive-business-rules)




Instance:   distribute-business-rules
InstanceOf: Requirements
Usage: #definition
* title = "Distribute business rules"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Make received business rules available through a distrubution point to a Receiver"
* actor[+] = Canonical(TrustNetworkAnchor)

Instance:   distribute-business-rules-cert-logic
InstanceOf: Requirements
Usage: #definition
* title = "Distribute CertLogic business rules"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Make received CertLoigc business rules available through a distrubution point to a Receiver"
* actor[+] = Canonical(TrustNetworkAnchor)
* derivedFrom = Canonical(distribute-business-rules)

Instance:   distribute-business-rules-fhir
InstanceOf: Requirements
Usage: #definition
* title = "Distribute CertLogic business rules"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Make received business rules available through a distrubution point to a Receiver through HL7 FHIR standards"
* actor[+] = Canonical(TrustNetworkAnchor)
* derivedFrom = Canonical(distribute-business-rules)




Instance:   retrieve-business-rules
InstanceOf: Requirements
Usage: #definition
* title = "Retrieve HL7 FHIR compatible business rules"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Retrieve business rules from a distribution point using"
* actor[+] = Canonical(Receiver)
* derivedFrom = Canonical(retrieve-business-rules)

Instance:   retrieve-business-rules-cert-logic
InstanceOf: Requirements
Usage: #definition
* title = "Retrieve Cert Logic compatible business rules"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Retrieve Cert Logic business rules from a distribution point "
* actor[+] = Canonical(Receiver)
* derivedFrom = Canonical(retrieve-business-rules)

Instance:   retrieve-business-rules-fhir
InstanceOf: Requirements
Usage: #definition
* title = "Retrieve HL7 FHIR compatible business rules"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Retrieve business rules from a distribution point using HL7 FHIR standards"
* actor[+] = Canonical(Receiver)
* derivedFrom = Canonical(retrieve-business-rules)





Instance:   publish-pki-material
InstanceOf: Requirements
Usage: #definition
* title = "Publish PKI material"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Publish trust material to a Trust Anchor"
* actor[+] = Canonical(TrustNetworkParticipant)

Instance:   publish-pki-material-api
InstanceOf: Requirements
Usage: #definition
* title = "Publish PKI material via API"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Publish trust material to a Trust Anchor via API"
* actor[+] = Canonical(TrustNetworkParticipant)
* derivedFrom = Canonical(publish-pki-material)

Instance:   publish-pki-material-did
InstanceOf: Requirements
Usage: #definition
* title = "Publish PKI material as DID"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Publish trust material to a Trust Anchor as DID"
* actor[+] = Canonical(TrustNetworkParticipant)
* derivedFrom = Canonical(publish-pki-material)

Instance:   receive-pki-material
InstanceOf: Requirements
Usage: #definition
* title = "Receive PKI material"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Receive trust material from a Trust Network Participant, for distribution within the Trust Network"
* actor[+] = Canonical(TrustNetworkAnchor)

Instance:   receive-pki-material-api
InstanceOf: Requirements
Usage: #definition
* title = "Receive PKI material via API"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Receive trust material from a Trust Network Participant, for distribution within the Trust Network via API"
* actor[+] = Canonical(TrustNetworkAnchor)
* derivedFrom = Canonical(receive-pki-material)

Instance:   receive-pki-material-did
InstanceOf: Requirements
Usage: #definition
* title = "Receive PKI material as DID"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Receive trust material from a Trust Network Participant, for distribution within the Trust Network as DID"
* actor[+] = Canonical(TrustNetworkAnchor)
* derivedFrom = Canonical(receive-pki-material)


Instance:   distribute-pki-material
InstanceOf: Requirements
Usage: #definition
* title = "Distribute PKI material"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Make received trust material available through a distrubution point to a Trust Network Participant"
* actor[+] = Canonical(TrustNetworkAnchor)

Instance:   distribute-pki-material-api
InstanceOf: Requirements
Usage: #definition
* title = "Distribute PKI material via API"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Make received trust material available through a distrubution point to a Trust Network Participant via API"
* actor[+] = Canonical(TrustNetworkAnchor)
* derivedFrom = Canonical(distribute-pki-material)

Instance:   distribute-pki-material-did
InstanceOf: Requirements
Usage: #definition
* title = "Distribute PKI material as DID"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Make received trust material available through a distrubution point to a Trust Network Participant as DID"
* actor[+] = Canonical(TrustNetworkAnchor)
* derivedFrom = Canonical(distribute-pki-material)

Instance:   retrieve-pki-material
InstanceOf: Requirements
Usage: #definition
* title = "Retrieve PKI material"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Retrieve PKI material from a distribution point"
* actor[+] = Canonical(TrustNetworkParticipant)
* actor[+] = Canonical(TrustNetworkAnchor)

Instance:   retrieve-pki-material-api
InstanceOf: Requirements
Usage: #definition
* title = "Retrieve PKI material via API"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Retrieve PKI material from a distribution point via API"
* actor[+] = Canonical(TrustNetworkParticipant)
* actor[+] = Canonical(TrustNetworkAnchor)
* derivedFrom = Canonical(retrieve-pki-material)

Instance:   retrieve-pki-material-did
InstanceOf: Requirements
Usage: #definition
* title = "Retrieve PKI material as DID"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Retrieve PKI material from a distribution point as DID"
* actor[+] = Canonical(TrustNetworkParticipant)
* actor[+] = Canonical(TrustNetworkAnchor)
* derivedFrom = Canonical(retrieve-pki-material)
 
