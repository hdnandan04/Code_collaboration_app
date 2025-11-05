import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage extends Document {
  roomId: string;
  username: string;
  text: string;
  timestamp: Date;
}

const MessageSchema = new Schema({
  roomId: { type: String, required: true, index: true },
  username: { type: String, required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

// Delete messages older than 7 days
MessageSchema.index({ timestamp: 1 }, { expireAfterSeconds: 604800 });

export default mongoose.model<IMessage>('Message', MessageSchema);