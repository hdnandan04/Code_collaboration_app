import dotenv from 'dotenv';
dotenv.config(); // <-- Correctly at the top
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { setupSocketHandlers } from './socket/handlers';
import executeRouter from './routes/execute';
import authRouter from './routes/auth';
import projectRouter from './routes/projects';
import aiRouter from './routes/ai';
import invitationRouter from './routes/invitations'; // <-- 1. ADD THIS IMPORT

// --- 1. DEFINE YOUR STATIC ALLOWED LIST ---
const allowedOrigins = [
  'http://localhost:8080',
  process.env.CORS_ORIGIN, 
];

// --- 2. CREATE THE DYNAMIC CORS OPTIONS ---
const corsOptions: cors.CorsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    if (!origin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    if (origin.startsWith('http://192.168.1.')) {
      return callback(null, true);
    }
    
    callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
};

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: corsOptions,
  transports: ['websocket', 'polling'],
});

// --- 4. APPLY CORS OPTIONS TO EXPRESS ---
app.use(cors(corsOptions));
app.use(express.json());

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI || 'mongodb://localhost:27017/chatapp')
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/projects', projectRouter);
app.use('/api/execute', executeRouter);
app.use('/api/ai', aiRouter);
app.use('/api/invitations', invitationRouter); // <-- 2. ADD THIS LINE

app.get('/health', (req: express.Request, res: express.Response) => { // <-- ADDED TYPES
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- SOCKET.IO AUTH MIDDLEWARE ---
interface SocketJwtPayload {
  id: string;
  username: string;
}

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication error: No token provided.'));
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET!
    ) as SocketJwtPayload;

    socket.data.user = {
      id: decoded.id,
      username: decoded.username,
    };

    next();
  } catch (err) {
    console.error('Socket authentication error:', (err as Error).message);
    return next(new Error('Authentication error: Invalid token.'));
  }
});

// Socket.IO setup
setupSocketHandlers(io);

// Start server
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.IO ready for connections`);
});

export { io };
