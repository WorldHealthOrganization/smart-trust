<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.2/Medication-8adc0999-9468-4ac9-9557-680fa133d625.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.2/Medication-8adc0999-9468-4ac9-9557-680fa133d625.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.2/Medication-8adc0999-9468-4ac9-9557-680fa133d625.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.2/Medication-8adc0999-9468-4ac9-9557-680fa133d625.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.2/Medication-8adc0999-9468-4ac9-9557-680fa133d625.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.2/Medication-8adc0999-9468-4ac9-9557-680fa133d625.html');
else 
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.2/Medication-8adc0999-9468-4ac9-9557-680fa133d625.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
