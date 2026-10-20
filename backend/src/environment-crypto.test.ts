import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decryptEnvironmentValue, encryptEnvironmentValue, isEncryptedEnvironmentValue } from './environment-crypto.js';

process.env.ENVIRONMENT_ENCRYPTION_KEY = '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';

test('environment values encrypt at rest and decrypt to the original value', () => {
  const plaintext = 'database-password-or-api-token';
  const encrypted = encryptEnvironmentValue(plaintext);
  assert.notEqual(encrypted, plaintext);
  assert.equal(isEncryptedEnvironmentValue(encrypted), true);
  assert.equal(decryptEnvironmentValue(encrypted), plaintext);
});

test('environment encryption uses a fresh nonce and rejects modified ciphertext', () => {
  const first = encryptEnvironmentValue('same value');
  const second = encryptEnvironmentValue('same value');
  assert.notEqual(first, second);
  const parts = first.split(':');
  parts[3] = `${parts[3]![0] === 'A' ? 'B' : 'A'}${parts[3]!.slice(1)}`;
  assert.throws(() => decryptEnvironmentValue(parts.join(':')));
});
