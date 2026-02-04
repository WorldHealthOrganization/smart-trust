<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/hiv/v1.0.0/ValueSet-HIV.B.DE68.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/hiv/v1.0.0/ValueSet-HIV.B.DE68.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/hiv/v1.0.0/ValueSet-HIV.B.DE68.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/hiv/v1.0.0/ValueSet-HIV.B.DE68.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/hiv/v1.0.0/ValueSet-HIV.B.DE68.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/hiv/v1.0.0/ValueSet-HIV.B.DE68.html');
else 
  Redirect('http://smart.who.int/hiv/v1.0.0/ValueSet-HIV.B.DE68.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
