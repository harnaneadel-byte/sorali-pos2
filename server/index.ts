import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { registerRoutes } from './routes.js';
import { initializeRealtime } from './realtime.js';

const app = express();
app.use(express.json()); // Allows the server to read JSON data

// Create the HTTP server and attach Socket.io for real-time updates
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*', // Allows your frontend to connect
    methods: ['GET', 'POST', 'PATCH', 'DELETE']
  }
});

// 1. Load all your API routes (Checkout, Products, Tasks)
registerRoutes(app);

// 2. Start the real-time database listener
initializeRealtime(io);

// 3. Start the actual server
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log('Real-time WebSockets are active.');
});