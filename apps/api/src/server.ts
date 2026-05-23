import 'dotenv/config';

import { disconnectPrismaClient } from '@caracal/db';
import { createServer } from 'node:http';

import { createApp } from './app.js';

const port = Number.parseInt(process.env.API_PORT ?? '3001', 10);
const app = createApp();
const server = createServer(app);

server.listen(port, () => {
  console.log(`Caracal API listening on http://localhost:${port}`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`Received ${signal}; shutting down API server.`);
  server.close(async () => {
    await disconnectPrismaClient();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
