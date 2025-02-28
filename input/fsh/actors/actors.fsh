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
* description = "Holder of a Verifiable Digital Health Certificate"
* status = $pubStatus#active
* experimental = true
* publisher = "WHO"
* type = $actorType#person

Instance: Issuer
InstanceOf: $SGActor
Usage: #definition
* name = "Issuer"
* title = "Issuer"
* description = "Issuer of a Verifiable Digital Health Certificate"
* status = $pubStatus#active
* experimental = true
* publisher = "WHO"
* type = $actorType#system


Instance: Receiver
InstanceOf: $SGActor
Usage: #definition
* name = "Receiver"
* title = "Receiver"
* description = "Receiver (or Verifier) of a Verifiable Digital Health Certificate"
* status = $pubStatus#active
* experimental = true
* publisher = "WHO"
* type = $actorType#system

