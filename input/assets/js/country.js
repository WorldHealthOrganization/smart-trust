
const environments = [
    { env: 'DEV', type: 'Embedded', url: 'https://tng-cdn-dev.who.int/v2/trustlist' },
    { env: 'DEV', type: 'Reference', url: 'https://tng-cdn-dev.who.int/v2/trustlist-ref' },
    { env: 'UAT', type: 'Embedded', url: 'https://tng-cdn-uat.who.int/v2/trustlist' },
    { env: 'UAT', type: 'Reference', url: 'https://tng-cdn-uat.who.int/v2/trustlist-ref' },
    { env: 'PROD', type: 'Embedded', url: 'https://tng-cdn.who.int/v2/trustlist' },
    { env: 'PROD', type: 'Reference', url: 'https://tng-cdn.who.int/v2/trustlist-ref' }
  ];


  async function fetchAndProcessDID() {
    const dropdown = document.getElementById("dropdown");
    const output = document.getElementById("output");
    const tableBody = document.getElementById("env-table");
    let outputText = "";

    try {
      const response = await fetch('https://raw.githubusercontent.com/WorldHealthOrganization/tng-cdn-dev/main/v2/trustlist/did.json');
      const data = await response.json();

      dropdown.innerHTML = '';

      if (data.verificationMethod) {
        const seen = new Set();

        data.verificationMethod.forEach(method => {
          if (method.id) {
            const parts = method.id.split(":");
            if (parts.length >= 7) {
              const value = parts[6];
              if (!seen.has(value)) {
                seen.add(value);

                const option = document.createElement("option");
                option.value = value;
                option.textContent = value;
                dropdown.appendChild(option);
              }
            }
          }
        });

        output.innerHTML = 'Select a country to populate the table.';
      } else {
        dropdown.innerHTML = '<option>No verification methods found.</option>';
      }

      // Handle selection change
      dropdown.addEventListener("change", () => {
        const selectedCountry = dropdown.value;

        // Clear existing table body
        tableBody.innerHTML = '';
      
        // Add rows with selected country appended to URL
        environments.forEach(env => {
          const tr = document.createElement("tr");
      
          // Append selected country as query param, e.g., ?country=Germany
          const updatedUrl = `${env.url}/DCC/${selectedCountry}/did.json`;
      
          tr.innerHTML = `
            <td>${env.env}</td>
            <td>${env.type}</td>
            <td><a href="${updatedUrl}" target="_blank">${updatedUrl}</a></td>
          `;
      
          tableBody.appendChild(tr);
        });
      });

    } catch (error) {
      output.innerHTML = `Error: ${error.message}`;
    }
  }

  document.addEventListener("DOMContentLoaded", fetchAndProcessDID);


  