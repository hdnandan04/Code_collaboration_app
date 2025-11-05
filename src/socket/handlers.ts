import { Server, Socket } from 'socket.io';
import Room from '../models/Room';
import Message from '../models/Message';
import Snapshot from '../models/Snapshot';

const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'];

interface AuthenticatedSocket extends Socket {
  data: {
    user: {
      id: string;
      username: string;
    };
  };
}

export const setupSocketHandlers = (io: Server) => {
  io.on('connection', async (socket: AuthenticatedSocket) => {
    const { roomId } = socket.handshake.query as { roomId: string };
    
    if (!socket.data.user) {
      console.error('❌ Socket connected without user data. Disconnecting.');
      socket.disconnect();
      return;
    }
    
    const { username, id: userId } = socket.data.user;
    
    if (!roomId) {
      console.log('❌ Missing roomId');
      socket.disconnect();
      return;
    }
    
    console.log(`👤 User ${username} (ID: ${userId}) connecting to room ${roomId}`);

    try {
      await socket.join(roomId);

      let room = await Room.findOne({ roomId });
      
      const userColor = COLORS[Math.floor(Math.random() * COLORS.length)];
      const participant = {
        socketId: socket.id,
        username,
        color: userColor,
        joinedAt: new Date(),
      };

      if (!room) {
        room = await Room.create({
          roomId,
          participants: [participant],
          currentCode: '// Start coding together!',
          language: 'javascript',
          version: 0,
        });
        console.log(`✅ Created new room: ${roomId}`);
      } else {
        // This logic is correct: Remove old, add new
        room.participants = room.participants.filter(p => p.username !== username);
        room.participants.push(participant);
        room.lastActivity = new Date();
        await room.save();
        console.log(`✅ User ${username} joined existing room: ${roomId}`);
      }

      // Send current state to new user
      socket.emit('code-snapshot', room.currentCode);
      socket.emit('language-update', room.language);
      
      const messages = await Message.find({ roomId })
        .sort({ timestamp: 1 })
        .limit(100);
      socket.emit('chat-history', messages);

      // ---
      // --- ⬇️ BUG FIX ⬇️ ---
      // ---
      // Instead of sending 'user-joined', send the *entire new list*
      // to *everyone* in the room. This stops duplicates.
      const participantsList = room.participants.map((p) => ({
        id: p.socketId,
        username: p.username,
        color: p.color,
      }));

      io.to(roomId).emit('room-joined', { participants: participantsList });
      // ---
      // --- ⬆️ BUG FIX ⬆️ ---
      // ---

      console.log(`📋 Participants in ${roomId}:`, participantsList.map(p => p.username).join(', '));

      // Handle code changes
      socket.on('code-change', async (data: { roomId: string; code: string }) => {
        try {
          const room = await Room.findOne({ roomId: data.roomId });
          if (room) {
            room.currentCode = data.code;
            room.version += 1;
            room.lastActivity = new Date();
            await room.save();
            socket.to(data.roomId).emit('code-update', data.code);
          }
        } catch (error) {
          console.error('Error updating code:', error);
        }
      });

      // Handle language change
      socket.on('language-change', async (data: { roomId: string; language: string }) => {
        try {
          const room = await Room.findOne({ roomId: data.roomId });
          if (room) {
            room.language = data.language;
            room.lastActivity = new Date();
            await room.save();
            socket.to(data.roomId).emit('language-update', data.language);
          }
        } catch (error) {
          console.error('Error updating language:', error);
        }
      });

      // Handle chat messages
      socket.on('chat-message', async (data: { roomId: string; message: any }) => {
        try {
          const message = await Message.create({
            roomId: data.roomId,
            username: socket.data.user.username,
            text: data.message.text,
            timestamp: new Date(data.message.timestamp),
          });
          io.to(data.roomId).emit('chat-message', message);
          console.log(`💬 Chat message in ${data.roomId} from ${socket.data.user.username}`);
        } catch (error) {
          console.error('Error saving message:', error);
        }
      });

      // Handle cursor positions
      socket.on('cursor-position', (data: { roomId: string; position: any }) => {
        socket.to(data.roomId).emit('cursor-update', {
          userId: socket.id,
          username,
          position: data.position,
        });
      });

      // Handle snapshot requests
      socket.on('request-snapshot', async (data: { roomId: string }) => {
        try {
          const room = await Room.findOne({ roomId: data.roomId });
          if (room) {
            await Snapshot.create({
              roomId: data.roomId,
              code: room.currentCode,
              language: room.language,
              version: room.version,
              createdBy: socket.data.user.username,
            });
            socket.emit('snapshot-saved', { success: true });
          }
        } catch (error) {
          console.error('Error saving snapshot:', error);
          socket.emit('snapshot-saved', { success: false, error: (error as Error).message });
        }
      });

      // Handle disconnection
      socket.on('disconnect', async () => {
        console.log(`👋 User ${username} disconnected from room ${roomId}`);
        
        if (!roomId) { 
          console.error('User disconnected with no roomId.');
          return; 
        }

        try {
          const room = await Room.findOne({ roomId });
          if (room) {
            room.participants = room.participants.filter(
              (p) => p.socketId !== socket.id
            );
            await room.save(); // Don't delete, just save

            if (room.participants.length === 0) {
              console.log(`🗑️  Room ${roomId} is now empty (but not deleted)`);
            }

            // ---
            // --- ⬇️ BUG FIX ⬇️ ---
            // ---
            // Send the new, smaller list to everyone still in the room
            const participantsList = room.participants.map((p) => ({
              id: p.socketId,
              username: p.username,
              color: p.color,
            }));
            io.to(roomId).emit('room-joined', { participants: participantsList });
            // ---
            // --- ⬆️ BUG FIX ⬆️ ---
            // ---
          }
        } catch (error) {
          console.error('Error handling disconnect:', error);
        }
      });
    } catch (error) {
      console.error('Error in socket connection:', error);
      socket.disconnect();
    }
  });
};