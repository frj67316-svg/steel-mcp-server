import { spawn } from 'child_process';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 10000;

const distPath = path.join(__dirname, 'dist', 'index.js');

// Start the actual MCP server as a child process
const mcp = spawn('node', [distPath], {
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

mcp.on('error', (err) => {
  console.error('MCP process error: ' + err.message);
});

mcp.on('exit', (code, signal) => {
  console.log('MCP process exited with code ' + code + ', signal ' + signal);
});

// Create HTTP server for SSE transport
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, 'http://localhost:' + PORT);
  const pathname = url.pathname;

  console.log(new Date().toISOString() + ' ' + req.method + ' ' + pathname);

  // Root endpoint
  if (pathname === '/' || pathname === '') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'steel-mcp-server', endpoints: ['/health', '/sse', '/messages'], timestamp: new Date().toISOString() }));
    return;
  }

  // Health check endpoint (for Render)
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  // SSE endpoint for MCP
  if (pathname === '/sse') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    res.write('data: ' + JSON.stringify({ type: 'connected', transport: 'sse' }) + '\n\n');

    const interval = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 30000);

    req.on('close', () => {
      clearInterval(interval);
    });
    return;
  }

  // POST endpoint for MCP messages
  if (pathname === '/messages' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const msg = JSON.parse(body);
        console.log('MCP message received: ' + JSON.stringify(msg).substring(0, 100));
        // Forward to MCP process stdin (MCP stdio protocol)
        mcp.stdin.write(JSON.stringify(msg) + '\n');
        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'accepted' }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // Default: 404
  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Health server listening on port ' + PORT);
});
