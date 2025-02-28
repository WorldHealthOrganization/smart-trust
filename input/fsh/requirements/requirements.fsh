
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
