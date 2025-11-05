import { Router } from 'express';
import Project from '../models/Project';
import authMiddleware, { AuthRequest } from '../middleware/auth';
import { Types } from 'mongoose';
import User from '../models/User';
import Room from '../models/Room'; 
import Message from '../models/Message'; 
import Snapshot from '../models/Snapshot';
import Invitation from '../models/Invitation'; // <-- 1. IMPORT THE NEW MODEL

const router = Router();

// ---
// 1. GET /api/projects
// ---
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = new Types.ObjectId(req.user!.id);
    
    const projects = await Project.find({
      $or: [
        { owner: userId },
        { members: userId }
      ]
    })
    .populate('owner', 'username email') 
    .populate('members', 'username email') 
    .sort({ lastModified: -1 });

    res.json(projects);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error while fetching projects' });
  }
});

// ---
// 2. POST /api/projects
// ---
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ message: 'Project name is required' });
  }

  try {
    const userId = new Types.ObjectId(req.user!.id);

    const newProject = new Project({
      name,
      owner: userId,
      members: [userId], 
    });

    await newProject.save();
    
    const project = await Project.findById(newProject._id).populate('owner', 'username email');
    
    res.status(201).json(project);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error while creating project' });
  }
});

// ---
// 3. GET /api/projects/:id
// ---
router.get('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = new Types.ObjectId(req.user!.id);
    const projectId = req.params.id;

    if (!Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }

    const project = await Project.findById(projectId)
      .populate('owner', 'username email')
      .populate('members', 'username email');

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const isOwner = project.owner._id.equals(userId);
    const isMember = project.members.some(member => (member as any)._id.equals(userId));

    if (!isOwner && !isMember) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(project);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---
// 4. POST /api/projects/:projectId/invite  (LOGIC CHANGED)
// Creates a new 'pending' invitation
// ---
router.post('/:projectId/invite', authMiddleware, async (req: AuthRequest, res) => {
  const { emailOrUsername } = req.body;
  const { projectId } = req.params;
  const inviterId = new Types.ObjectId(req.user!.id);

  try {
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (!project.owner.equals(inviterId)) {
      return res.status(403).json({ message: 'Only the project owner can invite members' });
    }

    const userToInvite = await User.findOne({
      $or: [{ email: emailOrUsername }, { username: emailOrUsername }],
    });

    if (!userToInvite) {
      return res.status(404).json({ message: `User '${emailOrUsername}' not found` });
    }

    // Check if user is the owner (can't invite yourself)
    if (project.owner.equals((userToInvite as any)._id)) {
      return res.status(400).json({ message: 'You cannot invite the project owner' });
    }

    // Check if user is *already* a member
    const isAlreadyMember = project.members.some(memberId =>
      memberId.equals((userToInvite as any)._id) 
    );
    if (isAlreadyMember) {
      return res.status(400).json({ message: 'User is already a member of this project' });
    }
    
    // --- ⬇️ NEW LOGIC ⬇️ ---
    // Check if a pending invitation *already* exists
    const existingInvite = await Invitation.findOne({
      project: project._id,
      invitee: (userToInvite as any)._id,
      status: 'pending',
    });

    if (existingInvite) {
      return res.status(400).json({ message: 'This user already has a pending invitation' });
    }

    // Create the new invitation
    const newInvitation = new Invitation({
      project: project._id,
      inviter: inviterId,
      invitee: (userToInvite as any)._id,
      status: 'pending',
    });
    
    await newInvitation.save();
    
    // Respond with success message
    res.status(201).json({ message: 'Invitation sent successfully' });
    // --- ⬆️ NEW LOGIC ⬆️ ---

  } catch (err) {
    console.error(err);
    // Handle duplicate key error from the index
    if ((err as any).code === 11000) {
      return res.status(400).json({ message: 'This user already has a pending invitation' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});


// ---
// 5. DELETE /api/projects/:projectId
// ---
router.delete('/:projectId', authMiddleware, async (req: AuthRequest, res) => {
  const { projectId } = req.params;
  const userId = new Types.ObjectId(req.user!.id);

  try {
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (!project.owner.equals(userId)) {
      return res.status(403).json({ message: 'Access denied: Only the owner can delete this project' });
    }

    // Delete all associated data
    await Room.findOneAndDelete({ roomId: projectId });
    await Message.deleteMany({ roomId: projectId });
    await Snapshot.deleteMany({ roomId: projectId });
    await Invitation.deleteMany({ project: projectId }); // <-- ALSO DELETE PENDING INVITES
    await Project.findByIdAndDelete(projectId);

    res.json({ message: 'Project and all associated data deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error while deleting project' });
  }
});


// ---
// 6. POST /api/projects/:projectId/leave
// ---
router.post('/:projectId/leave', authMiddleware, async (req: AuthRequest, res) => {
  const { projectId } = req.params;
  const userId = new Types.ObjectId(req.user!.id);

  try {
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (project.owner.equals(userId)) {
      return res.status(400).json({ message: 'Owner cannot leave a project. You must delete it instead.' });
    }
    
    const isMember = project.members.some(memberId => memberId.equals(userId));
    if (!isMember) {
      return res.status(403).json({ message: 'You are not a member of this project' });
    }

    project.members = project.members.filter(memberId => !memberId.equals(userId));
    await project.save();

    res.json({ message: 'You have successfully left the project' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error while leaving project' });
  }
});


export default router;