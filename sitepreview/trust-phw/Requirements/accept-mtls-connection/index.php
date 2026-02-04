<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/trust-phw/v0.1.0/Requirements-accept-mtls-connection.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/trust-phw/v0.1.0/Requirements-accept-mtls-connection.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/trust-phw/v0.1.0/Requirements-accept-mtls-connection.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/trust-phw/v0.1.0/Requirements-accept-mtls-connection.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/trust-phw/v0.1.0/Requirements-accept-mtls-connection.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/trust-phw/v0.1.0/Requirements-accept-mtls-connection.html');
else 
  Redirect('http://smart.who.int/trust-phw/v0.1.0/Requirements-accept-mtls-connection.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
