<?php
function Redirect($url)
{
  header('Location: ' . $url, true, 302);
  exit();
}

$accept = $_SERVER['HTTP_ACCEPT'];
if (strpos($accept, 'application/json+fhir') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.3/Condition-c4597aa2-688a-401b-a658-70acc6de28c5.json2');
elseif (strpos($accept, 'application/fhir+json') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.3/Condition-c4597aa2-688a-401b-a658-70acc6de28c5.json1');
elseif (strpos($accept, 'json') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.3/Condition-c4597aa2-688a-401b-a658-70acc6de28c5.json');
elseif (strpos($accept, 'application/xml+fhir') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.3/Condition-c4597aa2-688a-401b-a658-70acc6de28c5.xml2');
elseif (strpos($accept, 'application/fhir+xml') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.3/Condition-c4597aa2-688a-401b-a658-70acc6de28c5.xml1');
elseif (strpos($accept, 'html') !== false)
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.3/Condition-c4597aa2-688a-401b-a658-70acc6de28c5.html');
else 
  Redirect('http://smart.who.int/ips-pilgrimage/2.0.3/Condition-c4597aa2-688a-401b-a658-70acc6de28c5.xml');
?>
    
You should not be seeing this page. If you do, PHP has failed badly.
