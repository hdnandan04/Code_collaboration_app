import { Router } from 'express';
import authMiddleware, { AuthRequest } from '../middleware/auth';
import Invitation from '../models/Invitation';
import Project from '../models/Project';
import { Types } from 'mongoose';

const router = Router();

// ---
// 1. GET /api/invitations
// Get all pending invitations for the logged-in user
// ---
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = new Types.ObjectId(req.user!.id);

    // Find all invitations where this user is the invitee and status is pending
    const invitations = await Invitation.find({ 
      invitee: userId, 
      status: 'pending' 
    })
    .populate('project', 'name') // Get the project's name
    .populate('inviter', 'username'); // Get the inviter's username

    res.json(invitations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching invitations' });
  }
});

// ---
// 2. POST /api/invitations/:invitationId/accept
// Accept an invitation
// ---
router.post('/:invitationId/accept', authMiddleware, async (req: AuthRequest, res) => {
  const { invitationId } = req.params;
  const userId = new Types.ObjectId(req.user!.id);

  try {
    const invitation = await Invitation.findById(invitationId);

    // Check if invitation exists and is pending
    if (!invitation || invitation.status !== 'pending') {
      return res.status(404).json({ message: 'Invitation not found or already responded to' });
    }

    // Security check: Make sure the person accepting is the one invited
    if (!invitation.invitee.equals(userId)) {
      return res.status(403).json({ message: 'Access denied: You are not the invitee' });
    }

    // --- Perform the "accept" actions ---
    // 1. Add the user to the project's 'members' array
    // We use $addToSet to prevent duplicates just in case
    await Project.updateOne(
      { _id: invitation.project },
      { $addToSet: { members: userId } }
    );

    // 2. Delete the invitation, as it's now completed
    await Invitation.findByIdAndDelete(invitationId);

    res.json({ message: 'Invitation accepted and project added to your dashboard' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---
// 3. POST /api/invitations/:invitationId/reject
// Reject an invitation
// ---
router.post('/:invitationId/reject', authMiddleware, async (req: AuthRequest, res) => {
  const { invitationId } = req.params;
  const userId = new Types.ObjectId(req.user!.id);

  try {
    const invitation = await Invitation.findById(invitationId);

    // Check if invitation exists and is pending
    if (!invitation || invitation.status !== 'pending') {
      return res.status(404).json({ message: 'Invitation not found or already responded to' });
    }

    // Security check: Make sure the person rejecting is the one invited
    if (!invitation.invitee.equals(userId)) {
      return res.status(403).json({ message: 'Access denied: You are not the invitee' });
    }

    // --- Perform the "reject" action ---
    // 1. Just delete the invitation
    await Invitation.findByIdAndDelete(invitationId);

    res.json({ message: 'Invitation rejected' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;