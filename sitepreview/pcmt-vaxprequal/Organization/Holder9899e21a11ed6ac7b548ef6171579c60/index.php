<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Organization-Holder9899e21a11ed6ac7b548ef6171579c60.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Organization-Holder9899e21a11ed6ac7b548ef6171579c60.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Organization-Holder9899e21a11ed6ac7b548ef6171579c60.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Organization-Holder9899e21a11ed6ac7b548ef6171579c60.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Organization-Holder9899e21a11ed6ac7b548ef6171579c60.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Organization-Holder9899e21a11ed6ac7b548ef6171579c60.html');
else 
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Organization-Holder9899e21a11ed6ac7b548ef6171579c60.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
