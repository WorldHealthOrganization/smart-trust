# IVCP123455 - SMART ICVP v0.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **IVCP123455**

## Example Binary: IVCP123455

This content is an example of the [ICVP](StructureDefinition-ICVP.md) Logical Model and is not a FHIR Resource

```

{
  "resourceType": "http://smart.who.int/icvp/StructureDefinition/ICVP",
  "name": "Test Patient",
  "dob": "2023-02-04",
  "sex": "female",
  "nationality": "IND",
  "vaccineDetails": [
    {
      "productID": {
        "code": "PolioVaccineOralOPVBivalProduct16e883911ea0108b8213bc213c9972fe",
        "system": "http://smart.who.int/pcmt-vaxprequal/CodeSystem/PreQualProductIds"
      },
      "date": "2024-05-23",
      "clinicianName": "DR A",
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
  ]
}

```



## Resource Binary Content

application/fhir+json:

```
{snip}
```
