<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/dak-smbp/v1.0.0/ImplementationGuide-smart.who.int.dak-smbp.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/dak-smbp/v1.0.0/ImplementationGuide-smart.who.int.dak-smbp.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/dak-smbp/v1.0.0/ImplementationGuide-smart.who.int.dak-smbp.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/dak-smbp/v1.0.0/ImplementationGuide-smart.who.int.dak-smbp.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/dak-smbp/v1.0.0/ImplementationGuide-smart.who.int.dak-smbp.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/dak-smbp/v1.0.0/index.html');
else 
  Redirect('http://smart.who.int/dak-smbp/v1.0.0/ImplementationGuide-smart.who.int.dak-smbp.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
