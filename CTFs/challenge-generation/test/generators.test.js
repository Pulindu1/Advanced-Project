// Contract tests for the per-CTF flag generators. Locks the
// HMAC-determinism + salt-sensitivity + normalization properties that
// the trial harness depends on to produce reproducible, per-user flags.

const crypto = require('crypto');

const basic1 = require('../generators/basic1_generator');
const ctf2 = require('../generators/ctf2_generator');
const ctf7 = require('../generators/ctf7_generator');
const ctf8 = require('../generators/ctf8_generator');
const ctf9 = require('../generators/ctf9_generator');
const ctf3 = require('../generators/ctf3_generator');
const ctf5 = require('../generators/ctf5_generator');
const ctf6 = require('../generators/ctf6_generator');

const SINGLE_TOKEN_GENERATORS = [
  ['basic1', basic1, 16],
  ['ctf2', ctf2, 20],
  ['ctf7', ctf7, 16],
];

const MULTI_TOKEN_GENERATORS = [
  ['ctf8', ctf8, ['flag1', 'flag2', 'flag3'], 16],
  ['ctf9', ctf9, ['flag1', 'flag2', 'flag3', 'flag4', 'flag5', 'flag6'], 16],
];

describe('single-token generators (basic1 / ctf2 / ctf7)', () => {
  describe.each(SINGLE_TOKEN_GENERATORS)('%s', (_name, gen, defaultLen) => {
    test('deterministic: same input -> same output', () => {
      const a = gen('abcd12', { salt: 'fixed-salt' });
      const b = gen('abcd12', { salt: 'fixed-salt' });
      expect(a).toBe(b);
    });

    test('different usernames produce different tokens', () => {
      const a = gen('abcd12', { salt: 'fixed-salt' });
      const b = gen('efgh34', { salt: 'fixed-salt' });
      expect(a).not.toBe(b);
    });

    test('different salts produce different tokens', () => {
      const a = gen('abcd12', { salt: 'salt-a' });
      const b = gen('abcd12', { salt: 'salt-b' });
      expect(a).not.toBe(b);
    });

    test('default tokenLength emits hex of expected length', () => {
      const t = gen('abcd12', { salt: 'fixed-salt' });
      expect(t).toHaveLength(defaultLen);
      expect(t).toMatch(/^[0-9a-f]+$/);
    });

    test('tokenLength option is honored', () => {
      const t = gen('abcd12', { salt: 'fixed-salt', tokenLength: 24 });
      expect(t).toHaveLength(24);
    });

    test('default salt yields a stable output when options omitted', () => {
      const a = gen('abcd12');
      const b = gen('abcd12');
      expect(a).toBe(b);
      expect(a).toHaveLength(defaultLen);
    });
  });
});

describe('multi-token generators (ctf8 / ctf9)', () => {
  describe.each(MULTI_TOKEN_GENERATORS)('%s', (_name, gen, keys, defaultLen) => {
    test('returns expected flag keys', () => {
      const out = gen('abcd12', { salt: 'fixed-salt' });
      expect(Object.keys(out).sort()).toEqual([...keys].sort());
    });

    test('all per-flag tokens are distinct for the same user', () => {
      const out = gen('abcd12', { salt: 'fixed-salt' });
      const values = keys.map((k) => out[k]);
      expect(new Set(values).size).toBe(values.length);
    });

    test('determinism holds across all flags', () => {
      const a = gen('abcd12', { salt: 'fixed-salt' });
      const b = gen('abcd12', { salt: 'fixed-salt' });
      expect(a).toEqual(b);
    });

    test('salt change perturbs every flag', () => {
      const a = gen('abcd12', { salt: 'salt-a' });
      const b = gen('abcd12', { salt: 'salt-b' });
      for (const k of keys) {
        expect(a[k]).not.toBe(b[k]);
      }
    });

    test('tokenLength is honored for every flag', () => {
      const out = gen('abcd12', { salt: 'fixed-salt', tokenLength: 20 });
      for (const k of keys) {
        expect(out[k]).toHaveLength(20);
        expect(out[k]).toMatch(/^[0-9a-f]+$/);
      }
    });

    test('default output has the expected length for every flag', () => {
      const out = gen('abcd12');
      for (const k of keys) {
        expect(out[k]).toHaveLength(defaultLen);
      }
    });
  });
});

