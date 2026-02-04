<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/trust-phw/v0.1.0/Requirements-receive-a-vhl.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/trust-phw/v0.1.0/Requirements-receive-a-vhl.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/trust-phw/v0.1.0/Requirements-receive-a-vhl.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/trust-phw/v0.1.0/Requirements-receive-a-vhl.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/trust-phw/v0.1.0/Requirements-receive-a-vhl.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/trust-phw/v0.1.0/Requirements-receive-a-vhl.html');
else 
  Redirect('http://smart.who.int/trust-phw/v0.1.0/Requirements-receive-a-vhl.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
