<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/hiv/v1.0.0/PlanDefinition-HIVB2DT.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/hiv/v1.0.0/PlanDefinition-HIVB2DT.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/hiv/v1.0.0/PlanDefinition-HIVB2DT.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/hiv/v1.0.0/PlanDefinition-HIVB2DT.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/hiv/v1.0.0/PlanDefinition-HIVB2DT.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/hiv/v1.0.0/PlanDefinition-HIVB2DT.html');
else 
  Redirect('http://smart.who.int/hiv/v1.0.0/PlanDefinition-HIVB2DT.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
