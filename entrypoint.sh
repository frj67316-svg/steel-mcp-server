#!/bin/sh
# Start a simple health HTTP server in the background
node -e "
const http = require('http');
const port = process.env.PORT || 3000;
http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({status: 'ok', service: 'steel-mcp-server'}));
  } else {
    res.writeHead(404);
    res.end();
  }
}).listen(port, () => {
  console.error('Health server listening on port', port);
});
" &

# Wait for the MCP server process
node dist/index.js
