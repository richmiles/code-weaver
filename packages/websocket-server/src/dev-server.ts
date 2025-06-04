#!/usr/bin/env node
// packages/websocket-server/src/dev-server.ts
import { WebSocketServer } from './websocketServer.js';

// Configuration for development server
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8180;
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || process.cwd();

// Create and start the server
const server = new WebSocketServer({
  port: PORT,
  enableLogging: true,
  workspaceRoot: WORKSPACE_ROOT
});

server.start();

console.log(`CodeWeaver WebSocket Server started on port ${PORT}`);
console.log(`Workspace root: ${WORKSPACE_ROOT}`);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down server...');
  server.stop();
  process.exit(0);
});