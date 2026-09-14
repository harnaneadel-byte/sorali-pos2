import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { supabase } from '../supabase_service.js';

// ⚠️ CRITICAL: Keep this global Express Request augmentation.
// It tells TypeScript that req.user exists on every request, preventing
// red errors in routes.ts when it accesses req.user?.company_id, etc.
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        company_id: string;
        role: string;
        name?: string;
        [key: string]: any;
      };
    }
  }
}

// ⚠️ For production, set JWT_SECRET in your .env file
const SECRET = process.env.JWT_SECRET || 'solari-pos-secret-CHANGE-ME';
const SHIFT_TTL_MS = 12 * 60 * 60 * 1000; // 12-hour shift

// Creates a signed session token (no external JWT library needed)
export function createToken(user: any) {
  const payload = {
    id: user.id,
    company_id: user.company_id,
    role: user.role,
    name: user.full_name || user.name, // DB column is full_name, fallback to name
    exp: Date.now() + SHIFT_TTL_MS,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

// Verifies a token. Returns the payload, or null if invalid/expired.
export function verifyToken(token: string | null | undefined): any {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// Express middleware — protects routes, attaches req.user
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const user = verifyToken(token);
  if (!user) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Session expirée. Veuillez vous reconnecter.' },
    });
  }
  req.user = user;
  next();
}