<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Organization-Manufacturer8b73ac0f00c49a2623f9e9aee2c60cad.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Organization-Manufacturer8b73ac0f00c49a2623f9e9aee2c60cad.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Organization-Manufacturer8b73ac0f00c49a2623f9e9aee2c60cad.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Organization-Manufacturer8b73ac0f00c49a2623f9e9aee2c60cad.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Organization-Manufacturer8b73ac0f00c49a2623f9e9aee2c60cad.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Organization-Manufacturer8b73ac0f00c49a2623f9e9aee2c60cad.html');
else 
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Organization-Manufacturer8b73ac0f00c49a2623f9e9aee2c60cad.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
