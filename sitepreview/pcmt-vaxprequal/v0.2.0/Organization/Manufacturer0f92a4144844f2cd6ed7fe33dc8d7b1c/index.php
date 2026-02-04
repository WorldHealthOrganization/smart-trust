<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Organization-Manufacturer0f92a4144844f2cd6ed7fe33dc8d7b1c.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Organization-Manufacturer0f92a4144844f2cd6ed7fe33dc8d7b1c.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Organization-Manufacturer0f92a4144844f2cd6ed7fe33dc8d7b1c.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Organization-Manufacturer0f92a4144844f2cd6ed7fe33dc8d7b1c.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Organization-Manufacturer0f92a4144844f2cd6ed7fe33dc8d7b1c.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Organization-Manufacturer0f92a4144844f2cd6ed7fe33dc8d7b1c.html');
else 
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Organization-Manufacturer0f92a4144844f2cd6ed7fe33dc8d7b1c.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
