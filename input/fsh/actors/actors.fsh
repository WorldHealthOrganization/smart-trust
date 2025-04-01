Instance: TrustNetworkAnchor
InstanceOf: $SGActor
Usage: #definition
* name = "Trust Network Anchor"
* title = "Trust Network Anchor"
* description = "Trust Anchor which receives and distributes PKI-material within a Trust Network"
* status = $pubStatus#active
* experimental = true
* publisher = "WHO"
* type = $actorType#system

Instance: TrustNetworkParticipant
InstanceOf: $SGActor
Usage: #definition
* name = "Trust Network Participant"
* title = "Trust Network Participant"
* description = "Trust Network Participant which publishes and or receives PKI-material within a Trust Network"
* status = $pubStatus#active
* experimental = true
* publisher = "WHO"
* type = $actorType#system



Instance: Holder
InstanceOf: $SGActor
Usage: #definition
* name = "Holder"
* title = "Holder"
* description = "A Holder is an individual that has Verifiable Digtial Health Certificate in their possesion, received from an Issuer.  The Holder may choose to share the Verifiable Digital Health Certificate with a Receiver."
* status = $pubStatus#active
* experimental = true
* publisher = "WHO"
* type = $actorType#person

Instance: Issuer
InstanceOf: $SGActor
Usage: #definition
* name = "Issuer"
* title = "Issuer"
* description = "An Issuer a system authorized by a Trust Network Participant to generate Verifiable Digital Health Certificates which are provided to a Holder.   An Issuer is responsible for generating the content that is digitally signed within the Verifiable Digital Health Certificate.   In order to sign this content, an Issuer should either itself be a Document Signer or utilize a Document Signer service, as authorized by the jurisdicitonal policy."
* status = $pubStatus#active
* experimental = true
* publisher = "WHO"
* type = $actorType#system
* derivedFrom = Canonical(TrustNetworkParticipant)

Instance: Receiver
InstanceOf: $SGActor
Usage: #definition
* name = "Receiver"
* title = "Receiver"
* description = "A Reciever is a system authorized by a Trust Network Participant to receive from a Holder a Veritifable, verify and utilize the content within."
* status = $pubStatus#active
* experimental = true
* publisher = "WHO"
* type = $actorType#system
* derivedFrom = Canonical(TrustNetworkParticipant)
