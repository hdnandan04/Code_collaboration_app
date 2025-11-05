import mongoose, { Schema, Document, Types } from 'mongoose';

// Interface for a single file or folder in the project
export interface IFile {
  _id: Types.ObjectId;
  name: string;
  type: 'file' | 'folder';
  content?: string; // Only for files
  children?: IFile[]; // Only for folders
}

// Mongoose Schema for IFile (recursive)
const FileSchema = new Schema<IFile>();
FileSchema.add({
  name: { type: String, required: true },
  type: { type: String, enum: ['file', 'folder'], required: true },
  content: { type: String },
  children: [FileSchema], // Recursive definition for folders
});

export interface IProject extends Document {
  name: string;
  owner: Types.ObjectId; // Link to the User model
  members: Types.ObjectId[]; // List of users who have access
  fileTree: IFile[]; // The entire file system structure
  createdAt: Date;
  lastModified: Date;
}

const ProjectSchema = new Schema<IProject>({
  name: { type: String, required: true },
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  fileTree: [FileSchema],
  createdAt: { type: Date, default: Date.now },
  lastModified: { type: Date, default: Date.now },
});

// Create a default file when a new project is created
ProjectSchema.pre('save', function (next) {
  if (this.isNew && this.fileTree.length === 0) {
    this.fileTree.push({
      _id: new mongoose.Types.ObjectId(),
      name: 'main.js',
      type: 'file',
      content: "// Welcome to your new CodeCollab project!\nconsole.log('Hello, World!');\n",
    });
  }
  next();
});

export default mongoose.model<IProject>('Project', ProjectSchema);