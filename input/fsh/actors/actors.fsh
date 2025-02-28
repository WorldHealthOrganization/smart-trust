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

