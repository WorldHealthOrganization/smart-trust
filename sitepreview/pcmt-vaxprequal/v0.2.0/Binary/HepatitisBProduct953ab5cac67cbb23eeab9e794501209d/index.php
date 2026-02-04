<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-HepatitisBProduct953ab5cac67cbb23eeab9e794501209d.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-HepatitisBProduct953ab5cac67cbb23eeab9e794501209d.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-HepatitisBProduct953ab5cac67cbb23eeab9e794501209d.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-HepatitisBProduct953ab5cac67cbb23eeab9e794501209d.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-HepatitisBProduct953ab5cac67cbb23eeab9e794501209d.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-HepatitisBProduct953ab5cac67cbb23eeab9e794501209d.html');
else 
  Redirect('http://smart.who.int/pcmt-vaxprequal/v0.2.0/Binary-HepatitisBProduct953ab5cac67cbb23eeab9e794501209d.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
