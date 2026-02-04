<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/hiv/v1.0.0/MedicationStatement-ExamplePreferredThirdPepPrescription.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/hiv/v1.0.0/MedicationStatement-ExamplePreferredThirdPepPrescription.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/hiv/v1.0.0/MedicationStatement-ExamplePreferredThirdPepPrescription.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/hiv/v1.0.0/MedicationStatement-ExamplePreferredThirdPepPrescription.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/hiv/v1.0.0/MedicationStatement-ExamplePreferredThirdPepPrescription.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/hiv/v1.0.0/MedicationStatement-ExamplePreferredThirdPepPrescription.html');
else 
  Redirect('http://smart.who.int/hiv/v1.0.0/MedicationStatement-ExamplePreferredThirdPepPrescription.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
