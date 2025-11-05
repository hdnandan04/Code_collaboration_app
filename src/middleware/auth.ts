import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: { id: string }; // This stays the same
}

const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.header('Authorization');

  if (!authHeader) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Token is not valid' });
  }

  try {
    // --- ⬇️ THIS IS THE FIX ⬇️ ---
    // We are now verifying the NEW token structure
    // It has 'id', not 'userId'
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; username: string };
    
    // Add the user's ID to the request object
    req.user = { id: decoded.id }; // <-- Read from decoded.id
    // --- ⬆️ END OF FIX ⬆️ ---
    
    next(); 
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

export default authMiddleware;