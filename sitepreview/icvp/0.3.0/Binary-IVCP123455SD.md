# IVCP123455SD - SMART ICVP v0.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **IVCP123455SD**

## Example Binary: IVCP123455SD

This content is an example of the [DVC Icvp with Selective Disclosure](StructureDefinition-ICVPSD.md) Logical Model and is not a FHIR Resource

```

{
  "resourceType": "http://smart.who.int/icvp/StructureDefinition/ICVP",
  "nid": {
    "extension": [
      {
        "url": "http://smart.who.int/trust-phw/StructureDefinition/SelectiveDisclosure",
        "valueCode": "disclose-icvp-demographic-national-id"
      }
    ],
    "value": "987-65-4321-000"
  },
  "vaccineDetails": [
    {
      "productID": {
        "code": "PolioVaccineOralOPVBivalProduct16e883911ea0108b8213bc213c9972fe",
        "system": "http://smart.who.int/pcmt-vaxprequal/CodeSystem/PreQualProductIds"
      },
      "date": "2024-05-23",
      "clinicianName": "DR A",
      "_clinicianName": {
        "extension": [
          {
            "url": "http://smart.who.int/trust-phw/StructureDefinition/SelectiveDisclosure",
            "valueCode": "disclose-icvp-vaccination-clinician"
          }
        ]
      },
      "batchNo": {
        "coding": [
          {
            "display": "67890"
          }
        ]
      },
      "validityPeriod": {
        "start": "2024-05-31"
      }
    }
  ],
  "name": "Test Patient (SD)",
  "_name": {
    "extension": [
      {
        "url": "http://smart.who.int/trust-phw/StructureDefinition/SelectiveDisclosure",
        "valueCode": "disclose-icvp-demographic-name"
      }
    ]
  },
  "dob": "2023-02-04",
  "_dob": {
    "extension": [
      {
        "url": "http://smart.who.int/trust-phw/StructureDefinition/SelectiveDisclosure",
        "valueCode": "disclose-icvp-demographic-dob"
      }
    ]
  },
  "sex": "female",
  "_sex": {
    "extension": [
      {
        "url": "http://smart.who.int/trust-phw/StructureDefinition/SelectiveDisclosure",
        "valueCode": "disclose-icvp-demographic-sex"
      }
    ]
  },
  "nationality": "IND",
  "_nationality": {
    "extension": [
      {
        "url": "http://smart.who.int/trust-phw/StructureDefinition/SelectiveDisclosure",
        "valueCode": "disclose-icvp-demographic-nationality"
      }
    ]
  }
}

```



## Resource Binary Content

application/fhir+json:

```
{snip}
```
