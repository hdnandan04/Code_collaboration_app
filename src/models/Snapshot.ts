import mongoose, { Schema, Document } from 'mongoose';

export interface ISnapshot extends Document {
  roomId: string;
  code: string;
  language: string;
  version: number;
  createdBy: string;
  createdAt: Date;
}

const SnapshotSchema = new Schema({
  roomId: { type: String, required: true, index: true },
  code: { type: String, required: true },
  language: { type: String, default: 'javascript' },
  version: { type: Number, required: true },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<ISnapshot>('Snapshot', SnapshotSchema);