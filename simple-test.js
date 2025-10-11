console.log("Testing node.js execution");
console.log("Current directory:", process.cwd());

// Simple fetch test
const fetch = require('node-fetch');

fetch('http://localhost:4004/api/health')
  .then(response => {
    console.log("Server health status:", response.status);
    return response.json();
  })
  .then(data => {
    console.log("Server health data:", data);
  })
  .catch(error => {
    console.error("Health check failed:", error.message);
  });
