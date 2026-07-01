const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = process.env.PORT || 10000;

const mcp = spawn('node', [path.join(__dirname, 'dist/index.js')], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env }
});

let mcpBuffer = '';

mcp.stdout.on('data', (data) => {
  mcpBuffer += data.toString();
});

mcp.stderr.on('data', (data) => {
  process.stderr.write(data);
});

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  const url = new URL(req.url || '/', 'http://localhost:' + PORT);
  
  if (url.pathname === '/health' || url.pathname === '/') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({status: 'ok', service: 'steel-mcp-server'}));
    return;
  }
  
  if (url.pathname === '/sse') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    
    res.write('event: endpoint\ndata: /messages\n\n');
    
    const onData = (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          try { JSON.parse(line); res.write('data: ' + line + '\n\n'); } catch(e) {}
        }
      }
    };
    
    mcp.stdout.on('data', onData);
    
    req.on('close', () => {
      mcp.stdout.removeListener('data', onData);
    });
    
    const keepAlive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 15000);
    
    req.on('close', () => clearInterval(keepAlive));
    return;
  }
  
  if (url.pathname === '/messages' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      mcp.stdin.write(body + '\n');
      res.writeHead(202);
      res.end('accepted');
    });
    return;
  }
  
  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.error('Steel MCP Server (SSE) on port', PORT);
});
