import mongoose, { Schema, Document } from 'mongoose';

export interface IRoom extends Document {
  roomId: string;
  participants: Array<{
    socketId: string;
    username: string;
    color: string;
    joinedAt: Date;
  }>;
  currentCode: string;
  language: string;
  version: number;
  createdAt: Date;
  lastActivity: Date;
}

const RoomSchema = new Schema({
  roomId: { type: String, required: true, unique: true, index: true },
  participants: [
    {
      socketId: String,
      username: String,
      color: String,
      joinedAt: { type: Date, default: Date.now },
    },
  ],
  currentCode: { type: String, default: '// Start coding together!' },
  language: { type: String, default: 'javascript' },
  version: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  lastActivity: { type: Date, default: Date.now },
});

// Auto-delete rooms after 24 hours of inactivity
RoomSchema.index({ lastActivity: 1 }, { expireAfterSeconds: 86400 });

export default mongoose.model<IRoom>('Room', RoomSchema);