describe('ctf5 generator (NovaCMS SSTI)', () => {
  const FORMAT = /^durham-cms-flag\d\{[0-9a-f]{20}_[a-z0-9_.-]+\}$/;

  test('generateFlag is deterministic per (username, flagNum, salt)', () => {
    const a = ctf5.generateFlag('abcd12', 1, { salt: 's' });
    const b = ctf5.generateFlag('abcd12', 1, { salt: 's' });
    expect(a).toBe(b);
  });

  test('generateFlag emits the per-user flag format', () => {
    const f = ctf5.generateFlag('abcd12', 3, { salt: 's' });
    expect(f).toMatch(FORMAT);
    expect(f).toContain('flag3');
    expect(f.endsWith('_abcd12}')).toBe(true);
  });

  test('flag1..flag4 tokens are all distinct for the same user', () => {
    const all = ctf5.generateUserFlags('abcd12', { salt: 's' });
    const tokens = [all.flag1, all.flag2, all.flag3, all.flag4];
    expect(new Set(tokens).size).toBe(4);
  });

  test('username is normalized (case + whitespace)', () => {
    const lower = ctf5.generateFlag('abcd12', 1, { salt: 's' });
    const messy = ctf5.generateFlag('  ABCD12  ', 1, { salt: 's' });
    expect(messy).toBe(lower);
  });

  test('generateFlags skips empty usernames and keys by normalized name', () => {
    const out = ctf5.generateFlags(['Abcd12', '  ', ''], { salt: 's' });
    expect(Object.keys(out)).toEqual(['abcd12']);
  });

  test('different base salts produce different flags', () => {
    const a = ctf5.generateFlag('abcd12', 1, { salt: 'one' });
    const b = ctf5.generateFlag('abcd12', 1, { salt: 'two' });
    expect(a).not.toBe(b);
  });

  test('generateCredentials produces non-empty passwords per user', () => {
    const creds = ctf5.generateCredentials(['abcd12', 'efgh34']);
    expect(creds.abcd12.password.length).toBeGreaterThanOrEqual(8);
    expect(creds.efgh34.role).toBe('editor');
  });
});

describe('ctf6 generator (Veridian SSRF)', () => {
  const FORMAT = /^durham-vsec-flag\d\{[0-9a-f]{20}_[a-z0-9_.-]+\}$/;

  test('generateFlag is deterministic and normalized', () => {
    const a = ctf6.generateFlag('ABCD12', 2, { salt: 's' });
    const b = ctf6.generateFlag('abcd12', 2, { salt: 's' });
    expect(a).toBe(b);
    expect(a).toMatch(FORMAT);
  });

  test('generateBootstrapScript embeds flag2 in the user-data comment', () => {
    const flag2 = ctf6.generateFlag('abcd12', 2, { salt: 's' });
    const script = ctf6.generateBootstrapScript('abcd12', { salt: 's' });
    expect(script).toContain(flag2);
  });

  test('flags 1..4 all distinct for the same user', () => {
    const all = ctf6.generateUserFlags('abcd12', { salt: 's' });
    expect(new Set(Object.values(all)).size).toBe(4);
  });

  test('generateCredentials emits password + analyst role', () => {
    const creds = ctf6.generateCredentials(['abcd12']);
    expect(creds.abcd12.role).toBe('analyst');
    expect(creds.abcd12.password.length).toBeGreaterThanOrEqual(8);
  });
});

describe('ctf3 generator (HR system)', () => {
  const FORMAT = /^durham-hr\{[0-9a-f]{20}_[a-z0-9_.-]+\}$/;

  test('generateUserFlags emits both api and decrypt flags, distinct', () => {
    const { flag_api, flag_decrypt } = ctf3.generateUserFlags('abcd12', { salt: 's' });
    expect(flag_api).toMatch(FORMAT);
    expect(flag_decrypt).toMatch(FORMAT);
    expect(flag_api).not.toBe(flag_decrypt);
  });

  test('username case/whitespace normalized', () => {
    const a = ctf3.generateUserFlags('  ABCD12  ', { salt: 's' });
    const b = ctf3.generateUserFlags('abcd12', { salt: 's' });
    expect(a).toEqual(b);
  });

  test('different salts yield different flag pairs', () => {
    const a = ctf3.generateUserFlags('abcd12', { salt: 'one' });
    const b = ctf3.generateUserFlags('abcd12', { salt: 'two' });
    expect(a.flag_api).not.toBe(b.flag_api);
    expect(a.flag_decrypt).not.toBe(b.flag_decrypt);
  });

  test('encryptFlag emits iv:ciphertext base64 and round-trips back to plaintext', () => {
    const plaintext = 'durham-hr{decrypt-me_abcd12}';
    const encoded = ctf3.encryptFlag(plaintext);
    expect(encoded).toMatch(/^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);

    const [ivB64, ctB64] = encoded.split(':');
    const iv = Buffer.from(ivB64, 'base64');
    const ct = Buffer.from(ctB64, 'base64');
    expect(iv).toHaveLength(16);

    const key = crypto.createHash('sha256')
      .update('CTF_2026_SECRET_KEY_XJ9K2L').digest();
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    const decrypted = Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
    expect(decrypted).toBe(plaintext);
  });
});
