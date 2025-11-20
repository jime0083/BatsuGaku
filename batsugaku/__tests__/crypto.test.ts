import {encrypt, decrypt} from '../functions/src/security/crypto';

describe('encrypt/decrypt', () => {
  beforeAll(() => {
    // 32バイトのキーを Base64 で生成（テスト用）
    const key = Buffer.alloc(32, 1).toString('base64');
    process.env.SECRET_ENCRYPTION_KEY = key;
  });

  it('round-trips plaintext', () => {
    const plaintext = 'test-token-123';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });
});


