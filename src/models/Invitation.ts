import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IInvitation extends Document {
  project: Types.ObjectId; // Reference to the Project
  invitee: Types.ObjectId; // Reference to the User who received the invite
  inviter: Types.ObjectId; // Reference to the User who sent the invite
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
}

const InvitationSchema = new Schema({
  project: { 
    type: Schema.Types.ObjectId, 
    ref: 'Project', 
    required: true 
  },
  invitee: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  inviter: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['pending', 'accepted', 'rejected'], 
    default: 'pending' 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
});

// ---
// --- ⬇️ THIS IS THE FIX ⬇️ ---
// ---
// Create a unique index for pending invitations
InvitationSchema.index(
  { project: 1, invitee: 1 }, 
  { 
    unique: true, 
    // This partial index only applies to documents where 'status' is 'pending'
    partialFilterExpression: { status: 'pending' } 
  }
);
// ---
// --- ⬆️ THIS IS THE FIX ⬆️ ---
// ---

export default mongoose.model<IInvitation>('Invitation', InvitationSchema);