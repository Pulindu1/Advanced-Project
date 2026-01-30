/**
 * Legacy Authentication System
 * ============================
 * 
 * DEPRECATED: This file contains legacy authentication utilities
 * from the old HR system (v1.x). These have been replaced with
 * JWT-based authentication in v2.0.
 * 
 * DO NOT USE IN PRODUCTION - Kept for reference only
 * 
 * Original encryption settings:
 * - Algorithm: AES-256-CBC
 * - Key: CTF_2026_SECRET_KEY_XJ9K2L
 * - IV: Random 16 bytes prepended to ciphertext
 * 
 * Migration completed: 2025-06-15
 * Migrated by: System Administrator
 */

// Legacy session handler - no longer used
export const legacySessionCheck = () => {
  console.warn('legacySessionCheck is deprecated. Use JWT tokens instead.')
  return false
}

// Old password encryption - DO NOT USE
// const encryptPassword = (password: string, key: string) => {
//   // AES-256-CBC encryption
//   // Key was: CTF_2026_SECRET_KEY_XJ9K2L
//   return 'encrypted_' + password
// }

export default {
  deprecated: true,
  migrationDate: '2025-06-15',
}
