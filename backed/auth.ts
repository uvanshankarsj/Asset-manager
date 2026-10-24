import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Router, Request, Response, NextFunction } from 'express';

declare global {
  // Extending Express's Request type can only be done through its namespace
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

// Set JWT_SECRET in .env so logins survive a server restart.
// Without it a random secret is used and everyone is logged out on restart.
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.JWT_SECRET) {
  console.warn('JWT_SECRET is not set in backed/.env. Logins will reset whenever the server restarts.');
}
const TOKEN_TTL = '7d';

const authUserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  avatar: { type: String }, // small image stored as a data URL, so it follows the account
  createdAt: { type: Date, default: Date.now },
});
const AuthUser = mongoose.models.AuthUser || mongoose.model('AuthUser', authUserSchema);

const publicUser = (u: { _id: unknown; name: string; email: string; avatar?: string | null }) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  avatar: u.avatar ?? null,
});
const signToken = (id: unknown) => jwt.sign({ sub: String(id) }, JWT_SECRET, { expiresIn: TOKEN_TTL });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const authRouter = Router();

authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body ?? {};
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
    }
    if (!EMAIL_RE.test(String(email))) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }
    if (await AuthUser.findOne({ email: String(email).toLowerCase().trim() })) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }
    const passwordHash = await bcrypt.hash(String(password), 10);
    const user = await AuthUser.create({ name, email, passwordHash });
    return res.status(201).json({ success: true, token: signToken(user._id), user: publicUser(user) });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ success: false, message: 'Server error while creating account.' });
  }
});

authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }
    const user = await AuthUser.findOne({ email: String(email).toLowerCase().trim() });
    // Same message for unknown email and wrong password so emails can't be probed
    if (!user || !(await bcrypt.compare(String(password), user.passwordHash))) {
      return res.status(401).json({ success: false, message: 'Incorrect email or password.' });
    }
    return res.json({ success: true, token: signToken(user._id), user: publicUser(user) });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ success: false, message: 'Server error while logging in.' });
  }
});

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  try {
    const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    req.userId = payload.sub;
    return next();
  } catch {
    return res.status(401).json({ success: false, message: 'Please log in.' });
  }
}

authRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  const user = await AuthUser.findById(req.userId);
  if (!user) return res.status(401).json({ success: false, message: 'Please log in.' });
  return res.json({ user: publicUser(user) });
});

// The browser shrinks the picture to a small JPEG before sending it, so this only has to guard against abuse
const AVATAR_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_AVATAR_CHARS = 200_000;

authRouter.put('/avatar', requireAuth, async (req: Request, res: Response) => {
  const { avatar } = req.body ?? {};
  if (typeof avatar !== 'string' || avatar.length > MAX_AVATAR_CHARS || !AVATAR_RE.test(avatar)) {
    return res.status(400).json({ success: false, message: 'Choose a JPEG, PNG or WebP image.' });
  }
  const user = await AuthUser.findByIdAndUpdate(req.userId, { avatar }, { new: true });
  if (!user) return res.status(401).json({ success: false, message: 'Please log in.' });
  return res.json({ user: publicUser(user) });
});

authRouter.delete('/avatar', requireAuth, async (req: Request, res: Response) => {
  const user = await AuthUser.findByIdAndUpdate(req.userId, { $unset: { avatar: 1 } }, { new: true });
  if (!user) return res.status(401).json({ success: false, message: 'Please log in.' });
  return res.json({ user: publicUser(user) });
});
