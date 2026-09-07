// Format content loader
// This script removes embedded rendered HTML and replaces it with a fetch call
// to load the actual file (json, xml, ttl) dynamically
(function() {
  const code = document.getElementById('format-content');
  if (code && code.hasAttribute('data-src')) {
    const src = code.getAttribute('data-src');
    fetch(src)
      .then(response => response.text())
      .then(text => {
        code.textContent = text;
        Prism.highlightElement(code);
      })
      .catch(error => {
        console.error('Error loading format content:', error);
        code.textContent = 'Error loading content from ' + src;
      });
  }
})();
