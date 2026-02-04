<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.3/MedicationStatement-c220e36c-eb67-4fc4-9ba1-2fabc52acec5.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.3/MedicationStatement-c220e36c-eb67-4fc4-9ba1-2fabc52acec5.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.3/MedicationStatement-c220e36c-eb67-4fc4-9ba1-2fabc52acec5.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.3/MedicationStatement-c220e36c-eb67-4fc4-9ba1-2fabc52acec5.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.3/MedicationStatement-c220e36c-eb67-4fc4-9ba1-2fabc52acec5.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.3/MedicationStatement-c220e36c-eb67-4fc4-9ba1-2fabc52acec5.html');
else 
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.3/MedicationStatement-c220e36c-eb67-4fc4-9ba1-2fabc52acec5.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
