< script >
/*   async function fetchAndProcessDID() {
      try {
         const response = await fetch('https://raw.githubusercontent.com/WorldHealthOrganization/tng-cdn-dev/main/v2/trustlist/did.json');
         const data = await response.json();

         let outputText = '';
         if (data.verificationMethod) {
            data.verificationMethod.forEach(method => {
               if (method.id) {
                  const parts = method.id.split(":");
                  if (parts.length >= 9) {
                     outputText += `9th element: ${parts[8]}<br>`;
                  }
               }
            });
         }
         document.getElementById('output').innerHTML = outputText;
      } catch (error) {
         document.getElementById('output').innerHTML = `Error: ${error.message}`;
      }
   }
fetchAndProcessDID();*/
console.log("Hello, world!");
</script>