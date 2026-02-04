<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-PolioVaccineOralOPVMonovProductae7e506ca48a3aa605b188cd11eaceab.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-PolioVaccineOralOPVMonovProductae7e506ca48a3aa605b188cd11eaceab.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-PolioVaccineOralOPVMonovProductae7e506ca48a3aa605b188cd11eaceab.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-PolioVaccineOralOPVMonovProductae7e506ca48a3aa605b188cd11eaceab.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-PolioVaccineOralOPVMonovProductae7e506ca48a3aa605b188cd11eaceab.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-PolioVaccineOralOPVMonovProductae7e506ca48a3aa605b188cd11eaceab.html');
else 
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-PolioVaccineOralOPVMonovProductae7e506ca48a3aa605b188cd11eaceab.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
