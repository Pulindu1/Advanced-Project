// Thin Web Crypto wrapper. All sensitive crypto operations should be here.
export const cryptoService = {
  async deriveKeyFromPassword(password: string, salt: Uint8Array, iterations = 100_000) {
    const enc = new TextEncoder()
    const passKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      passKey,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    )
    return key
  },

  async encrypt(data: string, key: CryptoKey) {
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const enc = new TextEncoder()
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(data))
    return { iv: Array.from(iv), ct: Array.from(new Uint8Array(ct)) }
  },

  async decrypt(payload: { iv: number[]; ct: number[] }, key: CryptoKey) {
    const iv = new Uint8Array(payload.iv)
    const ct = new Uint8Array(payload.ct)
    const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
    return new TextDecoder().decode(dec)
  }
}
