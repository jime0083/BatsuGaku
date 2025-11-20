import crypto from 'crypto';

// アクセストークン暗号化方式
// - アルゴリズム: AES-256-GCM
// - キー: 環境変数 SECRET_ENCRYPTION_KEY (32バイトのランダム値を Base64 などで保存)

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96bit

function getKey(): Buffer {
  const key = process.env.SECRET_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('SECRET_ENCRYPTION_KEY is not set');
  }
  const buf = Buffer.from(key, 'base64');
  if (buf.length !== 32) {
    throw new Error('SECRET_ENCRYPTION_KEY must be 32 bytes (Base64 encoded)');
  }
  return buf;
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decrypt(payload: string): string {
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + 16);
  const encrypted = buf.subarray(IV_LENGTH + 16);

  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}


