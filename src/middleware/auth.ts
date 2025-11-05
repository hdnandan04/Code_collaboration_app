import { Request, Response, NextFunction } from 'express'; // <-- Added Request, Response from express
import jwt from 'jsonwebtoken';

// --- ⬇️ FIX: Extend express.Request to inherit all properties (like header, body, params) ⬇️ ---
export interface AuthRequest extends Request {
  user?: { id: string };
}
// --- ⬆️ FIX: Extend express.Request ⬆️ ---

const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  // req.header is now safely inherited from express.Request
  const authHeader = req.header('Authorization'); 

  if (!authHeader) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Token is not valid' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; username: string };
    
    // Add the user's ID to the request object
    req.user = { id: decoded.id };
    
    next(); 
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

export default authMiddleware;
