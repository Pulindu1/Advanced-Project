import crypto from 'crypto';

const FLAG_SECRET = process.env.FLAG_SECRET || 'default_secret_change_this';
const FLAG_PREFIX = process.env.CTF_FLAG_PREFIX || 'CTF{';
const FLAG_SUFFIX = process.env.CTF_FLAG_SUFFIX || '}';

/**
 * Compute a unique flag for a user based on their ID
 * Uses HMAC-SHA256 to derive a deterministic flag
 */
export function computeFlag(userId: number): string {
  const hmac = crypto.createHmac('sha256', FLAG_SECRET);
  hmac.update(`user_${userId}`);
  const hash = hmac.digest('hex').substring(0, 32).toUpperCase();
  return `${FLAG_PREFIX}${hash}${FLAG_SUFFIX}`;
}

/**
 * Verify a flag for a given user
 */
export function verifyFlag(userId: number, flag: string): boolean {
  return computeFlag(userId) === flag;
}
