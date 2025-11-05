import mongoose, { Schema, Document } from 'mongoose';

// The interface represents the document in code, 
// but the Schema defines what's in the DB.
export interface IUser extends Document {
  username: string;
  email: string;
  passwordHash: string; // This was 'password'
}

const UserSchema = new Schema({
  username: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, unique: true },
  
  // --- THIS IS THE FIX ---
  // Change 'password' to 'passwordHash' to match your auth.ts
  // Add 'select: false' to hide it from queries (security best practice)
  passwordHash: { 
    type: String, 
    required: true,
    select: false // This hides it from .find() queries
  },
  // --- END OF FIX ---
  
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<IUser>('User', UserSchema);