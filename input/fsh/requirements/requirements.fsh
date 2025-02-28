
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




Instance:   publish-pki-material
InstanceOf: Requirements
Usage: #definition
* title = "Publish PKI material"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Publish trust material to a Trust Anchor"
* actor[+] = Canonical(TrustNetworkParticipant)


Instance:   receive-pki-material
InstanceOf: Requirements
Usage: #definition
* title = "Receive PKI material"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Receive trust material from a Trust Network Participant, for distribution within the Trust Network"
* actor[+] = Canonical(TrustNetworkAnchor)

Instance:   distribute-pki-material
InstanceOf: Requirements
Usage: #definition
* title = "Distribute PKI material"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Make received trust material available through a distrubution point to a Trust Network Participant"
* actor[+] = Canonical(TrustNetworkAnchor)

Instance:   retrieve-pki-material
InstanceOf: Requirements
Usage: #definition
* title = "Retrieve PKI material"
* status = $pubStatus#active
* publisher = "WHO"
* description = "Retrieve PKI material from a distribution point"
* actor[+] = Canonical(TrustNetworkParticipant)
* actor[+] = Canonical(TrustNetworkAnchor)
