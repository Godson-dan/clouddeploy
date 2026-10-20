import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const marker = 'enc:v1:';
const keyLength = 32;

function encryptionKey(): Buffer {
  const value = process.env.ENVIRONMENT_ENCRYPTION_KEY;
  if (!value || !/^[\da-f]{64}$/i.test(value)) {
    throw new Error('ENVIRONMENT_ENCRYPTION_KEY must be set to 64 hexadecimal characters.');
  }
  return Buffer.from(value, 'hex');
}

export function assertEnvironmentEncryptionKey(): void {
  encryptionKey();
}

export function isEncryptedEnvironmentValue(value: string): boolean {
  return value.startsWith(marker);
}

export function encryptEnvironmentValue(value: string): string {
  if (isEncryptedEnvironmentValue(value)) return value;
  const key = encryptionKey();
  if (key.length !== keyLength) throw new Error('Invalid environment encryption key.');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${marker}${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

export function decryptEnvironmentValue(value: string): string {
  if (!isEncryptedEnvironmentValue(value)) return value;
  const parts = value.slice(marker.length).split(':');
  if (parts.length !== 3) throw new Error('Stored environment value has an invalid encrypted format.');
  const [encodedIv, encodedTag, encodedCiphertext] = parts;
  const iv = Buffer.from(encodedIv!, 'base64');
  const tag = Buffer.from(encodedTag!, 'base64');
  const ciphertext = Buffer.from(encodedCiphertext!, 'base64');
  if (iv.length !== 12 || tag.length !== 16) throw new Error('Stored environment value has invalid encryption metadata.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
