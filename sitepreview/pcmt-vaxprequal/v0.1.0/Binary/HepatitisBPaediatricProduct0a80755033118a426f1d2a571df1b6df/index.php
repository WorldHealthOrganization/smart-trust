<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-HepatitisBPaediatricProduct0a80755033118a426f1d2a571df1b6df.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-HepatitisBPaediatricProduct0a80755033118a426f1d2a571df1b6df.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-HepatitisBPaediatricProduct0a80755033118a426f1d2a571df1b6df.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-HepatitisBPaediatricProduct0a80755033118a426f1d2a571df1b6df.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-HepatitisBPaediatricProduct0a80755033118a426f1d2a571df1b6df.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-HepatitisBPaediatricProduct0a80755033118a426f1d2a571df1b6df.html');
else 
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.1.0/Binary-HepatitisBPaediatricProduct0a80755033118a426f1d2a571df1b6df.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
