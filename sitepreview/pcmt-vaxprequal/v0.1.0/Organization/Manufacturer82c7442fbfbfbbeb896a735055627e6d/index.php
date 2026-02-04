<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Organization-Manufacturer82c7442fbfbfbbeb896a735055627e6d.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Organization-Manufacturer82c7442fbfbfbbeb896a735055627e6d.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Organization-Manufacturer82c7442fbfbfbbeb896a735055627e6d.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Organization-Manufacturer82c7442fbfbfbbeb896a735055627e6d.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Organization-Manufacturer82c7442fbfbfbbeb896a735055627e6d.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Organization-Manufacturer82c7442fbfbfbbeb896a735055627e6d.html');
else 
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Organization-Manufacturer82c7442fbfbfbbeb896a735055627e6d.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
