<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.3/Observation-a6a5a1d5-c896-4c7e-b922-888fcc7e6ae3.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.3/Observation-a6a5a1d5-c896-4c7e-b922-888fcc7e6ae3.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.3/Observation-a6a5a1d5-c896-4c7e-b922-888fcc7e6ae3.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.3/Observation-a6a5a1d5-c896-4c7e-b922-888fcc7e6ae3.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.3/Observation-a6a5a1d5-c896-4c7e-b922-888fcc7e6ae3.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.3/Observation-a6a5a1d5-c896-4c7e-b922-888fcc7e6ae3.html');
else 
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.3/Observation-a6a5a1d5-c896-4c7e-b922-888fcc7e6ae3.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
