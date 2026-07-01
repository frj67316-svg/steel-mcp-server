#!/bin/sh
PORT=${PORT:-10000}

# Start SSE wrapper server (handles health + MCP SSE)
node /app/server.js
