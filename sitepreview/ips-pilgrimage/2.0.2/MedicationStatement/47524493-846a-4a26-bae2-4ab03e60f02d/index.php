<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.2/MedicationStatement-47524493-846a-4a26-bae2-4ab03e60f02d.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.2/MedicationStatement-47524493-846a-4a26-bae2-4ab03e60f02d.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.2/MedicationStatement-47524493-846a-4a26-bae2-4ab03e60f02d.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.2/MedicationStatement-47524493-846a-4a26-bae2-4ab03e60f02d.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.2/MedicationStatement-47524493-846a-4a26-bae2-4ab03e60f02d.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.2/MedicationStatement-47524493-846a-4a26-bae2-4ab03e60f02d.html');
else 
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.2/MedicationStatement-47524493-846a-4a26-bae2-4ab03e60f02d.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
