// server.ts
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { registerRoutes } from './server/routes.js';
import { initializeRealtime } from './server/realtime.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  path: '/ws',
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE']
  }
});

// 1. Register backend API routes
registerRoutes(app);

// 2. Initialize real-time updates
initializeRealtime(io);

// 3. Serve frontend static files
const publicPath = path.join(__dirname, 'dist');
app.use(express.static(publicPath));

app.get('*', (_req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// 4. Start server
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log('Sorali Distribution frontend and backend active.');
});