import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User';

const router = Router();

// --- SIGNUP ROUTE ---
router.post('/register', async (req: Request, res: Response) => {
  const { username, email, password } = req.body;
  try {
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    let user = await User.findOne({ username });
    if (user) {
      return res.status(400).json({ message: 'Username already exists' });
    }
    user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({
      username,
      email,
      passwordHash: hashedPassword,
    });

    await user.save(); // This will now save the password

    // --- ⬇️ THIS IS THE FIX ⬇️ ---
    // We must include all necessary user info in the token payload
    const token = jwt.sign(
      { id: user._id, username: user.username }, // <-- CHANGED
      process.env.JWT_SECRET as string,
      { expiresIn: '1d' }
    );
    // --- ⬆️ END OF FIX ⬆️ ---

    res.status(201).json({ token, username: user.username });
  } catch (error) {
    console.error('REGISTRATION ERROR:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// --- LOGIN ROUTE ---
router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  try {
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const user = await User.findOne({ username }).select('+passwordHash');

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const passwordFromDb = (user as any).get('passwordHash');

    if (!passwordFromDb) {
      return res.status(400).json({ message: 'Invalid credentials (user has no password)' });
    }

    const isMatch = await bcrypt.compare(password, passwordFromDb);

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // --- ⬇️ THIS IS THE FIX ⬇️ ---
    // We must include all necessary user info in the token payload
    const token = jwt.sign(
      { id: user._id, username: user.username }, // <-- CHANGED
      process.env.JWT_SECRET as string,
      { expiresIn: '1d' }
    );
    // --- ⬆️ END OF FIX ⬆️ ---

    res.status(200).json({ token, username: user.username });

  } catch (error) {
    console.error('LOGIN ERROR:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

export default router;