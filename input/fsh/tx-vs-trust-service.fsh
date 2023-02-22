Alias: $trust-service-context = http://worldhealthorganization.github.io/smart-trust/CodeSystem/trust-service-context

ValueSet: WHOSMARTTrust_credential_type
Id: credential-type
Title: "WHO SMART Trust credential type"
Description: "Health credential type"

* ^experimental = true
// * ^copyright = "nan"

* $trust-service-context#who
* $trust-service-context#dcc
* $trust-service-context#icao
* $trust-service-context#au
* $trust-service-context#shc
* $trust-service-context#divoc

ValueSet: WHOSMARTTrust_credential_service_type
Id: credential-service-type
Title: "WHO SMART Trust credential service type"
Description: "Health credential service type"

* ^experimental = true
// * ^copyright = "nan"

* $trust-service-context#vaccine_credential
* $trust-service-context#test_credential
* $trust-service-context#recovery_credential
* $trust-service-context#exemption_credential
* $trust-service-context#ips_credential

ValueSet: WHOSMARTTrust_credential_content_type
Id: credential-content-type
Title: "WHO SMART Trust credential content type"
Description: "Health credential content type"

* ^experimental = true
// * ^copyright = "nan"

* $trust-service-context#COVID-19
* $trust-service-context#Monkeypox